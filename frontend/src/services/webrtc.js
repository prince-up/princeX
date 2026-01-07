import socketService from './socket';
import { iceServersAPI } from './api';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.iceServers = [];
  }

  async initialize() {
    try {
      const response = await iceServersAPI.get();
      this.iceServers = response.data.iceServers;
    } catch (error) {
      console.error('Failed to fetch ICE servers:', error);
      this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }

  createPeerConnection(sessionId) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendICECandidate(sessionId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
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
      stream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, stream);
      });
    }
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
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

export default new WebRTCService();
