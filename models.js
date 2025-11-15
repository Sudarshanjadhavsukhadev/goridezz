// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  aadhar: { type: String, required: true },
  aadharPhoto: { type: String }, // path/URL to uploaded file
  license: { type: String, required: true },
  licensePhoto: { type: String }, // path/URL to uploaded file
  pickup: { type: String, required: true },
  drop: { type: String, required: true },
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  paymentMode: { type: String, enum: ['UPI','Cash'], default: 'UPI' },
  txnId: { type: String }, // payment transaction id for UPI
  aadhaarVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
