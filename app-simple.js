const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication endpoints
app.post('/api/auth/register', (req, res) => {
    res.json({
        success: true,
        message: 'User registered successfully',
        data: {
            token: 'mock-jwt-token-123',
            user: {
                id: '123',
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                email: req.body.email,
                department: req.body.department,
                position: req.body.position
            }
        }
    });
});

app.post('/api/auth/login', (req, res) => {
    res.json({
        success: true,
        message: 'Login successful',
        data: {
            token: 'mock-jwt-token-123',
            user: {
                id: '123',
                firstName: 'John',
                lastName: 'Doe',
                email: req.body.email,
                department: 'Engineering',
                position: 'Senior Developer'
            }
        }
    });
});

app.get('/api/auth/me', (req, res) => {
    res.json({
        success: true,
        data: {
            id: '123',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            department: 'Engineering',
            position: 'Senior Developer',
            avatar: null,
            timezone: 'UTC',
            isActive: true,
            createdAt: new Date().toISOString()
        }
    });
});

// Meeting endpoints
app.post('/api/meetings', (req, res) => {
    res.json({
        success: true,
        message: 'Meeting created successfully',
        data: {
            id: 'meeting-123',
            title: req.body.title,
            description: req.body.description,
            startTime: req.body.startTime,
            endTime: req.body.endTime,
            category: req.body.category,
            status: 'scheduled',
            organizer: {
                id: '123',
                name: 'John Doe',
                email: 'john.doe@test.com'
            },
            participants: [],
            location: req.body.location,
            createdAt: new Date().toISOString()
        }
    });
});

app.get('/api/meetings', (req, res) => {
    res.json({
        success: true,
        data: {
            meetings: [
                {
                    id: 'meeting-1',
                    title: 'Daily Standup',
                    description: 'Team sync meeting',
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                    endTime: new Date(Date.now() + 88200000).toISOString(),
                    category: 'standup',
                    status: 'scheduled'
                },
                {
                    id: 'meeting-2',
                    title: 'Sprint Planning',
                    description: 'Plan next sprint',
                    startTime: new Date(Date.now() + 172800000).toISOString(),
                    endTime: new Date(Date.now() + 176400000).toISOString(),
                    category: 'meeting',
                    status: 'scheduled'
                }
            ],
            total: 2,
            page: 1,
            limit: 10
        }
    });
});

app.get('/api/meetings/analytics', (req, res) => {
    res.json({
        success: true,
        data: {
            totalMeetings: 25,
            upcomingMeetings: 8,
            completedMeetings: 17,
            averageDuration: 45,
            categoryBreakdown: {
                meeting: 12,
                standup: 8,
                review: 3,
                training: 2
            },
            weeklyTrend: [5, 7, 3, 4, 6, 8, 2]
        }
    });
});

app.get('/api/meetings/calendar', (req, res) => {
    res.json({
        success: true,
        data: {
            events: [
                {
                    id: 'meeting-1',
                    title: 'Daily Standup',
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                    endTime: new Date(Date.now() + 88200000).toISOString(),
                    category: 'standup'
                },
                {
                    id: 'meeting-2',
                    title: 'Sprint Planning',
                    startTime: new Date(Date.now() + 172800000).toISOString(),
                    endTime: new Date(Date.now() + 176400000).toISOString(),
                    category: 'meeting'
                }
            ],
            totalEvents: 2
        }
    });
});

// User endpoints
app.get('/api/users/search', (req, res) => {
    res.json({
        success: true,
        data: {
            users: [
                {
                    id: '123',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@test.com',
                    department: 'Engineering',
                    position: 'Senior Developer'
                },
                {
                    id: '124',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane.smith@test.com',
                    department: 'Engineering',
                    position: 'Team Lead'
                }
            ],
            total: 2
        }
    });
});

app.get('/api/users/suggestions', (req, res) => {
    res.json({
        success: true,
        data: {
            suggestions: [
                {
                    id: '124',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane.smith@test.com',
                    department: 'Engineering',
                    reason: 'Frequently collaborates'
                },
                {
                    id: '125',
                    firstName: 'Mike',
                    lastName: 'Johnson',
                    email: 'mike.johnson@test.com',
                    department: 'Engineering',
                    reason: 'Same department'
                }
            ]
        }
    });
});

