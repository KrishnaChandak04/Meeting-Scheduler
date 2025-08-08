const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const { validateSearch, validatePagination } = require('../middleware/validation');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/search
// @desc    Search users for meeting invitations
// @access  Private
router.get('/search', validateSearch, async (req, res) => {
  try {
    const { q = '', limit = 10, skip = 0, department } = req.query;

    const users = await User.searchUsers(q, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      department
    });

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
          position: user.position,
          avatar: user.avatar
        })),
        count: users.length
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error searching users'
    });
  }
});

// @route   GET /api/users/suggestions
// @desc    Get user suggestions based on meeting history and department
// @access  Private
router.get('/suggestions', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // MongoDB Aggregation to find frequently collaborated users
    const suggestions = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(req.userId) },
            { 'participants.user': mongoose.Types.ObjectId(req.userId) }
          ],
          status: { $ne: 'cancelled' }
        }
      },
      {
        $unwind: '$participants'
      },
      {
        $match: {
          'participants.user': { $ne: mongoose.Types.ObjectId(req.userId) }
        }
      },
      {
        $group: {
          _id: '$participants.user',
          meetingCount: { $sum: 1 },
          lastMeeting: { $max: '$startTime' },
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
      {
        $unwind: '$userInfo'
      },
      {
        $match: {
          'userInfo.isActive': true
        }
      },
      {
        $project: {
          _id: 0,
          user: {
            id: '$userInfo._id',
            firstName: '$userInfo.firstName',
            lastName: '$userInfo.lastName',
            fullName: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
            email: '$userInfo.email',
            department: '$userInfo.department',
            position: '$userInfo.position',
            avatar: '$userInfo.avatar'
          },
          collaborationScore: {
            $add: [
              { $multiply: ['$meetingCount', 0.4] },
              { $multiply: ['$acceptanceRate', 100, 0.6] }
            ]
          },
          meetingCount: 1,
          lastMeeting: 1,
          acceptanceRate: { $round: [{ $multiply: ['$acceptanceRate', 100] }, 1] }
        }
      },
      {
        $sort: { collaborationScore: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // Get current user's department for additional suggestions
    const currentUser = await User.findById(req.userId);
    let departmentSuggestions = [];

    if (currentUser.department) {
      departmentSuggestions = await User.findByDepartment(currentUser.department)
        .limit(5)
        .select('firstName lastName email department position avatar');
    }

    res.json({
      success: true,
      data: {
        frequentCollaborators: suggestions,
        departmentColleagues: departmentSuggestions.map(user => ({
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
          position: user.position,
          avatar: user.avatar,
          reason: 'Same department'
        }))
      }
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching user suggestions'
    });
  }
});

// @route   GET /api/users/availability
// @desc    Check availability of multiple users for a time slot
// @access  Private
router.get('/availability', async (req, res) => {
  try {
    const { userIds, startTime, endTime } = req.query;

    if (!userIds || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'userIds, startTime, and endTime are required'
      });
    }

    const userIdArray = Array.isArray(userIds) ? userIds : userIds.split(',');
    const start = new Date(startTime);
    const end = new Date(endTime);

    // MongoDB Aggregation to check availability
    const availability = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: { $in: userIdArray.map(id => mongoose.Types.ObjectId(id)) } },
            { 'participants.user': { $in: userIdArray.map(id => mongoose.Types.ObjectId(id)) } }
          ],
          status: { $nin: ['cancelled', 'completed'] },
          startTime: { $lt: end },
          endTime: { $gt: start }
        }
      },
      {
        $project: {
          conflictedUsers: {
            $concatArrays: [
              [{ user: '$organizer', type: 'organizer' }],
              {
                $map: {
                  input: '$participants',
                  as: 'participant',
                  in: {
                    user: '$$participant.user',
                    type: 'participant',
                    status: '$$participant.status'
                  }
                }
              }
            ]
          },
          title: 1,
          startTime: 1,
          endTime: 1
        }
      },
      {
        $unwind: '$conflictedUsers'
      },
      {
        $match: {
          'conflictedUsers.user': { $in: userIdArray.map(id => mongoose.Types.ObjectId(id)) }
        }
      },
      {
        $group: {
          _id: '$conflictedUsers.user',
          conflicts: {
            $push: {
              meetingId: '$_id',
              title: '$title',
              startTime: '$startTime',
              endTime: '$endTime',
              role: '$conflictedUsers.type',
              status: '$conflictedUsers.status'
            }
          }
        }
      }
    ]);

    // Get user information and build response
    const users = await User.find({
      _id: { $in: userIdArray }
    }).select('firstName lastName email department preferences');

    const availabilityMap = users.map(user => {
      const userConflicts = availability.find(
        a => a._id.toString() === user._id.toString()
      );

      const isAvailable = !userConflicts || userConflicts.conflicts.length === 0;
      
      // Check working hours if available
      let inWorkingHours = true;
      if (user.preferences?.workingHours) {
        const startHour = parseInt(user.preferences.workingHours.start.split(':')[0]);
        const endHour = parseInt(user.preferences.workingHours.end.split(':')[0]);
        const meetingStartHour = start.getHours();
        const meetingEndHour = end.getHours();
        
        inWorkingHours = meetingStartHour >= startHour && meetingEndHour <= endHour;
      }

      return {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          department: user.department
        },
        isAvailable,
        inWorkingHours,
        conflicts: userConflicts ? userConflicts.conflicts : [],
        workingHours: user.preferences?.workingHours
      };
    });

    // Summary statistics
    const summary = {
      totalUsers: availabilityMap.length,
      availableUsers: availabilityMap.filter(u => u.isAvailable).length,
      conflictedUsers: availabilityMap.filter(u => !u.isAvailable).length,
      outOfHours: availabilityMap.filter(u => !u.inWorkingHours).length
    };

    res.json({
      success: true,
      data: {
        timeSlot: {
          startTime: start,
          endTime: end,
          duration: Math.round((end - start) / (1000 * 60)) // minutes
        },
        availability: availabilityMap,
        summary
      }
    });

  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error checking user availability'
    });
  }
});

