const mongoose = require('mongoose');
const ControlSchema = new mongoose.Schema(
    {
        deviceId: { type: String, unique: true, index: true, required: true },
        pesticideOn: { type: Boolean, default: false },
        nutritionOn: { type: Boolean, default: false },
        updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

module.exports = mongoose.model('Control', ControlSchema); 