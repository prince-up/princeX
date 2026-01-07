# PrinceX - System Architecture

**Tagline:** "Remote Control, Reinvented."

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PRINCEX PLATFORM                            │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                              ┌──────────────────┐
│   SCREEN OWNER   │                              │   CONTROLLER     │
│   (Laptop A)     │                              │   (Laptop B)     │
└──────────────────┘                              └──────────────────┘
        │                                                   │
        │ [1] Opens PrinceX Website                       │
        │ [2] Installs Chrome Extension                   │
        │                                                   │
        ▼                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React SPA)                            │
│  - Dashboard (Owner/Controller)                                      │
│  - QR Generator                                                      │
│  - Email Trust Manager                                               │
│  - Live Session Viewer                                               │
│  - WebRTC Video Player                                               │
└─────────────────────────────────────────────────────────────────────┘
        │                          │                          │
        │ HTTPS/WSS               │ WebRTC P2P              │ HTTPS/WSS
        │                          │                          │
        ▼                          ▼                          ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  SIGNALING       │      │  TURN/STUN       │      │  REST API        │
│  SERVER          │      │  SERVER          │      │  SERVER          │
│  (Socket.IO)     │◄────►│  (coturn/Twilio) │      │  (Express)       │
└──────────────────┘      └──────────────────┘      └──────────────────┘
        │                                                   │
        │                                                   │
        └───────────────────────┬───────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   MONGODB DATABASE    │
                    │  - Users              │
                    │  - Devices            │
                    │  - Sessions           │
                    │  - TrustedAccess      │
                    │  - AuditLogs          │
                    └───────────────────────┘
```

---

## 📊 Component Breakdown

### 1. **Frontend (React)**
**Location:** `frontend/`

**Responsibilities:**
- User authentication (login/register)
- Dashboard (Owner vs Controller views)
- QR code generation & scanning
- Email-based trusted access management
- WebRTC video stream rendering
- Mouse/keyboard event capture & transmission
- Session management UI
- Real-time notifications

**Key Libraries:**
- `react` - UI framework
- `react-router-dom` - Routing
- `socket.io-client` - WebSocket client
- `qrcode.react` - QR generation
- `simple-peer` or native WebRTC - Peer connections
- `axios` - HTTP client
- `tailwindcss` - Styling

---

### 2. **Backend (Node.js + Express)**
**Location:** `backend/`

**Responsibilities:**
- User authentication (JWT)
- Session token generation
- QR code data encoding
- Trusted email management
- WebSocket signaling server
- API endpoints for CRUD operations
- Session lifecycle management
- Audit logging

**Key Libraries:**
- `express` - Web framework
- `socket.io` - WebSocket server
- `jsonwebtoken` - JWT auth
- `bcrypt` - Password hashing
- `mongoose` - MongoDB ODM
- `cors` - CORS handling
- `express-validator` - Input validation

---

### 3. **Chrome Extension (Manifest V3)**
**Location:** `extension/`

**Responsibilities:**
- Screen capture via `chrome.desktopCapture` API
- Send video stream to WebRTC peer
- Receive remote control events (mouse/keyboard)
- Inject events into active tab (for browser-level control)
- Permission handling
- Background service worker
- Content script injection

**Key APIs:**
- `chrome.desktopCapture.chooseDesktopMedia()`
- `chrome.tabs` - Tab management
- `chrome.debugger` - Event injection (limited)
- `chrome.storage` - Store session data
- WebRTC `getDisplayMedia()`

---

### 4. **Database (MongoDB)**
**Location:** `backend/models/`

**Collections:**
- **Users:** Email, password, devices
- **Devices:** Browser fingerprint, user association
- **Sessions:** Active/expired sessions, tokens
- **TrustedAccess:** Owner-controller relationships
- **AuditLogs:** Session history, security events

---

## 🔄 Data Flow

### **Scenario A: Instant Share (QR-Based)**

```
SCREEN OWNER                    BACKEND                     CONTROLLER
     │                             │                             │
     │──[1] POST /session/create──►│                             │
     │    (userId, expiresIn: 10m) │                             │
     │                             │                             │
     │◄──[2] {sessionToken, qr}────│                             │
     │    Display QR Code          │                             │
     │                             │                             │
     │                             │◄──[3] POST /session/join────│
     │                             │    (sessionToken)           │
     │                             │                             │
     │                             │──[4] Validate token────────►│
     │                             │    {sessionId, iceServers}  │
     │                             │                             │
     │◄────────[5] WebSocket: Signal Offer/Answer/ICE ─────────►│
     │                             │                             │
     │◄──────────[6] WebRTC P2P Connection Established ────────►│
     │          (video stream + data channel)                    │
     │                             │                             │
     │◄──────────[7] Control Events (mouse, keyboard)──────────►│
     │                             │                             │
     │──[8] POST /session/end─────►│                             │
     │                             │──[9] Notify disconnect─────►│
