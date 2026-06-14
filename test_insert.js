const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Member = require('./models/Member');

async function testInsert() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  try {
    const res = await Member.create({
      name: 'Test Member',
      email: 'test@example.com',
      role: 'Member',
      status: 'active',
      engagementScore: 10,
      completedTasks: 0
    });
    console.log('Success! Inserted:', res);
  } catch (error) {
    console.error('Failed to insert member:', error);
  }

  await mongoose.disconnect();
}

testInsert().catch(console.error);
