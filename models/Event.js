const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  venue: { type: String },
  type: { type: String, enum: ['Competition', 'Workshop', 'Meeting', 'Social'], required: true },
  status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
  maxCapacity: { type: Number, required: true },
  organizer: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
