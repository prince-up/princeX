import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../../services/socket';
import webrtcService from '../../services/webrtc';
import { sessionAPI } from '../../services/api';

const SessionView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [isOwner, setIsOwner] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [localStream, setLocalStream] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  const handleUserInteraction = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [sessionId]);

  const initializeSession = async () => {
    try {
      // Initialize WebRTC
      await webrtcService.initialize();

      // Connect socket
      socketService.connect();
      socketService.joinRoom(sessionId, 'participant');

      // Set up WebRTC listeners
      setupWebRTCListeners();

      // Set up socket listeners
      setupSocketListeners();

      // Check if Chrome extension is installed
      window.postMessage({ type: 'PRINCEX_CHECK' }, '*');

    } catch (error) {
      console.error('Session init error:', error);
      alert('Failed to initialize session');
      navigate('/owner');
    }
  };

  const setupWebRTCListeners = () => {
    const pc = webrtcService.createPeerConnection(sessionId);

    pc.ontrack = (event) => {
      console.log('Received remote track');
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
      setConnectionState('connected');
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        alert('Connection lost');
        navigate('/owner');
      }
    };
  };

  const setupSocketListeners = () => {
    socketService.on('offer', async ({ offer }) => {
      await webrtcService.handleOffer(sessionId, offer);
      setIsOwner(false);
    });

    socketService.on('answer', async ({ answer }) => {
      await webrtcService.handleAnswer(answer);
    });

    socketService.on('ice-candidate', async ({ candidate }) => {
      await webrtcService.handleICECandidate(candidate);
    });

    socketService.on('session-ended', () => {
      alert('Session ended by host');
      navigate('/owner');
    });

    socketService.on('user-joined', () => {
      console.log('Another user joined');
      startScreenShare();
    });

    // Handle remote control events (Host side)
    socketService.on('control-event', ({ event }) => {
      console.log('Received control event:', event);

      // Pass to extension for execution
      // We need viewport dimensions to map coordinates accurately if they are normalized
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      window.postMessage({
        type: 'PRINCEX_CONTROL_EVENT',
        eventType: event.type,
        data: {
          ...event,
          width: viewportWidth,
          height: viewportHeight
        }
      }, '*');
    });
  };

  const startScreenShare = async () => {
    try {
      // Modern screen sharing API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always"
        },
        audio: false
      });

      setLocalStream(stream);
      await webrtcService.addVideoStream(stream);
      await webrtcService.createOffer(sessionId);
      setIsOwner(true);

      // Show local preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Handle stream stop (user clicks "Stop sharing" in browser UI)
      stream.getVideoTracks()[0].onended = () => {
        endSession();
      };

    } catch (error) {
      console.error('Screen share error:', error);
      if (error.name === 'NotAllowedError') {
        alert('Permission to share screen was denied.');
      } else {
        alert('Failed to start screen sharing: ' + error.message);
      }
      navigate('/owner');
    }
  };

  const handleMouseMove = (e) => {
    // Optimization: Don't send every mouse move to avoid flooding socket/debugger
    // Only send distinct moves or implement throttling if needed. 
    // For now, skipping generic mouse moves to focus on clicks/interaction.
    /*
     if (!isOwner) {
       const rect = videoRef.current.getBoundingClientRect();
       const x = (e.clientX - rect.left) / rect.width;
       const y = (e.clientY - rect.top) / rect.height;
 
       socketService.sendControlEvent(sessionId, {
         type: 'mousemove',
         x,
         y,
       });
     }
     */
  };

  const handleMouseClick = (e) => {
    if (!isOwner) {
      const rect = videoRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      socketService.sendControlEvent(sessionId, {
        type: 'mouseclick',
        button: e.button,
        x,
        y,
      });
    }
  };

  const endSession = async () => {
    try {
      await sessionAPI.end(sessionId);
      navigate('/owner');
    } catch (error) {
      console.error('End session error:', error);
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    webrtcService.close();
    socketService.endSession(sessionId);
  };

  return (
    <div
      className="h-screen w-screen bg-black overflow-hidden flex flex-col relative"
      onMouseMove={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      {/* Video - Full Screen */}
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-contain ${!isOwner ? 'cursor-none' : ''}`}
          style={{ objectFit: 'contain' }}
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
        />
      </div>

      {/* Floating Controls Overlay - Auto Hide */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent flex justify-between items-start transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="pointer-events-auto">
          <div className="bg-black/50 backdrop-blur-sm p-2 rounded-lg text-white">
            <h2 className="text-sm font-bold">PrinceX</h2>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {connectionState}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto">
          <button
            onClick={endSession}
            className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionView;
