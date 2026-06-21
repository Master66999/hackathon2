const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  leaderName: { type: String, required: true },
  leaderEmail: { type: String, required: true },
  members: [
    {
      name: { type: String },
      email: { type: String }
    }
  ],
  problemStatement: { type: String, default: '' },
  registeredEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  college: { type: String, default: '' },
  attendedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  performanceGrade: { type: Number, default: 0 },
  performanceFeedback: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
