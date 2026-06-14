const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  leaderName: { type: String, required: true },
  leaderEmail: { type: String, required: true },
  members: [
    {
      name: { type: String },
      email: { type: String }
    }
  ],
  problemStatement: { type: String, default: '' }, // Allocated statement title
  registeredEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  attendedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  performanceGrade: { type: Number, default: 0 }, // Evaluation grade (e.g. 0-100)
  performanceFeedback: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
