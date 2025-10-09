const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Grantha = require('../models/Grantha');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      success: true,
      adminId: admin._id, 
      username: admin.username 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all granthas (including drafts) - Admin only
router.get('/granthas', async (req, res) => {
  try {
    console.log('📚 Fetching all granthas for admin...');
    const granthas = await Grantha.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${granthas.length} granthas`);
    
    // Return array directly
    res.json(granthas);
  } catch (error) {
    console.error('❌ Error fetching granthas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
