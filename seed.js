const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Meeting = require('../src/models/Meeting');

const seedUsers = [
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    password: 'password123',
    department: 'Engineering',
    position: 'Senior Developer',
    role: 'admin'
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@company.com',
    password: 'password123',
    department: 'Engineering',
    position: 'Frontend Developer',
    role: 'user'
  },
  {
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@company.com',
    password: 'password123',
    department: 'Product',
    position: 'Product Manager',
    role: 'moderator'
  },
  {
    firstName: 'Sarah',
    lastName: 'Wilson',
    email: 'sarah.wilson@company.com',
    password: 'password123',
    department: 'Design',
    position: 'UI/UX Designer',
    role: 'user'
  },
  {
    firstName: 'David',
    lastName: 'Brown',
    email: 'david.brown@company.com',
    password: 'password123',
    department: 'Engineering',
    position: 'DevOps Engineer',
    role: 'user'
  },
  {
    firstName: 'Lisa',
    lastName: 'Davis',
    email: 'lisa.davis@company.com',
    password: 'password123',
    department: 'Marketing',
    position: 'Marketing Manager',
    role: 'user'
  },
  {
    firstName: 'Tom',
    lastName: 'Anderson',
    email: 'tom.anderson@company.com',
    password: 'password123',
    department: 'Sales',
    position: 'Sales Representative',
    role: 'user'
  },
  {
    firstName: 'Emily',
    lastName: 'Taylor',
    email: 'emily.taylor@company.com',
    password: 'password123',
    department: 'HR',
    position: 'HR Manager',
    role: 'moderator'
  }
];

