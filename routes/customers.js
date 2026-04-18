const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const authMiddleware = require('../middleware/auth');

router.post('/contact', async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
    let customer = await Customer.findOne({ phone });
    if (!customer) {
      customer = await Customer.create({ name, phone, email: email || '', message: message || '', source: 'contact' });
    }
    const io = req.app.get('io');
    io.to('admin-room').emit('new-contact', { customer, message: `New contact from ${name}` });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ customers, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
