# AI Freight Load Acquisition System
## Complete Setup & Deployment Guide

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI FREIGHT LOAD ACQUISITION SYSTEM               │
│                                                                     │
│  ┌──────────┐    ┌───────────────────────────────────────────────┐  │
│  │ Frontend │    │           Backend (Node.js/Express)            │  │
│  │ Next.js  │◄──►│  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │Dashboard │    │  │ Routes  │ │  Modules │ │  Bull Workers │  │  │
│  └──────────┘    │  └────┬────┘ └────┬─────┘ └───────┬───────┘  │  │
│                  │       │           │               │            │  │
│  ┌──────────┐    │  ┌────▼───────────▼───────────────▼────────┐  │  │
│  │ Supabase │◄──►│  │          Supabase PostgreSQL             │  │  │
│  │PostgreSQL│    │  └─────────────────────────────────────────┘  │  │
│  └──────────┘    └───────────────────────────────────────────────┘  │
│                                                                     │
│  External APIs:                                                     │
│  • Anthropic Claude (AI email gen + reply analysis + load agent)    │
│  • SendGrid (email sending + inbound parse)                         │
│  • Twilio (SMS notifications)                                       │
│  • Apollo.io (shipper + contact discovery)                          │
│  • Hunter.io (email finder)                                         │
│  • Google Places (shipper discovery)                                │
│  • Redis/Bull (job queue)                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Folder Structure

```
ai-freight-system/
├── backend/
│   ├── src/
│   │   ├── index.js                    # Express server entry point
│   │   ├── config/
│   │   │   └── supabase.js             # Supabase client
│   │   ├── modules/
│   │   │   ├── shipperDiscovery.js     # Module 1: Find shippers
│   │   │   ├── contactDiscovery.js     # Module 2: Find contacts
│   │   │   ├── emailGenerator.js       # Module 3: AI email writing
│   │   │   ├── emailAutomation.js      # Module 4: Send emails + followups
│   │   │   ├── replyAnalysis.js        # Module 5: AI reply classification
│   │   │   ├── loadSecuringAgent.js    # Module 6: Secure the load
│   │   │   └── notificationEngine.js  # Module 7: Email/SMS/Dashboard alerts
│   │   ├── routes/
│   │   │   ├── search.js               # POST/GET /api/search
│   │   │   ├── contacts.js             # /api/contacts
│   │   │   ├── emails.js               # /api/emails
│   │   │   ├── replies.js              # /api/replies
│   │   │   ├── opportunities.js        # /api/opportunities
│   │   │   ├── dashboard.js            # /api/dashboard/stats, etc.
│   │   │   ├── webhooks.js             # SendGrid inbound + events
│   │   │   └── notifications.js        # /api/notifications
│   │   ├── workers/
│   │   │   ├── queues.js               # Bull queue definitions
│   │   │   ├── cron.js                 # Scheduled jobs
│   │   │   └── processors/
│   │   │       ├── searchProcessor.js  # Full pipeline orchestrator
│   │   │       ├── emailProcessor.js   # Email send jobs
│   │   │       ├── followupProcessor.js
│   │   │       └── inboxProcessor.js   # Gmail inbox polling
│   │   └── utils/
│   │       └── logger.js
│   ├── .env.example
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/pages/
│   │   └── index.js                    # Dashboard (all tabs)
│   ├── package.json
│   └── Dockerfile
├── database/
│   └── schema.sql                      # Full Supabase schema
├── docker/
│   └── docker-compose.yml
└── docs/
    └── SETUP.md                        # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Redis (or Docker)
- Supabase account
- API keys (see below)

### Step 1: Clone & Install

```bash
git clone <your-repo>
cd ai-freight-system

# Backend
cd backend
npm install
cp .env.example .env

# Frontend
cd ../frontend
npm install
cp .env.example .env.local
```

### Step 2: Set Up Supabase

1. Create project at https://supabase.com
2. Go to SQL Editor
3. Run `database/schema.sql`
4. Copy your project URL and service role key to `.env`

### Step 3: Get API Keys

| Service | Where to Get | Required |
|---------|-------------|----------|
| Anthropic Claude | https://console.anthropic.com | ✅ YES |
| SendGrid | https://sendgrid.com | ✅ YES |
| Twilio | https://twilio.com | ✅ YES (SMS) |
| Apollo.io | https://apollo.io | ✅ YES |
| Hunter.io | https://hunter.io | Recommended |
| Google Places | https://console.cloud.google.com | Recommended |
| Supabase | https://supabase.com | ✅ YES |

### Step 4: Configure SendGrid

**Sending:**
1. Create API key with "Full Access"
2. Verify your sending domain/email

**Inbound Email (to capture replies):**
1. Go to Settings → Inbound Parse
2. Set MX records for your domain (or subdomain like `inbound.yourdomain.com`)
3. Point webhook to: `https://yourbackend.com/api/webhooks/sendgrid/inbound`

**Event Tracking:**
1. Go to Settings → Mail Settings → Event Webhook
2. Point to: `https://yourbackend.com/api/webhooks/sendgrid/events`
3. Enable: Opens, Clicks

