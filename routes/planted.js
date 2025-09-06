const Planted = require('../models/Planted');


const createPlanted = {
    method: "POST",
    path: "/planted",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            // Only allow one planted cycle
            const existing = await Planted.findOne();
            if (existing) {
                return h.response({ message: 'Hanya bisa menanam satu siklus ya!' }).code(400);
            }
            console.log(request.payload);
            const { plant } = request.payload;
            console.log(plant);
            // ✅ calculate harvestTime on backend (trusted source)
            const harvestTime = Date.now() + plant.harvestDays * 86400000;

            const newPlanted = new Planted({ plant, harvestTime });
            await newPlanted.save();

            return h.response(newPlanted).code(201);
        } catch (error) {
            console.error('Error creating planted:', error);
            return h.response({ message: 'Failed to create planted' }).code(500);
        }
    }
};

const getPlanted = {
    method: "GET",
    path: "/planted",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const planted = await Planted.findOne().sort({ createdAt: -1 });
            if (!planted) return h.response({ message: 'No planted cycle found' }).code(404);



            return h.response(planted).code(200);
        } catch (error) {
            console.error('Error fetching planted:', error);
            return h.response({ message: 'Failed to fetch planted' }).code(500);
        }
    }
};

const harvestedPlant = {
    method: 'POST',
    path: '/harvest',
    options: { auth: 'jwt' },
    handler: async (request, h) => {
        try {
            // Ambil tanaman yang lagi ditanam (cuma 1)
            const planted = await Planted.findOne();
            if (!planted) {
                return h.response({ message: 'Tidak ada tanaman yang ditanam' }).code(404);
            }

            const now = Date.now();

            // Cek apakah udah waktunya panen
            if (now < planted.harvestTime) {
                return h.response({
                    message: 'Belum waktunya panen',
                    remaining: planted.harvestTime - now
                }).code(400);
            }

            // Kalo udah siap panen → hapus atau update
            await Planted.deleteOne({ _id: planted._id });

            return h.response({
                message: 'Panen berhasil!',
                harvestedPlant: planted.plant
            }).code(200);

        } catch (err) {
            console.error(err);
            return h.response({ message: 'Server error' }).code(500);
        }
    }
}

const getPlantedById = {
    method: "GET",
    path: "/planted/{id}",
    options: { auth: "jwt" },
    handler: async (req, h) => {
        try {
            const { id } = req.params;
            const planted = await Planted.findById(id);
            if (!planted) return h.response({ message: 'Planted not found' }).code(404);
            return h.response(planted).code(200);
        } catch (error) {
            console.error('Error fetching planted by ID:', error);
            return h.response({ message: 'Failed to fetch planted by ID' }).code(500);
        }
    }
};

const updatePlanted = {
    method: "PUT",
    path: "/planted/{id}",
    options: { auth: "jwt" },
    handler: async (request, h) => {
        try {
            const { id } = request.params;
            const { harvestTime } = request.payload;

            const updatedPlanted = await Planted.findByIdAndUpdate(
                id,
                { harvestTime },
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
            return h.response({ message: 'Planted deleted successfully' }).code(200);
        } catch (error) {
            console.error('Error deleting planted:', error);
            return h.response({ message: 'Failed to delete planted' }).code(500);
        }
    }
};


module.exports = {
    name: 'planted',
    register: async (server) => {
        server.route([
            createPlanted,
            getPlanted,
            harvestedPlant,
            getPlantedById,
            updatePlanted,
            deletePlanted
        ]);
    }
};
