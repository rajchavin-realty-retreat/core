require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


const app = express();

// --- THE SECURITY BOUNCER (CORS WHITELIST) ---
const whitelist = [
  'http://localhost:3000',             // Allow your local React development server
  'http://localhost:5173',             // (Add this if you are using Vite instead of CRA)
  'https://oaas.rajchavin.com' // <-- Replace with your actual live deployed frontend URL
];

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Security Block: Not allowed by CORS'));
    }
  },
  credentials: true, 
  optionsSuccessStatus: 200 
};

// Apply the strict whitelist middleware
app.use(cors(corsOptions));

// Body parser
app.use(express.json()); 

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
app.use('/api/templates', require('./routes/templateRoutes'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});