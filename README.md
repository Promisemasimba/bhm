# Budget Health Management (BHM) API

## Architecture Overview

This project implements a two-tier architecture for a health management mobile application:

### 1. **Cloudflare Worker (Edge API)** - `/worker`
- Public-facing API consumed by mobile apps
- Handles authentication, validation, rate limiting
- Proxies requests to Core API with service authentication
- Provides caching for read-heavy endpoints

### 2. **Node.js Core API** - `/core-api`
- Backend-for-Frontend for the Worker
- Interfaces with legacy systems (DB, SOAP, etc.)
- Implements business logic for:
  - Member registration (via ID or member number)
  - Authentication and JWT management
  - Claims processing
  - Provider search
  - Membership management

### 3. **Legacy System**
- Source of truth for membership, benefits, plan coverage
- Accessed only by Core API
- Node layer translates legacy data to modern JSON

## Project Structure

```
bhm/
├── core-api/           # Node.js Core API
│   ├── src/
│   │   ├── config/     # Configuration
│   │   ├── middleware/ # Service auth, JWT verification
│   │   ├── routes/     # API routes
│   │   ├── services/   # Business logic
│   │   ├── models/     # Database models
│   │   ├── clients/    # Legacy system clients
│   │   └── server.js   # Entry point
│   ├── package.json
│   └── .env.example
│
├── worker/             # Cloudflare Worker
│   ├── src/
│   │   └── index.js    # Worker entry point
│   ├── wrangler.toml   # Worker configuration
│   └── package.json
│
└── README.md
```

## API Endpoints

### Public API (Mobile → Worker)

**Authentication**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

**Authenticated Endpoints** (require JWT in Authorization header)
- `GET /api/home` - Aggregated dashboard data
- `GET /api/card` - Digital card information
- `GET /api/dependants` - List dependants
- `GET /api/providers/search` - Search healthcare providers
- `POST /api/claims` - Submit/query claims
- `POST /api/claims/upload` - Upload claim documents
- `POST /api/cards/request` - Request physical card
- `GET /api/membership-certificate` - Get certificate

### Internal API (Worker → Core API)

All internal endpoints require `X-Service-Auth` header:
- `POST /internal/v1/auth/register`
- `POST /internal/v1/auth/login`
- `GET /internal/v1/home`
- `GET /internal/v1/providers/search`
- etc.

## Setup

### Core API Setup

```bash
cd core-api
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### Worker Setup

```bash
cd worker
npm install
# Configure wrangler.toml with your Cloudflare account
npm run dev
```

## Environment Variables

### Core API
- `PORT` - API port (default: 4000)
- `SERVICE_SECRET` - Shared secret for Worker authentication
- `JWT_SECRET` - Secret for JWT signing
- `DATABASE_URL` - Database connection string
- `LEGACY_API_URL` - Legacy system endpoint
- `LEGACY_API_KEY` - Legacy system credentials

### Worker
- `CORE_API_BASE` - Core API base URL
- `SERVICE_SECRET` - Shared secret (must match Core API)

## Registration Flow

### Option A: Registration by ID Number
1. App sends ID number, email, username, password
2. Worker validates and forwards to Core API
3. Core API queries legacy system for member with ID
4. If found and active, creates user account
5. Returns JWT token

### Option B: Registration by Member Number
1. App sends member number, email, username, password
2. Worker validates and forwards to Core API
3. Core API queries legacy system by member number
4. If found and active, creates user account
5. Returns JWT token

## Security

- All Worker ↔ Core API communication uses shared secret (`X-Service-Auth`)
- User authentication uses JWT tokens
- Passwords hashed with bcrypt
- Rate limiting on Worker edge
- Input validation at both layers

## Development

```bash
# Run Core API in development
cd core-api && npm run dev

# Run Worker in development
cd worker && npm run dev

# Run tests
npm test
```

## Deployment

### Core API
Deploy to your preferred Node.js hosting (Railway, Render, Fly.io, etc.)

### Worker
```bash
cd worker
npx wrangler deploy
```
