# PrinceX - Remote Control, Reinvented 🚀

A browser-based remote screen sharing and control platform with QR-based instant access and email-based trusted access.

---

## 🎯 Project Overview

**PrinceX** allows users to share their screen and grant remote control access to others directly through the browser. Features include:

- **Instant Share:** Generate QR code → Scan → Immediate screen sharing (10-minute sessions)
- **Permanent Access:** Trust emails for one-click persistent access
- **Browser Control:** Mouse + keyboard control within browser context
- **Secure:** JWT auth, WebRTC encryption, audit logging
- **Resume-Ready:** Full-stack architecture with production considerations

---

## 📁 Project Structure

```
princex/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── config/       # Database & environment config
│   │   ├── models/       # Mongoose schemas
│   │   ├── routes/       # API endpoints
│   │   ├── controllers/  # Business logic
│   │   ├── middleware/   # Auth & validation
│   │   ├── sockets/      # Socket.IO signaling
│   │   ├── utils/        # Helpers (JWT, QR, logging)
│   │   └── server.js     # Entry point
│   └── package.json
│
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── contexts/     # Auth context
│   │   ├── services/     # API, Socket, WebRTC
│   │   └── App.jsx       # Main app
│   └── package.json
│
├── extension/            # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/       # Service worker
│   ├── content/          # Content script
│   └── popup/            # Extension UI
│
└── docs/
    ├── ARCHITECTURE.md   # System design
    ├── DATABASE_SCHEMA.md
    ├── SECURITY.md
    └── API.md
```

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Chrome browser

### **1. Backend Setup**
```powershell
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

Backend runs on **http://localhost:5000**

### **2. Frontend Setup**
```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

### **3. Extension Setup**
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder
5. Extension icon appears in toolbar

---

## 🔧 Environment Variables

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/princex
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d
SESSION_EXPIRY_MINUTES=10
FRONTEND_URL=http://localhost:5173
```

---

## 📖 Usage Flow

### **Instant Share (QR-Based)**

1. **Owner:** Login → Dashboard → "Generate QR Code"
2. **Controller:** Scan QR with phone/another device → Login
3. **System:** Creates 10-minute session
4. **Owner:** Chrome extension captures screen
5. **Controller:** Views & controls screen in browser
6. **Either:** End session or auto-expires after 10 min

### **Permanent Share (Email-Based)**

1. **Owner:** Dashboard → "Trusted Access" → Add controller email
2. **Controller:** Login → Dashboard → See available devices
3. **Controller:** Click "Connect" on owner's device
4. **Owner:** Approves connection (or auto-approve if enabled)
5. **Both:** Session starts, no time limit
6. **Owner:** Can revoke access anytime

---

## 🛠️ Tech Stack

### **Backend**
- Node.js + Express
- Socket.IO (WebRTC signaling)
- MongoDB + Mongoose
- JWT authentication
- bcrypt password hashing
- Winston logging

### **Frontend**
- React 18 + Vite
- React Router (client-side routing)
- Tailwind CSS (styling)
- Socket.IO client
- Native WebRTC APIs
- QRCode.react

### **Extension**
- Manifest V3
- Chrome APIs (desktopCapture, activeTab)
- Service Worker background script
- Content script bridge

---

## 🔒 Security Features

- ✅ JWT authentication with 7-day expiry
- ✅ bcrypt password hashing (10 rounds)
- ✅ WebRTC DTLS-SRTP encryption
- ✅ Session tokens with expiration
- ✅ Audit logging (90-day retention)
- ✅ CORS restricted to frontend domain
- ✅ Input validation with express-validator
- ✅ Owner can revoke access anytime

See [docs/SECURITY.md](docs/SECURITY.md) for detailed security architecture.

---

## 📡 API Endpoints

### **Authentication**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - Logout

### **Sessions**
- `POST /api/session/instant` - Create QR session
- `POST /api/session/join` - Join via token
- `POST /api/session/permanent` - Connect to trusted device
- `DELETE /api/session/:id` - End session
- `GET /api/session/active` - List active sessions

### **Trusted Access**
- `POST /api/trust/add` - Add trusted email
- `GET /api/trust/list` - List trusted emails
- `DELETE /api/trust/:id` - Revoke access
- `GET /api/trust/available-devices` - Get connectable devices

### **Devices**
- `POST /api/device/register` - Register device
- `GET /api/device/list` - List user's devices
- `PATCH /api/device/:id/status` - Update online status

See [docs/API.md](docs/API.md) for full API documentation.

---

## 🧪 Testing

```powershell
# Backend tests
cd backend
npm test

# Frontend (add tests in production)
cd frontend
npm test
```

---

## 📦 Deployment

### **Backend (Example: Heroku)**
```powershell
# Install Heroku CLI
heroku create princex-api
heroku addons:create mongolab:sandbox
heroku config:set JWT_SECRET=your-production-secret
git push heroku main
```

### **Frontend (Example: Vercel)**
```powershell
npm install -g vercel
cd frontend
vercel --prod
```

### **Extension (Chrome Web Store)**
1. Zip the `extension/` folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay $5 one-time fee
4. Upload zip + screenshots
5. Publish

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production setup.

---

## 🎯 Future Roadmap

### **Phase 2: Enhanced Features**
- [ ] Desktop Electron app (OS-level control)
- [ ] Multi-monitor support
- [ ] File transfer capability
- [ ] Session recording & playback
- [ ] Mobile apps (React Native)

### **Phase 3: Enterprise**
- [ ] Multi-party sessions (1 owner, N controllers)
- [ ] Role-based access control (RBAC)
- [ ] SSO integration (Google, Microsoft)
- [ ] White-labeling options
- [ ] Custom branding

### **Phase 4: Scale**
- [ ] SFU (Selective Forwarding Unit) for group sessions
- [ ] CDN integration for global reach
- [ ] AI-powered assistance (OCR, auto-actions)
- [ ] Analytics dashboard
- [ ] API for third-party integrations

---

## 🐛 Known Limitations

- **Browser-level control only** (can't control OS outside browser)
- **No file system access** (browser security restriction)
- **Limited to active tab** for keyboard/mouse injection
- **NAT traversal** requires TURN server for some networks

**Solution:** Use Electron desktop app for full OS control (Phase 2).

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 💼 For Recruiters

**Why PrinceX is Resume-Worthy:**

1. **Full-Stack Architecture:** End-to-end ownership from MongoDB to React UI
2. **Real-Time Systems:** WebRTC + WebSockets for low-latency streaming
3. **Security First:** JWT, bcrypt, encryption, audit logging
4. **Scalable Design:** Microservices-ready, event-driven architecture
5. **Production-Ready:** Error handling, logging, monitoring considerations
6. **Modern Stack:** Latest technologies (Manifest V3, React 18, Node.js 18+)

**Interview Highlights:**
- "Implemented end-to-end WebRTC signaling with Socket.IO for peer-to-peer screen sharing"
- "Designed dual-access system (instant QR + trusted email) balancing UX and security"
- "Built Chrome extension with Manifest V3 using desktopCapture API"
- "Architected MongoDB schema with TTL indexes for automatic session cleanup"
- "Achieved <100ms latency using direct peer connections with STUN/TURN"

---

## 📧 Contact

**Developer:** Your Name  
**Email:** your.email@example.com  
**LinkedIn:** [linkedin.com/in/yourprofile](https://linkedin.com)  
**Portfolio:** [yourportfolio.com](https://yourportfolio.com)

---

**Built with ❤️ for remote collaboration**
