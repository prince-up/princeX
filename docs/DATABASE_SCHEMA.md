# PrinceX Database Schema

## Collections Overview

### 1. Users
### 2. Devices
### 3. Sessions
### 4. TrustedAccess
### 5. AuditLogs

---

## 1️⃣ Users Collection

**Purpose:** Store user accounts with authentication credentials

```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (bcrypt hashed, required),
  fullName: String (optional),
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean (default: true),
  devices: [ObjectId] (references Device)
}
```

**Indexes:**
- `email` (unique)
- `createdAt`

**Sample Document:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "password": "$2b$10$abcdefghijklmnopqrstuvwxyz",
  "fullName": "John Doe",
  "createdAt": "2026-01-07T10:00:00.000Z",
  "updatedAt": "2026-01-07T10:00:00.000Z",
  "isActive": true,
  "devices": ["507f1f77bcf86cd799439012"]
}
```

---

## 2️⃣ Devices Collection

**Purpose:** Track unique browser/device combinations per user

```javascript
{
  _id: ObjectId,
  userId: ObjectId (required, references User),
  deviceFingerprint: String (required, unique),
  deviceName: String (browser name + OS),
  userAgent: String,
  lastActive: Date,
  createdAt: Date,
  isOnline: Boolean (default: false)
}
```

**Indexes:**
- `userId`
- `deviceFingerprint` (unique)
- `lastActive`

**Sample Document:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "userId": "507f1f77bcf86cd799439011",
  "deviceFingerprint": "chrome-win10-abc123xyz",
  "deviceName": "Chrome on Windows 10",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "lastActive": "2026-01-07T11:30:00.000Z",
  "createdAt": "2026-01-07T10:00:00.000Z",
  "isOnline": true
}
```

---

## 3️⃣ Sessions Collection

**Purpose:** Manage active and expired screen sharing sessions

```javascript
{
  _id: ObjectId,
  sessionToken: String (unique, required),
  sessionType: String (enum: ['instant', 'permanent'], required),
  
  // Owner details
  ownerId: ObjectId (required, references User),
  ownerDeviceId: ObjectId (required, references Device),
  
  // Controller details
  controllerId: ObjectId (optional, references User),
  controllerDeviceId: ObjectId (optional, references Device),
  
  // Session config
  permissions: {
    viewOnly: Boolean (default: false),
    mouseControl: Boolean (default: true),
    keyboardControl: Boolean (default: true)
  },
  
  // Lifecycle
  status: String (enum: ['pending', 'active', 'ended', 'expired'], default: 'pending'),
  createdAt: Date,
  expiresAt: Date (TTL index for auto-deletion),
  startedAt: Date (optional),
  endedAt: Date (optional),
  
  // Metadata
  qrCode: String (data URL, optional),
  socketRoomId: String (for Socket.IO rooms)
}
```

**Indexes:**
- `sessionToken` (unique)
- `ownerId`
- `controllerId`
- `expiresAt` (TTL index for auto-deletion)
- `status`

**TTL Index:**
```javascript
// Auto-delete expired sessions 5 minutes after expiry
db.sessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 300 });
```

**Sample Document (Instant):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "sessionToken": "inst_abc123xyz789",
  "sessionType": "instant",
  "ownerId": "507f1f77bcf86cd799439011",
  "ownerDeviceId": "507f1f77bcf86cd799439012",
  "controllerId": null,
  "controllerDeviceId": null,
  "permissions": {
    "viewOnly": false,
    "mouseControl": true,
    "keyboardControl": true
  },
  "status": "pending",
  "createdAt": "2026-01-07T12:00:00.000Z",
  "expiresAt": "2026-01-07T12:10:00.000Z",
  "startedAt": null,
  "endedAt": null,
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "socketRoomId": "room_abc123xyz"
}
```

**Sample Document (Permanent):**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "sessionToken": "perm_xyz789abc456",
  "sessionType": "permanent",
  "ownerId": "507f1f77bcf86cd799439011",
  "ownerDeviceId": "507f1f77bcf86cd799439012",
  "controllerId": "507f1f77bcf86cd799439015",
  "controllerDeviceId": "507f1f77bcf86cd799439016",
  "permissions": {
    "viewOnly": false,
    "mouseControl": true,
    "keyboardControl": true
  },
  "status": "active",
  "createdAt": "2026-01-07T12:00:00.000Z",
  "expiresAt": null,
  "startedAt": "2026-01-07T12:01:00.000Z",
  "endedAt": null,
  "qrCode": null,
  "socketRoomId": "room_xyz789abc"
}
```

---

## 4️⃣ TrustedAccess Collection

**Purpose:** Store permanent trusted relationships between owners and controllers

```javascript
{
  _id: ObjectId,
  ownerId: ObjectId (required, references User),
  ownerDeviceId: ObjectId (required, references Device),
  controllerEmail: String (required),
  controllerId: ObjectId (optional, references User - set after controller registers),
  
  permissions: {
    autoApprove: Boolean (default: false),
    viewOnly: Boolean (default: false),
    mouseControl: Boolean (default: true),
    keyboardControl: Boolean (default: true)
  },
  
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date,
  lastUsedAt: Date (optional)
}
```

**Indexes:**
- `ownerId, ownerDeviceId`
- `controllerEmail`
- `controllerId`
- Compound: `ownerId, controllerEmail` (unique)

