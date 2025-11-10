# API Documentation

## Base URL

- Production: `https://puku-subscription.your-subdomain.workers.dev`
- Development: `http://localhost:8787`

## Authentication

All API requests (except health check) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

### JWT Token Requirements

The JWT must be signed with the configured `JWT_SECRET_CLOUD` and include:

```json
{
  "uid": "user-unique-identifier",
  "email": "user@example.com",
  "username": "username"
}
```

## Endpoints

### GET /

Health check endpoint

**Request:**
```bash
curl https://your-worker.workers.dev/
```

**Response: 200 OK**
```json
{
  "service": "Puku Subscription Service",
  "status": "running",
  "version": "1.0.0",
  "environment": "production"
}
```

---

### POST /api/key

Get or create an OpenRouter API key for the authenticated user.

**Request:**
```bash
curl -X POST https://your-worker.workers.dev/api/key \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

**Success Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "key": "sk-or-v1-abcdef123456...",
    "remaining_credits": 9.5,
    "total_credits": 10,
    "daily_limit": 1
  }
}
```

**Error Responses:**

#### 401 Unauthorized - Missing Token
```json
{
  "success": false,
  "error": "Authorization header missing or invalid"
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

#### 503 Service Unavailable - OpenRouter API Down
```json
{
  "success": false,
  "error": "Failed to create OpenRouter key: 503 - Service Unavailable"
}
```

---

## Response Fields

### Success Response

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always `true` for successful requests |
| data.key | string | OpenRouter API key (format: `sk-or-v1-...`) |
| data.remaining_credits | number | Credits remaining for the user (0-10) |
| data.total_credits | number | Total credits allocated (always 10) |
| data.daily_limit | number | Daily limit for each key (always 1) |

### Error Response

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always `false` for errors |
| error | string | Human-readable error message |

---

## Usage Flow

### First-Time User

1. User sends request with valid JWT
2. System creates new OpenRouter API key with $1 daily limit
3. User record created in database with 10 credits
4. Returns API key and credit information

**Example:**
```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "sk-or-v1-new-key-here",
    "remaining_credits": 10,
    "total_credits": 10,
    "daily_limit": 1
  }
}
```

### Existing User - Key Still Valid

1. User sends request with valid JWT
2. System checks OpenRouter key usage
3. If usage > $0.50 remaining, returns existing key
4. Updates credit tracking based on consumption

**Example:**
```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "sk-or-v1-existing-key",
    "remaining_credits": 9.3,
    "total_credits": 10,
    "daily_limit": 1
  }
}
```

### Existing User - Key Rotation

1. User sends request with valid JWT
2. System checks OpenRouter key usage
3. If usage ≤ $0.50 remaining, rotates key:
   - Deletes old key
   - Creates new key with $1 limit
   - Deducts used credits from total
4. Returns new key

**Example:**
```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "sk-or-v1-new-rotated-key",
    "remaining_credits": 8.7,
    "total_credits": 10,
    "daily_limit": 1
  }
}
```

### Credit Depletion - Auto Reset

1. User sends request with valid JWT
2. System detects remaining_credits ≤ 0.1
3. Deletes old user record and OpenRouter key
4. Creates fresh user with 10 new credits
5. Returns new key

**Example:**
```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "sk-or-v1-fresh-key",
    "remaining_credits": 10,
    "total_credits": 10,
    "daily_limit": 1
  }
}
```

---

## Credit System

### How Credits Work

- Each user starts with **10 credits**
- Each API key has a **$1 daily limit**
- Credits are deducted as the key is used
- When a key's remaining limit drops to $0.50 or less, it's rotated
- When total credits drop to 0.1 or less, user is reset with 10 fresh credits

### Credit Calculation

```
consumed_credits = previous_usage - current_remaining
remaining_credits = remaining_credits - consumed_credits
```

**Example:**
```
Initial state: remaining_credits = 9.5, usage_limit = 0.7
After check: limit_remaining = 0.4

Consumed: 0.7 - 0.4 = 0.3
New remaining: 9.5 - 0.3 = 9.2
New usage: 0.4
```

---

## Rate Limiting

- Cloudflare Workers have built-in DDoS protection
- No explicit per-user rate limiting (add if needed)
- OpenRouter API has its own rate limits

---

## Error Handling

### Client Errors (4xx)

- **401 Unauthorized**: Invalid or missing JWT token
- **404 Not Found**: Invalid endpoint

### Server Errors (5xx)

- **500 Internal Server Error**: Database error or unexpected failure
- **503 Service Unavailable**: OpenRouter API is down or unreachable

---

## Testing

### Using curl

```bash
# Set your JWT token
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get API key
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -v
```

### Using Postman

1. Set request type to `POST`
2. Enter URL: `http://localhost:8787/api/key`
3. Go to Headers tab:
   - Key: `Authorization`
   - Value: `Bearer YOUR_JWT_TOKEN`
   - Key: `Content-Type`
   - Value: `application/json`
4. Send request

### Using JavaScript

```javascript
const response = await fetch('https://your-worker.workers.dev/api/key', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

---

## CORS

The API supports CORS with the following configuration:

- **Origin**: `*` (all origins allowed)
- **Methods**: `POST`, `GET`, `OPTIONS`
- **Headers**: `Content-Type`, `Authorization`

---

## Best Practices

1. **Cache the API key**: Don't request a new key for every OpenRouter API call
2. **Handle errors gracefully**: Implement retry logic for 503 errors
3. **Monitor credits**: Track remaining_credits in your application
4. **Secure JWT tokens**: Never expose JWT tokens in client-side code
5. **Set token expiration**: Use short-lived JWT tokens (e.g., 1 hour)

---

## Support

For issues or questions:
- Check [SETUP.md](./SETUP.md) for setup help
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
- See [README.md](./README.md) for general documentation
