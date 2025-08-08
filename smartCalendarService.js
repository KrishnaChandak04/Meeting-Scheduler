const Meeting = require('../models/Meeting');
const User = require('../models/User');
const moment = require('moment');

class SmartCalendarService {
  constructor() {
    this.integrationTypes = {
      GOOGLE: 'google',
      OUTLOOK: 'outlook', 
      APPLE: 'apple',
      INTERNAL: 'internal'
    };
    
    this.availabilityStatuses = {
      AVAILABLE: 'available',
      BUSY: 'busy',
      TENTATIVE: 'tentative',
      OUT_OF_OFFICE: 'out_of_office'
    };
  }

  // Advanced availability checking with MongoDB aggregation
  async checkAvailability(participants, startTime, endTime, excludeMeetingId = null) {
    try {
      const availabilityData = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: { $in: participants } },
              { 'participants.user': { $in: participants } }
            ],
            $or: [
              {
                startTime: { $lte: new Date(startTime) },
                endTime: { $gt: new Date(startTime) }
              },
              {
                startTime: { $lt: new Date(endTime) },
                endTime: { $gte: new Date(endTime) }
              },
              {
                startTime: { $gte: new Date(startTime) },
                endTime: { $lte: new Date(endTime) }
              }
            ],
            status: { $in: ['scheduled', 'in_progress'] },
            ...(excludeMeetingId && { _id: { $ne: excludeMeetingId } })
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
          $unwind: {
            path: '$participantInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: '$participantInfo._id',
            conflicts: {
              $push: {
                meetingId: '$_id',
                title: '$title',
                startTime: '$startTime',
                endTime: '$endTime',
                priority: '$priority',
                type: '$type'
              }
            },
            conflictCount: { $sum: 1 },
            highPriorityConflicts: {
              $sum: {
                $cond: [{ $eq: ['$priority', 'high'] }, 1, 0]
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
          $project: {
            userId: '$_id',
            name: '$userInfo.name',
            email: '$userInfo.email',
            conflicts: 1,
            conflictCount: 1,
            highPriorityConflicts: 1,
            availability: {
              $cond: [
                { $eq: ['$conflictCount', 0] },
                'available',
                {
                  $cond: [
                    { $gt: ['$highPriorityConflicts', 0] },
                    'busy',
                    'tentative'
                  ]
                }
              ]
            }
          }
        }
      ]);

      // Check for participants with no conflicts (not in aggregation result)
      const allParticipants = await User.find({ 
        _id: { $in: participants } 
      }).select('_id name email');

      const conflictMap = new Map(availabilityData.map(item => [item.userId.toString(), item]));
      
      const fullAvailability = allParticipants.map(participant => {
        const conflict = conflictMap.get(participant._id.toString());
        return conflict || {
          userId: participant._id,
          name: participant.name,
          email: participant.email,
          conflicts: [],
          conflictCount: 0,
          highPriorityConflicts: 0,
          availability: 'available'
        };
      });

