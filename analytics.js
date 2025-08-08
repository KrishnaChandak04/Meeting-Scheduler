const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { validateDateRange } = require('../middleware/validation');
const { requireModerator } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get comprehensive analytics dashboard
// @access  Private
router.get('/dashboard', validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no date range provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Personal analytics using MongoDB aggregation
    const personalAnalytics = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $facet: {
          // Overall statistics
          overview: [
            {
              $group: {
                _id: null,
                totalMeetings: { $sum: 1 },
                totalDuration: {
                  $sum: {
                    $divide: [
                      { $subtract: ['$endTime', '$startTime'] },
                      1000 * 60
                    ]
                  }
                },
                organizedMeetings: {
                  $sum: {
                    $cond: [
                      { $eq: ['$organizer', mongoose.Types.ObjectId(req.userId)] },
                      1,
                      0
                    ]
                  }
                },
                attendedMeetings: {
                  $sum: {
                    $cond: [
                      { $ne: ['$organizer', mongoose.Types.ObjectId(req.userId)] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          
          // Meetings by status
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                duration: {
                  $sum: {
                    $divide: [
                      { $subtract: ['$endTime', '$startTime'] },
                      1000 * 60
                    ]
                  }
                }
              }
            },
            { $sort: { count: -1 } }
          ],
          
          // Meetings by category
          categoryBreakdown: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
                avgDuration: {
                  $avg: {
                    $divide: [
                      { $subtract: ['$endTime', '$startTime'] },
                      1000 * 60
                    ]
                  }
                }
              }
            },
            { $sort: { count: -1 } }
          ],
          
          // Daily activity
          dailyActivity: [
            {
              $group: {
                _id: {
                  year: { $year: '$startTime' },
                  month: { $month: '$startTime' },
                  day: { $dayOfMonth: '$startTime' }
                },
                meetings: { $sum: 1 },
                duration: {
                  $sum: {
                    $divide: [
                      { $subtract: ['$endTime', '$startTime'] },
                      1000 * 60
                    ]
                  }
                }
              }
            },
            {
              $project: {
                date: {
                  $dateFromParts: {
                    year: '$_id.year',
                    month: '$_id.month',
                    day: '$_id.day'
                  }
                },
                meetings: 1,
                duration: { $round: ['$duration', 2] }
              }
            },
            { $sort: { date: 1 } }
          ],
          
          // Time distribution (hours of day)
          hourlyDistribution: [
            {
              $project: {
                hour: { $hour: '$startTime' },
                duration: {
                  $divide: [
                    { $subtract: ['$endTime', '$startTime'] },
                    1000 * 60
                  ]
                }
              }
            },
            {
              $group: {
                _id: '$hour',
                meetingCount: { $sum: 1 },
                totalDuration: { $sum: '$duration' }
              }
            },
            { $sort: { _id: 1 } }
          ],
          
          // Priority distribution
          priorityBreakdown: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
                avgParticipants: { $avg: { $size: '$participants' } }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    // Top collaborators
    const topCollaborators = await Meeting.aggregate([
      {
        $match: {
          organizer: mongoose.Types.ObjectId(req.userId),
          startTime: { $gte: start, $lte: end }
        }
      },
      { $unwind: '$participants' },
      {
        $match: {
          'participants.user': { $ne: mongoose.Types.ObjectId(req.userId) }
        }
      },
      {
        $group: {
          _id: '$participants.user',
          meetingCount: { $sum: 1 },
          acceptanceRate: {
            $avg: {
              $cond: [
                { $eq: ['$participants.status', 'accepted'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          user: {
            id: '$userInfo._id',
            name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
            email: '$userInfo.email',
            department: '$userInfo.department'
          },
          meetingCount: 1,
          acceptanceRate: { $round: [{ $multiply: ['$acceptanceRate', 100] }, 1] }
        }
      },
      { $sort: { meetingCount: -1 } },
      { $limit: 10 }
    ]);

    // Productivity metrics
    const productivityMetrics = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          startTime: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          completedMeetings: { $sum: 1 },
          avgMeetingDuration: {
            $avg: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60
              ]
            }
          },
          totalProductiveTime: {
            $sum: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        overview: personalAnalytics[0].overview[0] || {
          totalMeetings: 0,
          totalDuration: 0,
          organizedMeetings: 0,
          attendedMeetings: 0
        },
        breakdowns: {
          status: personalAnalytics[0].statusBreakdown,
          category: personalAnalytics[0].categoryBreakdown,
          priority: personalAnalytics[0].priorityBreakdown
        },
        trends: {
          daily: personalAnalytics[0].dailyActivity,
          hourly: personalAnalytics[0].hourlyDistribution
        },
        collaborations: {
          topCollaborators
        },
        productivity: productivityMetrics[0] || {
          completedMeetings: 0,
          avgMeetingDuration: 0,
          totalProductiveTime: 0
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching dashboard analytics'
    });
  }
});

// @route   GET /api/analytics/team
// @desc    Get team/department analytics (for moderators/admins)
// @access  Private/Moderator
router.get('/team', requireModerator, validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get user's department if no specific department requested
    const user = await User.findById(req.userId);
    const targetDepartment = department || user.department;

    if (!targetDepartment) {
      return res.status(400).json({
        success: false,
        error: 'Department required',
        message: 'Please specify a department or ensure your profile has a department set'
      });
    }

    // Team analytics using complex aggregation
    const teamAnalytics = await Meeting.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'organizer',
          foreignField: '_id',
          as: 'organizerInfo'
        }
      },
      {
        $match: {
          'organizerInfo.department': targetDepartment,
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $facet: {
          // Department overview
          overview: [
            {
              $group: {
                _id: null,
                totalMeetings: { $sum: 1 },
                totalDuration: {
                  $sum: {
                    $divide: [
                      { $subtract: ['$endTime', '$startTime'] },
                      1000 * 60
                    ]
                  }
                },
                uniqueOrganizers: { $addToSet: '$organizer' },
                avgParticipants: { $avg: { $size: '$participants' } }
              }
            },
            {
              $project: {
                totalMeetings: 1,
                totalDuration: { $round: ['$totalDuration', 2] },
                uniqueOrganizers: { $size: '$uniqueOrganizers' },
                avgParticipants: { $round: ['$avgParticipants', 1] },
                avgMeetingDuration: {
                  $round: [{ $divide: ['$totalDuration', '$totalMeetings'] }, 2]
                }
              }
            }
          ],
          
          // Top organizers in department
          topOrganizers: [
            {
              $group: {
                _id: '$organizer',
                meetingCount: { $sum: 1 },
                totalDuration: {
                  $sum: {
                    $divide: [
                      { $subtract: ['$endTime', '$startTime'] },
                      1000 * 60
                    ]
                  }
                }
              }
            },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userInfo'
              }
            },
            { $unwind: '$userInfo' },
            {
              $project: {
                organizer: {
                  id: '$userInfo._id',
                  name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
                  email: '$userInfo.email',
                  position: '$userInfo.position'
                },
                meetingCount: 1,
                totalDuration: { $round: ['$totalDuration', 2] },
                avgDuration: {
                  $round: [{ $divide: ['$totalDuration', '$meetingCount'] }, 2]
                }
              }
            },
            { $sort: { meetingCount: -1 } },
            { $limit: 10 }
          ],
          
          // Meeting patterns by time
          timePatterns: [
            {
              $group: {
                _id: {
                  hour: { $hour: '$startTime' },
                  dayOfWeek: { $dayOfWeek: '$startTime' }
                },
                count: { $sum: 1 }
              }
            },
            {
              $group: {
                _id: '$_id.hour',
                totalMeetings: { $sum: '$count' },
                weekdayBreakdown: {
                  $push: {
                    dayOfWeek: '$_id.dayOfWeek',
                    count: '$count'
                  }
                }
              }
            },
            { $sort: { _id: 1 } }
          ],
          
          // Cross-department collaboration
          crossDeptCollaboration: [
            { $unwind: '$participants' },
            {
              $lookup: {
                from: 'users',
                localField: 'participants.user',
                foreignField: '_id',
                as: 'participantInfo'
              }
            },
            { $unwind: '$participantInfo' },
            {
              $match: {
                'participantInfo.department': { $ne: targetDepartment }
              }
            },
            {
              $group: {
                _id: '$participantInfo.department',
                collaborationCount: { $sum: 1 },
                uniqueMeetings: { $addToSet: '$_id' }
              }
            },
            {
              $project: {
                department: '$_id',
                collaborationCount: 1,
                uniqueMeetings: { $size: '$uniqueMeetings' }
              }
            },
            { $sort: { collaborationCount: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]);

    // Meeting efficiency metrics
    const efficiencyMetrics = await Meeting.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'organizer',
          foreignField: '_id',
          as: 'organizerInfo'
        }
      },
      {
        $match: {
          'organizerInfo.department': targetDepartment,
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $project: {
          duration: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 * 60
            ]
          },
          participantCount: { $size: '$participants' },
          status: 1,
          category: 1,
          hasAgenda: { $gt: [{ $size: '$agenda' }, 0] },
          onTimeStart: {
            $cond: [
              { $and: ['$metadata.actualStartTime'] },
              {
                $lte: [
                  { $abs: { $subtract: ['$metadata.actualStartTime', '$startTime'] } },
                  5 * 60 * 1000 // 5 minutes tolerance
                ]
              },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          avgParticipants: { $avg: '$participantCount' },
          completionRate: {
            $avg: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          agendaUsageRate: {
            $avg: {
              $cond: ['$hasAgenda', 1, 0]
            }
          },
          punctualityRate: {
            $avg: {
              $cond: [{ $eq: ['$onTimeStart', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        department: targetDepartment,
        period: { startDate: start, endDate: end },
        overview: teamAnalytics[0].overview[0] || {},
        topOrganizers: teamAnalytics[0].topOrganizers,
        timePatterns: teamAnalytics[0].timePatterns,
        crossDepartmentCollaboration: teamAnalytics[0].crossDeptCollaboration,
        efficiency: efficiencyMetrics[0] || {}
      }
    });

  } catch (error) {
    console.error('Get team analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching team analytics'
    });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get meeting trends and predictions
// @access  Private
router.get('/trends', validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // Default 90 days

    // Weekly trends
    const weeklyTrends = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            week: { $week: '$startTime' }
          },
          meetingCount: { $sum: 1 },
          totalDuration: {
            $sum: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60
              ]
            }
          },
          avgParticipants: { $avg: { $size: '$participants' } },
          categories: { $push: '$category' }
        }
      },
      {
        $project: {
          week: '$_id.week',
          year: '$_id.year',
          meetingCount: 1,
          totalDuration: { $round: ['$totalDuration', 2] },
          avgDuration: {
            $round: [{ $divide: ['$totalDuration', '$meetingCount'] }, 2]
          },
          avgParticipants: { $round: ['$avgParticipants', 1] },
          dominantCategory: {
            $arrayElemAt: [
              { $setIntersection: ['$categories', '$categories'] },
              0
            ]
          }
        }
      },
      { $sort: { year: 1, week: 1 } }
    ]);

    // Monthly comparison
    const monthlyComparison = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' }
          },
          current: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    '$startTime',
                    new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
                  ]
                },
                1,
                0
              ]
            }
          },
          previous: {
            $sum: {
              $cond: [
                {
                  $lt: [
                    '$startTime',
                    new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          month: '$_id.month',
          year: '$_id.year',
          current: 1,
          previous: 1,
          change: {
            $cond: [
              { $gt: ['$previous', 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$current', '$previous'] },
                      '$previous'
                    ]
                  },
                  100
                ]
              },
              null
            ]
          }
        }
      }
    ]);

    // Productivity patterns
    const productivityPatterns = await Meeting.aggregate([
      {
        $match: {
          organizer: mongoose.Types.ObjectId(req.userId),
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$startTime' },
          hour: { $hour: '$startTime' },
          duration: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 * 60
            ]
          },
          participantCount: { $size: '$participants' },
          hasAgenda: { $gt: [{ $size: '$agenda' }, 0] },
          status: 1
        }
      },
      {
        $group: {
          _id: {
            dayOfWeek: '$dayOfWeek',
            hour: '$hour'
          },
          avgDuration: { $avg: '$duration' },
          avgParticipants: { $avg: '$participantCount' },
          completionRate: {
            $avg: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          agendaUsage: {
            $avg: {
              $cond: ['$hasAgenda', 1, 0]
            }
          },
          meetingCount: { $sum: 1 }
        }
      },
      {
        $project: {
          dayOfWeek: '$_id.dayOfWeek',
          hour: '$_id.hour',
          avgDuration: { $round: ['$avgDuration', 2] },
          avgParticipants: { $round: ['$avgParticipants', 1] },
          completionRate: { $round: [{ $multiply: ['$completionRate', 100] }, 1] },
          agendaUsage: { $round: [{ $multiply: ['$agendaUsage', 100] }, 1] },
          productivityScore: {
            $round: [
              {
                $multiply: [
                  {
                    $add: [
                      { $multiply: ['$completionRate', 0.4] },
                      { $multiply: ['$agendaUsage', 0.3] },
                      {
                        $multiply: [
                          {
                            $cond: [
                              { $and: [{ $gte: ['$avgDuration', 15] }, { $lte: ['$avgDuration', 60] }] },
                              1,
                              0.5
                            ]
                          },
                          0.3
                        ]
                      }
                    ]
                  },
                  100
                ]
              },
              1
            ]
          },
          meetingCount: 1
        }
      },
      { $sort: { dayOfWeek: 1, hour: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        weeklyTrends,
        monthlyComparison,
        productivityPatterns,
        insights: {
          totalDataPoints: weeklyTrends.length,
          trendsDirection: weeklyTrends.length > 1 ? 
            (weeklyTrends[weeklyTrends.length - 1].meetingCount > weeklyTrends[0].meetingCount ? 'increasing' : 'decreasing') 
            : 'stable',
          mostProductiveHour: productivityPatterns.length > 0 ? 
            productivityPatterns.reduce((max, curr) => curr.productivityScore > max.productivityScore ? curr : max) 
            : null
        }
      }
    });

  } catch (error) {
    console.error('Get trends analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching trends analytics'
    });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.get('/export', validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get comprehensive data for export
    const exportData = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          startTime: { $gte: start, $lte: end }
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
        $project: {
          title: 1,
          description: 1,
          startTime: 1,
          endTime: 1,
          duration: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 * 60
            ]
          },
          status: 1,
          category: 1,
          priority: 1,
          participantCount: { $size: '$participants' },
          organizer: { $arrayElemAt: ['$organizerInfo.email', 0] },
          location: '$location.type',
          isRecurring: 1,
          tags: 1,
          createdAt: 1
        }
      },
      { $sort: { startTime: -1 } }
    ]);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = exportData.map(meeting => ({
        Title: meeting.title,
        Description: meeting.description || '',
        'Start Time': meeting.startTime.toISOString(),
        'End Time': meeting.endTime.toISOString(),
        'Duration (minutes)': Math.round(meeting.duration),
        Status: meeting.status,
        Category: meeting.category,
        Priority: meeting.priority,
        'Participant Count': meeting.participantCount,
        Organizer: meeting.organizer,
        'Location Type': meeting.location || 'not specified',
        'Is Recurring': meeting.isRecurring ? 'Yes' : 'No',
        Tags: meeting.tags.join(', '),
        'Created At': meeting.createdAt.toISOString()
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="meeting-analytics-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`);
      
      // Simple CSV conversion (in production, use proper CSV library)
      const headers = Object.keys(csv[0] || {});
      const csvContent = [
        headers.join(','),
        ...csv.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      
      res.send(csvContent);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="meeting-analytics-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.json"`);
      
      res.json({
        exportInfo: {
          generatedAt: new Date().toISOString(),
          period: { startDate: start, endDate: end },
          totalRecords: exportData.length,
          userId: req.userId
        },
        meetings: exportData
      });
    }

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error exporting analytics data'
    });
  }
});

module.exports = router;
