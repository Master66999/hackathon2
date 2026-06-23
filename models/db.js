const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Real models
const RealMember = require('./Member');
const RealEvent = require('./Event');
const RealTask = require('./Task');
const RealTeam = require('./Team');
const RealProblemStatement = require('./ProblemStatement');
const RealUser = require('./User');
const RealSoloRegistrant = require('./SoloRegistrant');

let isConnected = false;
let useMock = false;

// In-Memory Data Store (Fallback)
const dbMemory = {
  members: [],
  events: [],
  tasks: [],
  teams: [],
  problemstatements: [],
  users: [],
  soloregistrants: []
};

// Fluent Query Mock
class MockQuery {
  constructor(data, isSingle = false) {
    this.data = data;
    this.isSingle = isSingle;
  }

  populate(path) {
    // Simulate populate for simple schemas
    if (!this.data) return this;

    const populateItem = (item) => {
      if (!item) return item;
      
      // Populate Member in Task (assignedTo)
      if (path === 'assignedTo' && item.assignedTo) {
        if (typeof item.assignedTo === 'string' || item.assignedTo instanceof mongoose.Types.ObjectId) {
          const member = dbMemory.members.find(m => m._id.toString() === item.assignedTo.toString());
          if (member) item.assignedTo = { ...member };
        }
      }
      // Populate Event in Team (registeredEvent)
      if (path === 'registeredEvent' && item.registeredEvent) {
        if (typeof item.registeredEvent === 'string' || item.registeredEvent instanceof mongoose.Types.ObjectId) {
          const event = dbMemory.events.find(e => e._id.toString() === item.registeredEvent.toString());
          if (event) item.registeredEvent = { ...event };
        }
      }
      // Populate Event in SoloRegistrant (registeredEvent)
      if (path === 'registeredEvent' && item.registeredEvent) {
        if (typeof item.registeredEvent === 'string' || item.registeredEvent instanceof mongoose.Types.ObjectId) {
          const event = dbMemory.events.find(e => e._id.toString() === item.registeredEvent.toString());
          if (event) item.registeredEvent = { ...event };
        }
      }
      // Populate Event in ProblemStatement (eventId)
      if (path === 'eventId' && item.eventId) {
        if (typeof item.eventId === 'string' || item.eventId instanceof mongoose.Types.ObjectId) {
          const event = dbMemory.events.find(e => e._id.toString() === item.eventId.toString());
          if (event) item.eventId = { ...event };
        }
      }
      // Populate Teams in ProblemStatement (allocatedToTeams)
      if (path === 'allocatedToTeams' && item.allocatedToTeams) {
        if (Array.isArray(item.allocatedToTeams)) {
          item.allocatedToTeams = item.allocatedToTeams.map(tId => {
            const team = dbMemory.teams.find(t => t._id.toString() === tId.toString());
            return team ? { ...team } : tId;
          });
        }
      }
      return item;
    };

    if (this.isSingle) {
      this.data = populateItem(this.data);
    } else if (Array.isArray(this.data)) {
      this.data = this.data.map(item => populateItem({ ...item }));
    }
    return this;
  }

  sort(options) {
    if (!Array.isArray(this.data)) return this;

    let sortFields = [];
    if (typeof options === 'object') {
      sortFields = Object.entries(options);
    } else if (typeof options === 'string') {
      sortFields = options.split(' ').map(f => f.startsWith('-') ? [f.substring(1), -1] : [f, 1]);
    }

    this.data.sort((a, b) => {
      for (const [key, dir] of sortFields) {
        const valA = a[key];
        const valB = b[key];
        if (valA < valB) return dir === -1 ? 1 : -1;
        if (valA > valB) return dir === -1 ? -1 : 1;
      }
      return 0;
    });

    return this;
  }

  select(fields) {
    // No-op for mock, return as is
    return this;
  }

  limit(n) {
    if (Array.isArray(this.data)) {
      this.data = this.data.slice(0, n);
    }
    return this;
  }

  then(onFulfilled, onRejected) {
    return Promise.resolve(this.data).then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return Promise.resolve(this.data).catch(onRejected);
  }
}

