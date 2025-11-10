# Project Summary: Puku Subscription Service

## Overview

The Puku Subscription Service is a complete Cloudflare Workers-based backend that manages OpenRouter API key subscriptions using a credit-based system. Each user receives 10 credits, and API keys are automatically provisioned, monitored, and rotated to ensure uninterrupted service.

## Technology Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite-based)
- **Authentication**: JWT (using Jose library)
- **External API**: OpenRouter API
- **Deployment**: Wrangler CLI

## Project Structure

```
puku-editor-subscription/
├── src/
│   ├── index.ts              # Main worker entry point with Hono routes
│   ├── types.ts              # TypeScript type definitions
│   ├── auth.ts               # JWT authentication logic
│   ├── database.ts           # D1 database operations
│   ├── openrouter.ts         # OpenRouter API client
│   └── business-logic.ts     # Core business logic (user flows, key rotation)
│
├── Configuration Files
│   ├── package.json          # Dependencies and scripts
│   ├── tsconfig.json         # TypeScript configuration
│   ├── wrangler.toml         # Cloudflare Workers configuration
│   ├── schema.sql            # Database schema
│   ├── .gitignore            # Git ignore rules
│   └── .env.example          # Environment variables template
│
├── Documentation
│   ├── README.md             # Main documentation (detailed)
│   ├── CLAUDE.md             # Architecture guide for Claude Code
│   ├── QUICKSTART.md         # 5-minute setup guide
│   ├── SETUP.md              # Detailed setup instructions
│   ├── DEPLOYMENT.md         # Production deployment guide
│   ├── API.md                # Complete API documentation
│   └── PROJECT_SUMMARY.md    # This file
│
└── Original Requirements
    └── readme.md             # Original specification
```

## Core Features

### 1. Automatic Key Management
- Creates OpenRouter API keys with $1 daily limits
- Monitors key usage automatically
- Rotates keys when usage drops below $0.50
- Deletes expired keys

### 2. Credit-Based System
- Each user gets 10 total credits
- Credits deducted as keys are consumed
- Automatic reset when credits drop to ≤ 0.1
- Precise credit tracking with usage delta calculation

### 3. JWT Authentication
- Validates JWT tokens using HMAC-SHA256
- Extracts user claims (uid, email, username)
- User-scoped data access

### 4. Edge Deployment
- Runs on Cloudflare's global edge network
- Low latency worldwide
- Auto-scaling
- Built-in DDoS protection

## Key Components

### Authentication Layer (`src/auth.ts`)
- JWT token validation
- Bearer token extraction
- User claim verification

### Database Layer (`src/database.ts`)
- CRUD operations for user records
- Credit tracking
- Atomic updates

### OpenRouter Client (`src/openrouter.ts`)
- Create API keys
- Check key status
- Delete API keys

### Business Logic (`src/business-logic.ts`)
- New user flow
- Existing user flow
- Key rotation logic
- Credit reset mechanism

### API Handler (`src/index.ts`)
- HTTP endpoint handling
- Request validation
- Error handling
- CORS configuration

## Business Logic Flow

```
Request → JWT Validation → User Lookup
                               ↓
                    ┌──────────┴──────────┐
                    ↓                     ↓
              New User               Existing User
                    ↓                     ↓
           Create Key           Check Remaining Credits
                    ↓                     ↓
           Store in DB        ┌──────────┴─────────┐
                    ↓         ↓                    ↓
           Return Key    Credits ≤ 0.1?      Credits > 0.1
                              ↓                    ↓
                         Reset User         Check Key Usage
                              ↓                    ↓
                         New User      ┌──────────┴──────────┐
                                       ↓                     ↓
                              Usage > $0.50           Usage ≤ $0.50
                                       ↓                     ↓
                              Return Existing         Rotate Key
                              Update Credits          Update Credits
                                                      Return New Key
```

## API Endpoints

### `GET /`
Health check endpoint

### `POST /api/key`
Get or create API key for authenticated user
- Requires: JWT token in Authorization header
- Returns: API key and credit information

## Database Schema

```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL,
  key TEXT NOT NULL,
  hash TEXT NOT NULL,
  total_limit REAL NOT NULL,
  remaining_limit REAL NOT NULL,
  usage_limit REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

### Required Secrets
- `JWT_SECRET_CLOUD` - JWT signing secret for token validation
- `PROVISIONING_API_KEY` - OpenRouter provisioning API key

### Required Bindings
- `DB` - D1 database binding (configured in wrangler.toml)

### Optional Variables
- `ENVIRONMENT` - Environment identifier (production/staging/development)

## Getting Started

### Quick Start (5 minutes)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create D1 database**
   ```bash
   npx wrangler d1 create puku-subscription-db
   # Update wrangler.toml with database_id
   ```

3. **Initialize schema**
   ```bash
   npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql
   ```

4. **Configure environment**
   ```bash
   cp .env.example .dev.vars
   # Edit .dev.vars with your secrets
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Test the API**
   ```bash
   curl -X POST http://localhost:8787/api/key \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

### Production Deployment

1. **Set production secrets**
   ```bash
   npx wrangler secret put JWT_SECRET_CLOUD
   npx wrangler secret put PROVISIONING_API_KEY
   ```

2. **Initialize production database**
   ```bash
   npx wrangler d1 execute puku-subscription-db --file=./schema.sql
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

