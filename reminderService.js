const Meeting = require('../models/Meeting');
const User = require('../models/User');
const emailService = require('./emailService');
const moment = require('moment');

class ReminderService {
  constructor() {
    this.checkInterval = 60000; // Check every minute
  }
  
  // Check and send reminders
  async checkAndSendReminders(io) {
    try {
      const now = new Date();
      const futureTime = new Date(now.getTime() + (60 * 60 * 1000)); // Next hour
      
      // Find meetings that need reminders
      const meetings = await Meeting.find({
        startTime: {
          $gte: now,
          $lte: futureTime
        },
        status: 'scheduled',
        'reminders.sent': false
      })
      .populate('organizer', 'firstName lastName email preferences')
      .populate('participants.user', 'firstName lastName email preferences');
      
      for (const meeting of meetings) {
        await this.processMeetingReminders(meeting, io);
      }
      
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }
  
  // Process reminders for a specific meeting
  async processMeetingReminders(meeting, io) {
    const now = new Date();
    const meetingStart = new Date(meeting.startTime);
    const minutesUntilMeeting = Math.round((meetingStart - now) / (1000 * 60));
    
    // Check each reminder
    for (let i = 0; i < meeting.reminders.length; i++) {
      const reminder = meeting.reminders[i];
      
      if (!reminder.sent && minutesUntilMeeting <= reminder.minutesBefore) {
        try {
          await this.sendReminder(meeting, reminder, io);
          
          // Mark reminder as sent
          meeting.reminders[i].sent = true;
          meeting.reminders[i].sentAt = new Date();
          
          await meeting.save();
          
        } catch (error) {
          console.error(`Failed to send reminder for meeting ${meeting._id}:`, error);
        }
      }
    }
    
    // Send default reminders based on user preferences
    await this.sendDefaultReminders(meeting, minutesUntilMeeting, io);
  }
  
  // Send default reminders based on user preferences
  async sendDefaultReminders(meeting, minutesUntilMeeting, io) {
    const participants = meeting.participants.filter(p => p.status === 'accepted');
    
    for (const participant of participants) {
      const user = participant.user;
      const reminderTime = user.preferences?.reminderTime || 15;
      
      // Check if we should send a default reminder
      if (minutesUntilMeeting <= reminderTime && minutesUntilMeeting > (reminderTime - 1)) {
        // Check if a custom reminder hasn't already been sent for this time
        const existingReminder = meeting.reminders.find(r => 
          r.minutesBefore === reminderTime && r.sent
        );
        
        if (!existingReminder) {
          try {
            await this.sendUserReminder(meeting, user, reminderTime, io);
          } catch (error) {
            console.error(`Failed to send default reminder to ${user.email}:`, error);
          }
        }
      }
    }
  }
  
  // Send reminder to specific user
  async sendUserReminder(meeting, user, minutesBefore, io) {
    // Send email reminder if user has email notifications enabled
    if (user.preferences?.emailNotifications !== false) {
      await emailService.sendMeetingReminder(meeting, user.email, minutesBefore);
    }
    
    // Send real-time notification via Socket.IO
    if (io) {
      const notification = {
        type: 'meeting_reminder',
        meetingId: meeting._id,
        title: meeting.title,
        startTime: meeting.startTime,
        minutesBefore,
        message: `Meeting "${meeting.title}" starts in ${minutesBefore} minutes`,
        timestamp: new Date()
      };
      
      io.to(`user-${user._id}`).emit('notification', notification);
    }
    
    console.log(`✅ Reminder sent to ${user.email} for meeting: ${meeting.title}`);
  }
  
  // Send reminder for a specific reminder object
  async sendReminder(meeting, reminder, io) {
    const participants = meeting.participants.filter(p => p.status === 'accepted');
    
    for (const participant of participants) {
      const user = participant.user;
      
      if (reminder.type === 'email' && user.preferences?.emailNotifications !== false) {
        await emailService.sendMeetingReminder(meeting, user.email, reminder.minutesBefore);
      }
      
      if (reminder.type === 'notification' && io) {
        const notification = {
          type: 'meeting_reminder',
          meetingId: meeting._id,
          title: meeting.title,
          startTime: meeting.startTime,
          minutesBefore: reminder.minutesBefore,
          message: `Meeting "${meeting.title}" starts in ${reminder.minutesBefore} minutes`,
          timestamp: new Date()
        };
        
        io.to(`user-${user._id}`).emit('notification', notification);
      }
    }
  }
  
  // Add reminder to meeting
  async addReminder(meetingId, reminderData) {
    try {
      const meeting = await Meeting.findById(meetingId);
      
      if (!meeting) {
        throw new Error('Meeting not found');
      }
      
      // Check if reminder already exists for this time
      const existingReminder = meeting.reminders.find(r => 
        r.minutesBefore === reminderData.minutesBefore && 
        r.type === reminderData.type
      );
      
      if (existingReminder) {
        throw new Error('Reminder already exists for this time and type');
      }
      
      meeting.reminders.push({
        type: reminderData.type || 'email',
        minutesBefore: reminderData.minutesBefore,
        sent: false
      });
      
      await meeting.save();
      return meeting;
      
    } catch (error) {
      console.error('Error adding reminder:', error);
      throw error;
    }
  }
  
  // Remove reminder from meeting
  async removeReminder(meetingId, reminderId) {
    try {
      const meeting = await Meeting.findById(meetingId);
      
      if (!meeting) {
        throw new Error('Meeting not found');
      }
      
      meeting.reminders = meeting.reminders.filter(r => r._id.toString() !== reminderId);
      
      await meeting.save();
      return meeting;
      
    } catch (error) {
      console.error('Error removing reminder:', error);
      throw error;
    }
  }
  
  // Send immediate reminder for testing
  async sendImmediateReminder(meetingId, userId, io) {
    try {
      const meeting = await Meeting.findById(meetingId)
        .populate('organizer', 'firstName lastName email')
        .populate('participants.user', 'firstName lastName email preferences');
      
      if (!meeting) {
        throw new Error('Meeting not found');
      }
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const now = new Date();
      const meetingStart = new Date(meeting.startTime);
      const minutesUntilMeeting = Math.round((meetingStart - now) / (1000 * 60));
      
      await this.sendUserReminder(meeting, user, minutesUntilMeeting, io);
      
      return {
        success: true,
        message: 'Reminder sent successfully',
        minutesUntilMeeting
      };
      
    } catch (error) {
      console.error('Error sending immediate reminder:', error);
      throw error;
    }
  }
  
  // Get upcoming meetings that need reminders
  async getUpcomingMeetingsWithReminders(userId) {
    try {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      const meetings = await Meeting.find({
        $or: [
          { organizer: userId },
          { 'participants.user': userId }
        ],
        startTime: {
          $gte: now,
          $lte: nextWeek
        },
        status: 'scheduled'
      })
      .populate('organizer', 'firstName lastName email')
      .populate('participants.user', 'firstName lastName email')
      .sort({ startTime: 1 });
      
      return meetings.map(meeting => {
        const minutesUntilMeeting = Math.round((meeting.startTime - now) / (1000 * 60));
        const pendingReminders = meeting.reminders.filter(r => 
          !r.sent && minutesUntilMeeting > r.minutesBefore
        );
        
        return {
          meeting: {
            id: meeting._id,
            title: meeting.title,
            startTime: meeting.startTime,
            organizer: meeting.organizer,
            participantCount: meeting.participants.length
          },
          minutesUntilMeeting,
          pendingReminders: pendingReminders.length,
          nextReminderIn: pendingReminders.length > 0 
            ? Math.min(...pendingReminders.map(r => r.minutesBefore)) 
            : null
        };
      });
      
    } catch (error) {
      console.error('Error getting upcoming meetings with reminders:', error);
      throw error;
    }
  }
}

module.exports = new ReminderService();
