import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io('http://localhost:5000', {
        auth: {
          token: localStorage.getItem('token'),
        },
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }
    return this.socket;
  }

  joinRoom(sessionId, role) {
    if (this.socket) {
      this.socket.emit('join-room', { sessionId, role });
    }
  }

  sendOffer(sessionId, offer) {
    if (this.socket) {
      this.socket.emit('offer', { sessionId, offer });
    }
  }

  sendAnswer(sessionId, answer) {
    if (this.socket) {
      this.socket.emit('answer', { sessionId, answer });
    }
  }

  sendICECandidate(sessionId, candidate) {
    if (this.socket) {
      this.socket.emit('ice-candidate', { sessionId, candidate });
    }
  }

  sendControlEvent(sessionId, event) {
    if (this.socket) {
      this.socket.emit('control-event', { sessionId, event });
    }
  }

  endSession(sessionId) {
    if (this.socket) {
      this.socket.emit('end-session', { sessionId });
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
