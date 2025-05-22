const express = require('express');
const router = express.Router();
const Token = require('../models/Token');

// Enhanced error handler
const handleError = (res, err, status = 400) => {
  console.error('Route Error:', err);
  
  let message = 'An error occurred';
  if (err.name === 'ValidationError') {
    message = 'Validation failed: ' + Object.values(err.errors).map(e => e.message).join(', ');
  } else if (err.code === 11000) {
    message = 'Duplicate token detected - please try again';
  } else if (err.message) {
    message = err.message;
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Get all tokens
router.get('/', async (req, res) => {
  try {
    const tokens = await Token.find({})
      .sort({ tokenNumber: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: tokens
    });
  } catch (err) {
    handleError(res, err);
  }
});


// Get current serving token
router.get('/current', async (req, res) => {
  try {
    const currentToken = await Token.findOne({ status: 'serving' });
    res.json({
      success: true,
      data: currentToken
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current token'
    });
  }
});

// Move to next token
router.patch('/next', async (req, res) => {
  try {
    // Find next token (VIPs first, then by token number)
    const nextToken = await Token.findOne({ status: 'waiting' })
      .sort({ isVIP: -1, tokenNumber: 1 });
    
    if (!nextToken) {
      return res.json({
        success: true,
        data: null,
        message: 'No more patients in queue'
      });
    }

    // Update current serving token to completed
    await Token.updateMany(
      { status: 'serving' },
      { $set: { status: 'completed' } }
    );

    // Set next token to serving
    const updatedToken = await Token.findByIdAndUpdate(
      nextToken._id,
      { status: 'serving' },
      { new: true }
    );

    res.json({
      success: true,
      data: updatedToken
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to move to next token'
    });
  }
});

// Update token status
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedToken = await Token.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedToken) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: updatedToken
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update token status'
    });
  }
});

// Update VIP status and reorder
router.patch('/reorder/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isVIP } = req.body;

    // Update the token
    const updatedToken = await Token.findByIdAndUpdate(
      id,
      { isVIP },
      { new: true, runValidators: true }
    );

    if (!updatedToken) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: updatedToken,
      message: 'VIP status updated successfully'
    });
  } catch (err) {
    console.error('VIP update error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    console.log('Received token creation request:', req.body);

    const { patientName, phoneNumber, isVIP = false } = req.body;

    // Validate input
    if (!patientName?.trim() || !phoneNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and phone number are required'
      });
    }

    // Create token with explicit tokenNumber initialization
    const token = new Token({
      patientName: patientName.trim(),
      phoneNumber: phoneNumber.trim().replace(/\D/g, ''),
      isVIP: Boolean(isVIP),
      status: 'waiting',
      tokenNumber: 0 // Temporary value to pass initial validation
    });

    console.log('Token before save:', token);

    const savedToken = await token.save();
    console.log('Token after save:', savedToken);

    return res.status(201).json({
      success: true,
      data: savedToken,
      message: 'Token created successfully'
    });
  } catch (err) {
    console.error('Token creation error:', err);
    
    let message = 'Failed to create token';
    if (err.name === 'ValidationError') {
      message = `Validation failed: ${err.message}`;
    } else if (err.code === 11000) {
      message = 'Duplicate token detected. Please try again.';
    }

    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
});

module.exports = router;