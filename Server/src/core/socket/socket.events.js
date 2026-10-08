import socketRooms from "./socket.rooms.js";
import { SOCKET_EVENTS } from "./socket.constants.js";

class SocketEvents {
  register(io) {
    io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
      console.log(
        `Socket Connected: ${socket.id} user:${socket.userId}`
      );

      socket.join(socketRooms.user(socket.userId));

      socket.on(
        SOCKET_EVENTS.JOIN_CONVERSATION,
        async ({ conversationId }) => {
          await socketRooms.joinConversation(socket, conversationId);
        }
      );

      socket.on(
        SOCKET_EVENTS.LEAVE_CONVERSATION,
        ({ conversationId }) => {
          socketRooms.leaveConversation(socket, conversationId);
        }
      );

      socket.on(
        SOCKET_EVENTS.TYPING,
        ({ conversationId, ...payload }) => {
          if (!conversationId) return;

          socket.to(
            socketRooms.conversation(conversationId)
          ).emit(SOCKET_EVENTS.TYPING, {
            conversationId,
            userId: socket.userId,
            ...payload,
          });
        }
      );

      socket.on(
        SOCKET_EVENTS.STOP_TYPING,
        ({ conversationId }) => {
          if (!conversationId) return;

          socket.to(
            socketRooms.conversation(conversationId)
          ).emit(SOCKET_EVENTS.STOP_TYPING, {
            conversationId,
            userId: socket.userId,
          });
        }
      );

      socket.on(
        SOCKET_EVENTS.MARK_READ,
        ({ conversationId, messageId }) => {
          if (!conversationId) return;

          socket.to(
            socketRooms.conversation(conversationId)
          ).emit(SOCKET_EVENTS.READ_RECEIPT, {
            conversationId,
            messageId,
          });
        }
      );

      socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        console.log(
          `Socket Disconnected: ${socket.id}`
        );
      });
    });
  }
}

export default new SocketEvents();