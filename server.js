const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const mongoose = require('mongoose');
require('dotenv').config();

let server;

const createServer = async () => {
  if (server) return server; // reuse biar gak bikin ulang tiap request

  server = Hapi.server({
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    routes: {
      cors: {
        origin: ['*'],
        headers: ['Accept', 'Content-Type', 'Authorization'],
        exposedHeaders: ['WWW-Authenticate', 'Server-Authorization', 'X-Custom-Header'],
        credentials: true
      }
    }
  });

  await server.register(Jwt);

  server.auth.strategy('jwt', 'jwt', {
    keys: process.env.JWT_SECRET_KEY,
    verify: {
      aud: 'urn:audience:test',
      iss: 'urn:issuer:test',
      sub: false,
      maxAgeSec: 14400
    },
    validate: (artifacts) => {
      return {
        isValid: true,
        credentials: { user: artifacts.decoded.payload.user }
      };
    }
  });

  // MongoDB connect sekali aja
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
  }

  await server.register(require('./routes/auth'));
  await server.register(require('./routes/planted'));
  await server.register(require('./routes/plants'));
  await server.register(require('./routes/iot'));

  server.route({
    method: 'GET',
    path: '/',
    options: { auth: false },
    handler: () => ({ message: 'Hydrowangi API is running on Vercel!' })
  });

  await server.initialize(); // initialize tanpa start listen
  return server;
};

// Vercel handler
module.exports = async (req, res) => {
  const hapi = await createServer();
  const response = await hapi.inject({
    method: req.method,
    url: req.url,
    payload: req.body,
    headers: req.headers
  });

  res.status(response.statusCode).set(response.headers).send(response.result);
};
