const db = require('./models/db');

async function seed() {
  console.log('Connecting and seeding...');
  await db.connectDb();
  console.log('Seeded process finished!');
  
  // Query members to check
  const count = await db.Member.countDocuments();
  console.log('Member count after seed:', count);
}

seed().catch(console.error);
