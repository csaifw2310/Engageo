import socketRooms from "./socket.rooms.js";
import { SOCKET_EVENTS } from "./socket.constants.js";
import { MESSAGE_STATUS } from "../../modules/message/message.constants.js";

class SocketEmitter {
  #io = null;

  initialize(io) {
    this.#io = io;
  }

  get io() {
    if (!this.#io) {
      throw new Error("Socket.IO has not been initialized.");
    }

    return this.#io;
  }

  emitToUser(userId, event, payload) {
    this.io
      .to(socketRooms.user(userId))
      .emit(event, payload);
  }

  emitToConversation(conversationId, event, payload) {
    this.io
      .to(socketRooms.conversation(conversationId))
      .emit(event, payload);
  }

  newMessage(userId, conversationId, message) {
    this.emitToUser(
      userId,
      SOCKET_EVENTS.NEW_MESSAGE,
      {
        conversationId: String(conversationId),
        message,
      }
    );
  }

  conversationUpdated(userId, conversation) {
    this.emitToUser(
      userId,
      SOCKET_EVENTS.CONVERSATION_UPDATED,
      conversation
    );
  }

  messageDelivered(userId, conversationId, messageId) {
    this.emitToConversation(
      conversationId,
      SOCKET_EVENTS.MESSAGE_DELIVERED,
      {
        conversationId: String(conversationId),
        messageId,
      }
    );
  }

  readReceipt(userId, conversationId, messageId) {
    this.emitToConversation(
      conversationId,
      SOCKET_EVENTS.READ_RECEIPT,
      {
        conversationId: String(conversationId),
        messageId,
      }
    );
  }

  messageStatus(conversationId, payload) {
    switch (payload.status) {
      case MESSAGE_STATUS.DELIVERED:
        this.messageDelivered(
          null,
          conversationId,
          payload.messageId
        );
        break;

      case MESSAGE_STATUS.READ:
        this.readReceipt(
          null,
          conversationId,
          payload.messageId
        );
        break;

      default:
        break;
    }
  }

  typing(conversationId, payload) {
    this.emitToConversation(
      conversationId,
      SOCKET_EVENTS.TYPING,
      payload
    );
  }

  stopTyping(conversationId, payload) {
    this.emitToConversation(
      conversationId,
      SOCKET_EVENTS.STOP_TYPING,
      payload
    );
  }

  campaignCompleted(userId, campaign) {
    this.emitToUser(
      userId,
      SOCKET_EVENTS.CAMPAIGN_COMPLETED,
      campaign
    );
  }

  notification(userId, notification) {
    this.emitToUser(
      userId,
      SOCKET_EVENTS.NOTIFICATION,
      notification
    );
  }
}

export default new SocketEmitter();