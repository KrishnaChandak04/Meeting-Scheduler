const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Meeting organizer is required']
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'tentative'],
      default: 'pending'
    },
    responseDate: Date,
    notes: String
  }],
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  location: {
    type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      default: 'virtual'
    },
    details: {
      address: String,
      room: String,
      meetingLink: String,
      conferenceId: String,
      instructions: String
    }
  },
  category: {
    type: String,
    enum: ['meeting', 'interview', 'training', 'presentation', 'standup', 'review', 'other'],
    default: 'meeting'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: function() { return this.isRecurring; }
    },
    interval: {
      type: Number,
      min: 1,
      default: 1
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6 // 0 = Sunday, 6 = Saturday
    }],
    endDate: Date,
    maxOccurrences: Number
  },
  parentMeeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    default: null // For recurring meetings
  },
  agenda: [{
    item: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: Number, // in minutes
      min: 1
    },
    presenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'notification', 'sms'],
      default: 'email'
    },
    minutesBefore: {
      type: Number,
      required: true,
      min: 0
    },
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  settings: {
    allowGuestInvites: {
      type: Boolean,
      default: false
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    maxParticipants: {
      type: Number,
      min: 1,
      max: 1000
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    recordMeeting: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    createdVia: {
      type: String,
      enum: ['web', 'mobile', 'api', 'calendar_sync'],
      default: 'web'
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    actualStartTime: Date,
    actualEndTime: Date,
    attendanceCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for meeting duration in minutes
meetingSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  return 0;
});

// Virtual for participant count
meetingSchema.virtual('participantCount').get(function() {
  return this.participants ? this.participants.length : 0;
});

// Virtual for accepted participants count
meetingSchema.virtual('acceptedCount').get(function() {
  return this.participants ? this.participants.filter(p => p.status === 'accepted').length : 0;
});

// Virtual to check if meeting is in past
meetingSchema.virtual('isPast').get(function() {
  return this.endTime < new Date();
});

// Virtual to check if meeting is today
meetingSchema.virtual('isToday').get(function() {
  const today = new Date();
  const meetingDate = new Date(this.startTime);
  return today.toDateString() === meetingDate.toDateString();
});

// Indexes for optimal query performance
meetingSchema.index({ organizer: 1, startTime: -1 });
meetingSchema.index({ 'participants.user': 1, startTime: -1 });
meetingSchema.index({ startTime: 1, endTime: 1 });
meetingSchema.index({ status: 1, startTime: 1 });
meetingSchema.index({ category: 1, startTime: -1 });
meetingSchema.index({ tags: 1 });
meetingSchema.index({ parentMeeting: 1 });

// Compound indexes for complex queries
meetingSchema.index({ organizer: 1, status: 1, startTime: -1 });
meetingSchema.index({ 'participants.user': 1, status: 1, startTime: -1 });

// Text index for full-text search
meetingSchema.index({
  title: 'text',
  description: 'text',
  'location.details.address': 'text',
  tags: 'text'
});

// Validation middleware
meetingSchema.pre('save', function(next) {
  // Ensure end time is after start time
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
    return;
  }
  
  // Ensure meeting is not in the past (for new meetings)
  if (this.isNew && this.startTime < new Date()) {
    next(new Error('Cannot schedule meetings in the past'));
    return;
  }
  
  // Add organizer to participants if not already present
  const organizerInParticipants = this.participants.some(
    p => p.user.toString() === this.organizer.toString()
  );
  
  if (!organizerInParticipants) {
    this.participants.push({
      user: this.organizer,
      status: 'accepted',
      responseDate: new Date()
    });
  }
  
  // Set lastModifiedBy
  if (this.isModified() && !this.isNew) {
    this.metadata.lastModifiedBy = this.organizer;
  }
  
  next();
});

// Static method to find conflicts for a user
meetingSchema.statics.findConflicts = function(userId, startTime, endTime, excludeMeetingId = null) {
  const query = {
    $or: [
      { organizer: userId },
      { 'participants.user': userId }
    ],
    status: { $nin: ['cancelled', 'completed'] },
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  };
  
  if (excludeMeetingId) {
    query._id = { $ne: excludeMeetingId };
  }
  
  return this.find(query);
};

// Static method for meeting analytics using aggregation
meetingSchema.statics.getMeetingAnalytics = function(userId, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  
  const matchStage = {
    $or: [
      { organizer: mongoose.Types.ObjectId(userId) },
      { 'participants.user': mongoose.Types.ObjectId(userId) }
    ]
  };
  
  if (startDate && endDate) {
    matchStage.startTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMeetings: { $sum: 1 },
        totalDuration: {
          $sum: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 * 60 // Convert to minutes
            ]
          }
        },
        meetingsByStatus: {
          $push: '$status'
        },
        meetingsByCategory: {
          $push: '$category'
        },
        averageParticipants: {
          $avg: { $size: '$participants' }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalMeetings: 1,
        totalDuration: { $round: ['$totalDuration', 2] },
        averageDuration: {
          $round: [
            { $divide: ['$totalDuration', '$totalMeetings'] },
            2
          ]
        },
        averageParticipants: { $round: ['$averageParticipants', 1] },
        statusBreakdown: {
          $reduce: {
            input: '$meetingsByStatus',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        },
        categoryBreakdown: {
          $reduce: {
            input: '$meetingsByCategory',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

// Static method to get user's meeting calendar
meetingSchema.statics.getUserCalendar = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { organizer: mongoose.Types.ObjectId(userId) },
          { 'participants.user': mongoose.Types.ObjectId(userId) }
        ],
        startTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: { $nin: ['cancelled'] }
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
        startTime: 1,
        endTime: 1,
        status: 1,
        category: 1,
        priority: 1,
        location: 1,
        'organizer.name': { $arrayElemAt: ['$organizerInfo.fullName', 0] },
        'organizer.email': { $arrayElemAt: ['$organizerInfo.email', 0] },
        participantCount: { $size: '$participants' },
        duration: {
          $divide: [
            { $subtract: ['$endTime', '$startTime'] },
            1000 * 60
          ]
        }
      }
    },
    { $sort: { startTime: 1 } }
  ]);
};

module.exports = mongoose.model('Meeting', meetingSchema);
