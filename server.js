// server.js
const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const mongoose = require('mongoose');
require('dotenv').config();

let server;

const init = async () => {
  if (server) return server; // biar singleton

  server = Hapi.server({
    port: process.env.PORT || 5000,
    host: '0.0.0.0',
    routes: {
      cors: {
        origin: ['*'],
        headers: ['Accept', 'Content-Type', 'Authorization', 'x-secret-key'],
        exposedHeaders: ['WWW-Authenticate', 'Server-Authorization'],
        additionalHeaders: ['cache-control', 'x-requested-with'],
        additionalExposedHeaders: ['content-length', 'date'],
      },
    },
  });


  await server.register(Jwt);

  server.auth.strategy('jwt', 'jwt', {
    keys: process.env.JWT_SECRET_KEY,
    verify: {
      aud: 'urn:audience:test',
      iss: 'urn:issuer:test',
      sub: false,
      maxAgeSec: 14400,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: { user: artifacts.decoded.payload.user },
    }),
  });

  // Connect MongoDB sekali aja
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
  }

  // Routes
  await server.register(require('./routes/auth'));
  await server.register(require('./routes/planted'));
  await server.register(require('./routes/plants'));
  await server.register(require('./routes/iot'));

  server.route({
    method: 'GET',
    path: '/',
    options: { auth: false },
    handler: () => ({ message: 'Hydrowangi API is running on Vercel!' }),
  });

  server.route({
    method: 'OPTIONS',
    path: '/{any*}',
    options: { auth: false },
    handler: (request, h) => h.response().code(200)
  });

  await server.initialize();
  return server;
};

// Vercel handler
module.exports = async (req, res) => {
  const srv = await init();
  console.log('[REQUEST]', req.method, req.url, req.headers);

  let url = req.url;
  if (url.startsWith('/api')) {
    url = url.replace(/^\/api/, '') || '/';
  }

  const { statusCode, headers, result, payload } = await srv.inject({
    method: req.method,
    url,
    headers: req.headers,
    payload: req.body,
  });
  // kalau mau cek tipe aja:
  console.log('[INJECT]', statusCode, typeof result, Buffer.isBuffer(result));
  // Always set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization, x-secret-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Server-Authorization, content-length, date");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // forward headers ke vercel response, kecuali content-encoding
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "content-encoding") continue;
    res.setHeader(key, value);
  }

  res.statusCode = statusCode;

  // ✅ fix disini
  res.statusCode = statusCode;

  // kalau payload buffer → kirim langsung
  console.log('[RESPONSE]', statusCode, headers);
  if (Buffer.isBuffer(payload)) {
    res.end(payload);
  } else if (Buffer.isBuffer(result)) {
    res.end(result);
  } else {
    res.end(
      typeof result !== "undefined"
        ? (typeof result === "object" ? JSON.stringify(result) : String(result))
        : payload
    );
  }


};
