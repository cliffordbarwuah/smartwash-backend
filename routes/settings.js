const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', authMiddleware, async (req, res) => {
  try {
    const { businessName, businessPhone, businessAddress, pricing } = req.body;
    const admin = await Admin.findByIdAndUpdate(
      req.admin.id,
      { businessName, businessPhone, businessAddress, pricing },
      { new: true }
    ).select('-password');
    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
