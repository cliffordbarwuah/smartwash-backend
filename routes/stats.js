const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [totalBookings, todayBookings, totalCustomers, pendingBookings, recentBookings, statusCounts] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
      Customer.countDocuments(),
      Booking.countDocuments({ status: 'pending' }),
      Booking.find().sort({ createdAt: -1 }).limit(5),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const count = await Booking.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } });
      weeklyData.push({ day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }

    res.json({ totalBookings, todayBookings, totalCustomers, pendingBookings, recentBookings, statusCounts, weeklyData });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
