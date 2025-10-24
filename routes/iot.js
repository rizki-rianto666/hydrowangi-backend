const Telemetry = require('../models/Telemetry');
const Control = require('../models/Control');
const Planted = require('../models/Planted');

const DEVICE_ID = "esp-001"; // default id device, fix 1 aja
const SECRET_KEY_IOT = process.env.SECRET_KEY_IOT; // key rahasia supaya device ga sembarangan ngirim data

// In-memory store for real-time data (from ESP)
let currentLiveData = {
  ph: null,
  ppm: null,
  temp: null,
  lastReceived: null
};

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
      console.log('secret Req', secret)
      if (secret !== process.env.SECRET_KEY_IOT) {
        return h.response({ ok: false, message: "Unauthorized" }).code(401);
      }
      const { ph, ppm, temp } = request.payload;

      if (ph === undefined || ppm === undefined || temp === undefined) {
        return h.response({ ok: false, message: "Missing required fields (ph, ppm, temp)" }).code(400);
      }

      // ✅ ALWAYS update real-time data for display
      currentLiveData = {
        ph, ppm, temp,
        lastReceived: new Date()
      };

      console.log('Live data updated:', { ph, ppm, temp });

      // ✅ Only save to database if notable changes
      const latestStored = await Telemetry.findOne()
        .sort({ ts: -1 });

      // First record? Always save
      if (!latestStored) {
        const doc = await Telemetry.create({
          deviceId: DEVICE_ID,
          ph,
          ppm,
          temp,
          ts: new Date(),
        });
        return h
          .response({ ok: true, id: doc._id, ts: doc.ts, action: "saved (first record)" })
          .code(201);
      }

      // Check for notable changes based on your thresholds
      const hasNotableChange = 
        Math.abs(ph - latestStored.ph) >= 1 ||      // pH changes by 1 point
        Math.abs(ppm - latestStored.ppm) >= 80 ||  // PPM changes by 100
        Math.abs(temp - latestStored.temp) >= 3;    // Temp changes by 5°C

      if (hasNotableChange) {
        const doc = await Telemetry.create({
          deviceId: DEVICE_ID,
          ph,
          ppm,
          temp,
          ts: new Date(),
        });
        return h
          .response({ 
            ok: true, 
            id: doc._id, 
            ts: doc.ts, 
            action: "saved (notable change)",
            changes: {
              ph: `${latestStored.ph} → ${ph}`,
              ppm: `${latestStored.ppm} → ${ppm}`,
              temp: `${latestStored.temp} → ${temp}`
            }
          })
          .code(201);
      } else {
        // No notable changes, don't save to database
        return h
          .response({ 
            ok: true, 
            action: "live data updated, storage skipped (no notable changes)",
            message: "Data unchanged beyond thresholds - not saved to DB",
            currentValues: { ph, ppm, temp }
          })
          .code(200);
      }

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
      // Return real-time data from memory, not from database
      if (currentLiveData.ph !== null && currentLiveData.ppm !== null && currentLiveData.temp !== null) {
        // Return current live data with deviceId for consistency
        return h.response({
          deviceId: DEVICE_ID,
          ph: currentLiveData.ph,
          ppm: currentLiveData.ppm,
          temp: currentLiveData.temp,
          ts: currentLiveData.lastReceived,
          _id: 'live-data', // dummy ID for frontend
          isLive: true // flag to indicate this is real-time data
        }).code(200);
      }

      // If no live data yet, fallback to database
      const latestFromDB = await Telemetry.findOne()
        .sort({ ts: -1 })
        .lean();

      if (!latestFromDB) {
        return h.response({ message: 'No telemetry found' }).code(404);
      }

      return h.response(latestFromDB).code(200);
    } catch (err) {
      console.error("Error fetching telemetry:", err);
      return h.response({ error: 'Internal Server Error' }).code(500);
    }
  },
};


const getTelemetries = {
  method: 'GET',
  path: '/telemetries',
  options: { auth: 'jwt' },
  handler: async (request, h) => {
    try {
      const telemetries = await Telemetry.find().sort({ ts: -1 }).lean();
      console.log("Total telemetries:", telemetries.length);

      if (telemetries.length === 0) {
        // Return 404 if no data
        return h.response({ ok: false, message: 'No telemetry data found', data: [] }).code(200);
      }

      // Return data if exists
      return h.response({ ok: true, count: telemetries.length, data: telemetries }).code(200);
    } catch (err) {
      console.error("Error fetching telemetries:", err);
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


// ---------------------
// Pesticide control (FE trigger ON)
// ---------------------
// helper untuk sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

      // tunggu 10 detik
      await sleep(10000);

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
const pollStatus = {
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

module.exports = {
  name: 'iot',
  register: async (server) => {
    server.route([getPpm, createTelemetry, getTelemetries, getTelemetryLatest, deleteAllTelemetries, controlPesticide, pollStatus])
  }
}