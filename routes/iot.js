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

const generateReport = {
    method: "GET",
    path: "/report/sensors",
    options: { auth: 'jwt' },
    handler: async (request, h) => {
        const { plantName } = request.query;
        const allData = await Telemetry.find().sort({ ts: 1 }).lean();

        const tempat = "KWT Banjarwangi";
        const tanggalAwal = allData.length ? new Date(allData[0].ts).toLocaleDateString() : "-";
        const tanggalAkhir = allData.length ? new Date(allData[allData.length - 1].ts).toLocaleDateString() : "-";

        const doc = new PDFDocument({ margin: 40, size: "A4" });

        const chunks = [];
        return new Promise((resolve, reject) => {
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(
                    h.response(pdfBuffer)
                        .type("application/pdf")
                        .header("Content-Disposition", 'attachment; filename="riwayat-sensor.pdf"')
                );
            });
            doc.on("error", reject);

            // =======================
            // Judul & Info
            // =======================
            doc.fontSize(16).text("Riwayat Data Sensor", { align: "center" });
            doc.moveDown();

            doc.fontSize(12).text(`Tanaman yang Ditanam: ${plantName || "-"}`);
            doc.text(`Lokasi: ${tempat}`);
            doc.text(`Periode: ${tanggalAwal} s/d ${tanggalAkhir}`);
            doc.moveDown(2);

            // =======================
            // Function buat header tabel
            // =======================
            const drawTableHeader = (y) => {
                const colX = [50, 200, 300, 400];
                const rowHeight = 20;

                doc.save();
                doc.fillColor("rgb(33,150,243)")
                    .rect(45, y, 510, rowHeight)
                    .fill();
                doc.restore();

                doc.fillColor("white").font("Helvetica-Bold").fontSize(12);
                doc.text("Tanggal", colX[0], y + 5);
                doc.text("TDS (ppm)", colX[1], y + 5);
                doc.text("pH", colX[2], y + 5);
                doc.text("Suhu (°C)", colX[3], y + 5);

                doc.font("Helvetica").fillColor("black");

                return y + rowHeight;
            };

            // Mulai render header pertama
            const rowHeight = 20;
            const pageHeight = doc.page.height - doc.page.margins.bottom;
            let yPos = drawTableHeader(doc.y);

            // =======================
            // Isi tabel dengan auto page break
            // =======================
            doc.fontSize(10);
            const colX = [50, 200, 300, 400];

            allData.forEach((row) => {
                // kalau sudah mau keluar halaman → new page + header baru
                if (yPos + rowHeight > pageHeight) {
                    doc.addPage();
                    yPos = drawTableHeader(doc.y);
                }

                // Draw row border
                doc.rect(45, yPos, 510, rowHeight).stroke();

                // Isi teks
                doc.text(new Date(row.ts).toLocaleString(), colX[0] + 2, yPos + 5);
                doc.text(String(row.ppm), colX[1] + 2, yPos + 5);
                doc.text(String(row.ph), colX[2] + 2, yPos + 5);
                doc.text(String(row.temp), colX[3] + 2, yPos + 5);

                yPos += rowHeight;
            });

            doc.end();
        });
    },
};


module.exports = {
    name: 'iot',
    register: async (server) => {
        server.route([createTelemetry, getTelemetries, getTelemetryLatest, controlPesticide, generateReport]);
    }
};