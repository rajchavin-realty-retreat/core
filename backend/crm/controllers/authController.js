const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// Initialize Resend with your API Key from .env
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to generate a JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Reusable Helper to send OTP Emails
const sendOtpEmail = async (email, otp, type = 'verify') => {
  const subject = type === 'verify' ? 'Verify your OAAS Account' : 'Reset your OAAS Password';
  await resend.emails.send({
    from: 'OAAS <auth@rajchavin.com>', // Update this to your verified domain in production
    to: email,
    subject: subject,
    html: `
      <div style="font-family: sans-serif; max-w: 400px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
        <h2 style="color: #18181b;">${subject}</h2>
        <p style="color: #52525b;">Your secure 6-digit code is:</p>
        <div style="background: #f4f4f5; padding: 12px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #18181b;">
          ${otp}
        </div>
        <p style="color: #71717a; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `
  });
};

// ==========================================
// 1. SIGNUP (Creates unverified user, sends OTP)
// ==========================================
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user && user.isVerified) {
      return res.status(400).json({ message: 'A verified user with this email already exists.' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60000); // 10 minutes

    if (!user) {
      // Create new unverified user
      user = new User({ name, email: email.toLowerCase(), password, otp, otpExpires });
    } else {
      // Overwrite existing unverified user data
      user.name = name;
      user.password = password; // Pre-save hook will hash this
      user.otp = otp;
      user.otpExpires = otpExpires;
    }

    await user.save();
    await sendOtpEmail(user.email, otp, 'verify');

    res.status(201).json({ message: 'OTP sent to email for verification' });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};

// ==========================================
// 2. VERIFY SIGNUP (Activates account & logs in)
// ==========================================
exports.verifySignup = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid verification code' });
    if (user.otpExpires < new Date()) return res.status(400).json({ message: 'Code expired. Please sign up again.' });

    // Mark as verified and clear OTP
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      token: generateToken(user._id) 
    });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};

// ==========================================
// 3. LOGIN (Requires Verified Account)
// ==========================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Security check: Must be verified to login
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Account not verified. Please sign up again to receive a new verification code.' });
    }

    res.status(200).json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, // Assuming you use roles
      token: generateToken(user._id) 
    });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};

// ==========================================
// 4. FORGOT PASSWORD (Sends OTP to verified user)
// ==========================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.isVerified) {
      return res.status(404).json({ message: 'Verified user account not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60000);
    await user.save();

    await sendOtpEmail(user.email, otp, 'reset');
    res.status(200).json({ message: 'Password recovery code sent' });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};

// ==========================================
// 5. RESET PASSWORD (Verifies OTP & changes password)
// ==========================================
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid recovery code' });
    if (user.otpExpires < new Date()) return res.status(400).json({ message: 'Code expired. Please request a new one.' });

    // Set new password (Pre-save hook in User model will automatically hash it)
    user.password = newPassword; 
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      token: generateToken(user._id) 
    });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};

// ==========================================
// 6. UPDATE USER PROFILE (Requires Auth Middleware)
// ==========================================
exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = req.body.name || user.name;
    
    // If they are changing their email, check if the new email is already taken
    if (req.body.email && req.body.email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email.toLowerCase() });
      if (emailExists) return res.status(400).json({ message: 'Email is already in use.' });
      user.email = req.body.email.toLowerCase();
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// 7. UPDATE USER PASSWORD (Requires Auth Middleware)
// ==========================================
exports.updateUserPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id || req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect current password.' });

    // Set new password (Pre-save hook will hash this securely)
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password securely updated.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};