const { default: cloudinary } = require("../config/cloudinary");
const Plants = require("../models/Plants");

const createPlant = {
  method: "POST",
  path: "/plants",
  options: {
    auth: "jwt",
    payload: {
      output: "stream",
      parse: true,
      multipart: true,
      maxBytes: 5 * 1024 * 1024,
    },
  },
  handler: async (request, h) => {
    try {
      const { name, description, tds, image } = request.payload;

      const upload = await new Promise((res, rej) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "plants" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        image.pipe(stream);
      });

      const newPlant = new Plants({
        name,
        description,
        tds,
        image: upload.secure_url,
      });
      const savedPlant = await newPlant.save();
      return h
        .response({
          message: "Plant created successfully",
          plant: savedPlant,
        })
        .code(201);
    } catch (error) {
      console.error("Error creating plant:", error);
      return h.response({ message: "Failed to create plant" }).code(500);
    }
  },
};

const getPlants = {
  method: "GET",
  path: "/plants",
  options: {
    auth: false,
  },
  handler: async (request, h) => {
    try {
      const plants = await Plants.find().sort({ createdAt: -1 });
      return h.response(plants).code(200);
    } catch (error) {
      console.error("Error fetching plants:", error);
      return h.response({ message: "Failed to fetch plants" }).code(500);
    }
  },
};

const deletePlants = {
  method: "DELETE",
  path: "/plants/{id}",
  options: {
    auth: "jwt",
  },
  handler: async (request, h) => {
    try {
      const { id } = request.params;
      const deletedPlant = await Plants.findOneAndDelete(id);
      if (!deletedPlant) {
        return h.response({ message: "Plant not found" }).code(404);
      }
      return h.response({ message: "Plant deleted successfully" }).code(200);
    } catch (error) {
      console.error("Error deleting plant:", error);
      return h.response({ message: "Failed to delete plant" }).code(500);
    }
  },
};

const testPlant = {
  method: "GET",
  path: "/plants/test",
  options: {
    auth: false,
  },
  handler: async (request, h) => {
    const plants = await Plants.find().sort({ createdAt: -1 });
    console.log(plants);
    return h.response(plants).code(200);
  },
};

module.exports = {
  name: "plants",
  register: async (server) => {
    server.route([createPlant, getPlants, deletePlants, testPlant]);
  },
};
