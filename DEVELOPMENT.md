# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed
- Git
- Code editor (VS Code recommended)

### Initial Setup

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd bhm
```

2. **Set up Core API**

```bash
cd core-api
npm install
```

3. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```env
NODE_ENV=development
PORT=4000

SERVICE_SECRET=dev-secret-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_EXPIRY=1h

DATABASE_URL=postgresql://localhost:5432/bhm_dev

# Mock legacy system for development
LEGACY_API_URL=http://localhost:5001
LEGACY_API_KEY=dev-key

LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:8787
```

4. **Set up database**

```bash
# Create database
createdb bhm_dev

# Run migrations
npm run db:migrate
```

5. **Set up Worker**

```bash
cd ../worker
npm install
```

### Running Locally

#### Terminal 1: Core API

```bash
cd core-api
npm run dev
```

The API will be available at `http://localhost:4000`

#### Terminal 2: Worker

```bash
cd worker
npm run dev
```

The Worker will be available at `http://localhost:8787`

### Testing the API

#### Health Check

```bash
# Core API
curl http://localhost:4000/health

# Worker
curl http://localhost:8787/health
```

#### Register a User

```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "memberNumber",
    "memberNumber": "TEST123",
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test1234"
  }'
```

**Note:** This will fail unless you have a mock legacy system or modify the code to skip legacy validation in development.

#### Login

```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test1234"
  }'
```

Save the token from the response for authenticated requests.

#### Get Home Dashboard

```bash
curl http://localhost:8787/api/home \
  -H "Authorization: Bearer <your-token>"
```

## Development Workflow

### Code Structure

```
bhm/
├── core-api/              # Node.js Core API
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── middleware/    # Express middleware
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── models/        # Database models
│   │   ├── clients/       # External API clients
│   │   ├── db/            # Database utilities
│   │   └── server.js      # Entry point
│   └── package.json
│
└── worker/                # Cloudflare Worker
    ├── src/
    │   ├── handlers/      # Route handlers
    │   ├── utils/         # Utilities
    │   └── index.js       # Entry point
    └── wrangler.toml
```

### Adding a New Endpoint

1. **Create service in Core API**

```javascript
// core-api/src/services/newService.js
class NewService {
  async doSomething(userId, data) {
    // Business logic here
    return result;
  }
}

module.exports = new NewService();
```

2. **Create route in Core API**

```javascript
// core-api/src/routes/new.js
const express = require('express');
const router = express.Router();
const newService = require('../services/newService');

router.post('/action', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const result = await newService.doSomething(userId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

3. **Register route in server**

```javascript
// core-api/src/server.js
const newRoutes = require('./routes/new');

// After JWT middleware
app.use('/internal/v1/new', verifyJWT, newRoutes);
```

4. **Create handler in Worker**

```javascript
// worker/src/handlers/new.js
import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse } from '../utils/response';

export async function handleNew(request, env, requestId, token) {
  const response = await proxyToCoreAPI(
    request,
    env,
    '/internal/v1/new/action',
    requestId,
    token
  );

  return proxyResponse(response, requestId);
}
```

5. **Add route to Worker**

```javascript
// worker/src/index.js
import { handleNew } from './handlers/new';

// In the fetch handler
if (path === '/api/new/action' && method === 'POST') {
  return handleNew(request, env, requestId, token);
}
```

### Database Changes

1. **Update schema**

```sql
-- core-api/src/db/schema.sql
ALTER TABLE users ADD COLUMN new_field VARCHAR(100);
```

2. **Run migration**

```bash
npm run db:migrate
```

3. **Update model**

```javascript
// core-api/src/models/User.js
static async updateNewField(userId, value) {
  await db.query(
    'UPDATE users SET new_field = $1 WHERE id = $2',
    [value, userId]
  );
}
```

### Mock Legacy System for Development

Create a simple mock server for development:

```javascript
// mock-legacy-server.js
const express = require('express');
const app = express();

app.use(express.json());

app.get('/members/by-id', (req, res) => {
  res.json([{
    member_id: 'legacy-001',
    member_number: 'TEST123',
    id_number: req.query.idNumber,
    first_name: 'Test',
    last_name: 'User',
    status: 'active',
    plan_id: 'plan-001',
    plan_name: 'Test Plan',
  }]);
});

app.get('/members/:memberNumber', (req, res) => {
  res.json({
    member_id: 'legacy-001',
    member_number: req.params.memberNumber,
    first_name: 'Test',
    last_name: 'User',
    status: 'active',
    plan_id: 'plan-001',
    plan_name: 'Test Plan',
  });
});

app.listen(5001, () => {
  console.log('Mock legacy server running on port 5001');
});
```

Run it:

```bash
node mock-legacy-server.js
```

## Debugging

### Core API

Use Node.js debugging:

```bash
node --inspect src/server.js
```

Then attach VS Code debugger or Chrome DevTools.

### Worker

Use Wrangler dev tools:

```bash
wrangler dev --local --inspect
```

### Database Queries

Check logs in development mode:

```bash
# Set LOG_LEVEL=debug in .env
# Queries will be logged to console
```

Or connect directly:

```bash
psql bhm_dev
\dt  # List tables
SELECT * FROM users;
```

## Testing

### Manual Testing with curl

See examples above in "Testing the API" section.

### Automated Tests

```bash
cd core-api
npm test
```

### Load Testing

Use tools like Apache Bench or k6:

```bash
# Install k6
brew install k6

# Run load test
k6 run load-test.js
```

## Common Issues

### Port already in use

```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

### Database connection errors

```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
brew services restart postgresql
```

### Worker not proxying to Core API

- Check `CORE_API_BASE` in `wrangler.toml`
- Verify `SERVICE_SECRET` matches in both .env and Worker secrets
- Check Core API is running and accessible

## Tips

1. **Use Postman or Insomnia** for testing APIs with collections
2. **Enable hot reload** - both `npm run dev` commands support it
3. **Check logs** - both services log extensively in development mode
4. **Use VS Code REST Client** extension for inline API testing
5. **Database GUI** - Use TablePlus or pgAdmin for easier database management

## Next Steps

- Implement comprehensive tests
- Add API documentation with Swagger
- Set up CI/CD pipeline
- Add monitoring and alerting
- Implement caching strategies
- Add more comprehensive error handling
