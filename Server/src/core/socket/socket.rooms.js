import Conversation from "../../modules/conversation/conversation.model.js";

class SocketRooms {
  user(userId) {
    return `user:${userId}`;
  }

  conversation(conversationId) {
    return `conversation:${conversationId}`;
  }

  async joinConversation(socket, conversationId) {
    if (!conversationId) return;

    try {
      const exists = await Conversation.exists({
        _id: conversationId,
        userId: socket.userId,
      });

      if (!exists) return;

      socket.join(this.conversation(conversationId));
    } catch {
      // ignore invalid ObjectId
    }
  }

  leaveConversation(socket, conversationId) {
    if (!conversationId) return;

    socket.leave(this.conversation(conversationId));
  }
}

export default new SocketRooms();