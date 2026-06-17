const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://developer:3aWZwEdtZsf3Trln@cluster0.2weu66g.mongodb.net/clubpulse';
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
