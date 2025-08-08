const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const reminderService = require('../services/reminderService');
const { 
  validateMeeting, 
  validateMeetingUpdate, 
  validateParticipantResponse,
  validateObjectId,
  validatePagination,
  validateDateRange
} = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/meetings
// @desc    Create a new meeting
// @access  Private
router.post('/', validateMeeting, async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      participants,
      location,
      category,
      priority,
      isRecurring,
      recurrence,
      agenda,
      reminders,
      tags,
      settings
    } = req.body;

    // Check for conflicts for organizer
    const conflicts = await Meeting.findConflicts(
      req.userId,
      new Date(startTime),
      new Date(endTime)
    );

    if (conflicts.length > 0) {
      // Send conflict notification but don't block creation
      const io = req.app.get('socketio');
      notificationService.sendConflictDetection(io, req.userId, conflicts);
    }

    // Create meeting
    const meeting = new Meeting({
      title,
      description,
      organizer: req.userId,
      participants: participants.map(p => ({
        user: p.user || p,
        status: p.status || 'pending'
      })),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      category: category || 'meeting',
      priority: priority || 'medium',
      isRecurring: isRecurring || false,
      recurrence,
      agenda: agenda || [],
      reminders: reminders || [
        { type: 'email', minutesBefore: 15 },
        { type: 'notification', minutesBefore: 5 }
      ],
      tags: tags || [],
      settings: settings || {}
    });

    await meeting.save();

    // Populate meeting data for response
    await meeting.populate([
      { path: 'organizer', select: 'firstName lastName email' },
      { path: 'participants.user', select: 'firstName lastName email' }
    ]);

    // Send invitations to participants
    const io = req.app.get('socketio');
    const organizer = await User.findById(req.userId);

    for (const participant of meeting.participants) {
      if (participant.user._id.toString() !== req.userId.toString()) {
        try {
          // Send email invitation
          await emailService.sendMeetingInvite(
            meeting,
            participant.user.email,
            participant.user.fullName
          );

          // Send real-time notification
          notificationService.sendMeetingInvite(
            io,
            participant.user._id,
            meeting,
            organizer
          );
        } catch (error) {
          console.error(`Failed to send invitation to ${participant.user.email}:`, error);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: { meeting }
    });

  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error creating meeting'
    });
  }
});

// @route   GET /api/meetings
// @desc    Get user's meetings with advanced filtering
// @access  Private
router.get('/', validatePagination, validateDateRange, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      status,
      category,
      priority,
      search,
      sortBy = 'startTime',
      sortOrder = 'asc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build match criteria
    const matchCriteria = {
      $or: [
        { organizer: mongoose.Types.ObjectId(req.userId) },
        { 'participants.user': mongoose.Types.ObjectId(req.userId) }
      ]
    };

    // Add filters
    if (startDate || endDate) {
      matchCriteria.startTime = {};
      if (startDate) matchCriteria.startTime.$gte = new Date(startDate);
      if (endDate) matchCriteria.startTime.$lte = new Date(endDate);
    }

    if (status) matchCriteria.status = status;
    if (category) matchCriteria.category = category;
    if (priority) matchCriteria.priority = priority;

    if (search) {
      matchCriteria.$text = { $search: search };
    }

    // MongoDB Aggregation Pipeline for advanced meeting analytics
    const pipeline = [
      { $match: matchCriteria },
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
          duration: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 * 60 // Convert to minutes
            ]
          },
          acceptedCount: {
            $size: {
              $filter: {
                input: '$participants',
                cond: { $eq: ['$$this.status', 'accepted'] }
              }
            }
          },
          pendingCount: {
            $size: {
              $filter: {
                input: '$participants',
                cond: { $eq: ['$$this.status', 'pending'] }
              }
            }
          },
          declinedCount: {
            $size: {
              $filter: {
                input: '$participants',
                cond: { $eq: ['$$this.status', 'declined'] }
              }
            }
          },
          isToday: {
            $and: [
              {
                $gte: [
                  '$startTime',
                  { $dateFromString: { dateString: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z' } }
                ]
              },
              {
                $lt: [
                  '$startTime',
                  { $dateFromString: { dateString: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0] + 'T00:00:00.000Z' } }
                ]
              }
            ]
          },
          isPast: { $lt: ['$endTime', new Date()] },
          hasConflicts: false // This would be calculated in a more complex aggregation
        }
      },
      {
        $project: {
          title: 1,
          description: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          category: 1,
          priority: 1,
          location: 1,
          duration: 1,
          participantCount: { $size: '$participants' },
          acceptedCount: 1,
          pendingCount: 1,
          declinedCount: 1,
          isToday: 1,
          isPast: 1,
          hasConflicts: 1,
          organizer: {
            id: { $arrayElemAt: ['$organizerInfo._id', 0] },
            name: { $arrayElemAt: ['$organizerInfo.fullName', 0] },
            email: { $arrayElemAt: ['$organizerInfo.email', 0] }
          },
          tags: 1,
          reminders: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // Execute aggregation
    const meetings = await Meeting.aggregate(pipeline);

    // Get total count for pagination
    const totalPipeline = [
      { $match: matchCriteria },
      { $count: 'total' }
    ];
    const totalResult = await Meeting.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
      data: {
        meetings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      }
    });

  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching meetings'
    });
  }
});

