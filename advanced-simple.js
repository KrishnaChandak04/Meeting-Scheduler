const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const aiInsightsService = require('../services/aiInsightsService');
const smartCalendarService = require('../services/smartCalendarService');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// AI Insights Routes

// GET /api/advanced/insights - Generate AI-powered meeting insights
router.get('/insights', 
  auth,
  [
    query('timeframe').optional().isIn(['last_7_days', 'last_30_days', 'last_90_days'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { timeframe = 'last_30_days' } = req.query;
      const userId = req.user.id;

      const insights = await aiInsightsService.generateMeetingInsights(userId, timeframe);

      if (!insights.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate insights',
          error: insights.error
        });
      }

      res.json({
        success: true,
        message: 'AI insights generated successfully',
        data: insights.data
      });

    } catch (error) {
      console.error('AI insights error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while generating insights'
      });
    }
  }
);

// POST /api/advanced/conflict-detection - Smart conflict detection
router.post('/conflict-detection',
  auth,
  [
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
    body('participants').isArray().withMessage('Participants must be an array'),
    body('participants.*').isMongoId().withMessage('Invalid participant ID'),
    body('priority').optional().isIn(['low', 'medium', 'high'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startTime, endTime, participants, priority, organizer } = req.body;
      const userId = req.user.id;

      const meetingData = {
        startTime,
        endTime,
        participants,
        priority: priority || 'medium',
        organizer: organizer || userId
      };

      const conflictAnalysis = await aiInsightsService.detectConflicts(meetingData);

      res.json({
        success: true,
        message: 'Conflict detection completed',
        data: conflictAnalysis
      });

    } catch (error) {
      console.error('Conflict detection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to detect conflicts'
      });
    }
  }
);

// GET /api/advanced/calendar-analytics - Calendar analytics and insights
router.get('/calendar-analytics',
  auth,
  [
    query('timeframe').optional().isIn(['week', 'month', 'quarter'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { timeframe = 'month' } = req.query;
      const userId = req.user.id;

      const analytics = await smartCalendarService.getCalendarAnalytics(userId, timeframe);

      if (!analytics.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate calendar analytics',
          error: analytics.error
        });
      }

      res.json({
        success: true,
        message: 'Calendar analytics generated successfully',
        data: analytics.data
      });

    } catch (error) {
      console.error('Calendar analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate calendar analytics'
      });
    }
  }
);

// POST /api/advanced/availability-check - Advanced availability checking
router.post('/availability-check',
  auth,
  [
    body('participants').isArray().withMessage('Participants must be an array'),
    body('participants.*').isMongoId().withMessage('Invalid participant ID'),
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
    body('excludeMeetingId').optional().isMongoId().withMessage('Invalid meeting ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { participants, startTime, endTime, excludeMeetingId } = req.body;

      const availability = await smartCalendarService.checkAvailability(
        participants,
        startTime,
        endTime,
        excludeMeetingId
      );

      res.json({
        success: true,
        message: 'Availability check completed',
        data: availability.data
      });

    } catch (error) {
      console.error('Availability check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check availability'
      });
    }
  }
);

// GET /api/advanced/meeting-patterns - Analyze meeting patterns using MongoDB aggregation
router.get('/meeting-patterns',
  auth,
  [
    query('timeframe').optional().isIn(['last_7_days', 'last_30_days', 'last_90_days'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeframe = 'last_30_days' } = req.query;

      // Advanced MongoDB aggregation for meeting pattern analysis
      const Meeting = require('../models/Meeting');
      const dateFilter = getDateFilter(timeframe);

      const patterns = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: userId },
              { 'participants.user': userId }
            ],
            createdAt: dateFilter,
            status: { $ne: 'cancelled' }
          }
        },
        {
          $addFields: {
            duration: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60
              ]
            },
            timeOfDay: { $hour: '$startTime' },
            dayOfWeek: { $dayOfWeek: '$startTime' },
            monthDay: { $dayOfMonth: '$startTime' },
            isRecurring: { $ne: ['$recurringPattern', null] }
          }
        },
        {
          $facet: {
            // Time-of-day patterns
            hourlyPatterns: [
              {
                $group: {
                  _id: '$timeOfDay',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  categories: { $addToSet: '$category' }
                }
              },
              { $sort: { _id: 1 } }
            ],

            // Day-of-week patterns
            weeklyPatterns: [
              {
                $group: {
                  _id: '$dayOfWeek',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  totalDuration: { $sum: '$duration' }
                }
              },
              { $sort: { _id: 1 } }
            ],

            // Meeting type patterns
            typePatterns: [
              {
                $group: {
                  _id: '$type',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  avgParticipants: { $avg: { $size: '$participants' } }
                }
              }
            ],

            // Duration distribution
            durationPatterns: [
              {
                $bucket: {
                  groupBy: '$duration',
                  boundaries: [0, 30, 60, 90, 120, 180, 240],
                  default: '240+',
                  output: {
                    count: { $sum: 1 },
                    meetings: { $push: '$title' }
                  }
                }
              }
            ]
          }
        }
      ]);

      const insights = generatePatternInsights(patterns[0]);

      res.json({
        success: true,
        message: 'Meeting patterns analyzed successfully',
        data: {
          timeframe,
          patterns: patterns[0],
          insights,
          recommendations: generatePatternRecommendations(patterns[0])
        }
      });

    } catch (error) {
      console.error('Meeting patterns error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze meeting patterns'
      });
    }
  }
);

// Helper functions
function getDateFilter(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case 'last_7_days':
      return { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    case 'last_30_days':
      return { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case 'last_90_days':
      return { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    default:
      return { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
}

function generatePatternInsights(patterns) {
  const insights = [];

  // Analyze hourly patterns
  const hourlyData = patterns.hourlyPatterns || [];
  const peakHour = hourlyData.reduce((max, current) => 
    current.count > (max.count || 0) ? current : max, {});
  
  if (peakHour._id) {
    insights.push({
      type: 'peak_time',
      message: `Your most active meeting hour is ${peakHour._id}:00 with ${peakHour.count} meetings`,
      recommendation: 'Consider scheduling important meetings during this peak productive time'
    });
  }

  // Analyze duration patterns
  const durationData = patterns.durationPatterns || [];
  const longMeetings = durationData.find(d => d._id === 120 || d._id === 180);
  
  if (longMeetings && longMeetings.count > 5) {
    insights.push({
      type: 'duration_optimization',
      message: `You have ${longMeetings.count} meetings longer than 2 hours`,
      recommendation: 'Consider breaking long meetings into focused sessions'
    });
  }

  return insights;
}

function generatePatternRecommendations(patterns) {
  const recommendations = [];

  // Time optimization recommendations
  const weeklyData = patterns.weeklyPatterns || [];
  const busyDays = weeklyData.filter(day => day.count > 5);
  
  if (busyDays.length > 0) {
    recommendations.push({
      category: 'time_distribution',
      title: 'Balance Meeting Load',
      description: 'Distribute meetings more evenly across the week to avoid burnout',
      priority: 'medium'
    });
  }

  // Meeting type optimization
  const typeData = patterns.typePatterns || [];
  const standups = typeData.find(t => t._id === 'standup');
  
  if (standups && standups.avgDuration > 30) {
    recommendations.push({
      category: 'efficiency',
      title: 'Optimize Standup Duration',
      description: 'Keep standup meetings to 15-20 minutes for maximum effectiveness',
      priority: 'high'
    });
  }

  return recommendations;
}

module.exports = router;
