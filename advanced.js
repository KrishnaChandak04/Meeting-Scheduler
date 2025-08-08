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

// POST /api/advanced/optimal-times - Generate optimal meeting time suggestions
router.post('/optimal-times',
  auth,
  [
    body('participants').isArray().withMessage('Participants must be an array'),
    body('participants.*').isMongoId().withMessage('Invalid participant ID'),
    body('duration').isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
    body('preferences').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { participants, duration, preferences = {} } = req.body;
      const userId = req.user.id;

      // Include organizer in participants if not already included
      const allParticipants = participants.includes(userId) ? 
        participants : [...participants, userId];

      const suggestions = await aiInsightsService.suggestOptimalTimes(
        allParticipants, 
        duration, 
        preferences
      );

      res.json({
        success: true,
        message: 'Optimal time suggestions generated',
        data: suggestions
      });

    } catch (error) {
      console.error('Optimal times error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate optimal time suggestions'
      });
    }
  }
);

// Smart Calendar Routes

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

// POST /api/advanced/find-optimal-times - Find optimal meeting times using AI
router.post('/find-optimal-times',
  auth,
  [
    body('participants').isArray().withMessage('Participants must be an array'),
    body('participants.*').isMongoId().withMessage('Invalid participant ID'),
    body('duration').isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
    body('preferences').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { participants, duration, preferences = {} } = req.body;

      const optimalTimes = await smartCalendarService.findOptimalMeetingTimes(
        participants,
        duration,
        preferences
      );

      if (!optimalTimes.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to find optimal times',
          error: optimalTimes.error
        });
      }

      res.json({
        success: true,
        message: 'Optimal meeting times found',
        data: optimalTimes.data
      });

    } catch (error) {
      console.error('Find optimal times error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find optimal meeting times'
      });
    }
  }
);

// POST /api/advanced/resolve-conflicts - Smart conflict resolution
router.post('/resolve-conflicts',
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
      const meetingData = req.body;
      const userId = req.user.id;

      // Add organizer if not specified
      if (!meetingData.organizer) {
        meetingData.organizer = userId;
      }

      const resolution = await smartCalendarService.resolveSchedulingConflicts(meetingData);

      if (!resolution.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to resolve conflicts',
          error: resolution.error
        });
      }

      res.json({
        success: true,
        message: 'Conflict resolution completed',
        data: resolution
      });

    } catch (error) {
      console.error('Conflict resolution error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve scheduling conflicts'
      });
    }
  }
);

