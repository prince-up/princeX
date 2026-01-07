# PrinceX Deployment Guide

## 🚀 Production Deployment

---

## Table of Contents
1. [Backend Deployment](#backend-deployment)
2. [Frontend Deployment](#frontend-deployment)
3. [Extension Publishing](#extension-publishing)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Monitoring & Logging](#monitoring--logging)

---

## Backend Deployment

### **Option 1: Heroku (Easiest)**

```powershell
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create princex-api

# Add MongoDB
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set JWT_EXPIRES_IN=7d
heroku config:set SESSION_EXPIRY_MINUTES=10
heroku config:set FRONTEND_URL=https://princex.vercel.app
heroku config:set TURN_SERVER_URL=turn:your-turn-server.com:3478
heroku config:set TURN_USERNAME=your-username
heroku config:set TURN_PASSWORD=your-password

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

**Cost:** Free tier available (sleeps after 30 min inactivity)

---

### **Option 2: AWS EC2 (Full Control)**

```powershell
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
sudo apt-get install -y mongodb-org

# Clone repo
git clone https://github.com/yourusername/princex.git
cd princex/backend

# Install dependencies
npm install --production

# Set up PM2 (process manager)
sudo npm install -g pm2
pm2 start src/server.js --name princex-api
pm2 save
pm2 startup

# Set up Nginx reverse proxy
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/princex

# Add this config:
server {
    listen 80;
    server_name api.princex.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/princex /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Set up SSL (Let's Encrypt)
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.princex.com
```

**Cost:** ~$5-10/month (t2.micro instance)

---

### **Option 3: Docker + Docker Compose**

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/princex
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongo-data:
```

Deploy:
```powershell
docker-compose up -d
```

---

## Frontend Deployment

### **Option 1: Vercel (Recommended)**

```powershell
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel --prod

# Set environment variables in Vercel dashboard:
# VITE_API_URL=https://princex-api.herokuapp.com
```

**Features:**
- Automatic SSL
- Global CDN
- Zero-config deployment
- Free for personal projects

---

### **Option 2: Netlify**

```powershell
# Install Netlify CLI
npm install -g netlify-cli

# Build
cd frontend
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

---

### **Option 3: AWS S3 + CloudFront**

```powershell
# Build
cd frontend
npm run build

# Install AWS CLI
pip install awscli

# Create S3 bucket
aws s3 mb s3://princex-frontend

# Enable static website hosting
aws s3 website s3://princex-frontend --index-document index.html

# Upload build
aws s3 sync dist/ s3://princex-frontend --acl public-read

# Create CloudFront distribution
aws cloudfront create-distribution --origin-domain-name princex-frontend.s3.amazonaws.com
```

---

## Extension Publishing

### **Chrome Web Store**

1. **Prepare Extension**
```powershell
cd extension
# Update manifest.json with production URLs
# Replace localhost:5173 with https://princex.vercel.app

# Create icons (if not already done)
# 16x16, 48x48, 128x128 PNG files

# Zip extension
Compress-Archive -Path * -DestinationPath princex-extension.zip
```

2. **Submit to Chrome Web Store**
- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Pay $5 one-time developer fee
- Click "New Item"
- Upload `princex-extension.zip`
- Fill in details:
  - **Name:** PrinceX Screen Share
  - **Description:** Enable remote screen sharing and control
  - **Category:** Productivity
  - **Screenshots:** 1280x800 (at least 1)
- Submit for review (takes 1-3 days)

3. **Update Extension**
```powershell
# Increment version in manifest.json
# Create new zip
# Upload to dashboard → Existing item
```

---

## Database Setup

### **MongoDB Atlas (Free Tier)**

1. **Create Cluster**
- Go to [MongoDB Atlas](https://cloud.mongodb.com)
- Create free M0 cluster
- Choose region (closest to your backend)

2. **Configure Access**
- Database Access → Add user (username + password)
- Network Access → Add IP (0.0.0.0/0 for testing, restrict in production)

3. **Get Connection String**
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/princex?retryWrites=true&w=majority
```

4. **Update Backend**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/princex
```

---

## Environment Configuration

### **Backend (.env)**
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/princex
JWT_SECRET=use-openssl-rand-hex-32-to-generate
JWT_EXPIRES_IN=7d
SESSION_EXPIRY_MINUTES=10
FRONTEND_URL=https://princex.vercel.app
TURN_SERVER_URL=turn:openrelay.metered.ca:80
TURN_USERNAME=openrelayproject
TURN_PASSWORD=openrelayproject
LOG_LEVEL=info
```

### **Frontend (.env.production)**
```env
VITE_API_URL=https://princex-api.herokuapp.com
VITE_WS_URL=wss://princex-api.herokuapp.com
```

---

## TURN Server Setup

### **Option 1: Free Public TURN**
```env
TURN_SERVER_URL=turn:openrelay.metered.ca:80
TURN_USERNAME=openrelayproject
TURN_PASSWORD=openrelayproject
```

### **Option 2: Twilio (Production)**
```javascript
// Backend: Get TURN credentials dynamically
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

app.get('/api/ice-servers', async (req, res) => {
  const token = await client.tokens.create();
  res.json({ iceServers: token.iceServers });
});
```

### **Option 3: Self-Hosted (coturn)**
```powershell
# Install coturn
sudo apt-get install coturn

# Configure /etc/turnserver.conf
listening-port=3478
external-ip=YOUR_SERVER_IP
realm=princex.com
user=princex:yourpassword
lt-cred-mech
```

---

## Monitoring & Logging

### **Backend Monitoring (PM2)**
```powershell
# Install PM2
npm install -g pm2

# Start with monitoring
pm2 start src/server.js --name princex-api
pm2 monit

# View logs
pm2 logs princex-api

# Restart on crashes
pm2 startup
pm2 save
```

### **Error Tracking (Sentry)**
```powershell
npm install @sentry/node

# In server.js
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'your-sentry-dsn' });

app.use(Sentry.Handlers.errorHandler());
```

### **Uptime Monitoring**
- [UptimeRobot](https://uptimerobot.com) - Free
- [Pingdom](https://www.pingdom.com) - Paid
- [StatusCake](https://www.statuscake.com) - Free tier

---

## SSL/TLS Certificates

### **Let's Encrypt (Free)**
```powershell
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d api.princex.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy PrinceX

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "princex-api"
          heroku_email: "your@email.com"
          appdir: "backend"

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{secrets.VERCEL_TOKEN}}
          vercel-org-id: ${{secrets.VERCEL_ORG_ID}}
          vercel-project-id: ${{secrets.VERCEL_PROJECT_ID}}
          working-directory: ./frontend
```

---

## Performance Optimization

### **Backend**
- Enable gzip compression
- Use Redis for session caching
- Database indexing (already in models)
- Connection pooling

### **Frontend**
- Code splitting (React.lazy)
- Image optimization
- CDN for static assets
- Service worker caching

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] JWT secret rotated
- [ ] CORS restricted to frontend domain
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] MongoDB authentication enabled
- [ ] Firewall rules configured
- [ ] Secrets in environment variables (not in code)
- [ ] Regular dependency updates (`npm audit fix`)
- [ ] Error messages don't leak sensitive info

---

## Backup Strategy

### **Database**
```powershell
# MongoDB Atlas: Automated backups enabled by default
# Self-hosted: Cron job
0 2 * * * mongodump --out /backups/$(date +\%Y-\%m-\%d)
```

### **Code**
- GitHub (version control)
- Regular commits
- Tag releases (`git tag v1.0.0`)

---

## Cost Estimation

**Free Tier (for MVP):**
- MongoDB Atlas: Free (512MB)
- Heroku Backend: Free (sleeps)
- Vercel Frontend: Free (100GB bandwidth)
- Chrome Extension: $5 one-time

**Production (per month):**
- MongoDB Atlas: $0-9 (M2 cluster)
- AWS EC2: $5-10 (t2.micro)
- Twilio TURN: $0.01/GB (~$10-50)
- Domain: $10-15/year
- **Total: ~$20-70/month**

---

## Troubleshooting

**Backend won't start:**
- Check MongoDB connection string
- Verify JWT_SECRET is set
- Check port 5000 is free
- Review logs: `heroku logs --tail`

**WebRTC not connecting:**
- Check TURN server credentials
- Verify firewall allows UDP/3478
- Test with public TURN first

**Extension not capturing:**
- Check manifest.json permissions
- Verify host_permissions includes frontend URL
- Check console for errors

---

**🎉 Your PrinceX platform is now production-ready!**

For support, open an issue on GitHub or contact support@princex.com
