# Engageo

**Modern WhatsApp Automation & Customer Engagement Platform**

Engageo is a SaaS platform built on Meta's official WhatsApp Cloud API that enables businesses to send campaigns, manage contacts, track message delivery, and automate customer communication through a centralized dashboard — without requiring any technical knowledge.

🌐 [engageo.in](https://www.engageo.in)

---

## Table of Contents

- [MVP Overview](#mvp-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [HTTPS on Localhost (required for Meta Embedded Signup)](#https-on-localhost-required-for-meta-embedded-signup)
  - [Ngrok — Expose Local HTTPS Server to the Internet](#ngrok--expose-local-https-server-to-the-internet)
  - [Running Locally](#running-locally)
  - [MongoDB (local, if not using Atlas)](#mongodb-local-if-not-using-atlas)
  - [Running with Docker](#running-with-docker)
- [Project Structure](#project-structure)
- [Features](#features)
- [Success Criteria](#success-criteria)
- [Out of Scope (Not MVP)](#out-of-scope-not-mvp)
- [Roadmap](#roadmap)
- [License](#license)

---

## MVP Overview

The MVP focuses on solving a single problem: businesses should be able to connect their WhatsApp account, upload contacts, create campaigns, send messages, track performance, and manage subscriptions — all self-serve, with zero manual intervention from the platform owner.

**MVP Goal** — allow a business to:

1. Register an account
2. Purchase a subscription
3. Connect WhatsApp
4. Import contacts
5. Create campaigns
6. Send messages
7. Track results

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js, JavaScript |
| Database | MongoDB |
| Auth | JWT Authentication, Refresh Tokens, Password Hashing |
| Integrations | Meta WhatsApp Cloud API, Meta Embedded Signup, Razorpay, Email Service |
| Infrastructure | Docker, Nginx, VPS Hosting |

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- MongoDB instance (local or Atlas)
- Meta Developer account with a WhatsApp Cloud API app configured
- Razorpay account (test or live keys)
- Resend account (or your configured email service) for transactional email
- [`mkcert`](https://github.com/FiloSottile/mkcert/releases) — for locally-trusted HTTPS certs (Meta Embedded Signup requires HTTPS, even on localhost)
- [`ngrok`](https://ngrok.com/download) — to expose your local HTTPS server so Meta's webhook can reach it

### Installation

Clone the repository and install dependencies for both client and server:

```bash
git clone https://github.com/ravipariyar/engageo.git
cd engageo

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Variables

Create a `.env` file inside `/server` with the following keys (matches `config.js`):

```env
# Server
PORT=4000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/engageo

# Auth (JWT)
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Client
CLIENT_URL=https://localhost:5173

# Email (Resend)
EMAIL_FROM=no-reply@engageo.in
RESEND_API_KEY=your_resend_api_key

# Meta WhatsApp Cloud API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_GRAPH_API_VERSION=v25.0
META_REDIRECT_URI=https://your-ngrok-or-domain/api/meta/callback

# Razorpay (Billing — optional, warns instead of throwing if unset)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

> Required vs optional, per `config.js`:
> - **Throws on boot if missing:** `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `EMAIL_FROM`, `RESEND_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`
> - **Warns + falls back to a default:** `JWT_ACCESS_EXPIRES_IN` (→ `1d`), `JWT_REFRESH_EXPIRES_IN` (→ `7d`), `NODE_ENV` (→ `development`)
> - **Warns + degrades gracefully (billing/OAuth unavailable until set):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `META_REDIRECT_URI`

And a `.env` file inside `/client`:

```env
VITE_API_URL=https://localhost:4001/api
VITE_META_APP_ID=your_meta_app_id
VITE_META_CONFIG_ID=your_meta_config_id
```

> `VITE_META_APP_ID` and `VITE_META_CONFIG_ID` are used by the frontend's Meta Embedded Signup flow (`FB.login`) to initialize the Facebook JS SDK and target the correct WhatsApp Embedded Signup configuration — separate from the backend's `META_APP_ID`/`META_APP_SECRET`, which are used server-side for token exchange and Graph API calls.
>
> Never commit `.env` files. Use `.env.example` files to document required keys without exposing secrets.

### HTTPS on Localhost (required for Meta Embedded Signup)

Meta's `FB.login` (used for WhatsApp Embedded Signup) will **not** work over plain `http://localhost` — it requires HTTPS, even in local development.

**1. Install Vite's local SSL plugin (client)**

```bash
npm install -D @vitejs/plugin-basic-ssl
```

Lets the Vite dev server serve the frontend over `https://localhost` instead of `http://localhost`.

**2. Generate a locally-trusted certificate with `mkcert`**

Download the latest release: https://github.com/FiloSottile/mkcert/releases

```bash
.\mkcert.exe -install
```

Installs a local Certificate Authority (CA) on your machine, so certificates it issues are trusted by your browser without security warnings.

```bash
.\mkcert.exe localhost
```

Generates two files in the current folder:
- `localhost.pem` — the certificate
- `localhost-key.pem` — the private key

These are used by the backend (`server.js`) to start an HTTPS server, and referenced wherever the code reads cert files (e.g. `fs.readFileSync("C:/Certs/localhost-key.pem")`).

> These HTTPS/cert steps are for **local development only**. In production, SSL termination is handled by Nginx / the hosting provider, not by reading `.pem` files directly in Node.

### Ngrok — Expose Local HTTPS Server to the Internet

Needed so Meta's webhook (WhatsApp Cloud API) can reach your local backend during development, since Meta requires a public HTTPS URL for webhook delivery.

```bash
.\ngrok http https://localhost:4001
```

- Forwards a public ngrok URL (e.g. `https://xxxx.ngrok-free.app`) to your local backend running on `https://localhost:4001`.
- Use the generated ngrok URL as the **Callback URL** in Meta's WhatsApp App Dashboard → Webhook configuration.
- The free ngrok tier generates a new random URL every restart — you'll need to update the webhook URL in Meta's dashboard each time, unless you're on a paid plan with a reserved domain.

### Running Locally

```bash
# Terminal 1 — start the backend
cd server
npm install
npm run dev   # nodemon, auto-restarts on file changes

# Terminal 2 — start the frontend
cd client
npm install
npm run dev   # Vite dev server, served over HTTPS once basic-ssl is configured
```

- Backend runs on `https://localhost:4000` (or your configured `PORT`)
- Frontend runs on `https://localhost:5173`

### MongoDB (local, if not using Atlas)

```bash
mongod
```

Starts a local MongoDB instance, if not connecting to a hosted/Atlas cluster.

### Running with Docker

```bash
docker-compose up --build
```

This spins up the client, server, and MongoDB containers together, fronted by Nginx as configured in `docker-compose.yml`.

---

## Project Structure

```
engageo/
├── client/                # React + TypeScript frontend
│   ├── src/
│   │   ├── api/           # API resource layer
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route-level pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── types/         # Shared TypeScript types
│   └── package.json
│
├── server/                # Node.js + Express backend
│   ├── src/
│   │   ├── modules/       # Feature modules (auth, contacts, campaigns, etc.)
│   │   ├── middleware/    # Auth, rate limiting, tenant isolation
│   │   ├── utils/         # Shared utilities (ApiResponse, etc.)
│   │   └── config/        # DB, Meta API, Razorpay config
│   └── package.json
│
├── docker-compose.yml
├── nginx/
└── README.md
```

---

## Features

### 1. User Authentication
- User Registration
- Login / Logout
- Forgot Password / Reset Password
- Email Verification

### 2. Subscription & Billing
- Subscription Plans (Starter, Growth, Business)
- Razorpay Integration
- Plan Purchase & Renewal
- Subscription Status
- Payment History

### 3. WhatsApp Account Connection
- Meta Embedded Signup
- Connect WhatsApp Number
- Number Verification
- Business Account Linking
- Connection Status

### 4. Contact Management
- Add / Edit / Delete Contact
- Search Contacts
- CSV Import / Export
- Contact Groups

### 5. Campaign Management
- Create Campaign
- Select Audience
- Schedule & Launch Campaign
- Duplicate Campaign
- Campaign History

### 6. Template Management
- Create, Save & Reuse Templates
- Manage Approved Templates

### 7. Message Tracking
- Sent / Delivered / Read / Failed / Pending Messages

### 8. Analytics Dashboard
- Total Messages, Delivery Rate, Read Rate
- Campaign Statistics
- Contact Growth

### 9. User Dashboard
- Account, Subscription, Campaign & Contact Overview
- Recent Activities

### 10. User Settings
- Business Information
- Profile Settings
- WhatsApp Configuration
- Account Preferences

### 11. Admin Panel
- User Management
- Subscription Management
- Revenue Tracking
- Plan Management
- Basic System Monitoring

### 12. Security
- JWT Authentication
- Password Hashing
- Role-Based Access Control (RBAC)
- API Protection & Rate Limiting
- Tenant Isolation

---

## Success Criteria

A business owner can:

**Connect WhatsApp → Upload Contacts → Buy Subscription → Create Campaign → Send Messages → Track Results**

...without any assistance from the platform owner. This confirms product-market validation and readiness for future expansion.

---

## Out of Scope (Not MVP)

The following are deferred until after MVP validation:

- Shared Team Inbox
- Multi-Agent Support
- AI Chatbot
- Visual Flow Builder
- Automation Engine
- Customer Segmentation
- AI Campaign Generator
- White Label SaaS
- Instagram Integration
- Telegram Integration
- SMS Integration
- AI Voice Agents
- Mobile Applications

## Roadmap

Post-MVP priorities will be reassessed based on user feedback and the "Out of Scope" list above, pending validation of the core MVP loop.

---

## License

**Copyright © Engageo. All Rights Reserved.**

This project is proprietary software owned by Engageo.

You may not copy, modify, distribute, sell, or use any part of this project, including its source code and documentation, without prior written permission from the copyright holder.

Unauthorized use of this software is strictly prohibited.

> **Note:** This project is private and is not open source.