// Helper to filter items in-memory
function filterItems(items, filter) {
  if (!filter || Object.keys(filter).length === 0) return items;
  return items.filter(item => {
    for (const [key, val] of Object.entries(filter)) {
      if (val && typeof val === 'object' && val.$in) {
        if (!val.$in.includes(item[key])) return false;
      } else if (item[key] !== val) {
        // Handle string ID comparison
        if (key === '_id' && item._id.toString() !== val.toString()) return false;
        else if (item[key]?.toString() !== val?.toString()) return false;
      }
    }
    return true;
  });
}

// Mock Model Class
class MockModel {
  constructor(collectionName, arrayRef) {
    this.collectionName = collectionName;
    this.arrayRef = arrayRef;
  }

  find(filter = {}) {
    const filtered = filterItems(this.arrayRef, filter);
    return new MockQuery(filtered.map(item => ({ ...item })));
  }

  findById(id) {
    if (!id) return new MockQuery(null, true);
    const item = this.arrayRef.find(x => x._id.toString() === id.toString());
    return new MockQuery(item ? { ...item } : null, true);
  }

  findOne(filter = {}) {
    const filtered = filterItems(this.arrayRef, filter);
    const item = filtered[0] || null;
    return new MockQuery(item ? { ...item } : null, true);
  }

  async create(data) {
    const docs = Array.isArray(data) ? data : [data];
    const createdDocs = [];

    for (const doc of docs) {
      const newDoc = {
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...doc
      };
      this.arrayRef.push(newDoc);
      createdDocs.push({ ...newDoc });
    }

    return Array.isArray(data) ? createdDocs : createdDocs[0];
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const index = this.arrayRef.findIndex(x => x._id.toString() === id.toString());
    if (index === -1) return null;

    const current = this.arrayRef[index];
    const updatedFields = update.$set || update;
    const updated = {
      ...current,
      ...updatedFields,
      updatedAt: new Date()
    };

    // Keep mongoose properties in sync
    this.arrayRef[index] = updated;
    return { ...updated };
  }

  async findByIdAndDelete(id) {
    const index = this.arrayRef.findIndex(x => x._id.toString() === id.toString());
    if (index === -1) return null;
    const deleted = this.arrayRef.splice(index, 1)[0];
    return { ...deleted };
  }

