const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  leaderName: { type: String, required: true },
  leaderEmail: { type: String, required: true },
  leaderEmailStatus: { type: String, default: 'pending' },
  leaderEmailError: { type: String, default: '' },
  members: [
    {
      name: { type: String },
      email: { type: String },
      emailStatus: { type: String, default: 'pending' },
      emailError: { type: String, default: '' }
    }
  ],
  problemStatement: { type: String, default: '' },
  registeredEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  college: { type: String, default: '' },
  attendedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  performanceGrade: { type: Number, default: 0 },
  performanceFeedback: { type: String, default: '' },
  projectLiveLink: { type: String, default: '' },
  projectGithubLink: { type: String, default: '' },
  projectPptLink: { type: String, default: '' },
  projectReportLink: { type: String, default: '' },
  projectSubmitted: { type: Boolean, default: false },
  projectSubmittedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
