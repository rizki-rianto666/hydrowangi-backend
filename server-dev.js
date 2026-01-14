// server.js
const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const mongoose = require('mongoose');
require('dotenv').config();

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 5000,
    host: '0.0.0.0',
    routes: {
      cors: {
        origin: ['*'],
        headers: ['Accept', 'Content-Type', 'Authorization', 'x-secret-key'],
      },
    },
  });

  // JWT
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

  // MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  // Routes
  await server.register(require('./routes/auth'), { routes: { prefix: '/api' } });
  await server.register(require('./routes/planted'), { routes: { prefix: '/api' } });
  await server.register(require('./routes/plants'), { routes: { prefix: '/api' } });
  await server.register(require('./routes/iot'), { routes: { prefix: '/api' } });

  server.route({
    method: 'GET',
    path: '/',
    options: { auth: false },
    handler: () => ({ message: 'Hydrowangi API running' }),
  });

  await server.start();
  console.log(`🚀 Server running at ${server.info.uri}`);
};

// 🔴 ini WAJIB untuk Hapi normal
process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

init();
