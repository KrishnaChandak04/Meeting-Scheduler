// Simple test runner to debug startup issues
try {
  console.log('🔍 Testing startup components...');
  
  // Test 1: Environment
  require('dotenv').config();
  console.log('✅ Environment loaded');
  
  // Test 2: Basic modules
  const express = require('express');
  const mongoose = require('mongoose');
  console.log('✅ Basic modules loaded');
  
  // Test 3: Services
  console.log('📧 Testing email service...');
  const emailService = require('./services/emailService');
  console.log('✅ Email service loaded');
  
  console.log('📊 Testing AI insights service...');
  const aiService = require('./services/aiInsightsService');
  console.log('✅ AI insights service loaded');
  
  console.log('📅 Testing smart calendar service...');
  const calendarService = require('./services/smartCalendarService');
  console.log('✅ Smart calendar service loaded');
  
  // Test 4: Routes
  console.log('🛣️ Testing routes...');
  const authRoutes = require('./routes/auth');
  const meetingRoutes = require('./routes/meetings');
  const advancedRoutes = require('./routes/advanced-simple');
  console.log('✅ All routes loaded');
  
  console.log('🎉 All components loaded successfully!');
  
  // Now try to start the actual server
  console.log('🚀 Starting production server...');
  const app = require('./app-production');
  
} catch (error) {
  console.error('❌ Error during startup:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
