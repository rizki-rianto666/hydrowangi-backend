const Plants = require('../models/Plants');

const createPlant = {
  method: 'POST',
  path: '/plants',
  options: { auth: 'jwt' },
  handler: async (request, h) => {
    try {
      const { name, description, tds, harvestDays, image } = request.payload;

      const plant = await Plants.create({ name, description, tds, harvestDays, image });

      return { plant };
    } catch (err) {
      console.error(err);
      return h.response({ message: 'Failed' }).code(500);
    }
  }
};

const getPlants = {
  method: 'GET',
  path: '/plants',
  options: { auth: false },
  handler: async () => {
    const plants = await Plants.find().sort({ createdAt: -1 }).lean();
    return { plants };
  }
};

const deletePlants = {
  method: 'DELETE',
  path: '/plants/{id}',
  options: { auth: 'jwt' },
  handler: async (request) => {
    const { id } = request.params;
    const deleted = await Plants.findOneAndDelete({ _id: id });
    if (!deleted) return { message: 'Not found' };
    return { message: 'Deleted' };
  }
};

exports.plugin = {
  name: 'plants',
  version: '1.0.0',
  register: async (server) => {
    server.route([createPlant, getPlants, deletePlants]);
  }
};