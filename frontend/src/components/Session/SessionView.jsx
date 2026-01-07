import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
    console.log('[SessionDebug]', msg);
  };

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

  const { state } = useLocation();

  const initializeSession = async () => {
    try {
      addLog('Initializing session...');
      // Initialize WebRTC
      await webrtcService.initialize();
      addLog('WebRTC initialized');

      // Connect socket
      socketService.connect();
      socketService.joinRoom(sessionId, 'participant');
      addLog('Socket connected');

      // Set up WebRTC listeners
      setupWebRTCListeners();

      // Set up socket listeners
      setupSocketListeners();

      // Check if Chrome extension is installed
      window.postMessage({ type: 'PRINCEX_CHECK' }, '*');

      // Auto-start if triggered from Dashboard
      if (state?.autoStart) {
        addLog('Auto-starting screen share...');
        startScreenShare();
      }

    } catch (error) {
      console.error('Session init error:', error);
      addLog(`Init Error: ${error.message}`);
      alert('Failed to initialize session');
      navigate('/owner');
    }
  };

  const setupWebRTCListeners = () => {
    const pc = webrtcService.createPeerConnection(sessionId);

    pc.ontrack = (event) => {
      addLog('Received remote track');
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
      setConnectionState('connected');
    };

    pc.oniceconnectionstatechange = () => {
      addLog(`ICE: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      addLog(`Conn: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // alert('Connection lost');
        // navigate('/owner');
      }
    };
  };

  const setupSocketListeners = () => {
    socketService.on('offer', async ({ offer }) => {
      addLog('Received Offer');
      await webrtcService.handleOffer(sessionId, offer);
      setIsOwner(false);
    });

    socketService.on('answer', async ({ answer }) => {
      addLog('Received Answer');
      await webrtcService.handleAnswer(answer);
    });

    socketService.on('ice-candidate', async ({ candidate }) => {
      addLog('Received ICE Candidate');
      await webrtcService.handleICECandidate(candidate);
    });

    socketService.on('session-ended', () => {
      addLog('Session Ended');
      alert('Session ended by host');
      navigate('/owner');
    });

    socketService.on('user-joined', () => {
      addLog('User Joined');
      console.log('Another user joined');
      startScreenShare();
    });

    // Handle remote control events (Host side)
    socketService.on('control-event', ({ event }) => {
      console.log('Received control event:', event);

      // Pass to extension for execution
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
      addLog('Sharing screen...');
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
      addLog('Offer Sent');
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
      addLog(`Share Error: ${error.message}`);
      if (error.name === 'NotAllowedError') {
        alert('Permission to share screen was denied.');
      } else {
        alert('Failed to start screen sharing: ' + error.message);
      }
      navigate('/owner');
    }
  };

  const handleMouseMove = (e) => {
    // Optimization: Don't send every mouse move
  };

  const handleMouseClick = (e) => {
    if (!isOwner) {
      const rect = videoRef.current.getBoundingClientRect();
      const videoRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
      const elementRatio = rect.width / rect.height;

      let finalWidth, finalHeight, finalLeft, finalTop;

      if (elementRatio > videoRatio) {
        finalHeight = rect.height;
        finalWidth = finalHeight * videoRatio;
        finalTop = rect.top;
        finalLeft = rect.left + (rect.width - finalWidth) / 2;
      } else {
        finalWidth = rect.width;
        finalHeight = finalWidth / videoRatio;
        finalLeft = rect.left;
        finalTop = rect.top + (rect.height - finalHeight) / 2;
      }

      // Check if click is within video bounds
      if (e.clientX >= finalLeft && e.clientX <= finalLeft + finalWidth &&
        e.clientY >= finalTop && e.clientY <= finalTop + finalHeight) {

        const x = (e.clientX - finalLeft) / finalWidth;
        const y = (e.clientY - finalTop) / finalHeight;

        socketService.sendControlEvent(sessionId, {
          type: 'mouseclick',
          button: e.button,
          x,
          y,
        });
      }
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
            <div className="flex flex-col gap-1">
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {connectionState}
              </p>
              {/* Debug Logs */}
              <div className="text-[10px] text-gray-300 font-mono">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
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