**Sample Document:**
```json
{
  "_id": "507f1f77bcf86cd799439017",
  "ownerId": "507f1f77bcf86cd799439011",
  "ownerDeviceId": "507f1f77bcf86cd799439012",
  "controllerEmail": "trusted@example.com",
  "controllerId": "507f1f77bcf86cd799439015",
  "permissions": {
    "autoApprove": false,
    "viewOnly": false,
    "mouseControl": true,
    "keyboardControl": true
  },
  "isActive": true,
  "createdAt": "2026-01-05T10:00:00.000Z",
  "updatedAt": "2026-01-07T12:00:00.000Z",
  "lastUsedAt": "2026-01-07T12:00:00.000Z"
}
```

---

## 5️⃣ AuditLogs Collection

**Purpose:** Security and compliance tracking for all session activities

```javascript
{
  _id: ObjectId,
  sessionId: ObjectId (optional, references Session),
  userId: ObjectId (required, references User),
  deviceId: ObjectId (optional, references Device),
  
  eventType: String (enum: [
    'session_created',
    'session_joined',
    'session_started',
    'session_ended',
    'trust_added',
    'trust_revoked',
    'login',
    'logout',
    'permission_changed'
  ], required),
  
  eventData: Object (flexible metadata),
  ipAddress: String,
  userAgent: String,
  timestamp: Date (default: now),
  
  severity: String (enum: ['info', 'warning', 'critical'], default: 'info')
}
```

**Indexes:**
- `sessionId`
- `userId`
- `eventType`
- `timestamp` (with TTL for log rotation after 90 days)

**Sample Document:**
```json
{
  "_id": "507f1f77bcf86cd799439018",
  "sessionId": "507f1f77bcf86cd799439013",
  "userId": "507f1f77bcf86cd799439011",
  "deviceId": "507f1f77bcf86cd799439012",
  "eventType": "session_created",
  "eventData": {
    "sessionType": "instant",
    "expiresAt": "2026-01-07T12:10:00.000Z"
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-01-07T12:00:00.000Z",
  "severity": "info"
}
```

---

## 🔄 Relationships Diagram

```
Users
  │
  ├──< Devices (1:N)
  │
  ├──< Sessions as Owner (1:N)
  │
  ├──< Sessions as Controller (1:N)
  │
  ├──< TrustedAccess as Owner (1:N)
  │
  └──< AuditLogs (1:N)

Devices
  │
  ├──> User (N:1)
  │
  └──< Sessions (1:N)

Sessions
  │
  ├──> Owner (User) (N:1)
  │
  ├──> Controller (User) (N:1)
  │
  └──< AuditLogs (1:N)

TrustedAccess
  │
  ├──> Owner (User) (N:1)
  │
  └──> Controller (User) (N:1)
```

---

## 🎯 Query Examples

### Find active sessions for a user (as owner)
```javascript
db.sessions.find({
  ownerId: ObjectId("507f1f77bcf86cd799439011"),
  status: "active"
});
```

### Find all trusted controllers for a device
```javascript
db.trustedaccesses.find({
  ownerDeviceId: ObjectId("507f1f77bcf86cd799439012"),
  isActive: true
});
```

### Find available devices for a controller
```javascript
// Step 1: Find trusted relationships
const trustedRels = db.trustedaccesses.find({
  controllerEmail: "trusted@example.com",
  isActive: true
});

// Step 2: Get owner device IDs
const deviceIds = trustedRels.map(rel => rel.ownerDeviceId);

// Step 3: Find online devices
db.devices.find({
  _id: { $in: deviceIds },
  isOnline: true
});
```

### Audit trail for a session
```javascript
db.auditlogs.find({
  sessionId: ObjectId("507f1f77bcf86cd799439013")
}).sort({ timestamp: 1 });
```

---

## 🔒 Security Considerations

1. **Password Storage:** Never store plain text passwords (use bcrypt with salt rounds ≥ 10)

2. **Session Tokens:** Use UUID v4 with prefix (`inst_` or `perm_`) for easy identification

3. **TTL Indexes:** Auto-delete expired instant sessions to prevent database bloat

4. **Audit Logs:** Log all authentication and session events for compliance

5. **Sensitive Data:** Never log passwords or full session tokens in audit logs

6. **Device Fingerprinting:** Use combination of user agent, browser ID, and optional IP hash

---

## 📊 Scalability Notes

**For Production:**
- Add Redis caching for active sessions
- Implement database sharding on `userId`
- Use connection pooling (mongoose defaults are good)
- Add read replicas for audit log queries
- Consider time-series database for logs (InfluxDB, TimescaleDB)

**Estimated Storage:**
- User: ~500 bytes
- Device: ~300 bytes
- Session: ~800 bytes
- TrustedAccess: ~400 bytes
- AuditLog: ~600 bytes

**10,000 Users Estimate:**
- Users: 5 MB
- Devices (2 per user): 6 MB
- Active Sessions (1,000): 800 KB
- TrustedAccess (5 per user): 20 MB
- AuditLogs (100 events/user): 600 MB (with 90-day retention)

**Total: ~632 MB** (manageable for MongoDB free tier)

---

Next: Implementing MongoDB models with Mongoose! 🚀
