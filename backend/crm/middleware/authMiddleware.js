// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Check if the request headers have an Authorization token formatted as "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Isolate the token from the "Bearer " string
      token = req.headers.authorization.split(' ')[1];

      // Decode the token using your secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user in the database (minus their password) and attach it to the request
      req.user = await User.findById(decoded.id).select('-password');
      
      next(); // Move on to the actual route controller
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };