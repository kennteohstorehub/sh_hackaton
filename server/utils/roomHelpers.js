/**
 * Room naming helpers for consistent socket.io room management
 */

class RoomHelpers {
  /**
   * Get the primary room name for a queue entry
   * This is the main room used for notifications
   */
  static getEntryRoom(entryId) {
    return `entry-${entryId}`;
  }

  /**
   * Get the session room name for webchat customers
   */
  static getSessionRoom(sessionId) {
    return `session-${sessionId}`;
  }

  /**
   * Get the phone room name for phone-based notifications
   */
  static getPhoneRoom(phone) {
    // Normalize phone number by removing non-digits
    const normalizedPhone = phone.replace(/\D/g, '');
    return `phone-${normalizedPhone}`;
  }

  /**
   * Get the merchant room name for dashboard updates
   */
  static getMerchantRoom(merchantId) {
    return `merchant-${merchantId}`;
  }

  /**
   * Get all rooms a customer should join based on their queue entry
   */
  static getCustomerRooms(queueEntry) {
    const rooms = [];
    
    // Primary room - always included
    rooms.push(this.getEntryRoom(queueEntry.id));
    
    // Session room - for webchat customers
    if (queueEntry.sessionId) {
      rooms.push(this.getSessionRoom(queueEntry.sessionId));
    }
    
    // Phone room - for phone-based notifications
    if (queueEntry.customerPhone) {
      rooms.push(this.getPhoneRoom(queueEntry.customerPhone));
    }
    
    return rooms;
  }

  /**
   * Extract room type and ID from a room name
   */
  static parseRoom(roomName) {
    const parts = roomName.split('-');
    if (parts.length < 2) return null;
    
    const type = parts[0];
    const id = parts.slice(1).join('-');
    
    return { type, id };
  }

  /**
   * Check if a socket is authorized to join a room
   */
  static isAuthorizedForRoom(socket, roomName, queueEntry = null) {
    const room = this.parseRoom(roomName);
    if (!room) return false;
    
    switch (room.type) {
      case 'entry':
        // Customers can only join their own entry room
        return queueEntry && queueEntry.id === room.id;
        
      case 'session':
        // Customers can join their session room
        return socket.data.sessionId === room.id;
        
      case 'phone':
        // Customers can join their phone room
        return socket.data.phone && this.getPhoneRoom(socket.data.phone) === roomName;
        
      case 'merchant':
        // Only authenticated merchants can join merchant rooms
        return socket.request.session?.user?.merchantId === room.id;
        
      default:
        return false;
    }
  }
}

module.exports = RoomHelpers;