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
        return h.response({ ok: false, message: "Missing required fields" }).code(400);
      }

      const pump = await Control.findOne({ deviceId: "esp-001" }).lean();
   
      const doc = await Telemetry.create({
        deviceId: "esp-001",
        ph,
        ppm,
        temp,
        nutritionOn: pump?.nutritionOn || false,
        pesticideOn: pump?.pesticideOn || false,
        ts: new Date(),
      });

      await checkAndSendPPMAlert(ppm);

      return h.response({
        ok: true,
        id: doc._id,
        ts: doc.ts,
        doc,
        action: "saved"
      }).code(201);

    } catch (err) {
      return h.response({ ok: false, error: "Internal Server Error" }).code(500);
    }
  },
};