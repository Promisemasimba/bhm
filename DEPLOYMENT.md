# Deployment Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Cloudflare account (for Worker deployment)
- Access to legacy system APIs

## Part 1: Deploy Core API

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb bhm_db

# Run migrations
cd core-api
npm install
npm run db:migrate
```

### 2. Environment Configuration

```bash
cd core-api
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=production
PORT=4000

# Generate strong secrets:
SERVICE_SECRET=<generate-random-string>
JWT_SECRET=<generate-random-string>
JWT_EXPIRY=1h

# Database
DATABASE_URL=postgresql://user:password@host:5432/bhm_db

# Legacy System
LEGACY_API_URL=https://your-legacy-system.com
LEGACY_API_KEY=your-api-key

# CORS (your Worker URL)
CORS_ORIGIN=https://bhm-api.your-subdomain.workers.dev
```

### 3. Deploy Core API

#### Option A: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add

# Deploy
railway up
```

#### Option B: Deploy to Render

1. Create account at render.com
2. Create new "Web Service"
3. Connect your GitHub repo
4. Configure:
   - Build Command: `cd core-api && npm install`
   - Start Command: `cd core-api && npm start`
   - Add environment variables
5. Deploy

#### Option C: Deploy to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch app
cd core-api
fly launch

# Set secrets
fly secrets set SERVICE_SECRET=your-secret
fly secrets set JWT_SECRET=your-secret
fly secrets set DATABASE_URL=your-db-url
fly secrets set LEGACY_API_URL=your-legacy-url
fly secrets set LEGACY_API_KEY=your-key

# Deploy
fly deploy
```

### 4. Test Core API

```bash
# Health check
curl https://your-core-api.com/health

# Should return:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

## Part 2: Deploy Cloudflare Worker

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Configure Worker

Edit `worker/wrangler.toml`:

```toml
name = "bhm-api"
account_id = "your-cloudflare-account-id"

[env.production]
name = "bhm-api-production"

[env.production.vars]
CORE_API_BASE = "https://your-core-api.com"
ENVIRONMENT = "production"
```

### 4. Set Secrets

```bash
cd worker

# Set SERVICE_SECRET (must match Core API)
wrangler secret put SERVICE_SECRET

# Set JWT_SECRET (must match Core API)
wrangler secret put JWT_SECRET
```

### 5. Deploy Worker

```bash
# Deploy to production
wrangler deploy --env production

# Note the deployed URL, e.g.:
# https://bhm-api-production.your-subdomain.workers.dev
```

### 6. Test Worker

```bash
# Health check
curl https://bhm-api-production.your-subdomain.workers.dev/health

# Test registration
curl -X POST https://bhm-api-production.your-subdomain.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "memberNumber",
    "memberNumber": "12345",
    "email": "user@example.com",
    "username": "testuser",
    "password": "SecurePass123"
  }'
```

## Part 3: Configure Mobile App

Update your mobile app configuration with the Worker URL:

```javascript
const API_BASE_URL = 'https://bhm-api-production.your-subdomain.workers.dev';
```

## Security Checklist

- [ ] Generated strong random secrets for `SERVICE_SECRET` and `JWT_SECRET`
- [ ] Secrets match between Core API and Worker
- [ ] Database has strong password
- [ ] CORS configured to only allow your Worker
- [ ] Legacy API credentials secured
- [ ] HTTPS enabled on Core API
- [ ] Rate limiting configured
- [ ] Monitoring and logging enabled

## Monitoring

### Core API Logs

```bash
# Railway
railway logs

# Render
Check dashboard

# Fly.io
fly logs
```

### Worker Logs

```bash
wrangler tail --env production
```

## Scaling

### Core API

- **Railway/Render**: Auto-scales based on load
- **Fly.io**: Configure scaling in `fly.toml`

### Worker

- Cloudflare Workers automatically scale globally
- No configuration needed

## Rollback

### Core API

```bash
# Railway
railway rollback

# Fly.io
fly releases
fly deploy --image <previous-image>
```

### Worker

```bash
# Rollback to previous deployment
wrangler rollback --env production
```

## Troubleshooting

### Core API not responding

1. Check logs for errors
2. Verify database connection
3. Check environment variables
4. Test health endpoint

### Worker returns 401 Unauthorized

1. Verify `SERVICE_SECRET` matches between Worker and Core API
2. Check Core API is accessible from Worker
3. Verify JWT_SECRET is set correctly

### Legacy system connection fails

1. Check `LEGACY_API_URL` and `LEGACY_API_KEY`
2. Verify network connectivity
3. Check legacy system is operational
4. Review legacy client logs

## Production Best Practices

1. **Secrets Management**
   - Use environment-specific secrets
   - Rotate secrets regularly
   - Never commit secrets to git

2. **Database**
   - Enable automated backups
   - Use connection pooling
   - Monitor query performance

3. **Monitoring**
   - Set up error alerts
   - Monitor API response times
   - Track rate limiting metrics

4. **Caching**
   - Enable Worker KV for provider search
   - Cache static data at edge
   - Set appropriate TTLs

5. **Rate Limiting**
   - Implement per-user limits
   - Use Cloudflare Rate Limiting
   - Monitor for abuse
