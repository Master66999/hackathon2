const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clubpulse';
  console.log('Connecting to URI:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const users = await db.collection('users').find({}).toArray();
  console.log('--- USERS ---', users.length);
  console.log(users.map(u => ({ _id: u._id, name: u.name, email: u.email })));

  const events = await db.collection('events').find({}).toArray();
  console.log('--- EVENTS ---', events.length);
  console.log(events);

  const members = await db.collection('members').find({}).toArray();
  console.log('--- MEMBERS ---', members.length);

  const teams = await db.collection('teams').find({}).toArray();
  console.log('--- TEAMS ---', teams.length);

  await mongoose.disconnect();
  console.log('Disconnected');
}

check().catch(console.error);
