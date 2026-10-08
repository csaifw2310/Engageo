import { Server } from "socket.io";

import socketMiddleware from "./socket.middleware.js";
import socketEvents from "./socket.events.js";
import socketEmitter from "./socket.emitter.js";
import { SOCKET_CORS } from "./socket.constants.js";

class SocketServer {
  #io = null;

  initialize(httpServer) {
    if (this.#io) {
      return this.#io;
    }

    this.#io = new Server(httpServer, {
      cors: {
        origin: SOCKET_CORS.ORIGINS,
        credentials: true,
      },
    });

    this.#io.use(
      socketMiddleware.authenticate.bind(socketMiddleware)
    );

    socketEvents.register(this.#io);

    socketEmitter.initialize(this.#io);

    console.log("[socket] initialized");

    return this.#io;
  }

  get io() {
    if (!this.#io) {
      throw new Error("Socket server has not been initialized.");
    }

    return this.#io;
  }
}

export default new SocketServer();