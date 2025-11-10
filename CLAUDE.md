# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers backend service that manages OpenRouter API key subscriptions with usage limits. It uses Cloudflare D1 (SQLite) as the database and implements a credit-based system where users get 10 total credits and API keys are created with daily limits of $1.

## Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite-based)
- **External API**: OpenRouter API (https://openrouter.ai/api/v1)
- **Authentication**: JWT tokens using `JWT_SECRET_CLOUD` environment variable

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
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy

# View logs
npx wrangler tail
```

### Database Operations
```bash
# Create D1 database
npx wrangler d1 create puku-subscription-db

# Execute SQL migrations
npx wrangler d1 execute puku-subscription-db --file=./schema.sql

# Query database locally
npx wrangler d1 execute puku-subscription-db --local --command="SELECT * FROM users"

# Query production database
npx wrangler d1 execute puku-subscription-db --command="SELECT * FROM users"
```

## Environment Variables Required

- `JWT_SECRET_CLOUD` - JWT signing secret for token verification
- `PROVISIONING_API_KEY` - OpenRouter provisioning API key (format: `sk-or-v1-...`)
- D1 database binding in `wrangler.toml`

## Critical Implementation Notes

1. **Credit Threshold**: The 0.1 credit threshold is a reset trigger - when users have 0.1 or less remaining, they get a fresh start with 10 credits
2. **Key Rotation**: API keys are rotated when limit_remaining drops below 0.5 to ensure uninterrupted service
3. **Usage Tracking**: The `usage_limit` field tracks the last known usage to calculate consumption deltas
4. **Error Handling**: All OpenRouter API failures should be properly handled and logged
5. **Atomic Operations**: Database updates after API key operations must maintain consistency