// POST /api/advanced/intelligent-reschedule/:meetingId - Intelligent meeting rescheduling
router.post('/intelligent-reschedule/:meetingId',
  auth,
  [
    body('constraints').optional().isObject(),
    body('reason').optional().isString()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { meetingId } = req.params;
      const { constraints = {}, reason } = req.body;

      if (reason) {
        constraints.reason = reason;
      }

      const rescheduling = await smartCalendarService.intelligentReschedule(
        meetingId,
        constraints
      );

      if (!rescheduling.success) {
        return res.status(400).json({
          success: false,
          message: rescheduling.error || 'Failed to generate rescheduling suggestions'
        });
      }

      res.json({
        success: true,
        message: 'Intelligent rescheduling suggestions generated',
        data: rescheduling.data
      });

    } catch (error) {
      console.error('Intelligent rescheduling error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate rescheduling suggestions'
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

// GET /api/advanced/meeting-patterns - Analyze meeting patterns using MongoDB aggregation
router.get('/meeting-patterns',
  auth,
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
            ],

            // Recurring vs ad-hoc
            recurringAnalysis: [
              {
                $group: {
                  _id: '$isRecurring',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' }
                }
              }
            ],

            // Productivity indicators
            productivityMetrics: [
              {
                $group: {
                  _id: null,
                  totalMeetings: { $sum: 1 },
                  avgMeetingGap: {
                    $avg: {
                      $divide: [
                        { $subtract: ['$startTime', '$createdAt'] },
                        1000 * 60 * 60 * 24
                      ]
                    }
                  },
                  preparationScore: {
                    $avg: {
                      $cond: [
                        { $ne: ['$agenda', ''] },
                        1, 0
                      ]
                    }
                  },
                  punctualityScore: {
                    $avg: {
                      $cond: [
                        { $lte: [{ $abs: { $subtract: ['$actualStartTime', '$startTime'] } }, 300000] },
                        1, 0.5
                      ]
                    }
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

// GET /api/advanced/team-collaboration - Team collaboration insights
router.get('/team-collaboration',
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeframe = 'last_30_days' } = req.query;
      
      const Meeting = require('../models/Meeting');
      const User = require('../models/User');
      const dateFilter = getDateFilter(timeframe);

      // Advanced aggregation for team collaboration analysis
      const collaboration = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: userId },
              { 'participants.user': userId }
            ],
            createdAt: dateFilter,
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'organizer',
            foreignField: '_id',
            as: 'organizerInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'participants.user',
            foreignField: '_id',
            as: 'participantInfo'
          }
        },
        {
          $addFields: {
            allParticipants: {
              $concatArrays: [
                '$organizerInfo',
                '$participantInfo'
              ]
            }
          }
        },
        {
          $unwind: '$allParticipants'
        },
        {
          $group: {
            _id: '$allParticipants.department',
            uniqueCollaborators: { $addToSet: '$allParticipants._id' },
            meetings: { $addToSet: '$_id' },
            totalMeetingTime: {
              $sum: {
                $divide: [
                  { $subtract: ['$endTime', '$startTime'] },
                  1000 * 60
                ]
              }
            },
            avgMeetingSize: {
              $avg: { $size: '$participants' }
            }
          }
        },
        {
          $addFields: {
            collaboratorCount: { $size: '$uniqueCollaborators' },
            meetingCount: { $size: '$meetings' },
            collaborationScore: {
              $multiply: [
                { $size: '$uniqueCollaborators' },
                { $size: '$meetings' }
              ]
            }
          }
        },
        {
          $sort: { collaborationScore: -1 }
        }
      ]);

      // Cross-department collaboration matrix
      const crossDepartment = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: userId },
              { 'participants.user': userId }
            ],
            createdAt: dateFilter,
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'participants.user',
            foreignField: '_id',
            as: 'participantInfo'
          }
        },
        {
          $addFields: {
            departments: { $setUnion: [['$organizerInfo.department'], '$participantInfo.department'] }
          }
        },
        {
          $match: {
            $expr: { $gt: [{ $size: '$departments' }, 1] }
          }
        },
        {
          $group: {
            _id: null,
            crossDepartmentalMeetings: { $sum: 1 },
            departmentCombinations: { $addToSet: '$departments' }
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Team collaboration analysis completed',
        data: {
          timeframe,
          departmentCollaboration: collaboration,
          crossDepartmentalInsights: crossDepartment[0] || {
            crossDepartmentalMeetings: 0,
            departmentCombinations: []
          },
          collaborationMetrics: calculateCollaborationMetrics(collaboration),
          recommendations: generateCollaborationRecommendations(collaboration)
        }
      });

    } catch (error) {
      console.error('Team collaboration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze team collaboration'
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

  // Analyze productivity metrics
  const productivity = patterns.productivityMetrics[0];
  if (productivity) {
    if (productivity.preparationScore < 0.7) {
      insights.push({
        type: 'preparation',
        message: `Only ${Math.round(productivity.preparationScore * 100)}% of meetings have prepared agendas`,
        recommendation: 'Improve meeting preparation by setting clear agendas in advance'
      });
    }
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

function calculateCollaborationMetrics(collaboration) {
  const totalMeetings = collaboration.reduce((sum, dept) => sum + dept.meetingCount, 0);
  const totalCollaborators = collaboration.reduce((sum, dept) => sum + dept.collaboratorCount, 0);
  
  return {
    totalDepartments: collaboration.length,
    totalMeetings,
    averageCollaboratorsPerDepartment: totalCollaborators / collaboration.length,
    collaborationDiversity: collaboration.length > 3 ? 'high' : collaboration.length > 1 ? 'medium' : 'low'
  };
}

function generateCollaborationRecommendations(collaboration) {
  const recommendations = [];

  if (collaboration.length === 1) {
    recommendations.push({
      type: 'diversity',
      title: 'Expand Cross-Department Collaboration',
      description: 'Consider involving other departments to increase innovation and knowledge sharing',
      priority: 'medium'
    });
  }

  const avgCollaborators = collaboration.reduce((sum, dept) => 
    sum + dept.collaboratorCount, 0) / collaboration.length;

  if (avgCollaborators < 3) {
    recommendations.push({
      type: 'network',
      title: 'Strengthen Professional Network',
      description: 'Increase collaboration with more team members to improve project outcomes',
      priority: 'low'
    });
  }

  return recommendations;
}

module.exports = router;
