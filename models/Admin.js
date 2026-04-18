const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  businessName: { type: String, default: 'Smart Wash' },
  businessPhone: { type: String, default: '+233 54 292 9661' },
  businessAddress: { type: String, default: 'Accra, Ghana' },
  pricing: {
    exterior: { type: Number, default: 50 },
    interior: { type: Number, default: 80 },
    fullDetail: { type: Number, default: 150 },
    premium: { type: Number, default: 200 },
    engine: { type: Number, default: 100 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
