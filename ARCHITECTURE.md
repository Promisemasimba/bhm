# Architecture Documentation

## System Overview

The Budget Health Management (BHM) system implements a modern, scalable architecture for a mobile health management application. The system is designed with three main layers:

1. **Edge Layer** - Cloudflare Worker (Public API)
2. **Application Layer** - Node.js Core API (Business Logic)
3. **Data Layer** - PostgreSQL + Legacy System

```
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────┐
│  Cloudflare Worker      │
│  (Edge API Gateway)     │
│  - Auth validation      │
│  - Rate limiting        │
│  - Request routing      │
│  - Response caching     │
└──────┬──────────────────┘
       │ X-Service-Auth
       ▼
┌─────────────────────────┐
│  Node.js Core API       │
│  - Business logic       │
│  - JWT management       │
│  - Data transformation  │
│  - Legacy integration   │
└──────┬──────────────────┘
       │
       ├─────────┬─────────────┐
       ▼         ▼             ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │  Legacy  │ │  Legacy  │
│   DB     │ │  SOAP    │ │    DB    │
└──────────┘ └──────────┘ └──────────┘
```

## Architecture Principles

### 1. Separation of Concerns

- **Worker**: Handles edge concerns (validation, auth, routing, caching)
- **Core API**: Implements business logic and legacy integration
- **Legacy System**: Source of truth for membership data

### 2. Security in Depth

- Multiple authentication layers
- Service-to-service authentication via shared secret
- JWT tokens for user authentication
- Input validation at both Worker and Core API
- HTTPS everywhere

### 3. Scalability

- Workers scale automatically at edge locations globally
- Core API can be horizontally scaled
- Database connection pooling
- Caching at multiple levels

### 4. Resilience

- Fallback to cached data when legacy system unavailable
- Graceful error handling
- Request ID tracing for debugging
- Comprehensive logging

## Component Details

### Cloudflare Worker (Edge API)

**Purpose**: Act as the public-facing API gateway

**Responsibilities**:
- Validate incoming requests
- Authenticate requests (JWT verification)
- Rate limiting per IP/user
- Route requests to Core API
- Cache read-heavy responses
- Add CORS headers
- Generate request IDs for tracing

**Technology**: Cloudflare Workers (V8 isolates, serverless)

**Scaling**: Automatic, deployed to 300+ global edge locations

**Configuration**: `worker/wrangler.toml`

### Node.js Core API

**Purpose**: Implement business logic and integrate with legacy systems

**Responsibilities**:
- Verify service authentication from Worker
- Issue and verify JWT tokens
- Implement registration/login logic
- Query legacy system for membership data
- Transform legacy data to modern JSON format
- Cache legacy data locally for performance
- Process claims submissions
- Generate upload URLs for documents
- Manage user accounts and profiles

**Technology**: Node.js 18+, Express.js

**Key Dependencies**:
- `express` - Web framework
- `jsonwebtoken` - JWT handling
- `bcryptjs` - Password hashing
- `pg` - PostgreSQL client
- `joi` - Input validation
- `axios` - HTTP client for legacy API
- `winston` - Logging

**Scaling**: Horizontal scaling via load balancer

**Configuration**: Environment variables in `.env`

### Database Layer

#### PostgreSQL (App Database)

**Purpose**: Store app-specific data and cache legacy data

**Tables**:
- `users` - App user accounts
- `user_profiles` - Extended user information
- `user_sessions` - JWT refresh tokens
- `claims` - Cached claims data
- `claim_documents` - Uploaded document metadata
- `providers` - Cached provider directory
- `audit_logs` - System audit trail

**Features**:
- Connection pooling (max 20 connections)
- Automatic timestamps via triggers
- Full-text search on provider names
- Geospatial queries for provider location

#### Legacy System

**Purpose**: Source of truth for membership, benefits, claims

**Integration Methods**:
1. REST API (preferred)
2. SOAP endpoints (fallback)
3. Direct database access (read-only)

**Data**:
- Membership records
- Plan and benefit information
- Claims history
- Provider network

## Data Flow Examples

### Registration Flow

```
1. Mobile App → Worker
   POST /api/auth/register
   {
     "mode": "id",
     "idNumber": "123...",
     "email": "user@example.com",
     "username": "jdoe",
     "password": "Pass123"
   }

2. Worker validates:
   - Required fields present
   - Email format valid
   - Password length >= 8
   - Mode is valid

3. Worker → Core API
   POST /internal/v1/auth/register
   Headers:
     X-Service-Auth: <secret>
     X-Request-ID: <uuid>

4. Core API:
   - Verifies service auth header
   - Checks username/email not taken
   - Queries legacy system by ID
   - Validates member status is active
   - Creates user in PostgreSQL
   - Issues JWT token

5. Core API → Worker → Mobile App
   {
     "user": { ... },
     "token": "eyJ..."
   }
```

### Home Dashboard Flow

```
1. Mobile App → Worker
   GET /api/home
   Authorization: Bearer <token>

2. Worker:
   - Extracts JWT token
   - Forwards to Core API

3. Worker → Core API
   GET /internal/v1/home
   Headers:
     X-Service-Auth: <secret>
     X-Request-ID: <uuid>
     Authorization: Bearer <token>

4. Core API:
   - Verifies service auth
   - Verifies and decodes JWT
   - Extracts user ID from token
   - Queries PostgreSQL for user
   - Fetches from legacy system:
     * Member details
     * Dependants
     * Recent claims
   - Aggregates data

5. Core API → Worker → Mobile App
   {
     "member": { ... },
     "plan": { ... },
     "coverage": { ... },
     "dependants": { ... },
     "recentClaims": { ... }
   }
```

