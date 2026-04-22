// backend/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Body parser

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI; 

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB successfully connected for Rajchavin CRM'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic Health Check Route
app.get('/', (req, res) => {
  res.send('Rajchavin CRM API is running...');
});

// API Routes
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/users', require('./routes/authRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/records', require('./routes/recordRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/entities', require('./routes/entityRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});