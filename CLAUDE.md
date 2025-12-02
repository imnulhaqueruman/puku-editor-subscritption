# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers backend service that manages OpenRouter API key subscriptions with usage limits. It uses Cloudflare D1 (SQLite) as the database and implements a credit-based system where users get 10 total credits and API keys are created with daily limits of $1.

## Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite-based)
- **External API**: OpenRouter API (https://openrouter.ai/api/v1)
- **Authentication**: JWT tokens using `JWT_SECRET_CLOUD` environment variable
- **JWT Library**: jose (for token verification)

### Database Schema
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL,
  key TEXT NOT NULL,
  hash TEXT NOT NULL,
  total_limit REAL NOT NULL,
  remaining_limit REAL NOT NULL,
  usage_limit REAL NOT NULL
);
```

### Key Business Logic

#### New User Flow
1. Verify JWT token from Authorization header
2. Extract user info (uid, email, username) from JWT claims
3. Create OpenRouter API key with limit=$1 (daily)
4. Store user record with:
   - `total_limit = 10`
   - `remaining_limit = 10`
   - `usage_limit = 1`
5. Return API key to user

#### Existing User Flow
1. Query D1 database for user by `user_id`
2. If `remaining_limit <= 0.1`:
   - Delete existing user record
   - Follow "New User Flow"
3. Fetch key usage from OpenRouter API using stored `hash`
4. If `limit_remaining > 0.5`:
   - Return existing API key from database
   - Update: `remaining_limit -= (usage_limit - limit_remaining)`
   - Update: `usage_limit = limit_remaining`
5. If `limit_remaining <= 0.5`:
   - Update: `remaining_limit -= (usage_limit - limit_remaining)`
   - Delete OpenRouter API key using stored `hash`
   - Create new OpenRouter API key with limit=$1
   - Update database with new `key` and `hash`
   - Update: `usage_limit = 1`

### OpenRouter API Integration

**Base URL**: `https://openrouter.ai/api/v1/keys`

**Authentication**: Use `PROVISIONING_API_KEY` environment variable with Bearer token

**Endpoints**:
- `POST /api/v1/keys` - Create new API key
- `GET /api/v1/keys/:hash` - Check key usage and status
- `DELETE /api/v1/keys/:hash` - Delete API key

**Key Creation Payload**:
```json
{
  "name": "string",
  "limit": 1.0,
  "include_byok_in_limit": false
}
```

**Important Response Fields**:
- `data.hash` - Unique key identifier (store in DB)
- `data.limit_remaining` - Credits remaining on the key
- `key` - The actual API key to return to users

### JWT Authentication

Token must be validated using `JWT_SECRET_CLOUD` environment variable. Expected claims structure:
```go
{
  "uid": "user-id",
  "email": "user@example.com",
  "username": "username"
}
```

Tokens are sent via `Authorization: Bearer <token>` header.

## Development Commands

### Cloudflare Workers Development
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
# OR: npx wrangler dev

# Deploy to production
npm run deploy
# OR: npx wrangler deploy

# Deploy to staging
npm run deploy:staging
# OR: npx wrangler deploy --env staging

# View real-time logs
npm run tail
# OR: npx wrangler tail

# Run tests
npm test
# OR: vitest
```

### Database Operations
```bash
# Create D1 database (production)
npx wrangler d1 create puku-subscription-db

# Create D1 database (staging)
npx wrangler d1 create puku-subscription-db-staging

# Execute SQL migrations (production)
npm run db:migrate
# OR: npx wrangler d1 execute puku-subscription-db --file=./schema.sql

# Execute SQL migrations (local)
npm run db:migrate:local
# OR: npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql

# Query database (local)
npx wrangler d1 execute puku-subscription-db --local --command="SELECT * FROM users"

# Query database (production)
npx wrangler d1 execute puku-subscription-db --command="SELECT * FROM users"

# Common queries
npx wrangler d1 execute puku-subscription-db --command="SELECT COUNT(*) FROM users"
npx wrangler d1 execute puku-subscription-db --command="SELECT user_id, remaining_limit FROM users WHERE remaining_limit < 1"
```

### Setting Secrets
```bash
# Set JWT secret
npx wrangler secret put JWT_SECRET_CLOUD

# Set OpenRouter provisioning API key
npx wrangler secret put PROVISIONING_API_KEY

# For staging environment
npx wrangler secret put JWT_SECRET_CLOUD --env staging
npx wrangler secret put PROVISIONING_API_KEY --env staging

