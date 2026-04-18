const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const authMiddleware = require('../middleware/auth');

// ── EMAIL HELPER ──
async function sendEmails(booking) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.log('Email skipped — no credentials');
      return;
    }
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    const bookingDate = new Date(booking.date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Email to Admin
    await transporter.sendMail({
      from: `"Smart Wash" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_NOTIFY_EMAIL || process.env.GMAIL_USER,
      subject: `New Booking — ${booking.name} (${booking.service})`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1e6bff;padding:24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0">SMART WASH — New Booking!</h2>
        </div>
        <div style="background:#f8faff;padding:24px;border:1px solid #dde;border-radius:0 0 8px 8px">
          <p><b>Customer:</b> ${booking.name}</p>
          <p><b>Phone:</b> ${booking.phone}</p>
          <p><b>Email:</b> ${booking.email || 'Not provided'}</p>
          <p><b>Car Type:</b> ${booking.carType}</p>
          <p><b>Service:</b> ${booking.service}</p>
          <p><b>Date:</b> ${bookingDate}</p>
          <p><b>Time:</b> ${booking.time}</p>
          <p><b>Notes:</b> ${booking.notes || 'None'}</p>
          <a href="https://smartwashghadmin.netlify.app" style="display:inline-block;background:#1e6bff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">View Admin Dashboard</a>
        </div>
      </div>`
    });

    // Email to Customer
    if (booking.email) {
      await transporter.sendMail({
        from: `"Smart Wash Ghana" <${process.env.GMAIL_USER}>`,
        to: booking.email,
        subject: `Booking Received — Smart Wash Ghana`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1e6bff;padding:24px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0">SMART WASH</h2>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0">Booking Confirmation</p>
          </div>
          <div style="background:#f8faff;padding:24px;border:1px solid #dde;border-radius:0 0 8px 8px">
            <h3 style="color:#1e6bff">Hi ${booking.name}!</h3>
            <p>We have received your booking. Our team will confirm your slot shortly.</p>
            <p><b>Service:</b> ${booking.service}</p>
            <p><b>Car:</b> ${booking.carType}</p>
            <p><b>Date:</b> ${bookingDate}</p>
            <p><b>Time:</b> ${booking.time}</p>
            <p>Questions? WhatsApp: <b>+233 54 292 9661</b></p>
            <p style="color:#888;font-size:13px">Smart Wash Ghana — Mon-Sat 7am-7pm | Accra<br>Built by C-Fame Technologies</p>
          </div>
        </div>`
      });
    }
    console.log('Emails sent OK');
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

// ── SMS HELPER (Arkesel) ──
async function sendSMS(phone, name, service, date, time) {
  try {
    if (!process.env.ARKESEL_API_KEY) {
      console.log('SMS skipped — Arkesel key not set');
      return;
    }

    // Format phone to international Ghana format
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '233' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('233')) cleanPhone = '233' + cleanPhone;

    const bookingDate = new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    const message = `Hi ${name}! Your Smart Wash booking is received.\nService: ${service}\nDate: ${bookingDate}\nTime: ${time}\nWe will confirm shortly.\nQuestions? Call: +233 54 292 9661\nSmart Wash Ghana`;

    const response = await fetch('https://sms.arkesel.com/sms/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-sms',
        api_key: process.env.ARKESEL_API_KEY,
        to: cleanPhone,
        from: 'SmartWash',
        sms: message
      })
    });

    const data = await response.json();
    console.log('SMS result:', data);
  } catch (err) {
    console.error('SMS error:', err.message);
  }
}

// POST /api/bookings — PUBLIC
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, carType, service, date, time, notes } = req.body;
    if (!name || !phone || !carType || !service || !date || !time)
      return res.status(400).json({ error: 'Missing required fields' });

    let customer = await Customer.findOne({ phone });
    if (customer) {
      customer.totalBookings += 1;
      await customer.save();
    } else {
      customer = await Customer.create({ name, phone, email: email || '', source: 'booking' });
    }

    const booking = await Booking.create({
      name, phone, email: email || '', carType, service,
      date: new Date(date), time, notes: notes || '',
      customerId: customer._id
    });

    const io = req.app.get('io');
    io.to('admin-room').emit('new-booking', {
      booking, message: `New booking from ${name} for ${service}`
    });

    // Fire all notifications — non blocking
    sendEmails(booking);
    sendSMS(phone, name, service, date, time);

    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings — ADMIN ONLY
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { service: { $regex: search, $options: 'i' } }
      ];
    }
    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ bookings, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/bookings/:id/status — ADMIN ONLY
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'completed', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const io = req.app.get('io');
    io.to('admin-room').emit('booking-updated', { booking });
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bookings/:id — ADMIN ONLY
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
