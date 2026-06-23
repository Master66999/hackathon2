const mongoose = require('mongoose');

const problemStatementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['AI/ML', 'Web Dev', 'Web3', 'App Dev', 'data science'], required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  allocatedToTeams: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('ProblemStatement', problemStatementSchema);
