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
        socket.sessionRoom = session.socketRoomId;
        await socket.join(session.socketRoomId);

        // Notify room
        socket.to(session.socketRoomId).emit('user-joined', {
          socketId: socket.id,
          role,
        });

        logger.info(`Socket ${socket.id} joined room ${socket.sessionRoom} as ${role}`);
      } catch (error) {
        logger.error(`Join room error: ${error.message}`);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * WebRTC Signaling: Offer
     */
    socket.on('offer', ({ offer }) => {
      if (socket.sessionRoom) {
        socket.to(socket.sessionRoom).emit('offer', {
          offer,
          from: socket.id,
        });
        logger.info(`Offer sent in room ${socket.sessionRoom}`);
      }
    });

    /**
     * WebRTC Signaling: Answer
     */
    socket.on('answer', ({ answer }) => {
      if (socket.sessionRoom) {
        socket.to(socket.sessionRoom).emit('answer', {
          answer,
          from: socket.id,
        });
        logger.info(`Answer sent in room ${socket.sessionRoom}`);
      }
    });

    /**
     * WebRTC Signaling: ICE Candidate
     */
    socket.on('ice-candidate', ({ candidate }) => {
      if (socket.sessionRoom) {
        socket.to(socket.sessionRoom).emit('ice-candidate', {
          candidate,
          from: socket.id,
        });
      }
    });

    /**
     * Remote Control: Mouse/Keyboard Events
     */
    socket.on('control-event', ({ event }) => {
      if (socket.sessionRoom) {
        // Forward control event to the owner's browser
        socket.to(socket.sessionRoom).emit('control-event', {
          event,
          from: socket.id,
        });
        
        // Optional: Log control events for security/audit
        logger.debug(`Control event: ${event.type} in room ${socket.sessionRoom}`);
      }
    });

    /**
     * Screen quality adjustment
     */
    socket.on('quality-change', ({ quality }) => {
      if (socket.sessionRoom) {
        socket.to(socket.sessionRoom).emit('quality-change', {
          quality,
          from: socket.id,
        });
        logger.info(`Quality changed to ${quality} in room ${socket.sessionRoom}`);
      }
    });

    /**
     * Connection quality feedback
     */
    socket.on('connection-stats', ({ stats }) => {
      if (socket.sessionRoom) {
        socket.to(socket.sessionRoom).emit('connection-stats', {
          stats,
          from: socket.id,
        });
      }
    });

    /**
     * Session end notification
     */
    socket.on('end-session', () => {
      if (socket.sessionRoom) {
        socket.to(socket.sessionRoom).emit('session-ended', {
          from: socket.id,
        });
        logger.info(`Session in room ${socket.sessionRoom} ended by ${socket.id}`);
      }
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
