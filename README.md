# Meeting Scheduler Pro

**A comprehensive enterprise-grade meeting management platform built with Node.js, Express, MongoDB, and Socket.IO.**

[![Node.js](https://img.shields.io/badge/Node.js-14%2B-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4%2B-brightgreen.svg)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19%2B-blue.svg)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8%2B-black.svg)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Meeting Scheduler Pro is a production-ready meeting management application designed for modern organizations. It provides comprehensive scheduling capabilities, real-time collaboration features, and advanced analytics to optimize team productivity and communication.

### Key Features

- **🔐 Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **📅 Advanced Scheduling**: Multi-participant meeting coordination with conflict detection
- **📧 Automated Communications**: Professional email invitations and reminder system
- **⚡ Real-time Updates**: Live notifications and meeting status updates via Socket.IO
- **📊 Business Intelligence**: MongoDB aggregation-powered analytics and insights
- **🤖 AI-Enhanced Features**: Smart scheduling suggestions and productivity optimization
- **🏢 Enterprise Security**: Rate limiting, input validation, and comprehensive audit logging

## Technical Architecture

### Backend Technologies
- **Runtime**: Node.js 14+ with Express.js framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT) with bcrypt password hashing
- **Real-time Communication**: Socket.IO for live updates
- **Email Service**: Nodemailer with HTML template support
- **Task Scheduling**: Node-cron for automated background processes

### Security Implementation
- **Authentication**: JWT token-based session management
- **Password Security**: bcrypt hashing with salt rounds
- **API Protection**: Express rate limiting and request sanitization
- **Input Validation**: Comprehensive express-validator implementation
- **CORS Configuration**: Secure cross-origin resource sharing
- **Security Headers**: Helmet.js implementation

### Database Design
- **User Management**: Comprehensive user profiles with role-based access
- **Meeting Schema**: Complex meeting structure with participant tracking
- **Analytics Engine**: Optimized aggregation pipelines for business intelligence
- **Indexing Strategy**: Performance-optimized database indexing

## Installation & Setup

### Prerequisites
- Node.js (version 14.0.0 or higher)
- MongoDB (version 4.4 or higher)
- SMTP email service (Gmail recommended)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-organization/meeting-scheduler-pro.git
   cd meeting-scheduler-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   ```
   
   Configure your environment variables:
   ```env
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/meeting-scheduler
   JWT_SECRET=your-secure-jwt-secret-key
   JWT_EXPIRE=7d
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@company.com
   SMTP_PASS=your-app-password
   ```

4. **Database initialization**
   ```bash
   npm run seed    # Optional: populate with sample data
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Web Interface: `http://localhost:3000`
   - Health Check: `http://localhost:3000/health`
   - API Documentation: `http://localhost:3000/api`

## API Documentation

### Authentication Endpoints

#### User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "password": "SecurePassword123",
  "department": "Engineering",
  "position": "Software Developer"
}
```

#### User Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@company.com",
  "password": "SecurePassword123"
}
```

### Meeting Management

#### Create Meeting
```http
POST /api/meetings
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Quarterly Planning Meeting",
  "description": "Strategic planning for Q1 objectives",
  "startTime": "2024-03-15T14:00:00Z",
  "endTime": "2024-03-15T15:30:00Z",
  "participants": [
    {"user": "userId1"},
    {"user": "userId2"}
  ],
  "category": "planning",
  "priority": "high",
  "location": {
    "type": "physical",
    "details": {
      "address": "Conference Room A, 5th Floor"
    }
  }
}
```

#### Retrieve Meetings
```http
GET /api/meetings?page=1&limit=10&startDate=2024-03-01&endDate=2024-03-31
Authorization: Bearer <jwt-token>
```

### Analytics Endpoints

#### Dashboard Analytics
```http
GET /api/analytics/dashboard?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt-token>
```

#### Team Performance Metrics
```http
GET /api/analytics/team?department=Engineering
Authorization: Bearer <jwt-token>
```

## MongoDB Aggregation Features

The application leverages MongoDB's powerful aggregation framework for advanced data processing:

### Meeting Analytics Pipeline
```javascript
Meeting.aggregate([
  {
    $match: {
      startTime: { $gte: startDate, $lte: endDate },
      status: "completed"
    }
  },
  {
    $group: {
      _id: "$category",
      totalMeetings: { $sum: 1 },
      averageDuration: {
        $avg: {
          $divide: [
            { $subtract: ["$endTime", "$startTime"] },
            1000 * 60
          ]
        }
      },
      participantCount: { $avg: { $size: "$participants" } }
    }
  },
  {
    $sort: { totalMeetings: -1 }
  }
])
```

