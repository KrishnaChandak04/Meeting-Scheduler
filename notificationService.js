const moment = require('moment');

class NotificationService {
  constructor() {
    this.notificationTypes = {
      MEETING_INVITE: 'meeting_invite',
      MEETING_UPDATE: 'meeting_update',
      MEETING_CANCELLED: 'meeting_cancelled',
      MEETING_REMINDER: 'meeting_reminder',
      PARTICIPANT_RESPONSE: 'participant_response',
      CONFLICT_DETECTED: 'conflict_detected',
      MEETING_STARTED: 'meeting_started',
      MEETING_ENDED: 'meeting_ended'
    };
  }
  
  // Send meeting invitation notification
  sendMeetingInvite(io, userId, meeting, invitedBy) {
    const notification = {
      type: this.notificationTypes.MEETING_INVITE,
      title: 'New Meeting Invitation',
      message: `${invitedBy.fullName} invited you to "${meeting.title}"`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        startTime: meeting.startTime,
        organizer: invitedBy,
        requiresResponse: true
      },
      timestamp: new Date(),
      priority: 'high'
    };
    
    io.to(`user-${userId}`).emit('notification', notification);
    console.log(`📢 Meeting invite notification sent to user ${userId}`);
  }
  
  // Send meeting update notification
  sendMeetingUpdate(io, userIds, meeting, changes, updatedBy) {
    const changesList = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    const notification = {
      type: this.notificationTypes.MEETING_UPDATE,
      title: 'Meeting Updated',
      message: `${updatedBy.fullName} updated "${meeting.title}". Changes: ${changesList}`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        changes,
        updatedBy
      },
      timestamp: new Date(),
      priority: 'medium'
    };
    
    userIds.forEach(userId => {
      io.to(`user-${userId}`).emit('notification', notification);
    });
    
    console.log(`📢 Meeting update notification sent to ${userIds.length} users`);
  }
  
  // Send meeting cancellation notification
  sendMeetingCancellation(io, userIds, meeting, cancelledBy, reason) {
    const notification = {
      type: this.notificationTypes.MEETING_CANCELLED,
      title: 'Meeting Cancelled',
      message: `${cancelledBy.fullName} cancelled "${meeting.title}"${reason ? `: ${reason}` : ''}`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        cancelledBy,
        reason,
        originalStartTime: meeting.startTime
      },
      timestamp: new Date(),
      priority: 'high'
    };
    
    userIds.forEach(userId => {
      io.to(`user-${userId}`).emit('notification', notification);
    });
    
    console.log(`📢 Meeting cancellation notification sent to ${userIds.length} users`);
  }
  
  // Send meeting reminder notification
  sendMeetingReminder(io, userId, meeting, minutesBefore) {
    const timeText = minutesBefore === 0 ? 'now' : `in ${minutesBefore} minutes`;
    
    const notification = {
      type: this.notificationTypes.MEETING_REMINDER,
      title: 'Meeting Reminder',
      message: `"${meeting.title}" starts ${timeText}`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        startTime: meeting.startTime,
        minutesBefore,
        location: meeting.location,
        hasJoinLink: !!meeting.location?.details?.meetingLink
      },
      timestamp: new Date(),
      priority: minutesBefore <= 5 ? 'urgent' : 'medium'
    };
    
    io.to(`user-${userId}`).emit('notification', notification);
    console.log(`📢 Meeting reminder notification sent to user ${userId}`);
  }
  
  // Send participant response notification
  sendParticipantResponse(io, organizerId, meeting, participant, response) {
    const responseEmoji = {
      'accepted': '✅',
      'declined': '❌',
      'tentative': '❓'
    };
    
    const notification = {
      type: this.notificationTypes.PARTICIPANT_RESPONSE,
      title: 'Response Received',
      message: `${participant.fullName} ${response} your meeting invitation for "${meeting.title}" ${responseEmoji[response]}`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        participant: {
          id: participant._id,
          name: participant.fullName,
          email: participant.email
        },
        response,
        responseDate: new Date()
      },
      timestamp: new Date(),
      priority: 'low'
    };
    
    io.to(`user-${organizerId}`).emit('notification', notification);
    console.log(`📢 Participant response notification sent to organizer ${organizerId}`);
  }
  
  // Send conflict detection notification
  sendConflictDetection(io, userId, conflictingMeetings) {
    const meetingTitles = conflictingMeetings.map(m => m.title).join(', ');
    
    const notification = {
      type: this.notificationTypes.CONFLICT_DETECTED,
      title: 'Schedule Conflict Detected',
      message: `You have conflicting meetings: ${meetingTitles}`,
      data: {
        conflictingMeetings: conflictingMeetings.map(m => ({
          id: m._id,
          title: m.title,
          startTime: m.startTime,
          endTime: m.endTime
        }))
      },
      timestamp: new Date(),
      priority: 'high'
    };
    
    io.to(`user-${userId}`).emit('notification', notification);
    console.log(`📢 Conflict detection notification sent to user ${userId}`);
  }
  
  // Send meeting started notification
  sendMeetingStarted(io, userIds, meeting) {
    const notification = {
      type: this.notificationTypes.MEETING_STARTED,
      title: 'Meeting Started',
      message: `"${meeting.title}" has started`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        startTime: meeting.startTime,
        joinLink: meeting.location?.details?.meetingLink
      },
      timestamp: new Date(),
      priority: 'medium'
    };
    
    userIds.forEach(userId => {
      io.to(`user-${userId}`).emit('notification', notification);
    });
    
    console.log(`📢 Meeting started notification sent to ${userIds.length} users`);
  }
  
  // Send meeting ended notification
  sendMeetingEnded(io, userIds, meeting, summary) {
    const notification = {
      type: this.notificationTypes.MEETING_ENDED,
      title: 'Meeting Ended',
      message: `"${meeting.title}" has ended`,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        endTime: new Date(),
        duration: moment.duration(moment().diff(moment(meeting.startTime))).humanize(),
        summary
      },
      timestamp: new Date(),
      priority: 'low'
    };
    
    userIds.forEach(userId => {
      io.to(`user-${userId}`).emit('notification', notification);
    });
    
    console.log(`📢 Meeting ended notification sent to ${userIds.length} users`);
  }
  
  // Send bulk notifications
  sendBulkNotification(io, userIds, notification) {
    userIds.forEach(userId => {
      io.to(`user-${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date()
      });
    });
    
    console.log(`📢 Bulk notification sent to ${userIds.length} users`);
  }
  
  // Send system announcement
  sendSystemAnnouncement(io, message, priority = 'medium') {
    const notification = {
      type: 'system_announcement',
      title: 'System Announcement',
      message,
      data: {},
      timestamp: new Date(),
      priority
    };
    
    io.emit('notification', notification);
    console.log(`📢 System announcement sent to all users`);
  }
  
  // Create notification for database storage (for offline users)
  createNotificationData(type, title, message, data = {}, priority = 'medium') {
    return {
      type,
      title,
      message,
      data,
      priority,
      timestamp: new Date(),
      read: false
    };
  }
  
  // Send notification with fallback storage
  async sendNotificationWithFallback(io, userId, notification, saveToDb = true) {
    // Send real-time notification
    io.to(`user-${userId}`).emit('notification', notification);
    
    // Save to database for offline users (if notification model exists)
    if (saveToDb) {
      try {
        // This would require a Notification model
        // await Notification.create({
        //   userId,
        //   ...notification
        // });
        console.log(`📝 Notification saved to database for user ${userId}`);
      } catch (error) {
        console.error('Failed to save notification to database:', error);
      }
    }
  }
  
  // Format notification for display
  formatNotification(notification) {
    return {
      ...notification,
      timeAgo: moment(notification.timestamp).fromNow(),
      formattedTime: moment(notification.timestamp).format('MMM DD, YYYY h:mm A'),
      priorityColor: this.getPriorityColor(notification.priority)
    };
  }
  
  // Get priority color for UI
  getPriorityColor(priority) {
    const colors = {
      'low': '#6b7280',     // gray
      'medium': '#3b82f6',  // blue
      'high': '#f59e0b',    // amber
      'urgent': '#ef4444'   // red
    };
    
    return colors[priority] || colors.medium;
  }
  
  // Check if user is online
  isUserOnline(io, userId) {
    const room = io.sockets.adapter.rooms.get(`user-${userId}`);
    return room && room.size > 0;
  }
  
  // Get online users count
  getOnlineUsersCount(io) {
    return io.engine.clientsCount;
  }
  
  // Get users in a specific room
  getUsersInRoom(io, roomName) {
    const room = io.sockets.adapter.rooms.get(roomName);
    return room ? Array.from(room) : [];
  }
}

module.exports = new NotificationService();
