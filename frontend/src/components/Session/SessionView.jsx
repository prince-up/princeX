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
  };

  const startScreenShare = async () => {
    try {
      // Request Chrome extension to start capture
      window.postMessage({ type: 'PRINCEX_START_CAPTURE', sessionId }, '*');

      // Listen for stream from extension
      window.addEventListener('message', async (event) => {
        if (event.data.type === 'PRINCEX_STREAM_ID') {
          const streamId = event.data.streamId;
          
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: streamId,
              },
            },
          });

          setLocalStream(stream);
          await webrtcService.addVideoStream(stream);
          await webrtcService.createOffer(sessionId);
          setIsOwner(true);

          // Show local preview
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      });

    } catch (error) {
      console.error('Screen share error:', error);
      alert('Failed to start screen sharing. Make sure the Chrome extension is installed.');
    }
  };

  const handleMouseMove = (e) => {
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
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">PrinceX Session</h2>
          <p className="text-sm text-gray-400">
            Status: <span className={connectionState === 'connected' ? 'text-green-400' : 'text-yellow-400'}>
              {connectionState}
            </span>
            {' | '}
            Role: {isOwner ? 'Owner' : 'Controller'}
          </p>
        </div>
        <button
          onClick={endSession}
          className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
        >
          End Session
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center p-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="max-w-full max-h-full rounded-lg shadow-2xl cursor-crosshair"
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
        />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 text-white p-4 text-center">
        <p className="text-sm">
          {isOwner
            ? '✓ Sharing your screen. Others can see and control it.'
            : '✓ Connected. Click on the video to control the remote screen.'}
        </p>
      </div>
    </div>
  );
};

export default SessionView;
