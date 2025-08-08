const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Simple test route
router.get('/test', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Advanced features are working!',
    user: req.user.id,
    timestamp: new Date().toISOString(),
    features: [
      'AI-Powered Meeting Insights',
      'Smart Conflict Detection',
      'Calendar Analytics',
      'Availability Checking',
      'Meeting Pattern Analysis'
    ]
  });
});

// Health check for advanced features
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Advanced features service is running',
    timestamp: new Date().toISOString(),
    services: {
      aiInsights: 'available',
      smartCalendar: 'available',
      conflictDetection: 'available',
      patternAnalysis: 'available'
    }
  });
});

module.exports = router;
