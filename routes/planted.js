const Planted = require('../models/Planted');

// Create planted plant in specific slot
const createPlanted = {
    method: "POST",
    path: "/planted/{slot?}",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const slot = request.params.slot ? parseInt(request.params.slot) : 1;

            // Validate slot number
            if (slot < 1 || slot > 2) {
                return h.response({ message: 'Slot harus 1 atau 2!' }).code(400);
            }

            // Check if slot is already occupied
            const existingInSlot = await Planted.findOne({ slot });
            if (existingInSlot) {
                return h.response({
                    message: `Slot ${slot} sudah ada tanaman! Tunggu sampai panen atau hapus tanaman yang ada.`
                }).code(400);
            }

            // Check total planted plants (max 2)
            const totalPlanted = await Planted.countDocuments();
            if (totalPlanted >= 2) {
                return h.response({
                    message: 'Maksimal 2 tanaman dalam satu waktu! Panen atau hapus tanaman yang ada.'
                }).code(400);
            }

            console.log('Creating planted for slot:', slot);
            console.log('Payload:', request.payload);

            const { plant } = request.payload;
            console.log('Plant data:', plant);

            const newPlanted = new Planted({
                plant,
                slot,
                plantedAt: Date.now(),
            });

            await newPlanted.save();

            return h.response(newPlanted).code(201);
        } catch (error) {
            console.error('Error creating planted:', error);
            return h.response({ message: 'Failed to create planted' }).code(500);
        }
    }
};

// Get all planted plants
const getAllPlanted = {
    method: "GET",
    path: "/planted",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const plantedList = await Planted.find().sort({ createdAt: -1 });

            if (plantedList.length === 0) {
                return h.response({ message: 'No planted cycles found' }).code(404);
            }

            // Convert to slot-based object structure
            const plantedBySlot = {};
            plantedList.forEach(planted => {
                plantedBySlot[planted.slot] = planted;
            });

            return h.response(plantedBySlot).code(200);
        } catch (error) {
            console.error('Error fetching all planted:', error);
            return h.response({ message: 'Failed to fetch planted plants' }).code(500);
        }
    }
};

// Get planted plant for specific slot
const getPlantedBySlot = {
    method: "GET",
    path: "/planted/{slot}",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const slot = parseInt(request.params.slot);

            // Validate slot number
            if (slot < 1 || slot > 2) {
                return h.response({ message: 'Slot harus 1 atau 2!' }).code(400);
            }

            const planted = await Planted.findOne({ slot });

            if (!planted) {
                return h.response({ message: `No plant found in slot ${slot}` }).code(404);
            }

            return h.response(planted).code(200);
        } catch (error) {
            console.error(`Error fetching planted for slot ${request.params.slot}:`, error);
            return h.response({ message: 'Failed to fetch planted plant' }).code(500);
        }
    }
};

// Get planted by ID (keep for backward compatibility)
const getPlantedById = {
    method: "GET",
    path: "/planted/id/{id}",
    options: { auth: "jwt" },
    handler: async (req, h) => {
        try {
            const { id } = req.params;
            const planted = await Planted.findById(id);

            if (!planted) {
                return h.response({ message: 'Planted not found' }).code(404);
            }

            return h.response(planted).code(200);
        } catch (error) {
            console.error('Error fetching planted by ID:', error);
            return h.response({ message: 'Failed to fetch planted by ID' }).code(500);
        }
    }
};


// Delete planted plant (now with slot support)
const deletePlanted = {
    method: "DELETE",
    path: "/planted/{id}",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const { id } = request.params;
            const deletedPlanted = await Planted.findByIdAndDelete({id});

            console.log('Deleted planted:', deletedPlanted);
            console.log('Deleted planted ID:', id);

            if (!deletedPlanted) {
                return h.response({ message: 'Planted not found' }).code(404);
            }

            return h.response({
                message: `Tanaman dari slot ${deletedPlanted.slot} berhasil dihapus`,
                deletedPlant: deletedPlanted,
                slot: deletedPlanted.slot
            }).code(200);
        } catch (error) {
            console.error('Error deleting planted:', error);
            return h.response({ message: 'Failed to delete planted' }).code(500);
        }
    }
};

// Delete planted by slot
const deletePlantedBySlot = {
    method: "DELETE",
    path: "/planted/slot/{slot}",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const slot = parseInt(request.params.slot);

            // Validate slot number
            if (slot < 1 || slot > 2) {
                return h.response({ message: 'Slot harus 1 atau 2!' }).code(400);
            }

            const deletedPlanted = await Planted.findOneAndDelete({ slot });

            if (!deletedPlanted) {
                return h.response({ message: `No plant found in slot ${slot}` }).code(404);
            }

            return h.response({
                message: `Tanaman dari slot ${slot} berhasil dihapus`,
                deletedPlant: deletedPlanted,
                slot: slot
            }).code(200);
        } catch (error) {
            console.error('Error deleting planted by slot:', error);
            return h.response({ message: 'Failed to delete planted' }).code(500);
        }
    }
};

module.exports = {
    name: 'planted',
    register: async (server) => {
        server.route([
            createPlanted,           // POST /planted/{slot?}
            getAllPlanted,          // GET /planted
            getPlantedBySlot,       // GET /planted/{slot}
            getPlantedById,         // GET /planted/id/{id}
            deletePlanted,          // DELETE /planted/{id}
            deletePlantedBySlot,    // DELETE /planted/slot/{slot}
        ]);
    }
};