## Available Scripts

```bash
# Development
npm run dev                    # Start local dev server
npm run tail                   # View real-time logs

# Database
npm run db:create              # Create D1 database
npm run db:migrate             # Apply schema to production
npm run db:migrate:local       # Apply schema locally
npm run db:query               # Execute SQL query

# Deployment
npm run deploy                 # Deploy to production
npm run deploy:staging         # Deploy to staging

# Testing
npm test                       # Run tests (when added)
```

## Documentation Files

| File | Purpose |
|------|---------|
| **README.md** | Comprehensive project documentation with setup, API docs, and usage examples |
| **QUICKSTART.md** | 5-minute quick start guide |
| **SETUP.md** | Detailed setup instructions with troubleshooting |
| **DEPLOYMENT.md** | Production deployment guide with monitoring and maintenance |
| **API.md** | Complete API documentation with examples |
| **CLAUDE.md** | Architecture and implementation guide for Claude Code |
| **PROJECT_SUMMARY.md** | This file - high-level project overview |

## Testing

### Manual Testing

1. **Health check**
   ```bash
   curl http://localhost:8787/
   ```

2. **New user (first request)**
   ```bash
   curl -X POST http://localhost:8787/api/key \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```
   Expected: 200 OK with key and 10 credits

3. **Existing user (subsequent requests)**
   Same as above
   Expected: 200 OK with key and updated credits

4. **Invalid token**
   ```bash
   curl -X POST http://localhost:8787/api/key \
     -H "Authorization: Bearer invalid"
   ```
   Expected: 401 Unauthorized

### Database Queries

```bash
# Check all users
npx wrangler d1 execute puku-subscription-db --local \
  --command="SELECT * FROM users"

# Check specific user
npx wrangler d1 execute puku-subscription-db --local \
  --command="SELECT * FROM users WHERE user_id = 'test-user-id'"

# Count users
npx wrangler d1 execute puku-subscription-db --local \
  --command="SELECT COUNT(*) FROM users"
```

## Monitoring

### Real-time Logs
```bash
npm run tail
```

### Key Metrics
- Request count per minute
- Error rate (target: <1%)
- Response time (target: <500ms P95)
- Key rotations per day
- Users hitting credit limits

### Database Stats
```bash
# User count
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT COUNT(*) as total FROM users"

# Average credits
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT AVG(remaining_limit) as avg_credits FROM users"
```

## Security Features

- JWT token validation with HMAC-SHA256
- User-scoped database queries
- Secrets stored in Cloudflare Workers secrets
- HTTPS enforced by Cloudflare
- Built-in DDoS protection
- API keys stored encrypted at rest in D1

## Scalability

- **Cloudflare Workers**: Auto-scales globally
- **D1 Database**: Distributed SQLite with read replication
- **No Cold Starts**: Always-warm execution
- **Global Edge**: Low latency worldwide

### Limits (Free Tier)
- Workers: 100,000 requests/day
- D1: 100,000 reads/day, 1,000 writes/day
- Upgrade to paid tier for unlimited requests

## Cost Estimation

**Free Tier**: $0/month for moderate usage

**Paid Tier**:
- Workers: $5/month base + $0.50 per million requests
- D1: Usage-based pricing
- Estimated: $5-20/month for production workloads

## Future Enhancements

1. **Usage Analytics Dashboard**
   - Track consumption patterns
   - Predict credit exhaustion

2. **Credit Top-up System**
   - Purchase additional credits
   - Payment gateway integration

3. **Multiple Tier Plans**
   - Basic: 10 credits
   - Pro: 50 credits
   - Enterprise: Unlimited

4. **Webhook Notifications**
   - Low credit alerts
   - Key rotation notifications

5. **Admin API**
   - View all users
   - Manually adjust credits
   - Force key rotation

## Support & Resources

- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **D1 Database**: https://developers.cloudflare.com/d1/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **OpenRouter API**: https://openrouter.ai/docs
- **Hono Framework**: https://hono.dev/

## Troubleshooting

See [SETUP.md](./SETUP.md) for detailed troubleshooting guide.

Common issues:
- Database not found: Check wrangler.toml database_id
- JWT validation failed: Verify JWT_SECRET_CLOUD matches
- OpenRouter API error: Check PROVISIONING_API_KEY

## License

MIT

## Contributors

Built for Puku Editor with Claude Code

---

**Project Status**: ✅ Complete and ready for deployment

**Last Updated**: 2025-11-10
