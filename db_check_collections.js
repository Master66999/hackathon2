const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://developer:3aWZwEdtZsf3Trln@cluster0.2weu66g.mongodb.net/clubpulse';
  console.log('Connecting to URI:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections in database:');
  for (let col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`- ${col.name}: ${count} documents`);
  }

  await mongoose.disconnect();
  console.log('Disconnected');
}

check().catch(console.error);
