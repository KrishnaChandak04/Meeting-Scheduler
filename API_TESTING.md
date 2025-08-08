# Meeting Scheduler API Testing Guide

This file contains example API calls to test the Meeting Scheduler application.

## Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The server should be running on `http://localhost:3000`

## Authentication

### 1. Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "department": "Engineering",
    "position": "Developer"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Save the token from the response for subsequent requests!**

### 3. Get user profile
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Meeting Management

### 4. Create a meeting
```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Team Standup",
    "description": "Daily team synchronization",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T09:30:00Z",
    "participants": [],
    "category": "standup",
    "priority": "medium",
    "location": {
      "type": "virtual",
      "details": {
        "meetingLink": "https://meet.google.com/abc-def-ghi"
      }
    },
    "agenda": [
      {"item": "Yesterday progress", "duration": 10},
      {"item": "Today goals", "duration": 10},
      {"item": "Blockers", "duration": 10}
    ]
  }'
```

### 5. Get meetings
```bash
curl -X GET "http://localhost:3000/api/meetings?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Get meeting analytics (MongoDB Aggregation)
```bash
curl -X GET "http://localhost:3000/api/meetings/analytics" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7. Get calendar view
```bash
curl -X GET "http://localhost:3000/api/meetings/calendar?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## User Management

### 8. Search users
```bash
curl -X GET "http://localhost:3000/api/users/search?q=john" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 9. Get user suggestions
```bash
curl -X GET http://localhost:3000/api/users/suggestions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 10. Check user availability
```bash
curl -X GET "http://localhost:3000/api/users/availability?userIds=USER_ID_1,USER_ID_2&startTime=2024-01-15T09:00:00Z&endTime=2024-01-15T10:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Analytics

### 11. Dashboard analytics
```bash
curl -X GET "http://localhost:3000/api/analytics/dashboard?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 12. Trends analysis
```bash
curl -X GET "http://localhost:3000/api/analytics/trends?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 13. Export data
```bash
curl -X GET "http://localhost:3000/api/analytics/export?format=json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Health Check

### 14. Check API health
```bash
curl -X GET http://localhost:3000/api/health
```

## Using with Postman

1. Import these requests into Postman
2. Create an environment with:
   - `BASE_URL`: `http://localhost:3000`
   - `TOKEN`: (set after login)

3. Use `{{BASE_URL}}` and `{{TOKEN}}` in your requests

## Seeding Test Data

To populate the database with test data:

```bash
npm run seed
```

This will create sample users and meetings for testing.

## Test Credentials (after seeding)

- **Admin**: john.doe@company.com / password123
- **User**: jane.smith@company.com / password123
- **Moderator**: mike.johnson@company.com / password123

## MongoDB Aggregation Examples

The following endpoints showcase MongoDB aggregation pipelines:

1. **Meeting Analytics** (`/api/meetings/analytics`) - Complex statistics and breakdowns
2. **Calendar View** (`/api/meetings/calendar`) - Optimized calendar data
3. **User Availability** (`/api/users/availability`) - Conflict detection
4. **Team Analytics** (`/api/analytics/team`) - Department insights
5. **Trends Analysis** (`/api/analytics/trends`) - Pattern recognition

These endpoints demonstrate advanced MongoDB queries that go beyond simple CRUD operations.

## Real-time Features

The application supports real-time notifications via Socket.IO. Connect to:
- `ws://localhost:3000` for WebSocket connections
- Events: `notification`, `meeting_update`, `participant_response`

## Next Steps

1. Test the authentication flow
2. Create meetings and invite participants
3. Explore the analytics endpoints
4. Test real-time notifications
5. Try the advanced search and filtering features
