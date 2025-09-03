const mongoose = require('mongoose');

const PlantedSchema = new mongoose.Schema({
    plant: {
        type: {
            name: String,
            description: String,
            tds: Number,
            harvestDays: Number,
            image: String
        },
        required: true
    },
    harvestTime:{
        type: Number
    }
}, {timestamps: true });


module.exports = mongoose.model('Planted', PlantedSchema); 