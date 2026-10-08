import dotenv from "dotenv";
dotenv.config();

import config from "./src/config/config.js";
import db from "./src/config/db.js";
import app from "./src/app.js";

import { socketServer } from "./src/core/socket/index.js";

import http from "http";
import https from "https";
import fs from "fs";
import dns from "dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const PORT = config.PORT;

db();

// HTTP server used only for Socket.IO
const httpServer = http.createServer(app);

// Initialize Socket.IO
socketServer.initialize(httpServer);

// HTTPS API Server : Only for developement
// https
//   .createServer(
//     {
//       key: fs.readFileSync("C:/Certs/localhost-key.pem"),
//       cert: fs.readFileSync("C:/Certs/localhost.pem"),
//     },
//     app
//   )
//   .listen(PORT, () => {
//     console.log(`HTTPS API running on https://localhost:${PORT}`);
//   });
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Socket.IO Server
httpServer.listen(4002, () => {
  console.log("Socket.IO server running on http://localhost:4002");
});
