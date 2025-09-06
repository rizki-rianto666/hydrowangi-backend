const Jwt = require('@hapi/jwt');
const User = require('../models/User');

const register = {
    method: 'POST',
    path: '/auth/register',
    options: {
        auth: false // No auth required for registration
    },
    handler: async (request, h) => {
        try {
            const { username, password } = request.payload;

            if (!username || !password) {
                return h.response({ message: 'Username and password are required' }).code(400);
            }

            // Check if user already exists
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return h.response({ message: 'Username already exists' }).code(400);
            }

            // Create new user
            const user = new User({ username, password });
            await user.save();

            return h.response({ message: 'Registration successful' }).code(201);
        } catch (error) {
            console.error('Registration error:', error);
            return h.response({ message: error.message || 'Registration failed' }).code(500);
        }
    }
};

const login = {
    method: 'POST',
    path: '/auth/login',
    options: {
        auth: false // No auth required for login
    },
    handler: async (request, h) => {
        try {
            const { username, password } = request.payload;

            if (!username || !password) {
                return h.response({ message: 'Username and password are required' }).code(400);
            }

            // Find user
            const user = await User.findOne({ username });
            if (!user) {
                return h.response({ message: 'Invalid username or password' }).code(401);
            }

            // Check password
            const isValid = await user.comparePassword(password);
            if (!isValid) {
                return h.response({ message: 'Invalid username or password' }).code(401);
            }

            // Generate token
            const token = Jwt.token.generate(
                {
                    aud: 'urn:audience:test',
                    iss: 'urn:issuer:test',
                    user: {
                        id: user._id,
                        username: user.username
                    }
                },
                {
                    key: process.env.JWT_SECRET_KEY,
                    algorithm: 'HS256'
                },
                {
                    ttlSec: 14400 // 4 hours
                }
            );
            console.log('Generated token:', token);
            return h.response({
                token,
                user: {
                    id: user._id,
                    username: user.username
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            return h.response({ message: error.message || 'Login failed' }).code(500);
        }
    }
};

module.exports = {
    name: 'auth',
    register: async (server) => {
        server.route([register, login]);
    }
}; 