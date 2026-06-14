const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MemberSchema = new mongoose.Schema({}, { strict: false });
const TeamSchema = new mongoose.Schema({}, { strict: false });

const Member = mongoose.model('Member', MemberSchema, 'members');
const Team = mongoose.model('Team', TeamSchema, 'teams');

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clubpulse';
  console.log('Connecting to URI:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const members = await Member.find({});
  console.log('--- MEMBERS ---');
  console.log(JSON.stringify(members, null, 2));

  const teams = await Team.find({});
  console.log('--- TEAMS ---');
  console.log(JSON.stringify(teams, null, 2));

  await mongoose.disconnect();
  console.log('Disconnected');
}

check().catch(console.error);
