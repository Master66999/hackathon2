const db = require('./models/db');

async function check() {
  await db.connectDb();
  console.log('useMock:', db.getUseMock());
  console.log('isConnected:', db.getIsConnected());
  
  const members = await db.Member.find({});
  console.log('Members count:', members.length);
  console.log('Members:', JSON.stringify(members, null, 2));
}

check().catch(console.error);