### Step 5: Configure Gmail Inbox (Alternative to SendGrid inbound)

For monitoring replies via Gmail OAuth2:

```bash
# 1. Go to Google Cloud Console
# 2. Create OAuth2 credentials
# 3. Get refresh token using OAuth2 flow
# 4. Add to .env:
GMAIL_CLIENT_ID=xxx
GMAIL_CLIENT_SECRET=xxx
GMAIL_REFRESH_TOKEN=xxx
GMAIL_USER=yourfreight@gmail.com
```

### Step 6: Start Development

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

Dashboard: http://localhost:3000
Backend API: http://localhost:3001
Health check: http://localhost:3001/health

---

## 🐳 Docker Deployment

```bash
cd docker

# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

Services:
- Frontend: http://localhost:3000
- Backend:  http://localhost:3001
- Bull Board (queue monitor): http://localhost:3002

---

## ☁️ Production Deployment

### Option A: Railway (Recommended)

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Set all `.env` variables in Railway dashboard.

### Option B: Render.com

1. Connect GitHub repo
2. Create Web Service for backend
3. Create Static Site for frontend
4. Add all environment variables

### Option C: VPS (Ubuntu)

```bash
# Install Node, Redis, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash
sudo apt-get install -y nodejs redis-server
npm install -g pm2

# Start backend
cd backend
npm install --production
pm2 start src/index.js --name freight-backend

# Start frontend
cd ../frontend
npm run build
pm2 start npm --name freight-frontend -- start

# Save PM2 config
pm2 save
pm2 startup
```

---

## 🔄 How the Pipeline Works

### Automated Flow (after starting a search):

```
1. User enters: "frozen foods" in Chicago
   └─► POST /api/search { productType: "frozen foods", location: "Chicago" }

2. searchProcessor.js runs:
   a. discoverShippers() → Google Places + Apollo → 25-50 companies saved
   b. discoverContacts() → Apollo + Hunter → logistics managers found  
   c. generateBatchEmails() → Claude writes personalized emails
   d. Emails queued for sending

3. Cron job (every 5 min):
   └─► sendQueuedEmails() → SendGrid sends in batches of 50

4. Cron job (every 2 min):
   └─► checkInbox() → Gmail polls for new replies

5. Reply arrives from "John Smith @ Arctic Foods":
   └─► replyAnalysis.js → Claude classifies as "potential_shipment"
   └─► Notification sent: Email + SMS to user
   └─► Opportunity created in database

6. Load Securing Agent activates:
   └─► Sends reply asking for: pickup location, delivery, commodity, weight, equipment, date
   └─► As shipper responds, agent extracts details
   └─► Once all 6 fields collected → "Load Secured!"
   └─► User notified immediately via Email + SMS

7. User receives: "✅ Load secured from Arctic Foods! 
   40,000 lbs frozen chicken from Chicago IL to Miami FL"
```

---

## 📊 API Reference

### Search
```
POST /api/search
Body: { productType, location?, companySize?, importExport? }
Returns: { searchId, jobId, status }

GET /api/search
Returns: list of all searches

GET /api/search/:id
Returns: search + companies + contacts
```

### Dashboard
```
GET /api/dashboard/stats
GET /api/dashboard/pipeline
GET /api/dashboard/opportunities
GET /api/dashboard/email-stats
GET /api/dashboard/notifications
GET /api/dashboard/recent-replies
```

### Opportunities
```
GET /api/opportunities
GET /api/opportunities/:id
PATCH /api/opportunities/:id
POST /api/opportunities/:id/message
POST /api/opportunities/:id/secure
```

---

## ⚙️ Configuration

### Email Rate Limiting
```
DAILY_EMAIL_LIMIT=1000     # Max emails per day
FOLLOWUP_DELAY_DAYS=3      # Days between follow-ups
MAX_FOLLOWUPS=2             # Max follow-up attempts
```

### Scaling
- For 10,000+ shippers: Bull queues handle all async processing
- For 1,000+ emails/day: SendGrid handles up to 100/day free, paid plans unlimited
- Add more workers by scaling the backend horizontally

---

## 🔔 Notification Stages

| Stage | Email | SMS | Dashboard |
|-------|-------|-----|-----------|
| Search Started | ✅ | ❌ | ✅ |
| Shippers Found | ✅ | ❌ | ✅ |
| Contacts Found | ✅ | ❌ | ✅ |
| Email Generated | ✅ | ❌ | ✅ |
| Email Sent | ✅ | ❌ | ✅ |
| **Reply Received** | ✅ | ✅ | ✅ |
| **Potential Shipment** | ✅ | ✅ | ✅ |
| Details Requested | ✅ | ❌ | ✅ |
| **Shipment Secured** | ✅ | ✅ | ✅ |
| **Carrier Ready** | ✅ | ✅ | ✅ |

---

## 🛡️ Security Notes

- All API keys stored in `.env` (never commit to git)
- Rate limiting: 200 requests / 15 minutes per IP
- SendGrid webhook validation recommended
- Supabase Row Level Security should be configured for multi-user

---

## 📞 Support

For issues: check logs at `backend/logs/combined.log`
Queue monitor: http://localhost:3002 (Bull Board)
