require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const customerRoutes = require('./routes/customers');
const settingsRoutes = require('./routes/settings');
const statsRoutes = require('./routes/stats');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

app.set('io', io);

app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stats', statsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Wash API is running' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-admin', () => { socket.join('admin-room'); });
  socket.on('disconnect', () => { console.log('Client disconnected:', socket.id); });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedAdmin();
    await seedSampleData();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log('Smart Wash API running on port ' + PORT);
    });
  })
  .catch(err => {
    console.error('MongoDB error:', err.message);
    process.exit(1);
  });

async function seedAdmin() {
  const Admin = require('./models/Admin');
  const bcrypt = require('bcryptjs');
  const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  if (!existing) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await Admin.create({ email: process.env.ADMIN_EMAIL, password: hash, name: 'Smart Wash Admin' });
    console.log('Admin user created');
  }
}

async function seedSampleData() {
  const Booking = require('./models/Booking');
  const Customer = require('./models/Customer');
  const count = await Booking.countDocuments();
  if (count > 0) return;
  const customers = await Customer.insertMany([
    { name: 'Kwame Asante', phone: '+233241112222', email: 'kwame@email.com', totalBookings: 2 },
    { name: 'Ama Mensah', phone: '+233503334444', email: 'ama@email.com', totalBookings: 1 },
    { name: 'Kofi Boateng', phone: '+233275556666', email: 'kofi@email.com', totalBookings: 3 },
  ]);
  const services = ['Exterior Wash', 'Interior Cleaning', 'Full Detail', 'Premium Package'];
  const carTypes = ['Sedan', 'SUV', 'Pickup Truck', 'Hatchback'];
  const statuses = ['pending', 'approved', 'completed', 'rejected'];
  const bookings = [];
  const now = new Date();
  for (let i = 0; i < 10; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + Math.floor(Math.random() * 20) - 5);
    const customer = customers[Math.floor(Math.random() * customers.length)];
    bookings.push({
      name: customer.name, phone: customer.phone, email: customer.email,
      carType: carTypes[Math.floor(Math.random() * carTypes.length)],
      service: services[Math.floor(Math.random() * services.length)],
      date, time: '09:00',
      status: i < 3 ? 'pending' : statuses[Math.floor(Math.random() * statuses.length)],
      notes: '', customerId: customer._id
    });
  }
  await Booking.insertMany(bookings);
  console.log('Sample data seeded');
}