  async deleteOne(filter = {}) {
    const filtered = filterItems(this.arrayRef, filter);
    if (filtered.length === 0) return { deletedCount: 0 };
    const index = this.arrayRef.findIndex(x => x._id.toString() === filtered[0]._id.toString());
    if (index !== -1) {
      this.arrayRef.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(filter = {}) {
    const filtered = filterItems(this.arrayRef, filter);
    return filtered.length;
  }
}

// Expose Mock Models
const MockModels = {
  Member: new MockModel('Member', dbMemory.members),
  Event: new MockModel('Event', dbMemory.events),
  Task: new MockModel('Task', dbMemory.tasks),
  Team: new MockModel('Team', dbMemory.teams),
  ProblemStatement: new MockModel('ProblemStatement', dbMemory.problemstatements),
  User: new MockModel('User', dbMemory.users),
  SoloRegistrant: new MockModel('SoloRegistrant', dbMemory.soloregistrants)
};

// Seed default simulated data
function seedInitialData(models) {
  return async () => {
    try {
      const userCount = await models.User.countDocuments();
      
      // 0. Create/Find a Default User for seeding
      let user = await models.User.findOne({ email: 'admin@clubpulse.com' });
      if (!user) {
        const hashedPassword = await bcrypt.hash('admin123', 12);
        user = await models.User.create({
          name: 'Default Admin',
          email: 'admin@clubpulse.com',
          password: hashedPassword,
          clubName: 'ClubPulse Demo',
          role: 'Admin'
        });
      }
      const uId = user._id;

      const memberCount = await models.Member.countDocuments();
      if (memberCount > 0) return;

      console.log('Seeding initial dashboard data...');

      // 1. Create Members
      const members = await models.Member.create([
        { userId: uId, name: 'Alex Rivera', email: 'alex@clubpulse.com', role: 'Admin', status: 'active', engagementScore: 98, completedTasks: 12 },
        { userId: uId, name: 'Sophia Chen', email: 'sophia@clubpulse.com', role: 'Lead', status: 'active', engagementScore: 95, completedTasks: 9 },
        { userId: uId, name: 'Marcus Sterling', email: 'marcus@clubpulse.com', role: 'Organizer', status: 'active', engagementScore: 88, completedTasks: 7 },
        { userId: uId, name: 'Elena Rostova', email: 'elena@clubpulse.com', role: 'Member', status: 'active', engagementScore: 82, completedTasks: 5 },
        { userId: uId, name: 'Devon Patel', email: 'devon@clubpulse.com', role: 'Member', status: 'active', engagementScore: 75, completedTasks: 4 },
        { userId: uId, name: 'Sarah Jenkins', email: 'sarah@clubpulse.com', role: 'Member', status: 'inactive', engagementScore: 45, completedTasks: 2 },
        { userId: uId, name: 'Liam Zhao', email: 'liam@clubpulse.com', role: 'Member', status: 'active', engagementScore: 68, completedTasks: 3 }
      ]);

      // 2. Create Events
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const pastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const pastMonth = new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000);

      const events = await models.Event.create([
        {
          userId: uId,
          title: 'PulseHack 2026',
          description: 'The premier smart club 48-hour hackathon for building AI-driven utilities and web dashboards.',
          date: nextWeek,
          location: 'Innovation Lab A',
          type: 'Competition',
          status: 'upcoming',
          maxCapacity: 150,
          organizer: 'Sophia Chen'
        },
        {
          userId: uId,
          title: 'NextGen Web Dev Workshop',
          description: 'Hands-on training session for building glassmorphic web UI components using CSS variables.',
          date: nextMonth,
          location: 'Seminar Room 302',
          type: 'Workshop',
          status: 'upcoming',
          maxCapacity: 60,
          organizer: 'Marcus Sterling'
        },
        {
          userId: uId,
          title: 'AI/ML Spring BootCamp',
          description: 'Introduction to predictive analysis model workflows and prompt engineering structures.',
          date: pastWeek,
          location: 'Virtual Zoom Room',
          type: 'Workshop',
          status: 'completed',
          maxCapacity: 100,
          organizer: 'Alex Rivera'
        },
        {
          userId: uId,
          title: 'Club Launch & Mixer',
          description: 'Networking night for new club members and industry mentors.',
          date: pastMonth,
          location: 'Skye Rooftop Lounge',
          type: 'Social',
          status: 'completed',
          maxCapacity: 120,
          organizer: 'Elena Rostova'
        }
      ]);

      // 3. Create Tasks
      await models.Task.create([
        { userId: uId, title: 'Design Glassmorphic UI Shell', assignedTo: members[0]._id, description: 'Create style.css variables and structure the layout components script.', status: 'completed', dueDate: pastWeek },
        { userId: uId, title: 'Setup Node/Mongoose API Server', assignedTo: members[1]._id, description: 'Write REST endpoints, models schema, and connection configuration.', status: 'completed', dueDate: pastWeek },
        { userId: uId, title: 'Draft PulseHack Sponsor Deck', assignedTo: members[2]._id, description: 'Coordinate with design lead to finalize the slides for corporate partners.', status: 'in-progress', dueDate: nextWeek },
        { userId: uId, title: 'Integrate QR Code Reader API', assignedTo: members[3]._id, description: 'Write scan.html UI and integrate it with html5-qrcode scanner libraries.', status: 'pending', dueDate: nextWeek },
        { userId: uId, title: 'Create Promo Video Assets', assignedTo: members[4]._id, description: 'Film social media teaser clips and publish them to Instagram/X pages.', status: 'pending', dueDate: nextWeek }
      ]);

      // 4. Create Teams
      const teams = await models.Team.create([
        {
          userId: uId,
          name: 'CyberNeura',
          leaderName: 'Devon Patel',
          leaderEmail: 'devon@cyberneura.io',
          members: [
            { name: 'Devon Patel', email: 'devon@cyberneura.io' },
            { name: 'Jane Miller', email: 'jane@cyberneura.io' }
          ],
          problemStatement: 'Smart Energy Grid Optimizer',
          registeredEvent: events[0]._id,
          attendedEvents: [events[2]._id, events[3]._id],
          performanceGrade: 92,
          performanceFeedback: 'Excellent deployment of ML model for predictive power analysis. Glassmorphic dashboard UI is clean.'
        },
        {
          userId: uId,
          name: 'VortexWeb',
          leaderName: 'Liam Zhao',
          leaderEmail: 'liam@vortexweb.dev',
          members: [
            { name: 'Liam Zhao', email: 'liam@vortexweb.dev' },
            { name: 'Tariq Al-Fayed', email: 'tariq@vortexweb.dev' },
            { name: 'Anya Ivanova', email: 'anya@vortexweb.dev' }
          ],
          problemStatement: 'DeFi Liquidity Aggregator',
          registeredEvent: events[0]._id,
          attendedEvents: [events[3]._id],
          performanceGrade: 85,
          performanceFeedback: 'Solid implementation of smart contract routing, but UI needs optimization.'
        }
      ]);

      // 5. Create Problem Statements
      await models.ProblemStatement.create([
        {
          userId: uId,
          title: 'Smart Energy Grid Optimizer',
          description: 'Leverage predictive AI modeling to distribute power grid loads dynamically and reduce waste.',
          category: 'AI/ML',
          eventId: events[0]._id,
          allocatedToTeam: teams[0]._id
        },
        {
          userId: uId,
          title: 'DeFi Liquidity Aggregator',
          description: 'Create a cross-chain smart aggregator to minimize slippage rates on decentralized tokens swap.',
          category: 'Web3',
          eventId: events[0]._id,
          allocatedToTeam: teams[1]._id
        },
        {
          userId: uId,
          title: 'Vulnerability Detection Scanner',
          description: 'Build a lightweight terminal client to trace Node dependencies trees and detect outdated API calls.',
          category: 'Web Dev',
          eventId: events[0]._id,
          allocatedToTeam: null
        }
      ]);

      console.log('Database seeded successfully!');
    } catch (err) {
      console.error('Error seeding database:', err);
    }
  };
}

// Connect Database Function
async function connectDb() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://developer:3aWZwEdtZsf3Trln@ac-is4d5xg-shard-00-00.2weu66g.mongodb.net:27017,ac-is4d5xg-shard-00-01.2weu66g.mongodb.net:27017,ac-is4d5xg-shard-00-02.2weu66g.mongodb.net:27017/clubpulse?ssl=true&replicaSet=atlas-100zwf-shard-0&authSource=admin';
  console.log('Connecting to URI:', mongoUri);

