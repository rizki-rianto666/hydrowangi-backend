const Plants = require('../models/Plants');

const createPlant = {
    method: 'POST',
    path: '/api/plants',
    options: {
        auth: 'false'
    },
    handler: async (request, h) => {
        try {
            const { name, description, tds, harvestDays, image, } = request.payload;


            const plant = new Plants({
                name,
                description,
                tds,
                harvestDays,
                image
            });

            await plant.save();
            return h.response(plant).code(201);
        } catch (error) {
            console.error('Error creating plant:', error);
            return h.response({ message: 'Failed to create plant' }).code(500);
        }
    }
};

const getPlants = {
    method: 'GET',
    path: '/api/plants',
    options: {
        auth: 'false'
    },
    handler: async (request, h) => {
        try {
            const plants = await Plants.find().sort({ createdAt: -1 });
            return h.response(plants).code(200);
        } catch (error) {
            console.error('Error fetching plants:', error);
            return h.response({ message: 'Failed to fetch plants' }).code(500);
        }
    }
};

const deletePlants = {
    method: 'DELETE',
    path: '/api/plants',
    options: {
        auth: 'jwt'
    },
    handler: async (request, h) => {
        try {
            const { name } = request.payload;
            const deletedPlant = await Plants.findOneAndDelete({ name });
            if (!deletedPlant) {
                return h.response({ message: 'Plant not found' }).code(404);
            }
            return h.response({ message: 'Plant deleted successfully' }).code(200);
        } catch (error) {
            console.error('Error deleting plant:', error);
            return h.response({ message: 'Failed to delete plant' }).code(500);
        }
    }
};

module.exports = {
    name: 'plants',
    register: async (server) => {
        server.route([createPlant, getPlants, deletePlants]);
    }
}; 