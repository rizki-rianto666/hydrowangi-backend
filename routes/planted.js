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

            // Calculate harvest time on backend
            const harvestTime = Date.now() + plant.harvestDays * 86400000;

            const newPlanted = new Planted({
                plant,
                harvestTime,
                slot,
                plantedAt: Date.now(),
                status: 'growing'
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

// Harvest plant from specific slot
const harvestedPlant = {
    method: 'POST',
    path: '/harvest/{slot?}',
    options: { auth: 'jwt' },
    handler: async (request, h) => {
        try {
            const slot = request.params.slot ? parseInt(request.params.slot) : null;

            let planted;

            if (slot) {
                // Validate slot number
                if (slot < 1 || slot > 2) {
                    return h.response({ message: 'Slot harus 1 atau 2!' }).code(400);
                }

                // Get specific slot
                planted = await Planted.findOne({ slot });
                if (!planted) {
                    return h.response({ message: `Tidak ada tanaman di slot ${slot}` }).code(404);
                }
            } else {
                // Get any ready plant (backward compatibility)
                planted = await Planted.findOne();
                if (!planted) {
                    return h.response({ message: 'Tidak ada tanaman yang ditanam' }).code(404);
                }
            }

            const now = Date.now();

            // Check if ready for harvest
            if (now < planted.harvestTime) {
                const remainingDays = Math.ceil((planted.harvestTime - now) / 86400000);
                return h.response({
                    message: `Belum waktunya panen. Masih ${remainingDays} hari lagi.`,
                    remaining: planted.harvestTime - now,
                    slot: planted.slot
                }).code(400);
            }

            // Ready for harvest - remove from database
            await Planted.deleteOne({ _id: planted._id });

            return h.response({
                message: `Panen berhasil dari slot ${planted.slot}!`,
                harvestedPlant: planted.plant,
                slot: planted.slot,
                harvestedAt: now
            }).code(200);

        } catch (err) {
            console.error('Harvest error:', err);
            return h.response({ message: 'Server error' }).code(500);
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

// Update planted plant
const updatePlanted = {
    method: "PUT",
    path: "/planted/{id}",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const { id } = request.params;
            const updateData = request.payload;

            const updatedPlanted = await Planted.findByIdAndUpdate(
                id,
                {
                    ...updateData,
                    updatedAt: Date.now()
                },
                { new: true }
            );

            if (!updatedPlanted) {
                return h.response({ message: 'Planted not found' }).code(404);
            }

            return h.response(updatedPlanted).code(200);
        } catch (error) {
            console.error('Error updating planted:', error);
            return h.response({ message: 'Failed to update planted' }).code(500);
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
            const deletedPlanted = await Planted.findByIdAndDelete(id);

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

// Get system status
const getSystemStatus = {
    method: "GET",
    path: "/planted/status",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const allPlanted = await Planted.find();
            const now = Date.now();

            const status = {
                totalPlants: allPlanted.length,
                availableSlots: [],
                occupiedSlots: [],
                readyForHarvest: [],
                growing: []
            };

            // Check each slot
            for (let slot = 1; slot <= 2; slot++) {
                const planted = allPlanted.find(p => p.slot === slot);

                if (planted) {
                    status.occupiedSlots.push(slot);

                    if (now >= planted.harvestTime) {
                        status.readyForHarvest.push({
                            slot,
                            plant: planted.plant.name,
                            readySince: planted.harvestTime
                        });
                    } else {
                        const remainingDays = Math.ceil((planted.harvestTime - now) / 86400000);
                        status.growing.push({
                            slot,
                            plant: planted.plant.name,
                            remainingDays
                        });
                    }
                } else {
                    status.availableSlots.push(slot);
                }
            }

            return h.response(status).code(200);
        } catch (error) {
            console.error('Error getting system status:', error);
            return h.response({ message: 'Failed to get system status' }).code(500);
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
            harvestedPlant,         // POST /harvest/{slot?}
            getPlantedById,         // GET /planted/id/{id}
            updatePlanted,          // PUT /planted/{id}
            deletePlanted,          // DELETE /planted/{id}
            deletePlantedBySlot,    // DELETE /planted/slot/{slot}
            getSystemStatus         // GET /planted/status
        ]);
    }
};