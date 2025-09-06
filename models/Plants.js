const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    tds: {
        type: Number,
        required: true
    },
    harvestDays: {
        type: Number,
        required: true
    },
    image: {
        type: String,
        required: true,
        min: 1
    },
}, { timestamps: true });

module.exports = mongoose.model('Plant', plantSchema); 