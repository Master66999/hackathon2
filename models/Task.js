const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  dueDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