  // Object wrapping real Mongoose models so seedInitialData can use same interface
  const RealModels = {
    Member: RealMember,
    Event: RealEvent,
    Task: RealTask,
    Team: RealTeam,
    ProblemStatement: RealProblemStatement,
    User: RealUser,
    SoloRegistrant: RealSoloRegistrant
  };

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000, // 15s for Atlas cloud latency
      connectTimeoutMS: 15000
    });
    isConnected = true;
    useMock = false;
    console.log('Successfully connected to MongoDB.');
    // Seed real MongoDB
    await seedInitialData(RealModels)();
  } catch (error) {
    console.warn('MongoDB connection failed. Switching to in-memory mock database mode.');
    isConnected = false;
    useMock = true;
    // Seed mock data
    await seedInitialData(MockModels)();
  }
}

// Get active model (either mongoose or memory mock)
function getModel(name) {
  if (useMock) {
    return MockModels[name];
  }
  return mongoose.model(name);
}

module.exports = {
  connectDb,
  getIsConnected: () => isConnected,
  getUseMock: () => useMock,
  get dbMemory() { return dbMemory; }, // export memory store for debugging
  get Member() { return getModel('Member'); },
  get Event() { return getModel('Event'); },
  get Task() { return getModel('Task'); },
  get Team() { return getModel('Team'); },
  get ProblemStatement() { return getModel('ProblemStatement'); },
  get User() { return getModel('User'); },
  get SoloRegistrant() { return getModel('SoloRegistrant'); }
};
