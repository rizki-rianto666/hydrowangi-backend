const mongoose = require('mongoose');

const plantedSchema = new mongoose.Schema({
  plant: {
    type: Object,
    required: true,
    properties: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      tds: { type: Number, required: true },
      harvestDays: { type: Number, required: true },
      image: { type: String, required: true }
    }
  },
  slot: {
    type: Number,
    required: true,
    min: 1,
    max: 2,
    validate: {
      validator: function(v) {
        return v === 1 || v === 2;
      },
      message: 'Slot must be 1 or 2'
    }
  },
  harvestTime: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return v > Date.now();
      },
      message: 'Harvest time must be in the future'
    }
  },
  plantedAt: {
    type: Number,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['growing', 'ready', 'harvested'],
    default: 'growing'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one plant per slot
plantedSchema.index({ slot: 1 }, { unique: true });

// Virtual for remaining days
plantedSchema.virtual('remainingDays').get(function() {
  if (this.harvestTime <= Date.now()) return 0;
  return Math.ceil((this.harvestTime - Date.now()) / 86400000);
});

// Virtual for ready status
plantedSchema.virtual('isReady').get(function() {
  return Date.now() >= this.harvestTime;
});

// Pre-save middleware to update status
plantedSchema.pre('save', function(next) {
  if (this.harvestTime <= Date.now()) {
    this.status = 'ready';
  } else {
    this.status = 'growing';
  }
  this.updatedAt = new Date();
  next();
});

// Static method to get available slots
plantedSchema.statics.getAvailableSlots = async function() {
  const occupiedSlots = await this.distinct('slot');
  const allSlots = [1, 2];
  return allSlots.filter(slot => !occupiedSlots.includes(slot));
};

// Static method to get plants ready for harvest
plantedSchema.statics.getReadyForHarvest = async function() {
  const now = Date.now();
  return this.find({ harvestTime: { $lte: now } });
};

// Instance method to check if plant is ready
plantedSchema.methods.checkReadiness = function() {
  return Date.now() >= this.harvestTime;
};

// Instance method to get remaining time in readable format
plantedSchema.methods.getRemainingTime = function() {
  if (this.harvestTime <= Date.now()) {
    return 'Ready for harvest!';
  }
  
  const remaining = this.harvestTime - Date.now();
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours > 0 ? `and ${hours} hour${hours > 1 ? 's' : ''}` : ''}`;
  } else {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
};

const Planted = mongoose.model('Planted', plantedSchema);

module.exports = Planted;