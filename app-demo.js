require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

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
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// Mock API routes for demo
const authRouter = express.Router();
const meetingsRouter = express.Router();
const usersRouter = express.Router();
const analyticsRouter = express.Router();

// Authentication routes
authRouter.post('/register', (req, res) => {
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

authRouter.post('/login', (req, res) => {
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

authRouter.get('/me', (req, res) => {
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

// Meeting routes
meetingsRouter.post('/', (req, res) => {
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

meetingsRouter.get('/analytics', (req, res) => {
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

meetingsRouter.get('/calendar', (req, res) => {
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

meetingsRouter.get('/', (req, res) => {
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

// User routes
usersRouter.get('/search', (req, res) => {
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

usersRouter.get('/suggestions', (req, res) => {
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

// Analytics routes
analyticsRouter.get('/dashboard', (req, res) => {
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

analyticsRouter.get('/trends', (req, res) => {
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

analyticsRouter.get('/team', (req, res) => {
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

// Use routers
app.use('/api/auth', authRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/analytics', analyticsRouter);

// Mock seed endpoint
app.post('/scripts/seed', (req, res) => {
    res.json({
        success: true,
        message: 'Database seeded successfully with demo data',
        data: {
            users: 10,
            meetings: 25,
            notifications: 15
        }
    });
});

// Serve the demo interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: '🎯 Meeting Scheduler Pro API (Demo Mode)',
        version: '1.0.0',
        mode: 'demo',
        features: [
            '👤 User Authentication with JWT',
            '📅 Meeting Scheduling',
            '📧 Email Notifications',
            '🔔 Real-time Notifications',
            '📊 Analytics Dashboard',
            '🔍 Advanced Search & Filtering'
        ],
        note: 'This is a demo mode with mock data. Connect to MongoDB to use full functionality.'
    });
});

// Socket.IO configuration
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
    
    socket.on('join-room', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their notification room`);
        
        // Send demo notification
        setTimeout(() => {
            socket.emit('notification', {
                title: 'Demo Mode Active',
                message: 'You are using demo data. All operations are simulated.',
                timestamp: new Date().toISOString()
            });
        }, 2000);
    });
    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Can't find ${req.originalUrl} on this server!`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Meeting Scheduler Pro running in DEMO mode on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🎨 Demo interface: http://localhost:${PORT}/`);
    console.log(`⚠️  Note: Using mock data - connect MongoDB for full functionality`);
});

module.exports = { app, server, io };