```

---

### **Scenario B: Permanent Share (Email-Based)**

```
SCREEN OWNER                    BACKEND                     CONTROLLER
     │                             │                             │
     │─[1] POST /trust/add────────►│                             │
     │   {controllerEmail}         │                             │
     │                             │                             │
     │◄─[2] Trust created──────────│                             │
     │                             │                             │
     │                             │◄──[3] POST /auth/login──────│
     │                             │    {email, password}        │
     │                             │                             │
     │                             │──[4] {jwt, availableDevs}──►│
     │                             │                             │
     │                             │◄──[5] POST /session/connect─│
     │                             │    {ownerDeviceId}          │
     │                             │                             │
     │◄─[6] Notification: Control request                        │
     │                             │                             │
     │──[7] POST /session/approve─►│                             │
     │                             │                             │
     │◄──────────[8] WebRTC Connection ────────────────────────►│
```

---

## 🔐 Security Architecture

### **Authentication Flow**
```
User Registration
  ↓
Email + Password → bcrypt hash → Store in MongoDB
  ↓
Login → Verify password → Issue JWT (7d expiry)
  ↓
JWT stored in httpOnly cookie / localStorage
  ↓
Every API request → Verify JWT → Proceed
```

### **Session Security**
- **Temporary Sessions:** 
  - Auto-expire after 10 minutes
  - One-time use tokens
  - No storage after expiry
  
- **Permanent Access:**
  - Requires email authentication
  - Owner can revoke anytime
  - Audit logs maintained

### **WebRTC Security**
- Peer connections use DTLS-SRTP encryption
- ICE candidates filtered (no IP leakage)
- TURN server with authentication
- Data channels encrypted by default

### **Extension Security**
- Content Security Policy (CSP)
- Permissions requested: `desktopCapture`, `activeTab`
- No arbitrary code execution
- Session tokens stored in `chrome.storage.session` (cleared on close)

---

## 🚀 WebRTC + WebSocket Flow

### **Signaling (Socket.IO)**
```javascript
// Server-side
io.on('connection', (socket) => {
  socket.on('offer', ({ sessionId, offer }) => {
    socket.to(sessionId).emit('offer', offer);
  });
  
  socket.on('answer', ({ sessionId, answer }) => {
    socket.to(sessionId).emit('answer', answer);
  });
  
  socket.on('ice-candidate', ({ sessionId, candidate }) => {
    socket.to(sessionId).emit('ice-candidate', candidate);
  });
});
```

### **WebRTC Connection Establishment**
```javascript
// Owner (Sender)
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: false
});

const peer = new RTCPeerConnection({ iceServers });
stream.getTracks().forEach(track => peer.addTrack(track, stream));

// Data channel for control events
const controlChannel = peer.createDataChannel('control');

// Controller (Receiver)
peer.ontrack = (event) => {
  videoElement.srcObject = event.streams[0];
};

