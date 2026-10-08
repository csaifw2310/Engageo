import { verifyAccessToken } from "../../utils/token.utils.js";
import { SOCKET_ERRORS } from "./socket.constants.js";

class SocketMiddleware {
  authenticate(socket, next) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error(SOCKET_ERRORS.UNAUTHORIZED));
      }

      const decoded = verifyAccessToken(token);

      if (!decoded?.id) {
        return next(new Error(SOCKET_ERRORS.UNAUTHORIZED));
      }

      socket.userId = String(decoded.id);
      socket.userRole = decoded.role;

      next();
    } catch {
      next(new Error(SOCKET_ERRORS.UNAUTHORIZED));
    }
  }
}

export default new SocketMiddleware();