### Collaboration Analysis
```javascript
Meeting.aggregate([
  { $unwind: "$participants" },
  {
    $group: {
      _id: {
        user1: "$organizer",
        user2: "$participants.user"
      },
      collaborationCount: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "_id.user1",
      foreignField: "_id",
      as: "organizer"
    }
  }
])
```

## Advanced Features

### Real-time Notifications
- Live meeting updates via Socket.IO
- Participant response tracking
- Conflict alerts and resolution suggestions
- System-wide announcements

### Email Automation
- Professional HTML email templates
- Automated meeting invitations
- Customizable reminder scheduling
- Meeting update notifications
- Cancellation alerts

### AI-Powered Insights
- Optimal meeting time suggestions
- Productivity pattern analysis
- Team collaboration insights
- Resource utilization optimization

### Security Features
- JWT authentication with refresh tokens
- Password strength validation
- Account lockout mechanisms
- API rate limiting
- Input sanitization and validation
- SQL injection prevention
- XSS protection

## Performance Optimization

### Database Performance
- Strategic indexing for frequently queried fields
- Aggregation pipeline optimization
- Connection pooling
- Query result caching

### Application Performance
- Middleware optimization
- Response compression
- Static asset caching
- Background task processing

## Deployment

### Docker Support
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Production Configuration
1. Set `NODE_ENV=production`
2. Configure production MongoDB instance
3. Set up SMTP service credentials
4. Configure reverse proxy (nginx recommended)
5. Implement SSL/TLS certificates
6. Set up monitoring and logging

### Environment Variables
```env
# Application
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/meeting-scheduler

# Authentication
JWT_SECRET=your-production-jwt-secret-256-bit-key
JWT_EXPIRE=7d

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASS=secure-app-password

# Application URLs
APP_URL=https://meetings.company.com
```

## Monitoring & Logging

### Health Checks
- Application health endpoint: `/health`
- Database connectivity monitoring
- Email service status verification
- Real-time connection monitoring

### Logging Implementation
- Winston logger with multiple transport levels
- Request/response logging via Morgan
- Error tracking and alerting
- Performance metrics collection

## Development

### Project Structure
```
meeting-scheduler-pro/
├── src/
│   ├── app.js                  # Application entry point
│   ├── config/
│   │   └── database.js         # Database configuration
│   ├── models/
│   │   ├── User.js            # User data model
│   │   └── Meeting.js         # Meeting data model
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── meetings.js        # Meeting management
│   │   ├── users.js           # User management
│   │   ├── analytics.js       # Analytics endpoints
│   │   └── advanced.js        # Advanced features
│   ├── middleware/
│   │   ├── auth.js            # Authentication middleware
│   │   ├── validation.js      # Input validation
│   │   └── errorHandler.js    # Error handling
│   ├── services/
│   │   ├── emailService.js    # Email automation
│   │   ├── reminderService.js # Meeting reminders
│   │   ├── aiInsightsService.js # AI features
│   │   └── smartCalendarService.js # Calendar intelligence
│   └── utils/
│       └── logger.js          # Logging utilities
├── public/                    # Static web assets
├── scripts/                   # Database scripts
├── tests/                     # Test suites
└── docs/                      # Documentation
```

### Available Scripts
```bash
npm start              # Start production server
npm run dev           # Start development server with hot reload
npm test              # Run test suite
npm run test:coverage # Run tests with coverage report
npm run seed          # Populate database with sample data
npm run migrate       # Run database migrations
npm run lint          # Run ESLint code analysis
npm run build         # Build for production
```

### Testing
- Unit tests with Jest
- Integration tests for API endpoints
- Database testing with MongoDB Memory Server
- End-to-end testing with Supertest

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards
- ESLint configuration for code quality
- Prettier for code formatting
- Conventional Commits for commit messages
- Comprehensive test coverage requirements

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support & Documentation

- **Issue Tracker**: GitHub Issues
- **Documentation**: `/docs` directory
- **API Documentation**: Swagger/OpenAPI specification
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## Acknowledgments

- **MongoDB** for powerful aggregation capabilities
- **Express.js** for robust web framework
- **Socket.IO** for real-time communication
- **Node.js** ecosystem contributors

---

**Meeting Scheduler Pro** - Enterprise-grade meeting management for modern organizations.

*Copyright (c) 2024 Your Organization. All rights reserved.*
