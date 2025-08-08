// Simple server starter with explicit output
console.log('🚀 Starting Meeting Scheduler Pro...');

try {
  require('dotenv').config();
  console.log('✅ Environment loaded');
  
  const express = require('express');
  console.log('✅ Express loaded');
  
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  // Basic middleware
  app.use(express.json());
  app.use(express.static('public'));
  
  // Test route
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Meeting Scheduler Pro is running!',
      timestamp: new Date().toISOString(),
      port: PORT
    });
  });
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'Meeting Scheduler Pro',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });
  
  // Start server
  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🎉 MEETING SCHEDULER PRO - RUNNING SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📡 Server URL: http://localhost:${PORT}`);
    console.log(`🏠 Frontend: http://localhost:${PORT}/`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    console.log('='.repeat(60));
    console.log('✅ Ready to accept requests!');
    console.log('='.repeat(60));
  });
  
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}
