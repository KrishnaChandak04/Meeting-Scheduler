const Meeting = require('../models/Meeting');
const User = require('../models/User');
const moment = require('moment');

class AIInsightsService {
  constructor() {
    this.insightTypes = {
      PRODUCTIVITY: 'productivity',
      COLLABORATION: 'collaboration',
      TIME_OPTIMIZATION: 'time_optimization',
      TEAM_DYNAMICS: 'team_dynamics',
      MEETING_QUALITY: 'meeting_quality'
    };
  }

  // Generate comprehensive meeting insights using MongoDB aggregation
  async generateMeetingInsights(userId, timeframe = 'last_30_days') {
    try {
      const dateFilter = this.getDateFilter(timeframe);
      
      // Advanced aggregation pipeline for AI insights
      const insights = await Meeting.aggregate([
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
            duration: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60 // Convert to minutes
              ]
            },
            participantCount: { $size: '$participants' },
            timeOfDay: { $hour: '$startTime' },
            dayOfWeek: { $dayOfWeek: '$startTime' },
            isRecurring: { $ifNull: ['$recurringPattern', false] }
          }
        },
        {
          $facet: {
            // Productivity Analysis
            productivityMetrics: [
              {
                $group: {
                  _id: null,
                  totalMeetings: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  totalMeetingTime: { $sum: '$duration' },
                  avgParticipants: { $avg: '$participantCount' },
                  categories: {
                    $push: '$category'
                  }
                }
              }
            ],
            
            // Time Optimization Insights
            timePatterns: [
              {
                $group: {
                  _id: {
                    hour: '$timeOfDay',
                    dayOfWeek: '$dayOfWeek'
                  },
                  meetingCount: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  avgProductivity: {
                    $avg: {
                      $cond: [
                        { $gt: ['$duration', 60] },
                        0.7, // Longer meetings assumed less productive
                        1.0
                      ]
                    }
                  }
                }
              },
              {
                $sort: { meetingCount: -1 }
              }
            ],
            
            // Collaboration Analysis
            collaborationMetrics: [
              {
                $unwind: '$participantInfo'
              },
              {
                $group: {
                  _id: '$participantInfo.department',
                  meetingCount: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  uniqueCollaborators: {
                    $addToSet: '$participantInfo._id'
                  }
                }
              },
              {
                $addFields: {
                  collaboratorCount: { $size: '$uniqueCollaborators' }
                }
              }
            ],
            
            // Meeting Quality Indicators
            qualityMetrics: [
              {
                $group: {
                  _id: '$category',
                  meetingCount: { $sum: 1 },
                  avgDuration: { $avg: '$duration' },
                  avgParticipants: { $avg: '$participantCount' },
                  qualityScore: {
                    $avg: {
                      $add: [
                        // Duration efficiency (shorter meetings score higher)
                        {
                          $cond: [
                            { $lte: ['$duration', 30] }, 1.0,
                            { $cond: [{ $lte: ['$duration', 60] }, 0.8, 0.6] }
                          ]
                        },
                        // Participant optimization (3-7 participants ideal)
                        {
                          $cond: [
                            { $and: [{ $gte: ['$participantCount', 3] }, { $lte: ['$participantCount', 7] }] },
                            1.0, 0.7
                          ]
                        },
                        // Preparation indicator (has agenda)
                        {
                          $cond: [
                            { $ne: ['$agenda', null] },
                            1.0, 0.5
                          ]
                        }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      ]);

      // Process insights and generate AI recommendations
      const processedInsights = await this.processAIInsights(insights[0], userId);
      
      return {
        success: true,
        data: {
          timeframe,
          generatedAt: new Date(),
          insights: processedInsights,
          recommendations: await this.generateRecommendations(processedInsights),
          trendsAnalysis: await this.analyzeTrends(userId, timeframe)
        }
      };

    } catch (error) {
      console.error('AI Insights generation error:', error);
      return {
        success: false,
        error: 'Failed to generate AI insights'
      };
    }
  }

  // Process raw aggregation data into meaningful insights
  async processAIInsights(rawData, userId) {
    const productivity = rawData.productivityMetrics[0] || {};
    const timePatterns = rawData.timePatterns || [];
    const collaboration = rawData.collaborationMetrics || [];
    const quality = rawData.qualityMetrics || [];

    return {
      productivity: {
        totalMeetings: productivity.totalMeetings || 0,
        averageDuration: Math.round(productivity.avgDuration || 0),
        totalMeetingHours: Math.round((productivity.totalMeetingTime || 0) / 60),
        efficiency: this.calculateEfficiencyScore(productivity),
        categoryDistribution: this.analyzeCategoryDistribution(productivity.categories || [])
      },
      
      timeOptimization: {
        bestMeetingTimes: this.identifyOptimalTimes(timePatterns),
        meetingLoad: this.analyzeMeetingLoad(timePatterns),
        timeWaste: this.calculateTimeWaste(productivity),
        suggestions: this.generateTimeOptimizationSuggestions(timePatterns)
      },
      
      collaboration: {
        departmentEngagement: collaboration.map(dept => ({
          department: dept._id,
          meetingCount: dept.meetingCount,
          collaboratorCount: dept.collaboratorCount,
          engagementScore: this.calculateEngagementScore(dept)
        })),
        networkStrength: this.calculateNetworkStrength(collaboration),
        crossDepartmentalIndex: this.calculateCrossDepartmentalIndex(collaboration)
      },
      
      quality: {
        overallScore: this.calculateOverallQualityScore(quality),
        categoryPerformance: quality.map(cat => ({
          category: cat._id,
          score: Math.round(cat.qualityScore * 100),
          meetingCount: cat.meetingCount,
          averageDuration: Math.round(cat.avgDuration),
          recommendations: this.getCategoryRecommendations(cat)
        })),
        improvementAreas: this.identifyImprovementAreas(quality)
      }
    };
  }

  // Generate AI-powered recommendations
  async generateRecommendations(insights) {
    const recommendations = [];

    // Productivity recommendations
    if (insights.productivity.efficiency < 0.7) {
      recommendations.push({
        type: 'PRODUCTIVITY',
        priority: 'high',
        title: 'Optimize Meeting Efficiency',
        description: 'Your meeting efficiency is below optimal. Consider shorter, more focused meetings.',
        actions: [
          'Set clear agendas before meetings',
          'Limit meetings to 30 minutes when possible',
          'Use time-boxed discussions'
        ]
      });
    }

    // Time optimization recommendations
    if (insights.timeOptimization.timeWaste > 20) {
      recommendations.push({
        type: 'TIME_OPTIMIZATION',
        priority: 'medium',
        title: 'Reduce Meeting Overhead',
        description: `You could save ${insights.timeOptimization.timeWaste}% of meeting time with better planning.`,
        actions: [
          'Consolidate similar meetings',
          'Use async communication for updates',
          'Schedule buffer time between meetings'
        ]
      });
    }

    // Collaboration recommendations
    if (insights.collaboration.crossDepartmentalIndex < 0.5) {
      recommendations.push({
        type: 'COLLABORATION',
        priority: 'medium',
        title: 'Enhance Cross-Department Collaboration',
        description: 'Increase collaboration across different departments for better innovation.',
        actions: [
          'Organize cross-functional sessions',
          'Include diverse perspectives in planning',
          'Create inter-department project teams'
        ]
      });
    }

    return recommendations;
  }

  // Analyze trends over time
  async analyzeTrends(userId, timeframe) {
    const now = new Date();
    const previousPeriod = this.getPreviousPeriod(timeframe);
    
    const currentData = await this.generateMeetingInsights(userId, timeframe);
    const previousData = await this.generateMeetingInsights(userId, previousPeriod);

    return {
      meetingCount: this.calculateTrend(
        currentData.data?.insights?.productivity?.totalMeetings,
        previousData.data?.insights?.productivity?.totalMeetings
      ),
      efficiency: this.calculateTrend(
        currentData.data?.insights?.productivity?.efficiency,
        previousData.data?.insights?.productivity?.efficiency
      ),
      qualityScore: this.calculateTrend(
        currentData.data?.insights?.quality?.overallScore,
        previousData.data?.insights?.quality?.overallScore
      ),
      collaborationIndex: this.calculateTrend(
        currentData.data?.insights?.collaboration?.networkStrength,
        previousData.data?.insights?.collaboration?.networkStrength
      )
    };
  }

  // Smart meeting conflict detection and resolution
  async detectConflicts(meetingData) {
    const { startTime, endTime, participants, organizer } = meetingData;
    
    const conflicts = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: { $in: [organizer, ...participants] } },
            { 'participants.user': { $in: [organizer, ...participants] } }
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
          status: { $in: ['scheduled', 'in_progress'] }
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
      }
    ]);

    // Generate smart suggestions for conflict resolution
    const suggestions = await this.generateConflictResolutions(conflicts, meetingData);

    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts,
      suggestions: suggestions,
      riskLevel: this.calculateConflictRisk(conflicts, meetingData)
    };
  }

  // Generate alternative meeting times using AI
  async suggestOptimalTimes(participants, duration, preferences = {}) {
    const timeSlots = await Meeting.aggregate([
      {
        $match: {
          'participants.user': { $in: participants },
          startTime: {
            $gte: new Date(),
            $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
          }
        }
      },
      {
        $project: {
          startHour: { $hour: '$startTime' },
          endHour: { $hour: '$endTime' },
          dayOfWeek: { $dayOfWeek: '$startTime' },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } }
        }
      },
      {
        $group: {
          _id: {
            date: '$date',
            hour: '$startHour'
          },
          conflictCount: { $sum: 1 }
        }
      }
    ]);

    // AI algorithm to find optimal time slots
    const optimalTimes = this.calculateOptimalTimeSlots(timeSlots, duration, preferences);
    
    return {
      suggestions: optimalTimes.slice(0, 5), // Top 5 suggestions
      confidence: this.calculateSuggestionConfidence(optimalTimes),
      reasoning: this.generateTimingReasoning(optimalTimes[0])
    };
  }

  // Helper methods for calculations
  getDateFilter(timeframe) {
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

  calculateEfficiencyScore(productivity) {
    if (!productivity.avgDuration) return 0;
    
    // Optimal meeting duration is considered 30-45 minutes
    const optimalDuration = 37.5;
    const durationScore = Math.max(0, 1 - Math.abs(productivity.avgDuration - optimalDuration) / optimalDuration);
    
    // Factor in meeting frequency (not too many, not too few)
    const frequencyScore = productivity.totalMeetings > 0 ? Math.min(1, 20 / productivity.totalMeetings) : 0;
    
    return Math.round((durationScore * 0.7 + frequencyScore * 0.3) * 100) / 100;
  }

  calculateTrend(current, previous) {
    if (!previous || previous === 0) return { change: 0, direction: 'stable' };
    
    const change = ((current - previous) / previous) * 100;
    const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
    
    return {
      change: Math.round(change * 10) / 10,
      direction,
      significant: Math.abs(change) > 10
    };
  }

  analyzeCategoryDistribution(categories) {
    const distribution = {};
    categories.forEach(cat => {
      distribution[cat] = (distribution[cat] || 0) + 1;
    });
    
    const total = categories.length;
    Object.keys(distribution).forEach(key => {
      distribution[key] = Math.round((distribution[key] / total) * 100);
    });
    
    return distribution;
  }

  identifyOptimalTimes(timePatterns) {
    return timePatterns
      .sort((a, b) => (b.avgProductivity * b.meetingCount) - (a.avgProductivity * a.meetingCount))
      .slice(0, 3)
      .map(pattern => ({
        hour: pattern._id.hour,
        dayOfWeek: pattern._id.dayOfWeek,
        productivity: Math.round(pattern.avgProductivity * 100),
        frequency: pattern.meetingCount
      }));
  }

  calculateTimeWaste(productivity) {
    if (!productivity.avgDuration) return 0;
    
    // Assume optimal duration is 30 minutes
    const optimalDuration = 30;
    const waste = Math.max(0, productivity.avgDuration - optimalDuration);
    
    return Math.round((waste / productivity.avgDuration) * 100);
  }

  calculateOverallQualityScore(qualityMetrics) {
    if (!qualityMetrics.length) return 0;
    
    const avgScore = qualityMetrics.reduce((sum, metric) => sum + metric.qualityScore, 0) / qualityMetrics.length;
    return Math.round(avgScore * 100);
  }

  calculateEngagementScore(deptData) {
    // Simple engagement calculation based on meeting frequency and collaboration
    const frequency = Math.min(deptData.meetingCount / 10, 1); // Normalize to max 10 meetings
    const collaboration = Math.min(deptData.collaboratorCount / 5, 1); // Normalize to max 5 collaborators
    
    return Math.round((frequency * 0.6 + collaboration * 0.4) * 100);
  }

  calculateNetworkStrength(collaboration) {
    const totalCollaborators = collaboration.reduce((sum, dept) => sum + dept.collaboratorCount, 0);
    const totalMeetings = collaboration.reduce((sum, dept) => sum + dept.meetingCount, 0);
    
    return totalMeetings > 0 ? Math.round((totalCollaborators / totalMeetings) * 100) / 100 : 0;
  }

  calculateCrossDepartmentalIndex(collaboration) {
    const departments = collaboration.length;
    const maxDepartments = 10; // Assume max 10 departments
    
    return Math.min(departments / maxDepartments, 1);
  }

  identifyImprovementAreas(qualityMetrics) {
    return qualityMetrics
      .filter(metric => metric.qualityScore < 0.7)
      .map(metric => ({
        category: metric._id,
        currentScore: Math.round(metric.qualityScore * 100),
        improvementPotential: Math.round((1 - metric.qualityScore) * 100)
      }));
  }

  getCategoryRecommendations(category) {
    const recommendations = {
      'standup': ['Keep to 15 minutes', 'Focus on blockers', 'Use timer'],
      'meeting': ['Set clear agenda', 'Limit to key participants', 'End with action items'],
      'review': ['Prepare materials in advance', 'Focus on decisions', 'Document outcomes'],
      'training': ['Interactive sessions', 'Practical examples', 'Follow-up resources']
    };
    
    return recommendations[category._id] || ['Define clear objectives', 'Engage all participants', 'Follow up on decisions'];
  }

  calculateOptimalTimeSlots(existingSlots, duration, preferences) {
    // Advanced algorithm to find optimal meeting times
    // This is a simplified version - in production, you'd use more sophisticated AI
    
    const workingHours = preferences.workingHours || { start: 9, end: 17 };
    const preferredDays = preferences.preferredDays || [1, 2, 3, 4, 5]; // Mon-Fri
    
    const slots = [];
    const now = new Date();
    
    for (let day = 0; day < 14; day++) { // Next 2 weeks
      const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      const dayOfWeek = date.getDay();
      
      if (preferredDays.includes(dayOfWeek)) {
        for (let hour = workingHours.start; hour <= workingHours.end - (duration / 60); hour++) {
          const conflictCount = existingSlots.filter(slot => 
            slot._id.date === date.toISOString().split('T')[0] && 
            slot._id.hour === hour
          ).length;
          
          const score = this.calculateTimeSlotScore(hour, dayOfWeek, conflictCount, preferences);
          
          slots.push({
            dateTime: new Date(date.setHours(hour, 0, 0, 0)),
            score: score,
            conflicts: conflictCount,
            reasoning: this.getTimeSlotReasoning(hour, dayOfWeek, conflictCount)
          });
        }
      }
    }
    
    return slots.sort((a, b) => b.score - a.score);
  }

  calculateTimeSlotScore(hour, dayOfWeek, conflicts, preferences) {
    let score = 100;
    
    // Prefer mid-morning and early afternoon
    if (hour >= 10 && hour <= 11) score += 20;
    if (hour >= 14 && hour <= 15) score += 15;
    if (hour < 9 || hour > 16) score -= 30;
    
    // Prefer Tuesday-Thursday
    if ([2, 3, 4].includes(dayOfWeek)) score += 10;
    if ([1, 5].includes(dayOfWeek)) score += 5;
    if ([0, 6].includes(dayOfWeek)) score -= 50;
    
    // Penalize conflicts
    score -= conflicts * 25;
    
    // Apply user preferences
    if (preferences.avoidEarlyMorning && hour < 10) score -= 20;
    if (preferences.avoidLateMeeting && hour > 15) score -= 20;
    
    return Math.max(0, score);
  }

  calculateSuggestionConfidence(suggestions) {
    if (!suggestions.length) return 0;
    
    const topScore = suggestions[0].score;
    const avgScore = suggestions.reduce((sum, s) => sum + s.score, 0) / suggestions.length;
    
    return Math.round((topScore / 100) * (1 - (topScore - avgScore) / topScore) * 100);
  }

  generateTimingReasoning(topSuggestion) {
    if (!topSuggestion) return 'No optimal time found';
    
    const hour = topSuggestion.dateTime.getHours();
    const day = topSuggestion.dateTime.toLocaleDateString('en-US', { weekday: 'long' });
    
    let reasoning = `${day} at ${hour}:00 is optimal because `;
    
    if (hour >= 10 && hour <= 11) reasoning += 'it\'s during peak productivity hours, ';
    if (hour >= 14 && hour <= 15) reasoning += 'it\'s after lunch when people are re-energized, ';
    if (topSuggestion.conflicts === 0) reasoning += 'there are no scheduling conflicts, ';
    
    reasoning += 'and it aligns with typical business hours.';
    
    return reasoning;
  }

  getTimeSlotReasoning(hour, dayOfWeek, conflicts) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const reasons = [];
    
    if (hour >= 10 && hour <= 11) reasons.push('Peak productivity time');
    if (hour >= 14 && hour <= 15) reasons.push('Post-lunch energy');
    if ([2, 3, 4].includes(dayOfWeek)) reasons.push('Mid-week focus');
    if (conflicts === 0) reasons.push('No conflicts');
    if (conflicts > 0) reasons.push(`${conflicts} potential conflicts`);
    
    return reasons.join(', ') || 'Standard business hours';
  }

  getPreviousPeriod(timeframe) {
    switch (timeframe) {
      case 'last_7_days':
        return 'previous_7_days';
      case 'last_30_days':
        return 'previous_30_days';
      case 'last_90_days':
        return 'previous_90_days';
      default:
        return 'previous_30_days';
    }
  }

  generateConflictResolutions(conflicts, meetingData) {
    const suggestions = [];
    
    if (conflicts.length > 0) {
      suggestions.push({
        type: 'reschedule',
        title: 'Reschedule to avoid conflicts',
        description: 'Move the meeting to a time when all participants are available',
        priority: 'high'
      });
      
      suggestions.push({
        type: 'reduce_participants',
        title: 'Reduce participant list',
        description: 'Remove non-essential participants to reduce conflicts',
        priority: 'medium'
      });
      
      suggestions.push({
        type: 'split_meeting',
        title: 'Split into multiple sessions',
        description: 'Break the meeting into smaller, focused sessions',
        priority: 'low'
      });
    }
    
    return suggestions;
  }

  calculateConflictRisk(conflicts, meetingData) {
    const riskFactors = {
      direct_conflicts: conflicts.length * 10,
      participant_count: meetingData.participants.length * 2,
      meeting_duration: (new Date(meetingData.endTime) - new Date(meetingData.startTime)) / (1000 * 60) / 10
    };
    
    const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0);
    
    if (totalRisk > 50) return 'high';
    if (totalRisk > 25) return 'medium';
    return 'low';
  }
}

module.exports = new AIInsightsService();