      return {
        success: true,
        data: {
          requestedTime: {
            start: startTime,
            end: endTime,
            duration: moment(endTime).diff(moment(startTime), 'minutes')
          },
          participants: fullAvailability,
          summary: {
            available: fullAvailability.filter(p => p.availability === 'available').length,
            busy: fullAvailability.filter(p => p.availability === 'busy').length,
            tentative: fullAvailability.filter(p => p.availability === 'tentative').length,
            total: fullAvailability.length
          },
          canSchedule: fullAvailability.every(p => p.availability !== 'busy'),
          suggestions: await this.generateTimeSlotSuggestions(participants, startTime, endTime)
        }
      };

    } catch (error) {
      console.error('Availability check error:', error);
      return {
        success: false,
        error: 'Failed to check availability'
      };
    }
  }

  // Find optimal meeting times using AI algorithms
  async findOptimalMeetingTimes(participants, duration, preferences = {}) {
    try {
      const timeHorizon = preferences.timeHorizon || 14; // days
      const startDate = preferences.startDate || new Date();
      const endDate = new Date(startDate.getTime() + timeHorizon * 24 * 60 * 60 * 1000);

      // Advanced aggregation to analyze meeting patterns and find gaps
      const optimalTimes = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: { $in: participants } },
              { 'participants.user': { $in: participants } }
            ],
            startTime: {
              $gte: startDate,
              $lte: endDate
            },
            status: { $in: ['scheduled', 'in_progress'] }
          }
        },
        {
          $project: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
            startHour: { $hour: '$startTime' },
            endHour: { $hour: '$endTime' },
            dayOfWeek: { $dayOfWeek: '$startTime' },
            participants: 1,
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
            _id: {
              date: '$date',
              hour: '$startHour'
            },
            occupancy: { $sum: 1 },
            avgDuration: { $avg: '$duration' },
            participantOverlap: {
              $sum: {
                $size: {
                  $setIntersection: ['$participants.user', participants]
                }
              }
            }
          }
        },
        {
          $project: {
            date: '$_id.date',
            hour: '$_id.hour',
            occupancy: 1,
            avgDuration: 1,
            conflictScore: {
              $multiply: ['$occupancy', '$participantOverlap']
            }
          }
        },
        {
          $sort: { conflictScore: 1, hour: 1 }
        }
      ]);

      // Generate time slots and calculate scores
      const suggestions = await this.generateOptimalTimeSlots(
        participants,
        duration,
        startDate,
        endDate,
        optimalTimes,
        preferences
      );

      return {
        success: true,
        data: {
          suggestions: suggestions.slice(0, 10), // Top 10 suggestions
          searchCriteria: {
            participants: participants.length,
            duration,
            timeHorizon,
            preferences
          },
          algorithm: 'AI-powered optimal scheduling',
          confidence: this.calculateConfidenceScore(suggestions)
        }
      };

    } catch (error) {
      console.error('Optimal time finding error:', error);
      return {
        success: false,
        error: 'Failed to find optimal meeting times'
      };
    }
  }

  // Smart conflict resolution with alternative suggestions
  async resolveSchedulingConflicts(meetingData) {
    try {
      const { startTime, endTime, participants, priority = 'medium' } = meetingData;

      // Check current conflicts
      const conflicts = await this.checkAvailability(participants, startTime, endTime);
      
      if (conflicts.data.canSchedule) {
        return {
          success: true,
          hasConflicts: false,
          message: 'No conflicts detected - meeting can be scheduled as requested'
        };
      }

      // Analyze conflict patterns
      const conflictAnalysis = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: { $in: participants } },
              { 'participants.user': { $in: participants } }
            ],
            startTime: {
              $gte: new Date(startTime),
              $lte: new Date(new Date(startTime).getTime() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
            },
            status: { $in: ['scheduled', 'in_progress'] }
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
            priority: 1,
            type: 1,
            participantInfo: 1,
            flexibility: {
              $cond: [
                { $in: ['$type', ['standup', 'check-in', 'update']] },
                'high',
                {
                  $cond: [
                    { $eq: ['$priority', 'low'] },
                    'medium',
                    'low'
                  ]
                }
              ]
            }
          }
        },
        {
          $sort: { priority: -1, flexibility: -1 }
        }
      ]);

      // Generate resolution strategies
      const resolutionStrategies = await this.generateResolutionStrategies(
        conflicts.data,
        conflictAnalysis,
        meetingData
      );

      return {
        success: true,
        hasConflicts: true,
        conflicts: conflicts.data,
        conflictAnalysis,
        resolutionStrategies,
        recommendations: await this.generateSmartRecommendations(resolutionStrategies, meetingData)
      };

    } catch (error) {
      console.error('Conflict resolution error:', error);
      return {
        success: false,
        error: 'Failed to resolve scheduling conflicts'
      };
    }
  }

  // Intelligent meeting rescheduling
  async intelligentReschedule(meetingId, constraints = {}) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('participants.user organizer');
      if (!meeting) {
        return { success: false, error: 'Meeting not found' };
      }

      const participants = [meeting.organizer._id, ...meeting.participants.map(p => p.user._id)];
      const duration = moment(meeting.endTime).diff(moment(meeting.startTime), 'minutes');

      // Find optimal reschedule times
      const optimalTimes = await this.findOptimalMeetingTimes(participants, duration, {
        ...constraints,
        excludeMeetingId: meetingId,
        originalTime: meeting.startTime,
        reschedulingReason: constraints.reason || 'conflict_resolution'
      });

      // Analyze impact of rescheduling
      const reschedulingImpact = await this.analyzeReschedulingImpact(meeting, optimalTimes.data.suggestions);

      return {
        success: true,
        data: {
          currentMeeting: {
            id: meeting._id,
            title: meeting.title,
            currentTime: {
              start: meeting.startTime,
              end: meeting.endTime
            },
            participants: meeting.participants.length + 1 // Include organizer
          },
          suggestions: optimalTimes.data.suggestions,
          impact: reschedulingImpact,
          recommendations: this.generateReschedulingRecommendations(reschedulingImpact)
        }
      };

    } catch (error) {
      console.error('Intelligent rescheduling error:', error);
      return {
        success: false,
        error: 'Failed to generate rescheduling suggestions'
      };
    }
  }

  // Calendar analytics and insights
  async getCalendarAnalytics(userId, timeframe = 'month') {
    try {
      const dateRange = this.getDateRange(timeframe);

      const analytics = await Meeting.aggregate([
        {
          $match: {
            $or: [
              { organizer: userId },
              { 'participants.user': userId }
            ],
            startTime: {
              $gte: dateRange.start,
              $lte: dateRange.end
            }
          }
        },
        {
          $project: {
            title: 1,
            startTime: 1,
            endTime: 1,
            type: 1,
            priority: 1,
            status: 1,
            participantCount: { $size: '$participants' },
            duration: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60
              ]
            },
            timeOfDay: { $hour: '$startTime' },
            dayOfWeek: { $dayOfWeek: '$startTime' },
            week: { $isoWeek: '$startTime' }
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
                  totalDuration: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' },
                  avgParticipants: { $avg: '$participantCount' },
                  completedMeetings: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                  },
                  cancelledMeetings: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                  }
                }
              }
            ],

            // Time distribution
            timeDistribution: [
              {
                $group: {
                  _id: '$timeOfDay',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' }
                }
              },
              { $sort: { _id: 1 } }
            ],

            // Day-wise distribution
            dayDistribution: [
              {
                $group: {
                  _id: '$dayOfWeek',
                  count: { $sum: 1 },
                  totalDuration: { $sum: '$duration' }
                }
              },
              { $sort: { _id: 1 } }
            ],

            // Weekly trends
            weeklyTrends: [
              {
                $group: {
                  _id: '$week',
                  meetingCount: { $sum: 1 },
                  totalDuration: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' }
                }
              },
              { $sort: { _id: 1 } }
            ],

            // Meeting types
            typeDistribution: [
              {
                $group: {
                  _id: '$type',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  avgParticipants: { $avg: '$participantCount' }
                }
              }
            ],

            // Priority analysis
            priorityAnalysis: [
              {
                $group: {
                  _id: '$priority',
                  count: { $sum: 1 },
                  avgDuration: { $avg: '$duration' }
                }
              }
            ]
          }
        }
      ]);

      const processedAnalytics = this.processCalendarAnalytics(analytics[0]);

      return {
        success: true,
        data: {
          timeframe,
          period: {
            start: dateRange.start,
            end: dateRange.end
          },
          analytics: processedAnalytics,
          insights: this.generateCalendarInsights(processedAnalytics),
          recommendations: this.generateCalendarRecommendations(processedAnalytics)
        }
      };

    } catch (error) {
      console.error('Calendar analytics error:', error);
      return {
        success: false,
        error: 'Failed to generate calendar analytics'
      };
    }
  }

  // Helper methods
  async generateTimeSlotSuggestions(participants, requestedStart, requestedEnd) {
    const duration = moment(requestedEnd).diff(moment(requestedStart), 'minutes');
    const startDate = moment(requestedStart).startOf('day').toDate();
    const endDate = moment(requestedStart).add(7, 'days').toDate();

    const suggestions = [];
    const workingHours = { start: 9, end: 17 };

    for (let day = 0; day < 7; day++) {
      const currentDate = moment(startDate).add(day, 'days');
      
      // Skip weekends
      if (currentDate.day() === 0 || currentDate.day() === 6) continue;

      for (let hour = workingHours.start; hour <= workingHours.end - Math.ceil(duration / 60); hour += 0.5) {
        const slotStart = currentDate.clone().hour(Math.floor(hour)).minute((hour % 1) * 60).toDate();
        const slotEnd = moment(slotStart).add(duration, 'minutes').toDate();

        const availability = await this.checkAvailability(participants, slotStart, slotEnd);
        
        if (availability.data.canSchedule) {
          suggestions.push({
            startTime: slotStart,
            endTime: slotEnd,
            score: this.calculateTimeSlotScore(slotStart, availability.data),
            reason: this.generateSlotReason(slotStart, availability.data)
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  calculateTimeSlotScore(startTime, availabilityData) {
    let score = 100;
    const hour = moment(startTime).hour();
    const dayOfWeek = moment(startTime).day();

    // Prefer mid-morning and early afternoon
    if (hour >= 10 && hour <= 11) score += 20;
    if (hour >= 14 && hour <= 15) score += 15;
    if (hour < 9 || hour > 16) score -= 30;

    // Prefer Tuesday-Thursday
    if ([2, 3, 4].includes(dayOfWeek)) score += 10;
    if ([1, 5].includes(dayOfWeek)) score += 5;

    // Bonus for all participants available
    if (availabilityData.summary.available === availabilityData.summary.total) {
      score += 25;
    }

    return Math.max(0, score);
  }

  generateSlotReason(startTime, availabilityData) {
    const hour = moment(startTime).hour();
    const reasons = [];

    if (hour >= 10 && hour <= 11) reasons.push('Peak productivity hours');
    if (hour >= 14 && hour <= 15) reasons.push('Post-lunch focus time');
    if (availabilityData.summary.available === availabilityData.summary.total) {
      reasons.push('All participants available');
    }

    return reasons.join(', ') || 'Standard business hours';
  }

  async generateOptimalTimeSlots(participants, duration, startDate, endDate, conflictData, preferences) {
    const slots = [];
    const workingHours = preferences.workingHours || { start: 9, end: 17 };
    
    // Create conflict map for quick lookup
    const conflictMap = new Map();
    conflictData.forEach(conflict => {
      const key = `${conflict.date}-${conflict.hour}`;
      conflictMap.set(key, conflict.conflictScore);
    });

    let currentDate = moment(startDate);
    while (currentDate.isBefore(endDate)) {
      // Skip weekends unless specified
      if (!preferences.includeWeekends && (currentDate.day() === 0 || currentDate.day() === 6)) {
        currentDate.add(1, 'day');
        continue;
      }

      for (let hour = workingHours.start; hour <= workingHours.end - Math.ceil(duration / 60); hour += 0.5) {
        const slotStart = currentDate.clone().hour(Math.floor(hour)).minute((hour % 1) * 60);
        const slotEnd = slotStart.clone().add(duration, 'minutes');
        
        const dateStr = slotStart.format('YYYY-MM-DD');
        const hourKey = `${dateStr}-${Math.floor(hour)}`;
        const conflictScore = conflictMap.get(hourKey) || 0;

        const score = this.calculateAdvancedTimeSlotScore(slotStart, conflictScore, preferences);
        
        slots.push({
          startTime: slotStart.toDate(),
          endTime: slotEnd.toDate(),
          score,
          conflictLevel: conflictScore > 0 ? 'low' : 'none',
          reasoning: this.generateAdvancedSlotReasoning(slotStart, conflictScore, score)
        });
      }

      currentDate.add(1, 'day');
    }

    return slots.sort((a, b) => b.score - a.score);
  }

  calculateAdvancedTimeSlotScore(startTime, conflictScore, preferences) {
    let score = 100;
    const hour = startTime.hour();
    const dayOfWeek = startTime.day();

    // Time of day preferences
    if (hour >= 10 && hour <= 11) score += 25;
    if (hour >= 14 && hour <= 15) score += 20;
    if (hour === 9 || hour === 16) score += 10;
    if (hour < 9 || hour > 16) score -= 40;

    // Day of week preferences
    if ([2, 3, 4].includes(dayOfWeek)) score += 15;
    if ([1, 5].includes(dayOfWeek)) score += 8;
    if ([0, 6].includes(dayOfWeek)) score -= 50;

    // Conflict penalty
    score -= conflictScore * 20;

    // User preferences
    if (preferences.preferMorning && hour < 12) score += 15;
    if (preferences.preferAfternoon && hour >= 12) score += 15;
    if (preferences.avoidMondays && dayOfWeek === 1) score -= 25;
    if (preferences.avoidFridays && dayOfWeek === 5) score -= 25;

    return Math.max(0, score);
  }

  generateAdvancedSlotReasoning(startTime, conflictScore, score) {
    const hour = startTime.hour();
    const day = startTime.format('dddd');
    const reasons = [];

    if (hour >= 10 && hour <= 11) reasons.push('Peak productivity time');
    if (hour >= 14 && hour <= 15) reasons.push('Post-lunch energy');
    if ([2, 3, 4].includes(startTime.day())) reasons.push('Mid-week focus');
    if (conflictScore === 0) reasons.push('No scheduling conflicts');
    if (conflictScore > 0) reasons.push('Minimal conflicts');
    if (score > 80) reasons.push('Highly recommended');

    return reasons.join(', ') || 'Standard availability';
  }

  calculateConfidenceScore(suggestions) {
    if (!suggestions.length) return 0;
    
    const scores = suggestions.map(s => s.score);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const maxScore = Math.max(...scores);
    
    return Math.round((avgScore / 100) * (maxScore / 100) * 100);
  }

  async generateResolutionStrategies(conflictData, conflictAnalysis, meetingData) {
    const strategies = [];

    // Strategy 1: Find alternative times
    strategies.push({
      type: 'reschedule',
      title: 'Find Alternative Time',
      description: 'Suggest optimal alternative times when all participants are available',
      effort: 'low',
      impact: 'high',
      probability: 0.9
    });

    // Strategy 2: Reduce participants
    if (conflictData.participants.length > 3) {
      strategies.push({
        type: 'reduce_participants',
        title: 'Optimize Participant List',
        description: 'Remove non-essential participants to reduce conflicts',
        effort: 'medium',
        impact: 'medium',
        probability: 0.7
      });
    }

    // Strategy 3: Split meeting
    if (meetingData.duration > 60) {
      strategies.push({
        type: 'split_meeting',
        title: 'Split Into Multiple Sessions',
        description: 'Break into smaller, focused sessions with relevant participants',
        effort: 'high',
        impact: 'medium',
        probability: 0.6
      });
    }

    // Strategy 4: Override low-priority conflicts
    const flexibleConflicts = conflictAnalysis.filter(c => c.flexibility === 'high');
    if (flexibleConflicts.length > 0) {
      strategies.push({
        type: 'override_conflicts',
        title: 'Override Flexible Meetings',
        description: `Move ${flexibleConflicts.length} flexible meetings to accommodate this higher priority meeting`,
        effort: 'medium',
        impact: 'high',
        probability: 0.8
      });
    }

    return strategies;
  }

  async generateSmartRecommendations(strategies, meetingData) {
    const recommendations = [];

    // Primary recommendation
    const bestStrategy = strategies.sort((a, b) => 
      (b.impact === 'high' ? 3 : b.impact === 'medium' ? 2 : 1) * b.probability -
      (a.impact === 'high' ? 3 : a.impact === 'medium' ? 2 : 1) * a.probability
    )[0];

    if (bestStrategy) {
      recommendations.push({
        priority: 'primary',
        strategy: bestStrategy.type,
        title: bestStrategy.title,
        description: bestStrategy.description,
        confidence: Math.round(bestStrategy.probability * 100),
        estimatedTime: this.getEstimatedResolutionTime(bestStrategy.effort)
      });
    }

    // Alternative recommendations
    strategies.slice(1, 3).forEach((strategy, index) => {
      recommendations.push({
        priority: 'alternative',
        rank: index + 2,
        strategy: strategy.type,
        title: strategy.title,
        description: strategy.description,
        confidence: Math.round(strategy.probability * 100),
        estimatedTime: this.getEstimatedResolutionTime(strategy.effort)
      });
    });

    return recommendations;
  }

  getEstimatedResolutionTime(effort) {
    switch (effort) {
      case 'low': return '< 5 minutes';
      case 'medium': return '5-15 minutes';
      case 'high': return '15-30 minutes';
      default: return '5-10 minutes';
    }
  }

  async analyzeReschedulingImpact(originalMeeting, suggestions) {
    // Analyze the impact of rescheduling on participants
    const impact = {
      participants: [],
      organizationalImpact: 'low',
      communicationRequired: true,
      stakeholderNotifications: []
    };

    // Calculate impact for each participant
    for (const participant of originalMeeting.participants) {
      const userImpact = await this.calculateUserReschedulingImpact(
        participant.user._id,
        originalMeeting.startTime,
        suggestions[0]?.startTime
      );
      
      impact.participants.push({
        userId: participant.user._id,
        name: participant.user.name,
        impact: userImpact
      });
    }

    // Determine organizational impact
    if (originalMeeting.participants.length > 10) {
      impact.organizationalImpact = 'high';
    } else if (originalMeeting.participants.length > 5) {
      impact.organizationalImpact = 'medium';
    }

    return impact;
  }

  async calculateUserReschedulingImpact(userId, originalTime, newTime) {
    if (!newTime) return 'unknown';

    const timeDiff = Math.abs(moment(newTime).diff(moment(originalTime), 'hours'));
    
    if (timeDiff <= 2) return 'minimal';
    if (timeDiff <= 24) return 'moderate';
    return 'significant';
  }

  generateReschedulingRecommendations(impact) {
    const recommendations = [];

    if (impact.organizationalImpact === 'high') {
      recommendations.push({
        type: 'communication',
        message: 'Schedule a brief announcement to explain the rescheduling',
        priority: 'high'
      });
    }

    if (impact.participants.some(p => p.impact === 'significant')) {
      recommendations.push({
        type: 'compensation',
        message: 'Consider providing alternative meeting formats for significantly impacted participants',
        priority: 'medium'
      });
    }

    recommendations.push({
      type: 'notification',
      message: 'Send rescheduling notifications at least 24 hours in advance when possible',
      priority: 'medium'
    });

    return recommendations;
  }

  getDateRange(timeframe) {
    const now = new Date();
    let start, end;

    switch (timeframe) {
      case 'week':
        start = moment(now).startOf('week').toDate();
        end = moment(now).endOf('week').toDate();
        break;
      case 'month':
        start = moment(now).startOf('month').toDate();
        end = moment(now).endOf('month').toDate();
        break;
      case 'quarter':
        start = moment(now).startOf('quarter').toDate();
        end = moment(now).endOf('quarter').toDate();
        break;
      default:
        start = moment(now).startOf('month').toDate();
        end = moment(now).endOf('month').toDate();
    }

    return { start, end };
  }

  processCalendarAnalytics(analyticsData) {
    const overview = analyticsData.overview[0] || {};
    
    return {
      overview: {
        totalMeetings: overview.totalMeetings || 0,
        totalHours: Math.round((overview.totalDuration || 0) / 60 * 10) / 10,
        averageDuration: Math.round(overview.avgDuration || 0),
        averageParticipants: Math.round((overview.avgParticipants || 0) * 10) / 10,
        completionRate: overview.totalMeetings > 0 ? 
          Math.round((overview.completedMeetings / overview.totalMeetings) * 100) : 0,
        cancellationRate: overview.totalMeetings > 0 ? 
          Math.round((overview.cancelledMeetings / overview.totalMeetings) * 100) : 0
      },
      patterns: {
        timeDistribution: analyticsData.timeDistribution || [],
        dayDistribution: analyticsData.dayDistribution || [],
        weeklyTrends: analyticsData.weeklyTrends || [],
        typeDistribution: analyticsData.typeDistribution || [],
        priorityAnalysis: analyticsData.priorityAnalysis || []
      }
    };
  }

  generateCalendarInsights(analytics) {
    const insights = [];

    // Meeting load insights
    if (analytics.overview.totalMeetings > 20) {
      insights.push({
        type: 'meeting_load',
        level: 'high',
        message: 'High meeting volume detected. Consider consolidating or delegating some meetings.',
        metric: `${analytics.overview.totalMeetings} meetings`
      });
    }

    // Duration insights
    if (analytics.overview.averageDuration > 60) {
      insights.push({
        type: 'duration',
        level: 'attention',
        message: 'Meetings are running longer than optimal. Consider time-boxing discussions.',
        metric: `${analytics.overview.averageDuration} min average`
      });
    }

    // Efficiency insights
    if (analytics.overview.completionRate < 80) {
      insights.push({
        type: 'completion',
        level: 'concern',
        message: 'Meeting completion rate is below optimal. Review meeting necessity and preparation.',
        metric: `${analytics.overview.completionRate}% completion rate`
      });
    }

    return insights;
  }

  generateCalendarRecommendations(analytics) {
    const recommendations = [];

    // Time optimization
    if (analytics.overview.totalHours > 15) {
      recommendations.push({
        category: 'time_optimization',
        title: 'Optimize Meeting Time',
        description: 'Consider async alternatives for status updates and simple decisions',
        impact: 'high'
      });
    }

    // Meeting efficiency
    if (analytics.overview.averageDuration > 45) {
      recommendations.push({
        category: 'efficiency',
        title: 'Improve Meeting Focus',
        description: 'Set clear agendas and time limits to keep meetings focused',
        impact: 'medium'
      });
    }

    // Collaboration balance
    if (analytics.overview.averageParticipants > 8) {
      recommendations.push({
        category: 'collaboration',
        title: 'Right-size Meeting Participants',
        description: 'Large meetings can reduce effectiveness. Consider smaller, focused groups',
        impact: 'medium'
      });
    }

    return recommendations;
  }
}

module.exports = new SmartCalendarService();
