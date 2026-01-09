import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import socketService from '../../services/socket';
import webrtcService from '../../services/webrtc';
import { sessionAPI } from '../../services/api';
import MobileControls from './MobileControls';

const SessionView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isOwner, setIsOwner] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [localStream, setLocalStream] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [logs, setLogs] = useState([]);
  const [isSupported] = useState(!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [videoQuality, setVideoQuality] = useState('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const controlsTimeoutRef = useRef(null);
  const lastMouseMoveTime = useRef(0);
  const keysPressed = useRef(new Set());

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

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
      alert('Screen sharing is not supported on this browser/device.');
      return;
    }
    try {
      addLog('Opening Share UI...');
      
      // Quality presets
      const qualitySettings = {
        auto: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        high: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        medium: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        low: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
      };

      const videoConstraints = videoQuality === 'auto' 
        ? { cursor: "always", ...qualitySettings.auto }
        : { cursor: "always", ...qualitySettings[videoQuality] };

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
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
    if (!isOwner && videoRef.current && videoRef.current.srcObject && remoteControlEnabled) {
      e.preventDefault();
      const coords = getNormalizedCoordinates(e);
      if (coords) {
        socketService.sendControlEvent(sessionId, {
          type: 'mouseclick',
          button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isOwner && videoRef.current && videoRef.current.srcObject && remoteControlEnabled) {
      const now = Date.now();
      // Throttle mouse move events to reduce network load
      if (now - lastMouseMoveTime.current < 50) return;
      lastMouseMoveTime.current = now;

      const coords = getNormalizedCoordinates(e);
      if (coords) {
        setCursorPosition({ x: e.clientX, y: e.clientY });
        socketService.sendControlEvent(sessionId, {
          type: 'mousemove',
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleMouseDown = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      const coords = getNormalizedCoordinates(e);
      if (coords) {
        socketService.sendControlEvent(sessionId, {
          type: 'mousedown',
          button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleMouseUp = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      const coords = getNormalizedCoordinates(e);
      if (coords) {
        socketService.sendControlEvent(sessionId, {
          type: 'mouseup',
          button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleWheel = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      const coords = getNormalizedCoordinates(e);
      if (coords) {
        socketService.sendControlEvent(sessionId, {
          type: 'wheel',
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ || 0,
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      
      // Prevent duplicate events for held keys
      if (keysPressed.current.has(e.key)) return;
      keysPressed.current.add(e.key);

      socketService.sendControlEvent(sessionId, {
        type: 'keydown',
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
      });
    }
  };

  const handleKeyUp = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      keysPressed.current.delete(e.key);

      socketService.sendControlEvent(sessionId, {
        type: 'keyup',
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
      });
    }
  };

  // Handle touch events for mobile support
  const handleTouchStart = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      const touch = e.touches[0];
      const coords = getNormalizedCoordinates(touch);
      if (coords) {
        socketService.sendControlEvent(sessionId, {
          type: 'mousedown',
          button: 'left',
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleTouchMove = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      const touch = e.touches[0];
      const coords = getNormalizedCoordinates(touch);
      if (coords) {
        socketService.sendControlEvent(sessionId, {
          type: 'mousemove',
          x: coords.x,
          y: coords.y,
        });
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isOwner && remoteControlEnabled) {
      e.preventDefault();
      socketService.sendControlEvent(sessionId, {
        type: 'mouseup',
        button: 'left',
      });
    }
  };

  // Get normalized coordinates (0-1) from mouse/touch event
  const getNormalizedCoordinates = (e) => {
    if (!videoRef.current) return null;

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

    const clientX = e.clientX !== undefined ? e.clientX : e.pageX;
    const clientY = e.clientY !== undefined ? e.clientY : e.pageY;

    if (clientX >= finalLeft && clientX <= finalLeft + finalWidth &&
        clientY >= finalTop && clientY <= finalTop + finalHeight) {
      return {
        x: (clientX - finalLeft) / finalWidth,
        y: (clientY - finalTop) / finalHeight,
      };
    }

    return null;
  };

  // Enable/disable remote control
  const toggleRemoteControl = () => {
    setRemoteControlEnabled(!remoteControlEnabled);
    if (!remoteControlEnabled) {
      // Focus on video element to capture keyboard events
      videoRef.current?.focus();
    }
  };

  // Handle mobile keyboard input
  const handleMobileKeyPress = (e) => {
    socketService.sendControlEvent(sessionId, {
      type: 'keydown',
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });

    setTimeout(() => {
      socketService.sendControlEvent(sessionId, {
        type: 'keyup',
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
      });
    }, 50);
  };

  const handleMobileSpecialKey = (data) => {
    socketService.sendControlEvent(sessionId, {
      type: 'keydown',
      key: data.key,
      code: data.key,
      keyCode: 0,
      ctrlKey: data.ctrlKey,
      altKey: data.altKey,
      shiftKey: data.shiftKey,
      metaKey: false,
    });

    setTimeout(() => {
      socketService.sendControlEvent(sessionId, {
        type: 'keyup',
        key: data.key,
        code: data.key,
        keyCode: 0,
        ctrlKey: data.ctrlKey,
        altKey: data.altKey,
        shiftKey: data.shiftKey,
        metaKey: false,
      });
    }, 50);
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
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      tabIndex={0}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain ${!isOwner && remoteControlEnabled ? 'cursor-none' : ''}`}
          onClick={handleMouseClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
        />
        
        {/* Custom cursor for remote control */}
        {!isOwner && remoteControlEnabled && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: cursorPosition.x,
              top: cursorPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" strokeWidth="1">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          </div>
        )}

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
                <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse ${
                  connectionState === 'connected' ? 'bg-green-500' : 
                  connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
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
          {/* Remote Control Toggle (for controllers) */}
          {!isOwner && videoRef.current?.srcObject && (
            <button
              onClick={toggleRemoteControl}
              className={`${
                remoteControlEnabled 
                  ? 'bg-green-600 hover:bg-green-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              } text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl active:scale-95 transition-all flex items-center gap-2`}
            >
              {remoteControlEnabled ? '🖱️ Control ON' : '🔒 Control OFF'}
            </button>
          )}

          {/* Quality Settings */}
          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl text-sm font-black backdrop-blur-md border border-white/10 active:scale-95 transition-all"
              >
                ⚙️
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 bg-black/90 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-2xl min-w-[200px]">
                  <p className="text-white text-xs font-bold mb-2">Video Quality</p>
                  <div className="space-y-2">
                    {['auto', 'high', 'medium', 'low'].map(quality => (
                      <button
                        key={quality}
                        onClick={() => {
                          setVideoQuality(quality);
                          setShowSettings(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs ${
                          videoQuality === quality 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {quality.charAt(0).toUpperCase() + quality.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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

      {/* Mobile Controls */}
      {isMobile && !isOwner && remoteControlEnabled && (
        <MobileControls
          onKeyPress={handleMobileKeyPress}
          onSpecialKey={handleMobileSpecialKey}
        />
      )}
    </div>
  );
};

export default SessionView;