// @route   GET /api/meetings/analytics
// @desc    Get meeting analytics using MongoDB aggregation
// @access  Private
router.get('/analytics', validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Use the static method that implements MongoDB aggregation
    const analytics = await Meeting.getMeetingAnalytics(req.userId, {
      startDate,
      endDate
    });

    // Additional aggregation for time-based analytics
    const timeAnalytics = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          ...(startDate && endDate && {
            startTime: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' },
            day: { $dayOfMonth: '$startTime' }
          },
          count: { $sum: 1 },
          totalDuration: {
            $sum: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60
              ]
            }
          },
          categories: { $push: '$category' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
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
          meetingCount: '$count',
          totalDuration: { $round: ['$totalDuration', 2] },
          averageDuration: {
            $round: [{ $divide: ['$totalDuration', '$count'] }, 2]
          },
          categories: 1
        }
      }
    ]);

    // Department comparison (if user has department)
    const user = await User.findById(req.userId);
    let departmentComparison = null;

    if (user.department) {
      departmentComparison = await Meeting.aggregate([
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
            'organizerInfo.department': user.department,
            ...(startDate && endDate && {
              startTime: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
            })
          }
        },
        {
          $group: {
            _id: '$organizerInfo.department',
            totalMeetings: { $sum: 1 },
            avgDuration: {
              $avg: {
                $divide: [
                  { $subtract: ['$endTime', '$startTime'] },
                  1000 * 60
                ]
              }
            },
            avgParticipants: {
              $avg: { $size: '$participants' }
            }
          }
        }
      ]);
    }

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalMeetings: 0,
          totalDuration: 0,
          averageDuration: 0,
          averageParticipants: 0,
          statusBreakdown: {},
          categoryBreakdown: {}
        },
        timeAnalytics,
        departmentComparison: departmentComparison?.[0] || null,
        period: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present'
        }
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching meeting analytics'
    });
  }
});

// @route   GET /api/meetings/calendar
// @desc    Get calendar view of meetings using aggregation
// @access  Private
router.get('/calendar', validateDateRange, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'Start date and end date are required for calendar view'
      });
    }

    // Use the static method that implements MongoDB aggregation
    const calendarData = await Meeting.getUserCalendar(
      req.userId,
      startDate,
      endDate
    );

    // Group meetings by date for easier frontend consumption
    const groupedByDate = calendarData.reduce((acc, meeting) => {
      const date = meeting.startTime.toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = {
          date,
          meetings: [],
          totalMeetings: 0,
          totalDuration: 0
        };
      }
      
      acc[date].meetings.push(meeting);
      acc[date].totalMeetings++;
      acc[date].totalDuration += meeting.duration;
      
      return acc;
    }, {});

    // Convert to array and sort by date
    const calendar = Object.values(groupedByDate).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calculate summary stats
    const summary = {
      totalMeetings: calendarData.length,
      totalDuration: calendarData.reduce((sum, m) => sum + m.duration, 0),
      busyDays: calendar.length,
      averageMeetingsPerDay: calendar.length > 0 ? 
        Math.round(calendarData.length / calendar.length * 10) / 10 : 0
    };

    res.json({
      success: true,
      data: {
        calendar,
        summary,
        period: {
          startDate,
          endDate
        }
      }
    });

  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching calendar data'
    });
  }
});

// @route   GET /api/meetings/:id
// @desc    Get meeting by ID
// @access  Private
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'firstName lastName email department position')
      .populate('participants.user', 'firstName lastName email department position')
      .populate('agenda.presenter', 'firstName lastName email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
        message: 'The requested meeting does not exist'
      });
    }

    // Check if user has access to this meeting
    const hasAccess = meeting.organizer._id.toString() === req.userId.toString() ||
      meeting.participants.some(p => p.user._id.toString() === req.userId.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this meeting'
      });
    }

    res.json({
      success: true,
      data: { meeting }
    });

  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching meeting'
    });
  }
});

