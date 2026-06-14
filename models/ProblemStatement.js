const mongoose = require('mongoose');

const problemStatementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['AI/ML', 'Web Dev', 'Web3', 'App Dev'], required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  allocatedToTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ProblemStatement', problemStatementSchema);
