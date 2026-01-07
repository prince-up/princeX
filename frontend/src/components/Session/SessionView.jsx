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
  const [isSupported] = useState(!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));
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
      addLog('Initializing...');

      // Initialize WebRTC
      await webrtcService.initialize();
      addLog('WebRTC Ready');

      // Connect socket
      socketService.connect();
      socketService.joinRoom(sessionId, 'participant');
      addLog('Socket Connected');

      // Set up listeners
      setupWebRTCListeners();
      setupSocketListeners();

      // Determine Role
      const userRole = state?.role || 'participant';
      addLog(`Role: ${userRole}`);

      // Auto-start if Host
      if (userRole === 'owner' || state?.autoStart) {
        if (isSupported) {
          addLog('Host: Auto-starting...');
          setTimeout(() => startScreenShare(), 1000);
        } else {
          addLog('Error: Sharing not supported');
        }
      } else {
        addLog('Controller: Waiting for Host...');
      }

    } catch (error) {
      console.error('Session init error:', error);
      addLog(`Error: ${error.message}`);
      alert('Failed to initialize session');
      navigate('/owner');
    }
  };

  const setupWebRTCListeners = () => {
    const pc = webrtcService.createPeerConnection(sessionId);

    pc.ontrack = (event) => {
      addLog('Video Received');
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
      addLog(`State: ${pc.connectionState}`);
    };
  };

  const setupSocketListeners = () => {
    socketService.on('offer', async ({ offer }) => {
      addLog('Offer Received');
      await webrtcService.handleOffer(sessionId, offer);
      setIsOwner(false);
    });

    socketService.on('answer', async ({ answer }) => {
      addLog('Answer Received');
      await webrtcService.handleAnswer(answer);
    });

    socketService.on('ice-candidate', async ({ candidate }) => {
      await webrtcService.handleICECandidate(candidate);
    });

    socketService.on('session-ended', () => {
      addLog('Ended');
      alert('Session ended');
      navigate('/owner');
    });

    socketService.on('user-joined', () => {
      addLog('Guest Joined');
      // If we are host and guest joins, share
      if (!localStream && isSupported && (state?.role === 'owner' || isOwner)) {
        startScreenShare();
      }
    });

    socketService.on('control-event', ({ event }) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      window.postMessage({
        type: 'PRINCEX_CONTROL_EVENT',
        eventType: event.type,
        data: { ...event, width: viewportWidth, height: viewportHeight }
      }, '*');
    });
  };

  const startScreenShare = async () => {
    if (!isSupported) {
      alert('Sharing is not supported on this browser/device.');
      return;
    }
    try {
      addLog('Opening Share UI...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      setLocalStream(stream);
      await webrtcService.addVideoStream(stream);
      await webrtcService.createOffer(sessionId);
      addLog('Sharing Active');
      setIsOwner(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      stream.getVideoTracks()[0].onended = () => endSession();

    } catch (error) {
      console.error('Share error:', error);
      addLog(`Fail: ${error.message}`);
    }
  };

  const handleMouseClick = (e) => {
    if (!isOwner && videoRef.current && videoRef.current.srcObject) {
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
        {!isOwner && !videoRef.current?.srcObject && connectionState === 'connecting' && (
          <div className="text-white/50 text-center animate-pulse">
            <p className="text-xl font-medium">Waiting for Host Screen...</p>
            <p className="text-sm mt-2">The session will start as soon as the host shares.</p>
          </div>
        )}
      </div>

      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/5 shadow-2xl text-white min-w-[180px]">
            <h2 className="text-base font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">PrinceX</h2>
            <div className="mt-2 flex flex-col gap-1.5">
              <p className="text-[10px] text-green-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
                {connectionState}
              </p>
              <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
                {logs.map((log, i) => (
                  <div key={i} className="text-[9px] text-gray-400 font-mono leading-none">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          {isSupported && (state?.role === 'owner' || isOwner) && !localStream && (
            <button
              onClick={startScreenShare}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
            >
              Start Sharing
            </button>
          )}

          {!isSupported && (state?.role === 'owner') && (
            <div className="bg-amber-500/20 text-amber-500 px-4 py-2 rounded-xl text-[10px] font-bold border border-amber-500/30">
              DESKTOP REQUIRED TO SHARE
            </div>
          )}

          <button
            onClick={endSession}
            className="bg-white/10 hover:bg-red-600 text-white px-6 py-3 rounded-2xl text-sm font-black backdrop-blur-md border border-white/10 active:scale-95 transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionView;
