const Hapi = require("@hapi/hapi");
const Jwt = require("@hapi/jwt");
const mongoose = require("mongoose");

let cachedServer = null;

async function initServer() {
  if (cachedServer) return cachedServer;

  const server = Hapi.server({
    compression: false,
    routes: { cors: { origin: ["*"] } },
  });

  await server.register(Jwt);

  server.auth.strategy("jwt", "jwt", {
    keys: process.env.JWT_SECRET_KEY,
    verify: { aud: false, iss: false, sub: false },
    validate: (artifacts) => ({
      isValid: true,
      credentials: artifacts.decoded.payload,
    }),
  });

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  await server.register(require("./routes/auth"), {
    routes: { prefix: "/api" },
  });
  await server.register(require("./routes/iot"), {
    routes: { prefix: "/api" },
  });
  await server.register(require("./routes/plants"), {
    routes: { prefix: "/api" },
  });
  await server.register(require("./routes/planted"), {
    routes: { prefix: "/api" },
  });

  server.route({
    method: "GET",
    path: "/",
    options: { auth: false },
    handler: () => ({ msg: "API OK" }),
  });

  await server.initialize();
  cachedServer = server;
  return server;
}

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  const server = await initServer();

  const response = await server.inject({
    method: req.method,
    url: req.url,
    headers: { ...req.headers, "accept-encoding": "identity" },
    payload: req.body || undefined,
  });

  res.status(response.statusCode);
  res.setHeader("Access-Control-Allow-Origin", "*");

  const skipHeaders = ["transfer-encoding"];
  for (const [k, v] of Object.entries(response.headers)) {
    if (!skipHeaders.includes(k.toLowerCase())) {
      res.setHeader(k, v);
    }
  }

  res.end(response.payload);
};