const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MemberSchema = new mongoose.Schema({}, { strict: false });
const TeamSchema = new mongoose.Schema({}, { strict: false });

const Member = mongoose.model('Member', MemberSchema, 'members');
const Team = mongoose.model('Team', TeamSchema, 'teams');

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://developer:3aWZwEdtZsf3Trln@cluster0.2weu66g.mongodb.net/clubpulse';
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