// Analytics endpoints
app.get('/api/analytics/dashboard', (req, res) => {
    res.json({
        success: true,
        data: {
            overview: {
                totalMeetings: 156,
                totalParticipants: 45,
                averageDuration: 42,
                productivityScore: 85
            },
            recentActivity: [
                { date: '2025-08-05', meetings: 8 },
                { date: '2025-08-04', meetings: 6 },
                { date: '2025-08-03', meetings: 7 },
                { date: '2025-08-02', meetings: 5 },
                { date: '2025-08-01', meetings: 9 }
            ],
            topCategories: [
                { category: 'standup', count: 45, percentage: 28.8 },
                { category: 'meeting', count: 38, percentage: 24.4 },
                { category: 'review', count: 25, percentage: 16.0 },
                { category: 'training', count: 18, percentage: 11.5 }
            ]
        }
    });
});

app.get('/api/analytics/trends', (req, res) => {
    res.json({
        success: true,
        data: {
            meetingTrends: {
                daily: [5, 7, 3, 4, 6, 8, 2, 9, 6, 4, 7, 5, 8, 3],
                weekly: [25, 28, 22, 30, 26, 33, 29, 31],
                monthly: [156, 142, 168, 173, 159, 181]
            },
            participationTrends: {
                averagePerMeeting: [4.2, 4.5, 3.8, 4.1, 4.7, 4.3],
                totalUnique: [42, 45, 48, 46, 51, 49]
            },
            durationTrends: {
                average: [45, 42, 38, 41, 44, 42],
                median: [30, 32, 28, 30, 35, 30]
            }
        }
    });
});

app.get('/api/analytics/team', (req, res) => {
    res.json({
        success: true,
        data: {
            teamStats: {
                totalMembers: 45,
                activeMembers: 42,
                averageMeetingsPerMember: 3.5,
                topPerformers: [
                    { name: 'John Doe', meetings: 12, participation: 95 },
                    { name: 'Jane Smith', meetings: 11, participation: 92 },
                    { name: 'Mike Johnson', meetings: 10, participation: 88 }
                ]
            },
            departmentBreakdown: [
                { department: 'Engineering', members: 18, meetings: 67 },
                { department: 'Product', members: 12, meetings: 45 },
                { department: 'Design', members: 8, meetings: 28 },
                { department: 'Marketing', members: 7, meetings: 16 }
            ]
        }
    });
});

// Socket.IO for real-time features
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Send welcome notification
    setTimeout(() => {
        socket.emit('notification', {
            title: 'Welcome!',
            message: 'You are now connected to Meeting Scheduler Pro',
            timestamp: new Date().toISOString()
        });
    }, 1000);
    
    // Handle meeting creation
    socket.on('create_meeting', (data) => {
        console.log('Meeting creation request:', data);
        
        // Broadcast to all clients
        io.emit('meeting_created', {
            id: `meeting-${Date.now()}`,
            title: data.title,
            startTime: data.startTime,
            endTime: data.endTime,
            organizer: 'Demo User',
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle meeting updates
    socket.on('update_meeting', (data) => {
        console.log('Meeting update request:', data);
        
        io.emit('meeting_updated', {
            id: data.id,
            changes: data.changes,
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle user activity
    socket.on('user_activity', (data) => {
        socket.broadcast.emit('activity_update', {
            userId: socket.id,
            activity: data.activity,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 Meeting Scheduler Pro - Demo Mode');
    console.log('='.repeat(50));
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🌐 Interface: http://localhost:${PORT}`);
    console.log(`📊 API Base: http://localhost:${PORT}/api`);
    console.log(`⚡ Socket.IO: Enabled`);
    console.log(`🔧 Mode: Production Demo`);
    console.log('='.repeat(50));
    console.log('✅ Ready to accept connections');
    console.log('💡 Features: Real-time updates, Mock data, Analytics');
    console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
