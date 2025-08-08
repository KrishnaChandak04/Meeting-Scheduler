const nodemailer = require('nodemailer');
const moment = require('moment');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      }
    });
    
    // Verify transporter configuration
    this.verifyConnection();
  }
  
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready');
    } catch (error) {
      console.error('❌ Email service configuration error:', error.message);
    }
  }
  
  // Generate email templates
  generateMeetingInviteEmail(meeting, participant) {
    const startTime = moment(meeting.startTime).format('MMMM Do YYYY, h:mm A');
    const endTime = moment(meeting.endTime).format('h:mm A');
    const duration = moment.duration(moment(meeting.endTime).diff(moment(meeting.startTime)));
    const durationText = `${duration.hours()}h ${duration.minutes()}m`;
    
    const subject = `Meeting Invitation: ${meeting.title}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .meeting-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .detail-row { display: flex; margin: 8px 0; }
          .detail-label { font-weight: bold; min-width: 120px; }
          .buttons { text-align: center; margin: 20px 0; }
          .btn { display: inline-block; padding: 12px 24px; margin: 0 10px; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .btn-accept { background: #10b981; color: white; }
          .btn-decline { background: #ef4444; color: white; }
          .btn-tentative { background: #f59e0b; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Meeting Invitation</h1>
          </div>
          <div class="content">
            <h2>${meeting.title}</h2>
            ${meeting.description ? `<p>${meeting.description}</p>` : ''}
            
            <div class="meeting-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date & Time:</span>
                <span>${startTime} - ${endTime} (${durationText})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Organizer:</span>
                <span>${meeting.organizer.fullName} (${meeting.organizer.email})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👥 Participants:</span>
                <span>${meeting.participants.length} participants</span>
              </div>
              ${meeting.location?.details?.meetingLink ? `
                <div class="detail-row">
                  <span class="detail-label">🔗 Meeting Link:</span>
                  <span><a href="${meeting.location.details.meetingLink}">${meeting.location.details.meetingLink}</a></span>
                </div>
              ` : ''}
              ${meeting.location?.details?.address ? `
                <div class="detail-row">
                  <span class="detail-label">📍 Location:</span>
                  <span>${meeting.location.details.address}</span>
                </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">🏷️ Category:</span>
                <span>${meeting.category}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⚡ Priority:</span>
                <span>${meeting.priority}</span>
              </div>
            </div>
            
            ${meeting.agenda?.length > 0 ? `
              <h3>📋 Agenda</h3>
              <ul>
                ${meeting.agenda.map(item => `<li>${item.item}${item.duration ? ` (${item.duration} min)` : ''}</li>`).join('')}
              </ul>
            ` : ''}
            
            <div class="buttons">
              <a href="${process.env.APP_URL}/meetings/${meeting._id}/respond?response=accepted" class="btn btn-accept">✅ Accept</a>
              <a href="${process.env.APP_URL}/meetings/${meeting._id}/respond?response=tentative" class="btn btn-tentative">❓ Tentative</a>
              <a href="${process.env.APP_URL}/meetings/${meeting._id}/respond?response=declined" class="btn btn-decline">❌ Decline</a>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 14px;">
              This invitation was sent by Meeting Scheduler System
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { subject, html };
  }
  
  generateReminderEmail(meeting, participant, minutesBefore) {
    const startTime = moment(meeting.startTime).format('MMMM Do YYYY, h:mm A');
    const timeUntil = moment(meeting.startTime).fromNow();
    
    const subject = `Reminder: ${meeting.title} starts ${timeUntil}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .meeting-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .reminder-badge { background: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Meeting Reminder</h1>
          </div>
          <div class="content">
            <div class="reminder-badge">
              ⚡ Starting ${timeUntil}
            </div>
            <h2>${meeting.title}</h2>
            <div class="meeting-details">
              <p><strong>📅 Time:</strong> ${startTime}</p>
              <p><strong>👤 Organizer:</strong> ${meeting.organizer.fullName}</p>
              ${meeting.location?.details?.meetingLink ? `
                <p><strong>🔗 Join Link:</strong> <a href="${meeting.location.details.meetingLink}">Click to join</a></p>
              ` : ''}
              ${meeting.location?.details?.address ? `
                <p><strong>📍 Location:</strong> ${meeting.location.details.address}</p>
              ` : ''}
            </div>
            <p style="text-align: center; color: #666;">
              Don't forget to prepare for your meeting!
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { subject, html };
  }
  
  generateMeetingUpdateEmail(meeting, participant, changes) {
    const subject = `Meeting Updated: ${meeting.title}`;
    
    const changesText = Object.entries(changes)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .changes { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Meeting Updated</h1>
          </div>
          <div class="content">
            <h2>${meeting.title}</h2>
            <p>The following changes have been made to your meeting:</p>
            <div class="changes">
              <ul>${changesText}</ul>
            </div>
            <p>Please check your calendar and adjust accordingly.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { subject, html };
  }
  
  generateMeetingCancellationEmail(meeting, participant) {
    const subject = `Meeting Cancelled: ${meeting.title}`;
    const startTime = moment(meeting.startTime).format('MMMM Do YYYY, h:mm A');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Meeting Cancelled</h1>
          </div>
          <div class="content">
            <h2>${meeting.title}</h2>
            <p>This meeting scheduled for <strong>${startTime}</strong> has been cancelled.</p>
            <p>Please update your calendar accordingly.</p>
            <p>If you have any questions, please contact the organizer: ${meeting.organizer.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { subject, html };
  }
  
  // Send meeting invitation
  async sendMeetingInvite(meeting, participantEmail, participantName) {
    try {
      const { subject, html } = this.generateMeetingInviteEmail(meeting, { email: participantEmail, name: participantName });
      
      const mailOptions = {
        from: `"Meeting Scheduler" <${process.env.SMTP_USER}>`,
        to: participantEmail,
        subject,
        html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Meeting invite sent to ${participantEmail}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send meeting invite to ${participantEmail}:`, error.message);
      throw error;
    }
  }
  
  // Send meeting reminder
  async sendMeetingReminder(meeting, participantEmail, minutesBefore) {
    try {
      const { subject, html } = this.generateReminderEmail(meeting, { email: participantEmail }, minutesBefore);
      
      const mailOptions = {
        from: `"Meeting Scheduler" <${process.env.SMTP_USER}>`,
        to: participantEmail,
        subject,
        html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Meeting reminder sent to ${participantEmail}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send meeting reminder to ${participantEmail}:`, error.message);
      throw error;
    }
  }
  
  // Send meeting update notification
  async sendMeetingUpdate(meeting, participantEmail, changes) {
    try {
      const { subject, html } = this.generateMeetingUpdateEmail(meeting, { email: participantEmail }, changes);
      
      const mailOptions = {
        from: `"Meeting Scheduler" <${process.env.SMTP_USER}>`,
        to: participantEmail,
        subject,
        html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Meeting update sent to ${participantEmail}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send meeting update to ${participantEmail}:`, error.message);
      throw error;
    }
  }
  
  // Send meeting cancellation
  async sendMeetingCancellation(meeting, participantEmail) {
    try {
      const { subject, html } = this.generateMeetingCancellationEmail(meeting, { email: participantEmail });
      
      const mailOptions = {
        from: `"Meeting Scheduler" <${process.env.SMTP_USER}>`,
        to: participantEmail,
        subject,
        html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Meeting cancellation sent to ${participantEmail}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send meeting cancellation to ${participantEmail}:`, error.message);
      throw error;
    }
  }
}

module.exports = new EmailService();