// @route   PUT /api/meetings/:id
// @desc    Update meeting
// @access  Private
router.put('/:id', validateObjectId('id'), validateMeetingUpdate, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
        message: 'The requested meeting does not exist'
      });
    }

    // Check if user is the organizer
    if (meeting.organizer.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the meeting organizer can update this meeting'
      });
    }

    // Track changes for notifications
    const changes = {};
    const allowedUpdates = [
      'title', 'description', 'startTime', 'endTime', 'location',
      'category', 'priority', 'status', 'agenda', 'reminders', 'tags'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (JSON.stringify(meeting[field]) !== JSON.stringify(req.body[field])) {
          changes[field] = req.body[field];
        }
        meeting[field] = req.body[field];
      }
    });

    await meeting.save();

    // Populate for response
    await meeting.populate([
      { path: 'organizer', select: 'firstName lastName email' },
      { path: 'participants.user', select: 'firstName lastName email' }
    ]);

    // Send update notifications if there are changes
    if (Object.keys(changes).length > 0) {
      const io = req.app.get('socketio');
      const organizer = await User.findById(req.userId);
      const participantIds = meeting.participants.map(p => p.user._id.toString());

      // Send email notifications
      for (const participant of meeting.participants) {
        if (participant.user._id.toString() !== req.userId.toString()) {
          try {
            await emailService.sendMeetingUpdate(
              meeting,
              participant.user.email,
              changes
            );
          } catch (error) {
            console.error(`Failed to send update email to ${participant.user.email}:`, error);
          }
        }
      }

      // Send real-time notifications
      notificationService.sendMeetingUpdate(
        io,
        participantIds.filter(id => id !== req.userId.toString()),
        meeting,
        changes,
        organizer
      );
    }

    res.json({
      success: true,
      message: 'Meeting updated successfully',
      data: { meeting, changes }
    });

  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error updating meeting'
    });
  }
});

// @route   POST /api/meetings/:id/respond
// @desc    Respond to meeting invitation
// @access  Private
router.post('/:id/respond', validateObjectId('id'), validateParticipantResponse, async (req, res) => {
  try {
    const { response, notes } = req.body;

    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'firstName lastName email')
      .populate('participants.user', 'firstName lastName email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
        message: 'The requested meeting does not exist'
      });
    }

    // Find participant
    const participantIndex = meeting.participants.findIndex(
      p => p.user._id.toString() === req.userId.toString()
    );

    if (participantIndex === -1) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You are not invited to this meeting'
      });
    }

    // Update participant response
    meeting.participants[participantIndex].status = response;
    meeting.participants[participantIndex].responseDate = new Date();
    if (notes) {
      meeting.participants[participantIndex].notes = notes;
    }

    await meeting.save();

    // Send notification to organizer
    const io = req.app.get('socketio');
    const participant = await User.findById(req.userId);

    notificationService.sendParticipantResponse(
      io,
      meeting.organizer._id,
      meeting,
      participant,
      response
    );

    res.json({
      success: true,
      message: `Meeting invitation ${response} successfully`,
      data: {
        meetingId: meeting._id,
        response,
        responseDate: meeting.participants[participantIndex].responseDate
      }
    });

  } catch (error) {
    console.error('Respond to meeting error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error responding to meeting invitation'
    });
  }
});

// @route   DELETE /api/meetings/:id
// @desc    Cancel/Delete meeting
// @access  Private
router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const { reason } = req.body;

    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'firstName lastName email')
      .populate('participants.user', 'firstName lastName email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
        message: 'The requested meeting does not exist'
      });
    }

    // Check if user is the organizer
    if (meeting.organizer._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the meeting organizer can cancel this meeting'
      });
    }

    // Update meeting status instead of deleting
    meeting.status = 'cancelled';
    if (reason) {
      meeting.description = (meeting.description || '') + `\n\nCancellation reason: ${reason}`;
    }
    await meeting.save();

    // Send cancellation notifications
    const io = req.app.get('socketio');
    const organizer = await User.findById(req.userId);
    const participantIds = meeting.participants
      .filter(p => p.user._id.toString() !== req.userId.toString())
      .map(p => p.user._id.toString());

    // Send email notifications
    for (const participant of meeting.participants) {
      if (participant.user._id.toString() !== req.userId.toString()) {
        try {
          await emailService.sendMeetingCancellation(
            meeting,
            participant.user.email
          );
        } catch (error) {
          console.error(`Failed to send cancellation email to ${participant.user.email}:`, error);
        }
      }
    }

    // Send real-time notifications
    notificationService.sendMeetingCancellation(
      io,
      participantIds,
      meeting,
      organizer,
      reason
    );

    res.json({
      success: true,
      message: 'Meeting cancelled successfully',
      data: {
        meetingId: meeting._id,
        status: meeting.status,
        reason
      }
    });

  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error cancelling meeting'
    });
  }
});

module.exports = router;
