// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const shortid = require('shortid');
const fs = require('fs');

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiter (basic)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 150 // adjust as needed
});
app.use(limiter);

// ensure upload dir exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const fname = `${Date.now()}-${shortid.generate()}${ext}`;
    cb(null, fname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    // accept only images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads allowed'), false);
    }
    cb(null, true);
  }
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI missing in .env');
  process.exit(1);
}
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.get('/', (req, res) => res.json({ msg: 'DriveHub API running' }));

// POST booking — accepts fields + files: aadharPhoto, licensePhoto
app.post('/api/bookings', upload.fields([
  { name: 'aadharPhoto', maxCount: 1 },
  { name: 'licensePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    // validate required fields
    const {
      name, contact, aadhar, license,
      pickup, drop, pickupDate, returnDate,
      paymentMode, txnId, aadhaarVerified
    } = req.body;

    if (!name || !contact || !aadhar || !license || !pickup || !drop || !pickupDate || !returnDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // require aadhaar verification
    if (!aadhaarVerified || (aadhaarVerified !== 'true' && aadhaarVerified !== true)) {
      return res.status(400).json({ error: 'Aadhaar must be verified before booking' });
    }

    // file paths
    const aadharPhotoFile = req.files && req.files['aadharPhoto'] && req.files['aadharPhoto'][0];
    const licensePhotoFile = req.files && req.files['licensePhoto'] && req.files['licensePhoto'][0];

    if (!aadharPhotoFile || !licensePhotoFile) {
      return res.status(400).json({ error: 'Aadhaar and License photos are required' });
    }

    const bookingId = `DH-${shortid.generate()}`;

    const booking = new Booking({
      bookingId,
      name,
      contact,
      aadhar,
      aadharPhoto: `/uploads/${aadharPhotoFile.filename}`,
      license,
      licensePhoto: `/uploads/${licensePhotoFile.filename}`,
      pickup,
      drop,
      pickupDate: new Date(pickupDate),
      returnDate: new Date(returnDate),
      paymentMode: paymentMode || 'UPI',
      txnId: txnId || null,
      aadhaarVerified: aadhaarVerified === 'true' || aadhaarVerified === true
    });

    await booking.save();

    return res.status(201).json({
      message: 'Booking created',
      bookingId,
      booking
    });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET booking by bookingId
app.get('/api/bookings/:bookingId', async (req, res) => {
  try {
    const b = await Booking.findOne({ bookingId: req.params.bookingId }).lean();
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: b });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List bookings (for admin) - simple, add auth later
app.get('/api/bookings', async (req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ bookings: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