# List configured secrets (shows names only)
npx wrangler secret list
```

## Environment Variables Required

- `JWT_SECRET_CLOUD` - JWT signing secret for token verification
- `PROVISIONING_API_KEY` - OpenRouter provisioning API key (format: `sk-or-v1-...`)
- D1 database binding in `wrangler.toml`

## Code Structure

The codebase is organized into modular TypeScript files:

- **src/index.ts** - Main Hono application setup, routing, CORS configuration, and error handling
- **src/auth.ts** - JWT validation logic using jose library, following Go auth pattern
- **src/business-logic.ts** - Core business logic for user creation, key rotation, and credit management
- **src/database.ts** - D1 database operations (CRUD operations for users)
- **src/openrouter.ts** - OpenRouter API client for key creation, status checking, and deletion
- **src/types.ts** - TypeScript type definitions for all interfaces

### Key Design Patterns

1. **Inline Authentication** - Authentication is done inline in the route handler (NOT as middleware), following the Go auth.VerifyToken pattern
2. **Modular Functions** - Business logic is split into focused functions: `handleNewUser`, `handleExistingUser`, `handleCreditReset`, `rotateKey`
3. **Error Propagation** - Errors bubble up from helper functions to main handler for proper HTTP status code mapping
4. **Constants** - Configuration values are defined as constants at the top of business-logic.ts:
   - `CREDIT_RESET_THRESHOLD = 0.1`
   - `KEY_ROTATION_THRESHOLD = 0.5`
   - `INITIAL_CREDITS = 10.0`
   - `KEY_DAILY_LIMIT = 1.0`

## Critical Implementation Notes

1. **Credit Threshold**: The 0.1 credit threshold is a reset trigger - when users have 0.1 or less remaining, they get a fresh start with 10 credits
2. **Key Rotation**: API keys are rotated when limit_remaining drops below 0.5 to ensure uninterrupted service
3. **Usage Tracking**: The `usage_limit` field tracks the last known usage to calculate consumption deltas
4. **Error Handling**: All OpenRouter API failures should be properly handled and logged
5. **Atomic Operations**: Database updates after API key operations must maintain consistency
6. **404 Key Handling**: If OpenRouter returns 404 for a key (deleted externally), the system creates a new key with 0 consumption
7. **HTTP Status Codes**:
   - 403 for missing/invalid auth headers (matches Go implementation)
   - 401 for invalid JWT tokens
   - 503 for OpenRouter API failures
   - 500 for database/internal errors

## Credit Calculation Algorithm

The credit system tracks user consumption through the following formula:

```typescript
// Check current OpenRouter key status
const limitRemaining = keyStatus.data.limit_remaining;

// Calculate how much was consumed since last check
const consumed = user.usage_limit - limitRemaining;

// Deduct consumed amount from total remaining credits
const newRemainingLimit = user.remaining_limit - consumed;

// Update usage_limit to current value for next check
await updateUser(db, user.user_id, {
  remaining_limit: newRemainingLimit,
  usage_limit: limitRemaining
});
```

**Example Scenario:**
- User has `remaining_limit = 9.5` and `usage_limit = 0.7` (last known)
- OpenRouter reports `limit_remaining = 0.4` (current)
- Consumed: `0.7 - 0.4 = 0.3`
- New remaining: `9.5 - 0.3 = 9.2`
- New usage: `0.4`

## Testing and Development

### Local Testing Setup

1. Start development server with local D1 database:
```bash
npm run dev
```

2. The local server runs at `http://localhost:8787` with a local SQLite database

3. Test endpoints with curl:
```bash
# Health check
curl http://localhost:8787/

# Test with JWT token
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Generating Test JWT Tokens

For local testing, you can generate JWT tokens using online tools or programmatically:

```javascript
// Example using jose library
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode('your-jwt-secret');
const token = await new SignJWT({
  uid: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('1h')
  .sign(secret);
```

### Running Tests

Tests use Vitest framework:
```bash
npm test
```

Note: Currently no test files exist in the codebase. When adding tests, create files with `.test.ts` extension in the src directory.

## Documentation Structure

The codebase includes comprehensive documentation:
- **CLAUDE.md** (this file) - Development guidance for Claude Code
- **README.md** - High-level system design and architecture diagrams
- **SETUP.md** - Step-by-step setup instructions for deployment
- **DEPLOYMENT.md** - Production deployment and monitoring guide
- **API.md** - Complete API endpoint documentation
- **PROJECT_SUMMARY.md** - Detailed system design document
