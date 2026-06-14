const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Lead', 'Organizer', 'Member'], default: 'Member' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  engagementScore: { type: Number, default: 0 },
  completedTasks: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Member', memberSchema);
