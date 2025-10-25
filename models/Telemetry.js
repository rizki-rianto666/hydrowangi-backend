const mongoose = require('mongoose');

const TelemetrySchema = new mongoose.Schema(
    {
        deviceId: { type: String, index: true, required: true },
        ph: { type: Number, min: 0, max: 14, required: true },
        ppm: { type: Number, min: 0, required: true },
        temp: { type: Number, required: true },
        humidity: { type: Number, required: false },
        nutritionOn: { type: Boolean, required: false },
        pesticideOn: { type: Boolean, required: false },
        ts: { type: Date, default: Date.now, index: true },
    },
    { versionKey: false }
);
TelemetrySchema.index({ deviceId: 1, ts: -1 });


module.exports = mongoose.model('Telemetry', TelemetrySchema); 