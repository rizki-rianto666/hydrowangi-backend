const Telemetry = require('../models/Telemetry');
const Control = require('../models/Control');

const DEVICE_ID = "esp-001"; // default id device, fix 1 aja
const SECRET_KEY_IOT = process.env.SECRET_KEY_IOT; // key rahasia supaya device ga sembarangan ngirim data
// ---------------------
// Create Telemetry (device kirim data sensor)
// ---------------------
const createTelemetry = {
    method: 'POST',
    path: "/telemetry",
    handler: async (request, h) => {
        try {
            const secret = request.headers['x-secret-key'];
            if (secret !== SECRET_KEY_IOT) {
                return h.response({ ok: false, message: "Unauthorized" }).code(401);
            }
            const { ph, ppm, temp } = request.payload;

            if (ph === undefined || ppm === undefined || temp === undefined) {
                return h.response({ ok: false, message: "Missing required fields (ph, ppm, temp)" }).code(400);
            }

            const doc = await Telemetry.create({
                deviceId: DEVICE_ID,
                ph,
                ppm,
                temp,
                ts: new Date(),
            });

            return h
                .response({ ok: true, id: doc._id, ts: doc.ts })
                .code(201);
        } catch (err) {
            console.error("Error saving telemetry:", err);
            return h.response({ ok: false, error: "Internal Server Error" }).code(500);
        }
    },
};

// ---------------------
// Get latest Telemetry (FE ambil data sensor terbaru)
// ---------------------
const getTelemetryLatest = {
    method: 'GET',
    path: '/telemetry/latest',
    options: { auth: 'jwt' },
    handler: async (request, h) => {
        try {
            const latest = await Telemetry.findOne()
                .sort({ ts: -1 }) // ambil data terbaru berdasarkan timestamp
                .lean();          // biar hasil plain object, bukan mongoose doc

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

// ...existing code...
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
                return h.response({ ok: false, message: 'No telemetry data found', data: [] }).code(404);
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
// Pesticide control (manual ON/OFF)
// ---------------------
const controlPesticide = {
    method: 'POST',
    path: '/pesticide',
    options: { auth: 'jwt' },
    handler: async (request) => {
        const { pesticideOn } = request.payload;
        const updated = await Control.findOneAndUpdate(
            { deviceId: DEVICE_ID },
            { pesticideOn, updatedAt: new Date() },
            { new: true, upsert: true }
        ).lean();
        return { ok: true, state: updated };
    },
};

// ---------------------
// Generate PDF report
// ---------------------
const PDFDocument = require("pdfkit");
const { PassThrough } = require("stream");

const PDFDocument = require("pdfkit");

const generateReport = {
  method: "GET",
  path: "/report/sensors",
  handler: async (request, h) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    const response = h.response(doc);
    response.type("application/pdf");
    response.header(
      "Content-Disposition",
      "attachment; filename=test.pdf"
    );

    // HARUS sebelum doc.end()
    doc.fontSize(25).fillColor("black").text("Halo Dunia!", 100, 100);
    doc.text("Ini isi PDF pertama kamu", 100, 150);
    doc.moveDown().text("Harusnya keliatan ya, ga putih doang.");

    doc.end(); // flush ke stream

    return response;
  },
};


module.exports = {
    name: 'iot',
    register: async (server) => {
        server.route([createTelemetry, getTelemetries, getTelemetryLatest, controlPesticide, generateReport]);
    }
};