// @route   GET /api/users/departments
// @desc    Get list of departments
// @access  Private
router.get('/departments', async (req, res) => {
  try {
    const departments = await User.aggregate([
      {
        $match: {
          isActive: true,
          department: { $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$department',
          userCount: { $sum: 1 },
          positions: { $addToSet: '$position' }
        }
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          userCount: 1,
          positions: {
            $filter: {
              input: '$positions',
              cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
            }
          }
        }
      },
      {
        $sort: { department: 1 }
      }
    ]);

    res.json({
      success: true,
      data: { departments }
    });

  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching departments'
    });
  }
});

// @route   GET /api/users/:id/schedule
// @desc    Get user's schedule summary
// @access  Private
router.get('/:id/schedule', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const targetUserId = req.params.id;

    // Check if requesting user has permission to view this schedule
    if (targetUserId !== req.userId.toString()) {
      // Allow if they have meetings together or if admin
      const sharedMeetings = await Meeting.findOne({
        $and: [
          {
            $or: [
              { organizer: mongoose.Types.ObjectId(req.userId) },
              { 'participants.user': mongoose.Types.ObjectId(req.userId) }
            ]
          },
          {
            $or: [
              { organizer: mongoose.Types.ObjectId(targetUserId) },
              { 'participants.user': mongoose.Types.ObjectId(targetUserId) }
            ]
          }
        ]
      });

      if (!sharedMeetings) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to view this user\'s schedule'
        });
      }
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Get schedule using aggregation
    const schedule = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: mongoose.Types.ObjectId(targetUserId) },
            { 'participants.user': mongoose.Types.ObjectId(targetUserId) }
          ],
          startTime: { $gte: start, $lte: end },
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $project: {
          title: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          category: 1,
          priority: 1,
          duration: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 * 60
            ]
          },
          isOrganizer: { $eq: ['$organizer', mongoose.Types.ObjectId(targetUserId)] }
        }
      },
      {
        $sort: { startTime: 1 }
      }
    ]);

    // Calculate busy time slots
    const busySlots = schedule.map(meeting => ({
      start: meeting.startTime,
      end: meeting.endTime,
      title: meeting.title,
      category: meeting.category,
      priority: meeting.priority
    }));

    // Calculate statistics
    const stats = {
      totalMeetings: schedule.length,
      totalDuration: schedule.reduce((sum, m) => sum + m.duration, 0),
      averageDuration: schedule.length > 0 ? 
        Math.round(schedule.reduce((sum, m) => sum + m.duration, 0) / schedule.length) : 0,
      organizedMeetings: schedule.filter(m => m.isOrganizer).length,
      attendingMeetings: schedule.filter(m => !m.isOrganizer).length
    };

    res.json({
      success: true,
      data: {
        schedule,
        busySlots,
        stats,
        period: {
          startDate: start,
          endDate: end
        }
      }
    });

  } catch (error) {
    console.error('Get user schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching user schedule'
    });
  }
});

// Admin routes

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', requireAdmin, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      department,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build match criteria
    const matchCriteria = {};

    if (search) {
      matchCriteria.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    if (department) {
      matchCriteria.department = department;
    }

    if (isActive !== undefined) {
      matchCriteria.isActive = isActive === 'true';
    }

    const users = await User.find(matchCriteria)
      .select('-password')
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(matchCriteria);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error fetching users'
    });
  }
});

// @route   PUT /api/users/:id/status
// @desc    Update user status (Admin only)
// @access  Private/Admin
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'isActive must be a boolean value'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error updating user status'
    });
  }
});

module.exports = router;
