# PrinceX API Documentation

Base URL: `http://localhost:5000/api` (development)  
Production: `https://api.princex.com/api`

---

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### **Health Check**

#### GET /health
Check server status

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-07T12:00:00.000Z"
}
```

---

## Auth Routes (`/api/auth`)

### **Register**

#### POST /api/auth/register
Create new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe" // optional
}
```

**Response:** `201 Created`
```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe",
    "isActive": true,
    "createdAt": "2026-01-07T10:00:00.000Z"
  }
}
```

---

### **Login**

#### POST /api/auth/login
Authenticate user

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

---

### **Get Profile**

#### GET /api/auth/profile
Get current user profile (requires auth)

**Response:** `200 OK`
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe",
    "devices": [...]
  }
}
```

---

### **Logout**

#### POST /api/auth/logout
Logout user (creates audit log)

**Response:** `200 OK`
```json
{
  "message": "Logout successful"
}
```

---

## Session Routes (`/api/session`)

### **Create Instant Session**

#### POST /api/session/instant
Generate QR code for instant sharing

**Request Body:**
```json
{
  "deviceId": "507f1f77bcf86cd799439012",
  "permissions": {
    "viewOnly": false,
    "mouseControl": true,
    "keyboardControl": true
  }
}
```

**Response:** `201 Created`
```json
{
  "session": {
    "id": "507f1f77bcf86cd799439013",
    "sessionToken": "inst_abc123xyz789",
    "qrCode": "data:image/png;base64,iVBORw0...",
    "expiresAt": "2026-01-07T12:10:00.000Z",
    "socketRoomId": "room_abc123xyz",
    "permissions": {
      "viewOnly": false,
      "mouseControl": true,
      "keyboardControl": true
    }
  }
}
```

---

### **Join Session**

#### POST /api/session/join
Join session via token (QR scan)

**Request Body:**
```json
{
  "sessionToken": "inst_abc123xyz789",
  "deviceId": "507f1f77bcf86cd799439016"
}
```

**Response:** `200 OK`
```json
{
  "session": {
    "id": "507f1f77bcf86cd799439013",
    "socketRoomId": "room_abc123xyz",
    "owner": {
      "email": "owner@example.com",
      "fullName": "Owner Name"
    },
    "ownerDevice": {
      "deviceName": "Chrome on Windows"
    },
    "permissions": {
      "viewOnly": false,
      "mouseControl": true,
      "keyboardControl": true
    }
  }
}
```

---

### **Connect to Permanent Device**

#### POST /api/session/permanent
Connect to trusted device

**Request Body:**
```json
{
  "ownerDeviceId": "507f1f77bcf86cd799439012",
  "deviceId": "507f1f77bcf86cd799439016"
}
```

**Response:** `201 Created`
```json
{
  "session": {
    "id": "507f1f77bcf86cd799439014",
    "socketRoomId": "room_xyz789abc",
    "status": "pending", // or "active" if autoApprove
    "permissions": {
      "viewOnly": false,
      "mouseControl": true,
      "keyboardControl": true
    }
  }
}
```

---

### **End Session**

#### DELETE /api/session/:sessionId
End active session

**Response:** `200 OK`
```json
{
  "message": "Session ended successfully"
}
```

---

### **Get Active Sessions**

#### GET /api/session/active
List all active sessions for user

**Response:** `200 OK`
```json
{
  "sessions": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "sessionType": "instant",
      "status": "active",
      "ownerId": {...},
      "controllerId": {...},
      "startedAt": "2026-01-07T12:00:00.000Z"
    }
  ]
}
```

---

## Trust Routes (`/api/trust`)

### **Add Trusted Email**

#### POST /api/trust/add
Add email for permanent access

**Request Body:**
```json
{
  "controllerEmail": "trusted@example.com",
  "deviceId": "507f1f77bcf86cd799439012",
  "permissions": {
    "autoApprove": false,
    "viewOnly": false,
    "mouseControl": true,
    "keyboardControl": true
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Trusted email added successfully",
  "trustedAccess": {
    "_id": "507f1f77bcf86cd799439017",
    "controllerEmail": "trusted@example.com",
    "permissions": {...},
    "isActive": true
  }
}
```

---

### **Get Trusted Emails**

#### GET /api/trust/list
List all trusted emails

**Response:** `200 OK`
```json
{
  "trustedList": [
    {
      "_id": "507f1f77bcf86cd799439017",
      "controllerEmail": "trusted@example.com",
      "ownerDeviceId": {...},
      "permissions": {...},
      "lastUsedAt": "2026-01-07T11:00:00.000Z"
    }
  ]
}
```

---

### **Revoke Trust**

#### DELETE /api/trust/:trustId
Revoke trusted access

**Response:** `200 OK`
```json
{
  "message": "Access revoked successfully"
}
```

---

### **Get Available Devices**

#### GET /api/trust/available-devices
Get devices controller can access

**Response:** `200 OK`
```json
{
  "availableDevices": [
    {
      "trustId": "507f1f77bcf86cd799439017",
      "device": {
        "_id": "507f1f77bcf86cd799439012",
        "deviceName": "Chrome on Windows",
        "isOnline": true,
        "lastActive": "2026-01-07T12:00:00.000Z"
      },
      "owner": {
        "email": "owner@example.com",
        "fullName": "Owner Name"
      },
      "permissions": {...}
    }
  ]
}
```

---

## Device Routes (`/api/device`)

### **Register Device**

#### POST /api/device/register
Register or update device

**Request Body:**
```json
{
  "deviceFingerprint": "chrome-win10-abc123",
  "deviceName": "Chrome on Windows 10",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:** `200 OK`
```json
{
  "message": "Device registered successfully",
  "device": {
    "_id": "507f1f77bcf86cd799439012",
    "deviceFingerprint": "chrome-win10-abc123",
    "deviceName": "Chrome on Windows 10",
    "isOnline": true
  }
}
```

---

### **Get User Devices**

#### GET /api/device/list
List all user's devices

**Response:** `200 OK`
```json
{
  "devices": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "deviceName": "Chrome on Windows 10",
      "isOnline": true,
      "lastActive": "2026-01-07T12:00:00.000Z"
    }
  ]
}
```

---

### **Update Device Status**

#### PATCH /api/device/:deviceId/status
Update online/offline status

**Request Body:**
```json
{
  "isOnline": true
}
```

**Response:** `200 OK`
```json
{
  "message": "Device status updated",
  "device": {...}
}
```

---

## ICE Servers

### **Get ICE Servers**

#### GET /api/ice-servers
Get STUN/TURN server configuration

**Response:** `200 OK`
```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" },
    {
      "urls": "turn:your-turn-server.com:3478",
      "username": "princex",
      "credential": "your-password"
    }
  ]
}
```

---

## WebSocket Events (Socket.IO)

### **Client → Server**

#### `join-room`
Join session room

**Payload:**
```json
{
  "sessionId": "507f1f77bcf86cd799439013",
  "role": "owner" // or "controller"
}
```

---

#### `offer`
Send WebRTC offer

**Payload:**
```json
{
  "sessionId": "room_abc123xyz",
  "offer": { /* RTCSessionDescription */ }
}
```

---

#### `answer`
Send WebRTC answer

**Payload:**
```json
{
  "sessionId": "room_abc123xyz",
  "answer": { /* RTCSessionDescription */ }
}
```

---

#### `ice-candidate`
Send ICE candidate

**Payload:**
```json
{
  "sessionId": "room_abc123xyz",
  "candidate": { /* RTCIceCandidate */ }
}
```

---

#### `control-event`
Send control event (mouse/keyboard)

**Payload:**
```json
{
  "sessionId": "room_abc123xyz",
  "event": {
    "type": "mouseclick",
    "x": 0.5,
    "y": 0.5,
    "button": 0
  }
}
```

---

#### `end-session`
End session

**Payload:**
```json
{
  "sessionId": "room_abc123xyz"
}
```

---

### **Server → Client**

#### `user-joined`
User joined room

**Payload:**
```json
{
  "socketId": "abc123",
  "role": "controller"
}
```

---

#### `offer`
Received WebRTC offer

**Payload:**
```json
{
  "offer": { /* RTCSessionDescription */ },
  "from": "socket-id"
}
```

---

#### `answer`
Received WebRTC answer

**Payload:**
```json
{
  "answer": { /* RTCSessionDescription */ },
  "from": "socket-id"
}
```

---

#### `ice-candidate`
Received ICE candidate

**Payload:**
```json
{
  "candidate": { /* RTCIceCandidate */ },
  "from": "socket-id"
}
```

---

#### `control-event`
Received control event

**Payload:**
```json
{
  "event": { /* control event */ },
  "from": "socket-id"
}
```

---

#### `session-ended`
Session ended by host

**Payload:**
```json
{
  "from": "socket-id"
}
```

---

#### `error`
Error occurred

**Payload:**
```json
{
  "message": "Invalid session"
}
```

---

## Error Responses

### **400 Bad Request**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### **401 Unauthorized**
```json
{
  "error": "Authentication required"
}
```

### **403 Forbidden**
```json
{
  "error": "Access not authorized"
}
```

### **404 Not Found**
```json
{
  "error": "Session not found"
}
```

### **500 Internal Server Error**
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting (Production)

- **Auth endpoints:** 5 requests/minute
- **Session endpoints:** 10 requests/minute
- **Other endpoints:** 100 requests/minute

---

**For more details, see the source code in `backend/src/routes/`**