const seedMeetings = [
  {
    title: 'Daily Standup',
    description: 'Daily team synchronization meeting',
    category: 'standup',
    priority: 'medium',
    location: {
      type: 'virtual',
      details: {
        meetingLink: 'https://meet.google.com/abc-def-ghi'
      }
    },
    isRecurring: true,
    recurrence: {
      pattern: 'daily',
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
    },
    agenda: [
      { item: 'Yesterday\'s progress', duration: 5 },
      { item: 'Today\'s goals', duration: 5 },
      { item: 'Blockers and challenges', duration: 5 }
    ],
    tags: ['daily', 'standup', 'team']
  },
  {
    title: 'Sprint Planning',
    description: 'Planning meeting for the upcoming sprint',
    category: 'meeting',
    priority: 'high',
    location: {
      type: 'hybrid',
      details: {
        address: 'Conference Room A, 2nd Floor',
        meetingLink: 'https://meet.google.com/xyz-abc-def'
      }
    },
    agenda: [
      { item: 'Sprint goal definition', duration: 30 },
      { item: 'Backlog refinement', duration: 45 },
      { item: 'Capacity planning', duration: 30 },
      { item: 'Task assignments', duration: 15 }
    ],
    tags: ['sprint', 'planning', 'agile']
  },
  {
    title: 'Product Demo',
    description: 'Demo of new features to stakeholders',
    category: 'presentation',
    priority: 'high',
    location: {
      type: 'physical',
      details: {
        address: 'Main Conference Room, 1st Floor'
      }
    },
    agenda: [
      { item: 'Welcome and introductions', duration: 10 },
      { item: 'Feature demonstrations', duration: 40 },
      { item: 'Q&A session', duration: 20 },
      { item: 'Next steps', duration: 10 }
    ],
    tags: ['demo', 'stakeholders', 'features']
  },
  {
    title: 'Design Review',
    description: 'Review of new UI/UX designs',
    category: 'review',
    priority: 'medium',
    location: {
      type: 'virtual',
      details: {
        meetingLink: 'https://meet.google.com/design-review-123'
      }
    },
    agenda: [
      { item: 'Design presentation', duration: 20 },
      { item: 'Feedback collection', duration: 15 },
      { item: 'Action items', duration: 10 }
    ],
    tags: ['design', 'review', 'ui', 'ux']
  },
  {
    title: 'All Hands Meeting',
    description: 'Company-wide quarterly update',
    category: 'meeting',
    priority: 'high',
    location: {
      type: 'virtual',
      details: {
        meetingLink: 'https://meet.google.com/all-hands-q1'
      }
    },
    agenda: [
      { item: 'CEO opening remarks', duration: 15 },
      { item: 'Q1 results and highlights', duration: 30 },
      { item: 'Department updates', duration: 45 },
      { item: 'Q&A session', duration: 30 }
    ],
    tags: ['all-hands', 'quarterly', 'company']
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Meeting.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Seed users
    const createdUsers = [];
    for (const userData of seedUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`👤 Created user: ${user.fullName} (${user.email})`);
    }

    // Seed meetings
    const now = new Date();
    for (let i = 0; i < seedMeetings.length; i++) {
      const meetingData = seedMeetings[i];
      
      // Random start time in the next 30 days
      const startTime = new Date(now.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + (meetingData.agenda ? 
        meetingData.agenda.reduce((sum, item) => sum + (item.duration || 30), 0) * 60 * 1000 :
        60 * 60 * 1000)); // Default 1 hour

      // Random organizer and participants
      const organizer = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const participantCount = Math.floor(Math.random() * 4) + 2; // 2-5 participants
      const participants = [];
      
      // Add organizer as participant
      participants.push({
        user: organizer._id,
        status: 'accepted'
      });

      // Add random participants
      const shuffledUsers = [...createdUsers].sort(() => 0.5 - Math.random());
      for (let j = 0; j < participantCount - 1 && j < shuffledUsers.length - 1; j++) {
        if (shuffledUsers[j]._id.toString() !== organizer._id.toString()) {
          participants.push({
            user: shuffledUsers[j]._id,
            status: ['pending', 'accepted', 'declined'][Math.floor(Math.random() * 3)]
          });
        }
      }

      const meeting = new Meeting({
        ...meetingData,
        organizer: organizer._id,
        participants,
        startTime,
        endTime,
        reminders: [
          { type: 'email', minutesBefore: 60 },
          { type: 'notification', minutesBefore: 15 }
        ]
      });

      await meeting.save();
      console.log(`📅 Created meeting: ${meeting.title} (${startTime.toLocaleDateString()})`);
    }

    // Create some additional random meetings for better analytics
    for (let i = 0; i < 20; i++) {
      const organizer = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const startTime = new Date(now.getTime() + (Math.random() - 0.5) * 60 * 24 * 60 * 60 * 1000); // ±60 days
      const duration = [15, 30, 45, 60, 90, 120][Math.floor(Math.random() * 6)]; // Random duration
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const participants = [{
        user: organizer._id,
        status: 'accepted'
      }];

      // Add 1-4 random participants
      const shuffledUsers = [...createdUsers].sort(() => 0.5 - Math.random());
      const participantCount = Math.floor(Math.random() * 4) + 1;
      
      for (let j = 0; j < participantCount && j < shuffledUsers.length - 1; j++) {
        if (shuffledUsers[j]._id.toString() !== organizer._id.toString()) {
          participants.push({
            user: shuffledUsers[j]._id,
            status: ['pending', 'accepted', 'declined', 'tentative'][Math.floor(Math.random() * 4)]
          });
        }
      }

      const meeting = new Meeting({
        title: `Meeting ${i + 1}`,
        description: `Randomly generated meeting for testing analytics`,
        organizer: organizer._id,
        participants,
        startTime,
        endTime,
        status: startTime < now ? 
          ['completed', 'cancelled'][Math.floor(Math.random() * 2)] : 
          'scheduled',
        category: ['meeting', 'standup', 'review', 'training', 'interview'][Math.floor(Math.random() * 5)],
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        location: {
          type: ['virtual', 'physical', 'hybrid'][Math.floor(Math.random() * 3)],
          details: {
            meetingLink: 'https://meet.google.com/random-' + Math.random().toString(36).substr(2, 9)
          }
        },
        tags: ['test', 'analytics', 'sample'],
        reminders: [
          { type: 'email', minutesBefore: 30 }
        ]
      });

      await meeting.save();
    }

    console.log('✅ Database seeded successfully!');
    
    // Print summary
    const userCount = await User.countDocuments();
    const meetingCount = await Meeting.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    console.log('\n📊 Seed Summary:');
    console.log(`👥 Users created: ${userCount} (${adminCount} admins)`);
    console.log(`📅 Meetings created: ${meetingCount}`);
    console.log('\n🔑 Test Accounts:');
    console.log('Admin: john.doe@company.com / password123');
    console.log('User: jane.smith@company.com / password123');
    console.log('Moderator: mike.johnson@company.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