### Claim Submission Flow

```
1. Mobile App → Worker
   POST /api/claims
   {
     "type": "Medical",
     "providerName": "City Hospital",
     "serviceDate": "2024-01-15",
     "amount": 1500
   }

2. Worker validates:
   - Required fields
   - Amount is positive
   - Service date not in future

3. Worker → Core API
   POST /internal/v1/claims

4. Core API:
   - Verifies auth
   - Gets user's legacy member ID
   - Submits to legacy system
   - Caches claim in PostgreSQL
   - Returns created claim

5. Mobile App requests upload URL:
   POST /api/claims/{id}/upload
   {
     "fileName": "invoice.pdf",
     "fileType": "application/pdf",
     "fileSize": 524288
   }

6. Core API:
   - Validates file type/size
   - Generates upload URL (S3/Cloud Storage)
   - Returns signed URL

7. Mobile App:
   - Uploads directly to storage
   - Notifies API of completion
```

## Security Architecture

### Authentication & Authorization

**Layer 1: Worker → Core API**
- Shared secret in `X-Service-Auth` header
- Prevents unauthorized access to Core API
- Secret must be securely stored and rotated

**Layer 2: User Authentication**
- JWT tokens issued by Core API
- Tokens contain user ID, username, legacy member ID
- 1-hour expiration (configurable)
- Verified by both Worker and Core API

**Layer 3: Resource Authorization**
- Core API checks user ownership of resources
- User can only access their own data
- Legacy member ID prevents data leakage

### Data Protection

**In Transit**:
- All communication over HTTPS/TLS
- Mobile App → Worker: TLS 1.3
- Worker → Core API: TLS 1.2+
- Core API → Legacy: TLS 1.2+

**At Rest**:
- Passwords hashed with bcrypt (cost factor 10)
- Database encrypted at rest (provider-managed)
- Sensitive logs redacted

**Secrets Management**:
- Environment variables for configuration
- Cloudflare Workers Secrets for Worker
- Never committed to git
- Rotated regularly

## Caching Strategy

### Edge Caching (Worker)

**Good candidates**:
- Provider search results (TTL: 1 hour)
- Plan information (TTL: 24 hours)
- Static content

**Implementation**: Cloudflare KV or Cache API

### Application Caching (Core API)

**Database caching**:
- Provider directory synced daily
- Claims cached after fetch from legacy
- Member details cached (invalidate on update)

**In-memory caching** (future):
- Redis for session data
- Frequently accessed lookups

## Error Handling

### Error Propagation

```
Legacy System Error
  ↓
Core API catches, logs, returns appropriate status
  ↓
Worker receives error, adds CORS headers
  ↓
Mobile App displays user-friendly message
```

### Error Categories

1. **Client Errors (4xx)**
   - Invalid input → 400
   - Unauthorized → 401
   - Not found → 404
   - Conflict → 409

2. **Server Errors (5xx)**
   - Internal error → 500
   - Legacy unavailable → 503

3. **Custom Errors**
   - Each error has message, status, requestId
   - Development mode includes stack trace

## Monitoring & Observability

### Logging

**Request Logging**:
- Every request logged with:
  - Request ID
  - Method and path
  - User ID (if authenticated)
  - Duration
  - Status code

**Error Logging**:
- Full stack traces
- Context (user, request ID)
- Severity levels

**Performance Logging**:
- Database query times
- Legacy API call times
- Response times

### Metrics

**Core API**:
- Request count per endpoint
- Response time percentiles (p50, p95, p99)
- Error rates
- Database connection pool utilization

**Worker**:
- Edge request count
- Cache hit rate
- Geographic distribution
- Error rates by location

### Tracing

- Request ID flows through entire stack
- Mobile → Worker → Core API → Legacy
- Enables end-to-end debugging

## Deployment Architecture

### Production Setup

```
┌─────────────────┐
│  Mobile Apps    │
│  iOS / Android  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Cloudflare Global Network  │
│  300+ Edge Locations        │
│  - Workers                  │
│  - WAF                      │
│  - DDoS Protection          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Load Balancer              │
│  (Cloud Provider)           │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Core   │ │ Core   │  (Auto-scaling)
│ API 1  │ │ API 2  │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  Primary/Replica│
└─────────────────┘
```

### Disaster Recovery

- Database: Daily automated backups, 30-day retention
- Core API: Stateless, rapid redeployment
- Worker: Versioned, instant rollback
- RTO: < 15 minutes
- RPO: < 24 hours

## Future Enhancements

1. **Caching**
   - Implement Redis for session storage
   - Add Cloudflare KV for edge caching
   - Cache warm-up on deployment

2. **Performance**
   - Database read replicas
   - GraphQL for flexible querying
   - Optimize database indexes

3. **Features**
   - Real-time notifications (WebSockets)
   - Offline support (service workers)
   - Biometric authentication

4. **Operations**
   - Automated testing pipeline
   - Blue-green deployments
   - Feature flags
   - A/B testing framework

5. **Security**
   - Two-factor authentication
   - Anomaly detection
   - Regular security audits
   - Penetration testing
