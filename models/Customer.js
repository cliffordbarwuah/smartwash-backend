const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  totalBookings: { type: Number, default: 1 },
  message: { type: String, default: '' },
  source: { type: String, enum: ['booking', 'contact'], default: 'booking' }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
