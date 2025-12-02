# Quick Start Guide - Deploy to Cloudflare Workers

Get the Puku Subscription Service deployed to Cloudflare Workers in 10 minutes!

## Prerequisites

Before you begin, make sure you have:

- ✅ Node.js 18 or higher installed
- ✅ A Cloudflare account ([Sign up free](https://dash.cloudflare.com/sign-up))
- ✅ An OpenRouter account with a provisioning API key ([Get one](https://openrouter.ai/keys))
- ✅ Your JWT secret (the same secret used to sign your JWT tokens)

## Step 1: Clone and Install

```bash
# Clone the repository (or navigate to your project directory)
cd puku-editor-subscription

# Install dependencies
npm install
```

## Step 2: Authenticate with Cloudflare

Login to your Cloudflare account via Wrangler CLI:

```bash
npx wrangler login
```

This will open a browser window. Log in and authorize Wrangler to access your Cloudflare account.

To verify authentication:
```bash
npx wrangler whoami
```

## Step 3: Create D1 Database (Production)

```bash
npx wrangler d1 create puku-subscription-db
```

**You'll see output like this:**
```
✅ Successfully created DB 'puku-subscription-db'

[[d1_databases]]
binding = "DB"
database_name = "puku-subscription-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Important:** Copy the `database_id` and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "puku-subscription-db"
database_id = "paste-your-actual-database-id-here"  # ⚠️ Replace this!
```

## Step 4: Initialize Production Database

Apply the database schema to your production D1 database:

```bash
 npx wrangler d1 execute puku-subscription-db --remote --file=./schema.sql
```

You should see: `🚣 Executed 3 commands in 0.Xms`

## Step 5: Configure Production Secrets

Set your environment secrets (these are encrypted and stored securely in Cloudflare):

```bash
# Set JWT secret
npx wrangler secret put JWT_SECRET_CLOUD
# When prompted, paste your JWT secret and press Enter

# Set OpenRouter provisioning API key
npx wrangler secret put PROVISIONING_API_KEY
# When prompted, paste your OpenRouter key (sk-or-v1-...) and press Enter
```

## Step 6: Deploy to Cloudflare Workers 🚀

```bash
npm run deploy
```

**Expected output:**
```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded puku-subscription (x.xx sec)
Published puku-subscription (x.xx sec)
  https://puku-subscription.your-subdomain.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

🎉 **Your service is now live!** Copy the URL for testing.

## Step 7: Test Your Deployment

Test the health endpoint:

```bash
curl https://puku-subscription.your-subdomain.workers.dev/
```

**Expected response:**
```json
{
  "service": "Puku Subscription Service",
  "status": "running",
  "version": "1.0.0",
  "environment": "development"
}
```

Test with a JWT token:

```bash
curl -X POST https://puku-subscription.poridhiclasses5.workers.dev/api/key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected response (new user):**
```json
{
  "success": true,
  "data": {
    "key": "sk-or-v1-...",
    "remaining_credits": 10,
    "total_credits": 10,
    "daily_limit": 1
  }
}
```

---

## 🧪 Optional: Local Development Setup

If you want to test locally before deploying:

### Configure Local Environment

Create `.dev.vars` file:

```bash
cat > .dev.vars << EOF
JWT_SECRET_CLOUD=your-jwt-secret-here
PROVISIONING_API_KEY=sk-or-v1-your-openrouter-key
EOF
```

### Initialize Local Database

```bash
npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql
```

### Start Development Server

```bash
npm run dev
```

The service will be available at `http://localhost:8787`

### Test Locally

```bash
# Health check
curl http://localhost:8787/

# Test with JWT token
curl -X POST http://localhost:8787/api/key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📊 Monitor Your Deployment

### View Real-time Logs

```bash
npm run tail
```

### Check Database

```bash
# View all users
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT * FROM users LIMIT 10"

# Count total users
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT COUNT(*) as total FROM users"

# Check users with low credits
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT user_id, email, remaining_limit FROM users WHERE remaining_limit < 2"
```

### View Deployment Info

```bash
# List recent deployments
npx wrangler deployments list

# View worker details
npx wrangler whoami
```

---

## 🔄 Update Your Deployment

After making code changes:

```bash
# Deploy new version
npm run deploy

# Or deploy to staging first
npm run deploy:staging
```

---

## 🌐 Set Up Custom Domain (Optional)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click on your worker (`puku-subscription`)
4. Go to **Settings** → **Triggers**
5. Click **Add Custom Domain**
6. Enter your domain (e.g., `api.yourdomain.com`)
7. Follow DNS configuration instructions

---

## ⚡ Quick Reference Commands

```bash
# Development
npm run dev                    # Start local development server
npm run tail                   # View real-time logs
npm test                       # Run tests

# Database
npm run db:migrate:local       # Apply schema to local database
npm run db:migrate             # Apply schema to production

# Deployment
npm run deploy                 # Deploy to production
npm run deploy:staging         # Deploy to staging

# Secrets Management
npx wrangler secret list                    # List all secrets
npx wrangler secret put SECRET_NAME         # Set a secret
npx wrangler secret delete SECRET_NAME      # Delete a secret
```

---

## 🐛 Troubleshooting

### Issue: "Database not found"

**Solution:**
```bash
# Verify database exists
npx wrangler d1 list

# Check wrangler.toml has correct database_id
cat wrangler.toml | grep database_id

# Recreate if needed
npx wrangler d1 create puku-subscription-db
```

### Issue: "Unauthorized" or "JWT validation failed"

**Causes:**
- JWT secret not set correctly
- Token is expired
- Token missing required claims (uid, email, username)

**Solution:**
```bash
# Re-set JWT secret
npx wrangler secret put JWT_SECRET_CLOUD

# Verify your JWT token includes: uid, email, username
# Use https://jwt.io to decode and verify your token
```

### Issue: "OpenRouter API error"

**Causes:**
- PROVISIONING_API_KEY not set or invalid
- OpenRouter account has insufficient quota
- Key lacks provisioning permissions

**Solution:**
```bash
# Re-set OpenRouter key
npx wrangler secret put PROVISIONING_API_KEY

# Verify key format: should start with sk-or-v1-
# Check OpenRouter dashboard for quota and permissions
```

### Issue: Deployment fails

**Solution:**
```bash
# Ensure you're logged in
npx wrangler login
npx wrangler whoami

# Clear cache and retry
rm -rf .wrangler
npm run deploy
```

### Issue: Local development not working

**Solution:**
```bash
# Delete local database and recreate
rm -rf .wrangler

# Reinitialize local database
npx wrangler d1 execute puku-subscription-db --local --file=./schema.sql

# Restart dev server
npm run dev
```

---

## 📚 Additional Resources

- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[API.md](./API.md)** - Complete API documentation
- **[CLAUDE.md](./CLAUDE.md)** - Architecture and development guide
- **[Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)** - Official documentation
- **[OpenRouter API Docs](https://openrouter.ai/docs)** - OpenRouter documentation

---

## 🎯 Next Steps

After deployment:

1. **Set up monitoring** - Use `npm run tail` to watch logs
2. **Configure custom domain** - Follow the custom domain setup above
3. **Set up staging environment** - Create staging database and deploy
4. **Implement rate limiting** - Add rate limiting if needed
5. **Monitor costs** - Check Cloudflare and OpenRouter usage

---

## 💡 Pro Tips

- **Always test locally first** - Use `npm run dev` before deploying
- **Use staging environment** - Deploy to staging before production
- **Monitor your logs** - Run `npm run tail` during testing
- **Keep secrets secure** - Never commit `.dev.vars` to git
- **Check database regularly** - Monitor user credits and usage
- **Set up alerts** - Configure Cloudflare alerts for errors

---

## ✅ Deployment Checklist

Before going to production:

- [ ] All secrets configured (`JWT_SECRET_CLOUD`, `PROVISIONING_API_KEY`)
- [ ] Database initialized with schema
- [ ] Health endpoint returns 200 OK
- [ ] API endpoint tested with valid JWT token
- [ ] Logs are clean (no errors in `npm run tail`)
- [ ] OpenRouter provisioning key has sufficient quota
- [ ] Custom domain configured (optional)
- [ ] Monitoring/alerting set up (optional)

**🚀 You're ready to go live!**
