import socketService from './socket';
import { iceServersAPI } from './api';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.iceServers = [];
    this.localStream = null;
    this.remoteStream = null;
    this.statsInterval = null;
    this.connectionQuality = 'good';
  }

  async initialize() {
    try {
      const response = await iceServersAPI.get();
      this.iceServers = response.data.iceServers;
    } catch (error) {
      console.error('Failed to fetch ICE servers:', error);
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ];
    }
  }

  createPeerConnection(sessionId) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendICECandidate(sessionId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        this.startStatsMonitoring();
      } else if (this.peerConnection.connectionState === 'disconnected' || 
                 this.peerConnection.connectionState === 'failed') {
        this.stopStatsMonitoring();
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track');
      this.remoteStream = event.streams[0];
    };

    return this.peerConnection;
  }

  async createOffer(sessionId) {
    if (!this.peerConnection) {
      this.createPeerConnection(sessionId);
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    socketService.sendOffer(sessionId, offer);

    return offer;
  }

  async handleOffer(sessionId, offer) {
    if (!this.peerConnection) {
      this.createPeerConnection(sessionId);
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    socketService.sendAnswer(sessionId, answer);

    return answer;
  }

  async handleAnswer(answer) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleICECandidate(candidate) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async addVideoStream(stream) {
    if (this.peerConnection) {
      this.localStream = stream;
      stream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, stream);
      });
    }
  }

  // Monitor connection quality
  startStatsMonitoring() {
    if (this.statsInterval) return;
    
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;
      
      const stats = await this.peerConnection.getStats();
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const packetsLost = report.packetsLost || 0;
          const packetsReceived = report.packetsReceived || 1;
          const lossRate = packetsLost / (packetsLost + packetsReceived);
          
          if (lossRate > 0.1) {
            this.connectionQuality = 'poor';
          } else if (lossRate > 0.05) {
            this.connectionQuality = 'fair';
          } else {
            this.connectionQuality = 'good';
          }
        }
      });
    }, 2000);
  }

  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  getConnectionQuality() {
    return this.connectionQuality;
  }

  createDataChannel(sessionId) {
    if (this.peerConnection) {
      this.dataChannel = this.peerConnection.createDataChannel('control');

      this.dataChannel.onopen = () => {
        console.log('Data channel opened');
      };

      this.dataChannel.onmessage = (event) => {
        console.log('Data channel message:', event.data);
      };

      return this.dataChannel;
    }
  }

  onDataChannel(callback) {
    if (this.peerConnection) {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.dataChannel.onmessage = callback;
      };
    }
  }

  sendControlEvent(event) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    }
  }

  close() {
    this.stopStatsMonitoring();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.remoteStream = null;
    this.connectionQuality = 'good';
  }
}

export default new WebRTCService();
