// --- humidity cache (avoid API spam) ---
let lastHumidity = null;
let lastHumidityFetchedAt = 0;
// ---------------------

const Telemetry = require('../models/Telemetry');
const Control = require('../models/Control');
const Planted = require('../models/Planted');

const DEVICE_ID = "esp-001"; // default id device, fix 1 aja
const SECRET_KEY_IOT = process.env.SECRET_KEY_IOT; // key rahasia supaya device ga sembarangan ngirim data

const getPpm = {
  method: 'GET',
  path: '/ppm',
  handler: async (request, h) => {
    try {
      const secret = request.headers['x-secret-key'];
      console.log('secret Req', secret)
      console.log('SECRET_KEY_IOT', SECRET_KEY_IOT)
      if (secret !== SECRET_KEY_IOT) {
        return h.response({ ok: false, message: "Unauthorized" }).code(401);
      }
      const planted = await Planted.findOne().lean();
      console.log('planted', planted)
      return h.response({ ok: true, ppm: planted?.plant.tds || 0 }).code(200);
    } catch (err) {
      console.error(err);
      return h.response({ ok: false, message: "Error fetching ppm" }).code(500);
    }
  }
}


// ---------------------
// Create Telemetry (device kirim data sensor)
// ---------------------
const createTelemetry = {
  method: 'POST',
  path: "/telemetry",
  handler: async (request, h) => {
    try {
      const secret = request.headers['x-secret-key'];
      if (secret !== process.env.SECRET_KEY_IOT) {
        return h.response({ ok: false, message: "Unauthorized" }).code(401);
      }

      const { ph, ppm, temp } = request.payload;

      if (ph === undefined || ppm === undefined || temp === undefined) {
        return h.response({ ok: false, message: "Missing required fields (ph, ppm, temp)" }).code(400);
      }

      // --- fetch humidity (cached every 1 hour) ---
      const now = Date.now();
      let humidity = lastHumidity;

      if (!lastHumidity || now - lastHumidityFetchedAt > 3600000) { // 1 hour
        try {
          // Replace with your actual weather API endpoint
          const response = await fetch('https://api.open-meteo.com/v1/forecast?' +
            'latitude=-6.67778&longitude=106.85389&' +
            'current=relative_humidity_2m,temperature_2m&' +
            'timezone=Asia%2FJakarta'
          );
          const data = await response.json();
          humidity = data.current.relative_humidity_2m;

          lastHumidity = humidity;
          lastHumidityFetchedAt = now;
        } catch (err) {
          console.warn('⚠️ Humidity fetch failed:', err.message);
        }
      }

      const pump = await Control.findOne({ deviceId: DEVICE_ID }).lean();
      humidity = lastHumidity || 0; // fallback to last humidity if not fetched
      // --- save telemetry ---
      const doc = await Telemetry.create({
        deviceId: DEVICE_ID,
        ph,
        ppm,
        temp,
        humidity,
        nutritionOn: pump?.nutritionOn || false,
        pesticideOn: pump?.pesticideOn || false,
        ts: new Date(),
      });


      return h.response({
        ok: true,
        id: doc._id,
        ts: doc.ts,
        doc,
        action: "saved"
      }).code(201);

    } catch (err) {
      console.error("Error saving telemetry:", err);
      return h.response({ ok: false, error: "Internal Server Error" }).code(500);
    }
  },
};


// ---------------------
// Get latest Telemetry (FE ambil data sensor terbaru - REAL TIME from memory)
// ---------------------
const getTelemetryLatest = {
  method: 'GET',
  path: '/telemetry/latest',
  options: { auth: 'jwt' },
  handler: async (request, h) => {
    try {
      const latest = await Telemetry.findOne().sort({ ts: -1 }).lean();
      if (!latest) {
        return h.response({ message: 'No telemetry found' }).code(404);
      }
      return h.response(latest).code(200);
    } catch (err) {
      console.error("Error fetching telemetry:", err);
      return h.response({ error: 'Internal Server Error' }).code(500);
    }
  },
};


