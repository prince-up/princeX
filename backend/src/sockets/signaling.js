const logger = require('../utils/logger');
const { Session } = require('../models');

/**
 * Initialize Socket.IO signaling server
 */
const initializeSignaling = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    /**
     * Join session room
     */
    socket.on('join-room', async ({ sessionId, role }) => {
      try {
        const session = await Session.findById(sessionId);
        
        if (!session || !session.isValid()) {
          socket.emit('error', { message: 'Invalid session' });
          return;
        }

        // Join Socket.IO room
        await socket.join(session.socketRoomId);
        
        // Notify room
        socket.to(session.socketRoomId).emit('user-joined', {
          socketId: socket.id,
          role,
        });

        logger.info(`Socket ${socket.id} joined room ${session.socketRoomId} as ${role}`);
      } catch (error) {
        logger.error(`Join room error: ${error.message}`);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * WebRTC Signaling: Offer
     */
    socket.on('offer', ({ sessionId, offer }) => {
      socket.to(sessionId).emit('offer', {
        offer,
        from: socket.id,
      });
      logger.info(`Offer sent in room ${sessionId}`);
    });

    /**
     * WebRTC Signaling: Answer
     */
    socket.on('answer', ({ sessionId, answer }) => {
      socket.to(sessionId).emit('answer', {
        answer,
        from: socket.id,
      });
      logger.info(`Answer sent in room ${sessionId}`);
    });

    /**
     * WebRTC Signaling: ICE Candidate
     */
    socket.on('ice-candidate', ({ sessionId, candidate }) => {
      socket.to(sessionId).emit('ice-candidate', {
        candidate,
        from: socket.id,
      });
    });

    /**
     * Remote Control: Mouse/Keyboard Events
     */
    socket.on('control-event', ({ sessionId, event }) => {
      socket.to(sessionId).emit('control-event', {
        event,
        from: socket.id,
      });
    });

    /**
     * Session end notification
     */
    socket.on('end-session', ({ sessionId }) => {
      socket.to(sessionId).emit('session-ended', {
        from: socket.id,
      });
      logger.info(`Session ${sessionId} ended by ${socket.id}`);
    });

    /**
     * Disconnect
     */
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.IO signaling server initialized');
};

module.exports = { initializeSignaling };
