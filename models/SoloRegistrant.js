const mongoose = require('mongoose');

const soloRegistrantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  skills: [{ type: String }],
  interests: [{ type: String }],
  registeredEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  matchedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }
}, { timestamps: true });

module.exports = mongoose.model('SoloRegistrant', soloRegistrantSchema);
