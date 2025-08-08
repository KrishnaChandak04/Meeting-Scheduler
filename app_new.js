require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cron = require('node-cron');
const cors = require('cors');
const morgan = require('morgan');

// Import configurations and middleware
const logger = require('./config/logger');
const { securityMiddlewares, rateLimiters } = require('./middleware/security');
const { errorHandler, notFound, catchAsync } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');

// Import services
const reminderService = require('./services/reminderService');
const notificationService = require('./services/notificationService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-scheduler';

// Database connection with retry logic
const connectDB = async () => {
    const maxRetries = 5;
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            const conn = await mongoose.connect(MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferMaxEntries: 0,
                bufferCommands: false
            });
            
            logger.info(`MongoDB Connected: ${conn.connection.host}`);
            return;
        } catch (error) {
            retries++;
            logger.error(`Database connection attempt ${retries} failed:`, error);
            
            if (retries === maxRetries) {
                logger.error('Max retries reached. Exiting...');
                process.exit(1);
            }
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
    }
};

// Connect to database
connectDB();

// Trust proxy for accurate IP addresses behind reverse proxy
app.set('trust proxy', 1);

// Apply security middlewares
app.use(securityMiddlewares);

// CORS configuration
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            process.env.CLIENT_URL
        ].filter(Boolean);
        
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// HTTP request logging
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', { stream: logger.stream }));
}

// Body parsing middleware
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: NODE_ENV === 'production' ? '1y' : '0',
    etag: true,
    lastModified: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API routes with rate limiting
app.use('/api/auth', rateLimiters.auth, authRoutes);
app.use('/api/meetings', rateLimiters.meetings, meetingRoutes);
app.use('/api/users', rateLimiters.search, userRoutes);
app.use('/api/analytics', rateLimiters.api, analyticsRoutes);

// Serve the demo interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Welcome API endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: '🎯 Meeting Scheduler API',
        version: '1.0.0',
        features: [
            '👤 User Authentication with JWT',
            '📅 Meeting Scheduling',
            '📧 Email Notifications',
            '🔔 Real-time Notifications',
            '📊 Analytics Dashboard',
            '🔍 Advanced Search & Filtering'
        ]
    });
});

// Socket.IO configuration
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);
    
    // Join user to their personal room for notifications
    socket.on('join-room', (userId) => {
        socket.join(userId);
        logger.info(`User ${userId} joined their notification room`);
    });
    
    // Handle meeting updates
    socket.on('meeting-update', (data) => {
        socket.to(data.room).emit('meeting-updated', data);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.id}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
        logger.error('Socket error:', error);
    });
});

// Make io accessible to routes
app.set('io', io);

// Cron jobs for automated tasks
if (NODE_ENV !== 'test') {
    // Send meeting reminders every minute
    cron.schedule('* * * * *', async () => {
        try {
            await reminderService.sendReminders();
        } catch (error) {
            logger.error('Error in reminder cron job:', error);
        }
    });
    
    // Clean up old notifications every hour
    cron.schedule('0 * * * *', async () => {
        try {
            await notificationService.cleanupOldNotifications();
        } catch (error) {
            logger.error('Error in cleanup cron job:', error);
        }
    });
    
    // Generate daily analytics report at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            logger.info('Generating daily analytics report...');
            // Add analytics generation logic here
        } catch (error) {
            logger.error('Error in analytics cron job:', error);
        }
    });
}

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        logger.info('HTTP server closed');
        
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', err);
    // Close server & exit process
    server.close(() => {
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception thrown:', err);
    process.exit(1);
});

// Start server
server.listen(PORT, () => {
    logger.info(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
    logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
    logger.info(`🎨 Demo interface available at http://localhost:${PORT}/`);
});

module.exports = { app, server, io };
