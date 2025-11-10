# Setup Guide - Puku Subscription Service

This guide will walk you through setting up and deploying the Puku Subscription Service.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account
- OpenRouter account with provisioning API key
- Terminal/command line access

## Step 1: Install Dependencies

```bash
npm install
```

This will install:
- Wrangler CLI (Cloudflare Workers development tool)
- Hono (lightweight web framework)
- Jose (JWT library)
- TypeScript and types

## Step 2: Create D1 Database

Create a new D1 database for production:

```bash
npx wrangler d1 create puku-subscription-db
```

You'll see output like:
```
✅ Successfully created DB 'puku-subscription-db'

[[d1_databases]]
binding = "DB"
database_name = "puku-subscription-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the database_id** and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "puku-subscription-db"
database_id = "your-actual-database-id-here"  # Replace this
```

## Step 3: Create Staging Database (Optional)

If you want a staging environment:

```bash
npx wrangler d1 create puku-subscription-db-staging
```

Update the staging section in `wrangler.toml` with the staging database ID.

## Step 4: Initialize Database Schema

Run the SQL migration to create tables:

**For production:**
```bash
npx wrangler d1 execute puku-subscription-db --file=./schema.sql
```

**For local development:**
```bash
npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql
```

**For staging:**
```bash
npx wrangler d1 execute puku-subscription-db-staging --file=./schema.sql
```

## Step 5: Configure Secrets

Set up your environment secrets:

### JWT Secret

```bash
npx wrangler secret put JWT_SECRET_CLOUD
```

When prompted, enter your JWT secret (the same secret used to sign your JWT tokens).

### OpenRouter Provisioning API Key

```bash
npx wrangler secret put PROVISIONING_API_KEY
```

When prompted, enter your OpenRouter provisioning API key (format: `sk-or-v1-...`).

### For Staging Environment

If using staging:

```bash
npx wrangler secret put JWT_SECRET_CLOUD --env staging
npx wrangler secret put PROVISIONING_API_KEY --env staging
```

## Step 6: Test Locally

Start the local development server:

```bash
npm run dev
```

The service will be available at `http://localhost:8787`

Test with curl (replace `YOUR_JWT_TOKEN` with a valid JWT):

```bash
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Step 7: Deploy to Cloudflare

Deploy to production:

```bash
npm run deploy
```

Or deploy to staging:

```bash
npm run deploy:staging
```

You'll see output with your worker URL:
```
Published puku-subscription (X.XX sec)
  https://puku-subscription.your-subdomain.workers.dev
```

## Step 8: Verify Deployment

Test your deployed worker:

```bash
# Health check
curl https://puku-subscription.your-subdomain.workers.dev/

# API endpoint
curl -X POST https://puku-subscription.your-subdomain.workers.dev/api/key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Step 9: Monitor Logs

View real-time logs:

```bash
npm run tail
```

Or with Wrangler directly:

```bash
npx wrangler tail
```

## Database Management

### Query Database

**Production:**
```bash
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT * FROM users LIMIT 10"
```

**Local:**
```bash
npx wrangler d1 execute puku-subscription-db --local \
  --command="SELECT * FROM users"
```

### Check User Count

```bash
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT COUNT(*) as total_users FROM users"
```

### View Specific User

```bash
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT * FROM users WHERE user_id = 'user-id-here'"
```

## Troubleshooting

### Issue: "Database not found"

Make sure you've:
1. Created the D1 database
2. Updated `wrangler.toml` with the correct database_id
3. Run the schema migration

### Issue: "JWT validation failed"

Check that:
1. Your JWT secret is correctly set
2. The JWT token is valid and not expired
3. The token includes required claims: uid, email, username

### Issue: "OpenRouter API error"

Verify:
1. Your PROVISIONING_API_KEY is correct
2. Your OpenRouter account has sufficient quota
3. The key has provisioning permissions

### Issue: Local development not working

Try:
1. Delete `.wrangler` directory
2. Run `npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql` again
3. Restart dev server with `npm run dev`

## Next Steps

- Set up custom domain in Cloudflare dashboard
- Configure rate limiting if needed
- Set up monitoring and alerts
- Review logs regularly with `npm run tail`

## Support

For issues, check:
- Wrangler logs: `npm run tail`
- Database status: Check Cloudflare dashboard
- OpenRouter status: https://openrouter.ai/status
