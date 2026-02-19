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
  await server.register(require('./routes/auth'), { routes: { prefix: '/api' } });
  await server.register(require('./routes/planted'), { routes: { prefix: '/api' } });
  await server.register(require('./routes/plants'), { routes: { prefix: '/api' } });
  await server.register(require('./routes/iot'), { routes: { prefix: '/api' } });

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

  // Read raw body from stream
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  const { statusCode, headers, result, payload } = await srv.inject({
    method: req.method,
    url: req.url,
    headers: req.headers,
    payload: body || undefined,
  });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Server-Authorization, content-length, date');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-encoding') continue;
    res.setHeader(key, value);
  }

  res.statusCode = statusCode;
  res.end(
    typeof result !== 'undefined'
      ? (typeof result === 'object' ? JSON.stringify(result) : String(result))
      : payload
  );
};