const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const mongoose = require('mongoose');
require('dotenv').config();

const init = async () => {
    const server = Hapi.server({
        port: 5000,
        host: '0.0.0.0',
        routes: {
            cors: {
                origin: ['*'], // asal yang diizinkan
                headers: ['Accept', 'Content-Type', 'Authorization'],
                exposedHeaders: ['WWW-Authenticate', 'Server-Authorization', 'X-Custom-Header'],
                credentials: true
            }
        }
    });


    // Register JWT plugin
    await server.register(Jwt);

    // Configure JWT
    server.auth.strategy('jwt', 'jwt', {
        keys: process.env.JWT_SECRET_KEY,
        verify: {
            aud: 'urn:audience:test',
            iss: 'urn:issuer:test',
            sub: false,
            maxAgeSec: 14400 // 4 hours
        },
        validate: (artifacts, request, h) => {
            return {
                isValid: true,
                credentials: { user: artifacts.decoded.payload.user }
            };
        }
    });

    // Connect to MongoDB
    try {
        console.log(process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }

    // Register routes
    await server.register(require('./routes/auth'));
    await server.register(require('./routes/planted'));
    await server.register(require('./routes/plants'));
    await server.register(require('./routes/iot'));

    // Add a test route
    server.route({
        method: 'GET',
        path: '/',
        options: {
            auth: false // No auth required for test route
        },
        handler: (request, h) => {
            return { message: 'Hydrowangi API is running!' };
        }
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();
