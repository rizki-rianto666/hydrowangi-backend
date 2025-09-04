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
        headers: ['Accept', 'Content-Type', 'Authorization'],
        exposedHeaders: ['WWW-Authenticate', 'Server-Authorization'],
        credentials: true,
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

  await server.initialize();
  return server;
};

// Vercel handler
module.exports = async (req, res) => {
  const srv = await init();

  const { raw, statusCode, headers, result } = await srv.inject({
    method: req.method,
    url: req.url,
    headers: req.headers,
    payload: req.body,
  });
  console.log('Request:', req.method, req.url, '->', statusCode);
  // Set headers
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  res.statusCode = statusCode;
  res.end(
    typeof result === 'object' ? JSON.stringify(result) : result
  );
};