peer.ondatachannel = (event) => {
  event.channel.onmessage = handleControlEvent;
};
```

---

## 📁 Project Structure

```
princex/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── env.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Device.js
│   │   │   ├── Session.js
│   │   │   ├── TrustedAccess.js
│   │   │   └── AuditLog.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── session.js
│   │   │   ├── trust.js
│   │   │   └── device.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── sessionController.js
│   │   │   └── trustController.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── validation.js
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   ├── qr.js
│   │   │   └── logger.js
│   │   ├── sockets/
│   │   │   └── signaling.js
│   │   └── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── OwnerDashboard.jsx
│   │   │   │   └── ControllerDashboard.jsx
│   │   │   ├── Session/
│   │   │   │   ├── QRGenerator.jsx
│   │   │   │   ├── QRScanner.jsx
│   │   │   │   ├── VideoPlayer.jsx
│   │   │   │   └── ControlInterface.jsx
│   │   │   └── Trust/
│   │   │       ├── AddTrustedEmail.jsx
│   │   │       └── TrustedList.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── socket.js
│   │   │   └── webrtc.js
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/
│   │   │   ├── useWebRTC.js
│   │   │   └── useSocket.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── extension/
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── content-script.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── utils/
│   │   ├── capture.js
│   │   └── webrtc.js
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── docs/
│   ├── API.md
│   ├── DATABASE_SCHEMA.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
│
└── README.md
```

---

## 🎯 Technical Decisions & Justifications

### **Why Socket.IO over native WebSockets?**
- Built-in reconnection logic
- Room-based messaging (sessionId rooms)
- Fallback to HTTP long-polling
- Better developer experience

### **Why MongoDB over SQL?**
- Flexible schema for device fingerprints
- Horizontal scaling for session data
- Built-in TTL indexes for auto-expiring sessions
- Fast lookups for trusted relationships

### **Why React over Vanilla JS?**
- Component reusability (Dashboard, Video Player)
- State management for WebRTC connections
- Ecosystem (React Router, Context API)
- Industry standard for resumes

### **Browser Extension Limitations**
- **Cannot control OS-level actions** (outside browser)
- **Limited to active tab** for keyboard/mouse injection
- **Requires user permission** for screen capture
- **Solution:** Clear documentation explaining scope

---

## 🔮 Future Upgrade Path

### **Phase 1 (Current MVP):**
✅ Browser-based screen sharing  
✅ QR + Email access  
✅ Basic mouse/keyboard control  
✅ Session management  

### **Phase 2 (Native Agent):**
- Desktop Electron app (bypasses browser limitations)
- System-level keyboard/mouse control
- Multi-monitor support
- File transfer capability

### **Phase 3 (Enterprise):**
- Multi-party sessions (1 owner, N controllers)
- Recording & playback
- OCR + AI assistance
- Mobile app (React Native)
- RBAC (role-based access control)

### **Phase 4 (Scale):**
- SFU (Selective Forwarding Unit) for group sessions
- CDN integration
- Cloud recording (AWS S3)
- Analytics dashboard

---

## 📈 Metrics for Success

**Performance:**
- WebRTC latency < 100ms
- Screen share FPS: 30fps
- Connection establishment: < 3s

**Security:**
- 0 unauthorized access attempts
- 100% audit log coverage
- JWT rotation every 7 days

**User Experience:**
- QR scan to connection: < 10s
- Email login to access: < 5s
- Dashboard load time: < 2s

---

## 💼 Resume/Interview Talking Points

1. **Scalability:** "Designed event-driven architecture using Socket.IO for real-time signaling, supporting 1000+ concurrent sessions"

2. **Security:** "Implemented JWT-based authentication with bcrypt hashing, DTLS-SRTP encryption for WebRTC, and comprehensive audit logging"

3. **WebRTC Expertise:** "Built NAT traversal using STUN/TURN servers, handled ICE candidate exchange, and optimized peer connection quality"

4. **Full-Stack Ownership:** "End-to-end development from MongoDB schema design to React UI, including Chrome extension with Manifest V3"

5. **User-Centric Design:** "Dual access modes (instant QR vs trusted email) balancing convenience and security based on use case"

6. **Production Readiness:** "Implemented session expiry, connection recovery, error handling, and monitoring for production deployment"

---

**Next Steps:** Proceed to implementation! 🚀
