System Design: Puku Editor Subscription Service

  1. Overview

  Purpose: A credit-based API key management system that provides users with managed OpenRouter API keys, tracking usage and automatically rotating keys
  to ensure uninterrupted service.

  Core Concept: Each user gets 10 credits total. OpenRouter API keys are provisioned with $1 daily limits and automatically rotated as they're consumed,
  deducting from the user's total credits.

  ---
  2. High-Level Architecture

  ╔═════════════════════════════════════════════════════════════════════╗
  ║                         CLIENT APPLICATION                          ║
  ║                                                                     ║
  ║              POST /api/key                                          ║
  ║              Authorization: Bearer <JWT_TOKEN>                      ║
  ╚═══════════════════════════════╤═════════════════════════════════════╝
                                  │
                                  │ HTTPS Request
                                  │ (Secured by Cloudflare)
                                  │
                                  ▼
  ╔═════════════════════════════════════════════════════════════════════╗
  ║               CLOUDFLARE WORKERS (Edge Network)                     ║
  ║                                                                     ║
  ║  ┌─────────────────────────────────────────────────────────────┐  ║
  ║  │                 1. AUTHENTICATION LAYER                      │  ║
  ║  │                                                               │  ║
  ║  │   • Validate JWT Token                                       │  ║
  ║  │   • Verify Signature (JWT_SECRET_CLOUD)                      │  ║
  ║  │   • Extract Claims: uid, email, username                     │  ║
  ║  └──────────────────────────┬────────────────────────────────────┘  ║
  ║                             │                                       ║
  ║                             ▼                                       ║
  ║  ┌─────────────────────────────────────────────────────────────┐  ║
  ║  │                 2. BUSINESS LOGIC LAYER                      │  ║
  ║  │                                                               │  ║
  ║  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │  ║
  ║  │   │   NEW USER   │  │   EXISTING   │  │     KEY      │     │  ║
  ║  │   │   HANDLER    │  │     USER     │  │   ROTATION   │     │  ║
  ║  │   │              │  │   HANDLER    │  │    LOGIC     │     │  ║
  ║  │   │ • Create DB  │  │ • Check      │  │ • Monitor    │     │  ║
  ║  │   │   Record     │  │   Credits    │  │   Usage      │     │  ║
  ║  │   │ • Provision  │  │ • Verify     │  │ • Delete Old │     │  ║
  ║  │   │   API Key    │  │   Key Status │  │   Key        │     │  ║
  ║  │   │ • Set 10     │  │ • Update     │  │ • Create New │     │  ║
  ║  │   │   Credits    │  │   Usage      │  │   Key        │     │  ║
  ║  │   └──────────────┘  └──────────────┘  └──────────────┘     │  ║
  ║  └────┬──────────────────────┬──────────────────┬──────────────┘  ║
  ║       │                      │                  │                  ║
  ╚═══════┼══════════════════════┼══════════════════┼══════════════════╝
          │                      │                  │
          │                      │                  │
          ▼                      ▼                  ▼
  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐
  │  CLOUDFLARE D1   │  │  OPENROUTER API   │  │   OPENROUTER API   │
  │    DATABASE      │  │                   │  │                    │
  │                  │  │  GET /api/v1/     │  │  POST /api/v1/     │
  │ • User Records   │  │      keys/:hash   │  │       keys         │
  │ • API Keys       │  │                   │  │                    │
  │ • Credit Tracking│  │  • Check Key      │  │  DELETE /api/v1/   │
  │ • Usage History  │  │    Status         │  │         keys/:hash │
  │                  │  │  • Get Remaining  │  │                    │
  │ (SQLite Based)   │  │    Limit          │  │  • Create New Key  │
  │                  │  │                   │  │  • Delete Old Key  │
  └──────────────────┘  └───────────────────┘  └────────────────────┘

  ---
  3. Component Architecture

  3.1 Core Components

  A. Authentication Layer

  - Responsibility: JWT token validation
  - Input: Authorization: Bearer <token> header
  - Output: User claims (uid, email, username)
  - Technology: JWT library with HMAC signing
  - Secret: JWT_SECRET_CLOUD environment variable

  B. Business Logic Layer

  Three primary handlers:

  1. New User Handler
    - Creates first-time user records
    - Provisions initial OpenRouter API key
    - Initializes credit balance
  2. Existing User Handler
    - Checks credit balance and usage
    - Determines if key rotation is needed
    - Updates credit tracking
  3. Key Rotation Service
    - Monitors OpenRouter key usage
    - Rotates keys when threshold is hit
    - Updates database atomically

  C. Data Access Layer

  - Cloudflare D1 Database: User state persistence
  - OpenRouter API Client: External API key management

  ---
  4. Data Models

  4.1 Database Schema (Cloudflare D1)

  CREATE TABLE users (
    user_id TEXT PRIMARY KEY,           -- JWT claim: uid
    user_name TEXT NOT NULL,            -- JWT claim: username
    email TEXT NOT NULL,                -- JWT claim: email
    key TEXT NOT NULL,                  -- OpenRouter API key (sk-or-v1-...)
    hash TEXT NOT NULL,                 -- OpenRouter key hash/ID
    total_limit REAL NOT NULL,          -- Total credits (always 10)
    remaining_limit REAL NOT NULL,      -- Credits remaining
    usage_limit REAL NOT NULL,          -- Last known usage on current key
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_user_id ON users(user_id);

  4.2 Data Flow States

  User State Transitions:

  ╔═══════════════════════════════════════════════════════════════════╗
  ║                          NEW USER REQUEST                         ║
  ╚═══════════════════════════════════════════════════════════════════╝
                                   │
                                   │ User doesn't exist in DB
                                   │
                                   ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │                         CREATE USER                               │
  │                                                                   │
  │  • Create OpenRouter API Key (limit: $1)                         │
  │  • Insert DB Record                                              │
  │  • Set total_limit = 10                                          │
  │  • Set remaining_limit = 10                                      │
  │  • Set usage_limit = 1                                           │
  └───────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                       ACTIVE USER STATE                           ║
  ║                    (remaining_limit > 0.1)                        ║
  ╚═══════════════════════════════════════════════════════════════════╝
                              │
                              │ Every Request
                              │
                              ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │              CHECK OPENROUTER KEY STATUS                          │
  │                                                                   │
  │  GET /api/v1/keys/:hash                                          │
  │  Returns: limit_remaining (e.g., 0.6)                            │
  └───────────────┬───────────────────────────────────────────────────┘
                  │
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
  ┌─────────────┐   ┌─────────────────┐
  │ KEEP KEY    │   │  ROTATE KEY     │
  │             │   │                 │
  │ remaining   │   │  remaining      │
  │   > 0.5     │   │   ≤ 0.5         │
  └──────┬──────┘   └────────┬────────┘
         │                   │
         │                   │ 1. Update credits
         │                   │ 2. Delete old key
         │                   │ 3. Create new key ($1 limit)
         │                   │ 4. Update DB record
         │                   │
         │                   ▼
         │          ┌─────────────────┐
         │          │ NEW KEY ACTIVE  │
         │          │ usage_limit = 1 │
         │          └────────┬────────┘
         │                   │
         └───────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  UPDATE CREDITS       │
         │                       │
         │  consumed = old_usage │
         │            - new_usage│
         │                       │
         │  remaining_limit -=   │
         │            consumed   │
         └───────────┬───────────┘
                     │
                     │
            ┌────────┴─────────┐
            │                  │
            ▼                  ▼
  ┌──────────────────┐  ┌────────────────────┐
  │  CONTINUE ACTIVE │  │   DEPLETED STATE   │
  │                  │  │                    │
  │ remaining > 0.1  │  │ remaining ≤ 0.1    │
  │                  │  │                    │
  │ Return to        │  │ DELETE USER RECORD │
  │ Active State     │  │ Start Fresh:       │
  │                  │  │ • New 10 credits   │
  │                  │  │ • New API key      │
  └──────────────────┘  └────────────────────┘

  ---
  5. API Design

  5.1 Endpoint Specification

  POST /api/key
  Description: Get or create API key for authenticated user
  Headers:
    - Authorization: Bearer <JWT>
  Request Body: None
  Response:
    {
      "key": "sk-or-v1-...",
      "remaining_credits": 9.5,
      "total_credits": 10,
      "daily_limit": 1
    }

  5.2 Error Responses

  {
    "error": "Unauthorized",           // 401: Invalid/missing JWT
    "error": "Forbidden",              // 403: Token expired
    "error": "Insufficient credits",   // 402: remaining_limit ≤ 0.1 and can't reset
    "error": "Service unavailable",    // 503: OpenRouter API failure
    "error": "Internal server error"   // 500: Database/unexpected errors
  }

  ---
  6. Sequence Diagrams

  6.1 New User Flow

  Client          Worker          D1 DB       OpenRouter API
    │                │              │                │
    │─────POST────→  │              │                │
    │  /api/key      │              │                │
    │  + JWT token   │              │                │
    │                │              │                │
    │                │──Validate────│                │
    │                │    JWT       │                │
    │                │              │                │
    │                │──Query user──→               │
    │                │  by user_id  │                │
    │                │              │                │
    │                │←──No record──│                │
    │                │              │                │
    │                │──────────────┼─Create key────→│
    │                │              │  limit: 1     │
    │                │              │                │
    │                │←─────────────┼─Response──────│
    │                │              │  {key, hash}  │
    │                │              │                │
    │                │──Insert user─→               │
    │                │  total: 10   │                │
    │                │  remaining:10│                │
    │                │  usage: 1    │                │
    │                │              │                │
    │                │←──Success────│                │
    │                │              │                │
    │←────200────────│              │                │
    │  {key: "...",  │              │                │
    │   remaining: 10}              │                │

  6.2 Existing User Flow (Key Still Valid)

  Client          Worker          D1 DB       OpenRouter API
    │                │              │                │
    │─────POST────→  │              │                │
    │  /api/key      │              │                │
    │                │              │                │
    │                │──Query user──→               │
    │                │              │                │
    │                │←──User data──│                │
    │                │  remaining:9.5│               │
    │                │  usage: 0.7  │                │
    │                │  hash: "..." │                │
    │                │              │                │
    │                │──────────────┼─GET /keys/:hash→│
    │                │              │                │
    │                │←─────────────┼─Response──────│
    │                │              │limit_remaining:│
    │                │              │     0.6       │
    │                │              │                │
    │                │  [0.6 > 0.5 → Keep key]       │
    │                │              │                │
    │                │──Update user─→               │
    │                │remaining=9.5-│                │
    │                │  (0.7-0.6)   │                │
    │                │= 9.4         │                │
    │                │usage = 0.6   │                │
    │                │              │                │
    │←────200────────│              │                │
    │  {key: "...",  │              │                │
    │   remaining:9.4}              │                │

  6.3 Existing User Flow (Key Rotation)

  Client          Worker          D1 DB       OpenRouter API
    │                │              │                │
    │─────POST────→  │              │                │
    │  /api/key      │              │                │
    │                │              │                │
    │                │──Query user──→               │
    │                │              │                │
    │                │←──User data──│                │
    │                │  remaining:8.5│               │
    │                │  usage: 0.6  │                │
    │                │  hash: "X"   │                │
    │                │              │                │
    │                │──────────────┼─GET /keys/:hash→│
    │                │              │                │
    │                │←─────────────┼─Response──────│
    │                │              │limit_remaining:│
    │                │              │     0.3       │
    │                │              │                │
    │                │  [0.3 ≤ 0.5 → Rotate key]     │
    │                │              │                │
    │                │──Update──────→               │
    │                │remaining=8.5-│                │
    │                │  (0.6-0.3)   │                │
    │                │= 8.2         │                │
    │                │              │                │
    │                │──────────────┼─DELETE /keys/X→│
    │                │              │                │
    │                │←─────────────┼─{deleted:true}─│
    │                │              │                │
    │                │──────────────┼─POST /keys────→│
    │                │              │  limit: 1     │
    │                │              │                │
    │                │←─────────────┼─{key:"Y",─────│
    │                │              │  hash:"Y"}    │
    │                │              │                │
    │                │──Update user─→               │
    │                │  key = "Y"   │                │
    │                │  hash = "Y"  │                │
    │                │  usage = 1   │                │
    │                │              │                │
    │←────200────────│              │                │
    │  {key: "Y",    │              │                │
    │   remaining:8.2}              │                │

  ---
  7. Business Logic Details

  7.1 Credit Calculation Formula

  // When checking existing key usage:
  consumed = usage_limit - limit_remaining
  remaining_limit = remaining_limit - consumed
  usage_limit = limit_remaining

  // Example:
  // Before: remaining_limit=9.5, usage_limit=0.7
  // After API check: limit_remaining=0.4
  // Consumed: 0.7 - 0.4 = 0.3
  // New remaining: 9.5 - 0.3 = 9.2
  // New usage: 0.4

  7.2 Decision Tree

  ╔═════════════════════════════════════════════════════════════════╗
  ║                    REQUEST ARRIVES                              ║
  ║              POST /api/key + JWT Token                          ║
  ╚═══════════════════════════════╤═════════════════════════════════╝
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   VALIDATE JWT TOKEN    │
                    │   (JWT_SECRET_CLOUD)    │
                    └────────┬────────────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
                   Yes                No
                    │                  │
                    ▼                  ▼
         ┌────────────────┐    ┌─────────────────┐
         │ EXTRACT CLAIMS │    │ ❌ 401 ERROR    │
         │ • uid          │    │ "Unauthorized"  │
         │ • email        │    └─────────────────┘
         │ • username     │
         └────────┬───────┘
                  │
                  ▼
         ┌─────────────────────┐
         │ QUERY DATABASE      │
         │ SELECT * FROM users │
         │ WHERE user_id = uid │
         └────────┬────────────┘
                  │
         ┌────────┴─────────┐
         │                  │
      EXISTS            NOT EXISTS
         │                  │
         ▼                  ▼
  ┌────────────────┐  ┌──────────────────────┐
  │ CHECK CREDITS  │  │ 🆕 NEW USER FLOW     │
  │ remaining_limit│  │                      │
  └────────┬───────┘  │ 1. Create API Key    │
           │          │    (OpenRouter)      │
  ┌────────┴────┐     │ 2. Insert DB Record  │
  │             │     │    • total = 10      │
  │             │     │    • remaining = 10  │
 > 0.1       ≤ 0.1    │    • usage = 1       │
  │             │     │ 3. Return Key        │
  │             │     └──────────────────────┘
  │             │
  │             ▼
  │    ┌────────────────────┐
  │    │ 🔄 RESET USER      │
  │    │                    │
  │    │ 1. Delete Record   │
  │    │ 2. Delete Old Key  │
  │    │ 3. Start NEW USER  │
  │    │    FLOW            │
  │    └────────────────────┘
  │
  ▼
  ┌─────────────────────────┐
  │ GET KEY STATUS          │
  │ from OpenRouter API     │
  │ /api/v1/keys/:hash      │
  └────────┬────────────────┘
           │
           │ Returns: limit_remaining
           │
  ┌────────┴───────────┐
  │                    │
  │                    │
  ▼                    ▼
  ┌─────────────┐  ┌──────────────────────┐
  │ > 0.5       │  │ ≤ 0.5                │
  │             │  │                      │
  │ ✅ RETURN   │  │ 🔄 ROTATE KEY        │
  │ EXISTING    │  │                      │
  │ KEY         │  │ 1. Calculate         │
  │             │  │    consumed credits  │
  │ 1. Update   │  │ 2. Update remaining  │
  │    credits  │  │    credits           │
  │ 2. Update   │  │ 3. Delete old key    │
  │    usage    │  │ 4. Create new key    │
  │ 3. Return   │  │    (limit: $1)       │
  │    existing │  │ 5. Update DB         │
  │    key      │  │ 6. Return new key    │
  └─────────────┘  └──────────────────────┘

  ---
  8. Security Architecture

  8.1 Authentication Flow

  1. Client sends JWT (signed by external auth service)
  2. Worker validates signature using JWT_SECRET_CLOUD
  3. Extract claims: uid, email, username
  4. Use uid as primary identifier

  8.2 Security Measures

  | Layer          | Protection       | Implementation                  |
  |----------------|------------------|---------------------------------|
  | Transport      | TLS/HTTPS        | Cloudflare enforced             |
  | Authentication | JWT validation   | HMAC SHA-256                    |
  | Authorization  | User-scoped data | Query by user_id from token     |
  | API Keys       | Secure storage   | D1 database (encrypted at rest) |
  | Secrets        | Environment vars | Cloudflare Workers secrets      |
  | Rate limiting  | Cloudflare       | Built-in DDoS protection        |

  8.3 Sensitive Data Handling

  - JWT Secret: Never logged, stored only in environment
  - API Keys: Stored in D1, returned only to authenticated owner
  - Provisioning Key: Server-side only, never exposed to clients

  ---
  9. Error Handling & Edge Cases

  9.1 Error Scenarios

  | Scenario            | Detection                | Handling                       |
  |---------------------|--------------------------|--------------------------------|
  | JWT expired         | Token validation fails   | 401 + "Token expired"          |
  | OpenRouter API down | HTTP 5xx from OpenRouter | 503 + Retry logic              |
  | D1 database error   | Query exception          | 500 + Log error                |
  | Concurrent requests | Race condition           | D1 transactions                |
  | Credit exhaustion   | remaining_limit ≤ 0.1    | Reset user (delete + recreate) |
  | Key creation fails  | OpenRouter returns error | 500 + Rollback DB changes      |

  9.2 Edge Cases

  Case 1: User depletes all credits
  remaining_limit = 0.05 (≤ 0.1)
  → Delete user record
  → Start fresh with 10 credits
  → Create new OpenRouter key

  Case 2: OpenRouter key already deleted externally
  GET /keys/:hash returns 404
  → Log warning
  → Create new key
  → Update database
  → Return new key to user

  Case 3: Exactly at rotation threshold
  limit_remaining = 0.5 (not ≤ 0.5)
  → Keep existing key
  → Will rotate on next request when it drops below 0.5

  ---
  10. Scalability Considerations

  10.1 Cloudflare Workers Advantages

  - Global edge deployment: Low latency worldwide
  - Auto-scaling: Handles traffic spikes automatically
  - No cold starts: Always warm
  - Cost-effective: Pay per request

  10.2 Database Optimization

  -- Indexes for fast lookups
  CREATE INDEX idx_user_id ON users(user_id);

  -- Query pattern: Always by user_id (primary key)
  SELECT * FROM users WHERE user_id = ?;

  10.3 API Rate Limiting

  OpenRouter API:
  - Provisioning API limits apply
  - Implement exponential backoff on failures
  - Cache user data for short periods (optional)

  Client API:
  - Cloudflare's built-in rate limiting
  - Consider implementing per-user limits if needed

  ---
  11. Monitoring & Observability

  11.1 Key Metrics to Track

  // Request metrics
  - Total requests per minute
  - Success rate (2xx responses)
  - Error rate by type (4xx, 5xx)
  - Average response time

  // Business metrics
  - New users created per day
  - Key rotations per day
  - Average credits consumed per user
  - Users hitting credit limits

  // System health
  - OpenRouter API latency
  - OpenRouter API error rate
  - D1 query latency
  - D1 error rate

  11.2 Logging Strategy

  // Log on key events:
  ✓ New user created
  ✓ Key rotation performed
  ✓ Credits depleted (reset triggered)
  ✗ OpenRouter API errors
  ✗ JWT validation failures
  ✗ Database errors

  ---
  12. Deployment Architecture

  Development → Staging → Production
       │            │          │
       ├─ Local D1  ├─ D1 DB   ├─ D1 DB (prod)
       ├─ Test keys ├─ Test OR ├─ Prod OpenRouter
       └─ wrangler  └─ wrangler └─ wrangler deploy
          dev           deploy       --env production

  Environment Configuration

  # wrangler.toml
  name = "puku-subscription"
  main = "src/index.ts"
  compatibility_date = "2024-01-01"

  [[d1_databases]]
  binding = "DB"
  database_name = "puku-subscription-db"
  database_id = "<your-d1-id>"

  [vars]
  ENVIRONMENT = "production"

  # Secrets (set via wrangler secret put)
  # - JWT_SECRET_CLOUD
  # - PROVISIONING_API_KEY

  ---
  13. Future Enhancements

  1. Usage Analytics Dashboard
    - Track user consumption patterns
    - Predict when users will exhaust credits
  2. Credit Top-up System
    - Allow users to purchase additional credits
    - Integrate payment gateway
  3. Multiple Tier Plans
    - Basic: 10 credits
    - Pro: 50 credits
    - Enterprise: Unlimited
  4. Webhook Notifications
    - Alert users when credits are low
    - Notify on key rotation
  5. Admin API
    - View all users
    - Manually adjust credits
    - Force key rotation

  ---
  This system design provides a robust, scalable solution for managing OpenRouter API keys with automatic rotation and credit tracking, leveraging
  Cloudflare's edge infrastructure for optimal performance. give me a readme with this