// ---------------------
// Get Telemetries with Pagination
// ---------------------
const getTelemetries = {
  method: 'GET',
  path: '/telemetries',
  options: { auth: 'jwt' },
  handler: async (request, h) => {
    try {
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 50; // Default 50 records per page
      const skip = (page - 1) * limit;

      // Get total count for pagination info
      const totalCount = await Telemetry.countDocuments();

      // Get paginated data
      const telemetries = await Telemetry.find()
        .sort({ ts: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      console.log(`Telemetries page ${page}: ${telemetries.length} records`);

      // Return data with pagination info
      return h.response({
        ok: true,
        data: telemetries,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount: totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1
        }
      }).code(200);
    } catch (err) {
      console.error("Error fetching telemetries:", err);
      return h.response({ ok: false, error: 'Internal Server Error' }).code(500);
    }
  },
};

// ---------------------
// Download All Telemetries for PDF (separate endpoint for bulk data)
// ---------------------
const downloadTelemetries = {
  method: 'GET',
  path: '/telemetries/download',
  options: { auth: 'jwt' },
  handler: async (request, h) => {
    try {
      const telemetries = await Telemetry.find()
        .sort({ ts: -1 })
        .lean();

      console.log("Downloading telemetries:", telemetries.length);

      return h.response({
        ok: true,
        count: telemetries.length,
        data: telemetries
      }).code(200);
    } catch (err) {
      console.error("Error downloading telemetries:", err);
      return h.response({ ok: false, error: 'Internal Server Error' }).code(500);
    }
  },
};

// ---------------------
// Delete All Telemetries (Clear data after hydroponic cycle)
// ---------------------
const deleteAllTelemetries = {
  method: 'DELETE',
  path: '/telemetries',
  options: { auth: 'jwt' }, // Requires authentication to prevent accidental deletion
  handler: async (request, h) => {
    try {
      // Get count before deletion for logging
      const countBefore = await Telemetry.countDocuments();
      console.log(`Deleting ${countBefore} telemetry records...`);

      // Delete all telemetry data
      const result = await Telemetry.deleteMany({});

      console.log(`Successfully deleted ${result.deletedCount} telemetry records`);

      return h.response({
        ok: true,
        message: `Successfully deleted all telemetry data`,
        deletedCount: result.deletedCount,
        timestamp: new Date()
      }).code(200);

    } catch (err) {
      console.error("Error deleting all telemetries:", err);
      return h.response({
        ok: false,
        message: "Failed to delete telemetry data",
        error: 'Internal Server Error'
      }).code(500);
    }
  },
};



// Pesticide control (FE trigger ON)
// ---------------------
// helper untuk sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let pumpDurations = {
  nutrisi: 5000,     // default 10 detik
  pestisida: 5000
};

const setTimerPump = {
  method: 'POST',
  path: '/pump-duration',
  handler: async (request, h) => {
    const { type, duration } = request.payload;
    if (!['nutrisi', 'pestisida'].includes(type)) {
      return h.response({ error: 'Jenis pompa tidak valid' }).code(400);
    }

    pumpDurations[type] = duration * 1000; // simpan dalam ms
    return { type, duration };
  }
};


const controlPesticide = {
  method: 'POST',
  path: '/pesticide',
  handler: async (request, h) => {
    try {
      // set ON
      await Control.findOneAndUpdate(
        { deviceId: DEVICE_ID },
        { pesticideOn: true, updatedAt: new Date() },
        { upsert: true }
      );

      // tunggu dulu....
      await sleep(pumpDurations['pestisida']);

      // set OFF
      await Control.findOneAndUpdate(
        { deviceId: DEVICE_ID },
        { pesticideOn: false, updatedAt: new Date() }
      );

      // respon ke FE setelah benar2 OFF
      return h.response({
        ok: true,
        message: "Selesai disemprot ✅"
      }).code(200);

    } catch (err) {
      console.error("Error control pesticide:", err);
      return h.response({
        ok: false,
        message: "Error semprot pesticide ❌"
      }).code(500);
    }
  }
};


// ---------------------
// Endpoint untuk ESP polling status control pstisida
// ---------------------
const pesticideStatus = {
  method: 'GET',
  path: '/pesticide',
  handler: async (request, h) => {
    try {
      const control = await Control.findOne({ deviceId: DEVICE_ID }).lean();
      return h.response({
        ok: true,
        pesticide: control,
        pesticideOn: control?.pesticideOn || false
      }).code(200);
    } catch (err) {
      console.error(err);
      return h.response({ ok: false, message: "Error fetching control" }).code(500);
    }
  }
};

const controlNutritionPump = {
  method: 'POST',
  path: '/nutrition-pump',
  handler: async (request, h) => {
    try {
      // set ON
      await Control.findOneAndUpdate(
        { deviceId: DEVICE_ID },
        { nutritionOn: true, updatedAt: new Date() },
        { upsert: true }
      );

      // tunggu 10 detik
      await sleep(pumpDurations['nutrisi']);

      // set OFF
      await Control.findOneAndUpdate(
        { deviceId: DEVICE_ID },
        { nutritionOn: false, updatedAt: new Date() }
      );

      // respon ke FE setelah benar2 OFF
      return h.response({
        ok: true,
        message: "Selesai Dinyalakan ✅"
      }).code(200);
    } catch (err) {
      console.error("Error control pompa:", err);
      return h.response({
        ok: false,
        message: "Error pompa nutrisi ❌"
      }).code(500);
    }
  }
};


// ---------------------
// Endpoint untuk ESP polling status control pstisida
// ---------------------
const nutritionStatus = {
  method: 'GET',
  path: '/nutrition-pump',
  handler: async (request, h) => {
    try {
      const control = await Control.findOne({ deviceId: DEVICE_ID }).lean();
      return h.response({
        ok: true,
        nutritionOn: control?.nutritionOn || false
      }).code(200);
    } catch (err) {
      console.error(err);
      return h.response({ ok: false, message: "Error fetching control" }).code(500);
    }
  }
};

module.exports = {
  name: 'iot',
  register: async (server) => {
    server.route([getPpm, createTelemetry, getTelemetries, getTelemetryLatest, deleteAllTelemetries, controlPesticide, pesticideStatus, controlNutritionPump, nutritionStatus, setTimerPump, downloadTelemetries])
  }
}