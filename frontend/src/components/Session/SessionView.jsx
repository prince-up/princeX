import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import socketService from '../../services/socket';
import webrtcService from '../../services/webrtc';
import { sessionAPI } from '../../services/api';

const SessionView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const videoRef = useRef(null);
  const [isOwner, setIsOwner] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [localStream, setLocalStream] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [logs, setLogs] = useState([]);
  const controlsTimeoutRef = useRef(null);

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
        // Small delay to ensure everything is ready
        setTimeout(() => startScreenShare(), 1000);
      } else {
        addLog('Ready. Waiting for connection...');
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
        // Keep logs visible if disconnected
        setShowControls(true);
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
      alert('Session ended');
      navigate('/owner');
    });

    socketService.on('user-joined', () => {
      addLog('User Joined');
      // If we are the host and someone joins, we start sharing
      // But we check if we already have a stream to avoid redundant requests
      if (!localStream) {
        startScreenShare();
      }
    });

    // Handle remote control events (Host side)
    socketService.on('control-event', ({ event }) => {
      console.log('Received control event:', event);

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
      addLog('Starting Share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      setLocalStream(stream);
      await webrtcService.addVideoStream(stream);
      await webrtcService.createOffer(sessionId);
      addLog('Offer Sent');
      setIsOwner(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      stream.getVideoTracks()[0].onended = () => {
        endSession();
      };

    } catch (error) {
      console.error('Screen share error:', error);
      addLog(`Error: ${error.message}`);
      if (error.name !== 'NotAllowedError') {
        alert('Failed to start sharing: ' + error.message);
      }
    }
  };

  const handleMouseClick = (e) => {
    if (!isOwner && videoRef.current) {
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
      navigate('/owner');
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
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-contain ${!isOwner ? 'cursor-none' : ''}`}
          onClick={handleMouseClick}
        />
      </div>

      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white min-w-[150px]">
            <h2 className="text-sm font-bold tracking-tight">PrinceX</h2>
            <div className="mt-1 flex flex-col gap-1">
              <p className="text-[10px] text-green-400 flex items-center gap-1 font-medium uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {connectionState}
              </p>
              <div className="mt-2 space-y-0.5 border-t border-white/10 pt-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-[9px] text-gray-400 font-mono leading-tight">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {!localStream && !isOwner && (
            <button
              onClick={startScreenShare}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Start Sharing
            </button>
          )}
          <button
            onClick={endSession}
            className="bg-red-600/90 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 active:scale-95 transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionView;
