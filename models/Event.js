const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  type: { type: String, enum: ['Competition', 'Workshop', 'Meeting', 'Social'], required: true },
  status: { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' },
  maxCapacity: { type: Number, required: true },
  organizer: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
