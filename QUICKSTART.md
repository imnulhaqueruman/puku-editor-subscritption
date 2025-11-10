# Quick Start Guide

Get the Puku Subscription Service running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Create D1 Database

```bash
npx wrangler d1 create puku-subscription-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "puku-subscription-db"
database_id = "paste-your-database-id-here"
```

## 3. Initialize Database

```bash
npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql
```

## 4. Configure Local Environment

Create `.dev.vars` file:

```bash
cat > .dev.vars << EOF
JWT_SECRET_CLOUD=
PROVISIONING_API_KEY=sk-or-v1-your-openrouter-key
ENVIRONMENT=development
EOF
```

## 5. Start Development Server

```bash
npm run dev
```

## 6. Test the Service

### Health Check

```bash
curl http://localhost:8787/
```

### Create/Get API Key

First, generate a test JWT token or use an existing one, then:

```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 7. Deploy to Production

### Set Production Secrets

```bash
npx wrangler secret put JWT_SECRET_CLOUD
npx wrangler secret put PROVISIONING_API_KEY
```

### Initialize Production Database

```bash
npx wrangler d1 execute puku-subscription-db --file=./schema.sql
```

### Deploy

```bash
npm run deploy
```

## Common Commands

```bash
# Development
npm run dev                    # Start local server
npm run tail                   # View logs

# Database
npm run db:migrate:local       # Apply schema locally
npm run db:migrate             # Apply schema to production

# Deployment
npm run deploy                 # Deploy to production
npm run deploy:staging         # Deploy to staging
```

## Testing with curl

### New User (First Request)

```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer eyJhbGc..." \
  -v
```

Expected: 200 OK with new API key and 10 credits

### Existing User (Subsequent Requests)

Same request, expected: 200 OK with existing key and updated credits

### Invalid Token

```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer invalid-token" \
  -v
```

Expected: 401 Unauthorized

### Missing Authorization

```bash
curl -X POST http://localhost:8787/api/key -v
```

Expected: 401 Unauthorized

## What's Next?

- Read [SETUP.md](./SETUP.md) for detailed setup instructions
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- Review [README.md](./README.md) for API documentation
- See [CLAUDE.md](./CLAUDE.md) for architecture details

## Need Help?

- Check logs: `npm run tail`
- Verify database: `npx wrangler d1 execute puku-subscription-db --local --command="SELECT * FROM users"`
- Test health endpoint: `curl http://localhost:8787/`
