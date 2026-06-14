const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clubpulse';
  console.log('Connecting to URI:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const tasks = await db.collection('tasks').find({}).toArray();
  console.log('--- TASKS ---');
  console.log(JSON.stringify(tasks, null, 2));

  await mongoose.disconnect();
  console.log('Disconnected');
}

check().catch(console.error);
