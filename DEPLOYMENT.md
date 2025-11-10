# Deployment Guide

## Quick Deploy Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] D1 database created and ID added to `wrangler.toml`
- [ ] Database schema applied
- [ ] Secrets configured (`JWT_SECRET_CLOUD`, `PROVISIONING_API_KEY`)
- [ ] Local testing completed
- [ ] Ready to deploy

## Deployment Commands

### Production Deployment

```bash
# Deploy to production
npm run deploy

# Or with wrangler directly
npx wrangler deploy
```

### Staging Deployment

```bash
# Deploy to staging environment
npm run deploy:staging

# Or with wrangler directly
npx wrangler deploy --env staging
```

## Post-Deployment Verification

### 1. Check Health Endpoint

```bash
curl https://puku-subscription.your-subdomain.workers.dev/
```

Expected response:
```json
{
  "service": "Puku Subscription Service",
  "status": "running",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. Test API Endpoint

Generate a test JWT token and test:

```bash
curl -X POST https://puku-subscription.your-subdomain.workers.dev/api/key \
  -H "Authorization: Bearer YOUR_TEST_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response for new user:
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

### 3. Monitor Logs

```bash
npm run tail
```

Watch for:
- Successful requests
- Any error messages
- OpenRouter API calls
- Database operations

## Custom Domain Setup

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker (`puku-subscription`)
4. Go to Settings > Triggers
5. Click "Add Custom Domain"
6. Enter your domain (e.g., `api.yourdomain.com`)
7. Follow DNS configuration instructions

## Environment-Specific Configuration

### Production

```toml
# wrangler.toml
name = "puku-subscription"
[vars]
ENVIRONMENT = "production"
```

### Staging

```toml
# wrangler.toml
[env.staging]
name = "puku-subscription-staging"
[env.staging.vars]
ENVIRONMENT = "staging"
```

## Rollback Procedure

If you need to rollback a deployment:

```bash
# List recent deployments
npx wrangler deployments list

# Rollback to specific deployment
npx wrangler rollback [deployment-id]
```

## Monitoring & Observability

### View Real-time Logs

```bash
npx wrangler tail --format pretty
```

### Check Analytics

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. View Analytics tab for:
   - Request count
   - Error rate
   - CPU time
   - Success rate

### Set Up Alerts

Consider setting up alerts for:
- High error rates (>5%)
- Increased latency (>1s)
- OpenRouter API failures
- Database errors

## Database Maintenance

### Backup Database

```bash
# Export all users
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT * FROM users" \
  --json > backup-$(date +%Y%m%d).json
```

### Clean Up Test Data

```bash
# Remove test users (be careful!)
npx wrangler d1 execute puku-subscription-db \
  --command="DELETE FROM users WHERE email LIKE '%test%'"
```

### Check Database Stats

```bash
# User count
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT COUNT(*) as total FROM users"

# Average remaining credits
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT AVG(remaining_limit) as avg_credits FROM users"

# Users near depletion
npx wrangler d1 execute puku-subscription-db \
  --command="SELECT user_id, email, remaining_limit FROM users WHERE remaining_limit < 1"
```

## Security Best Practices

1. **Rotate Secrets Regularly**
   ```bash
   npx wrangler secret put JWT_SECRET_CLOUD
   npx wrangler secret put PROVISIONING_API_KEY
   ```

2. **Monitor Failed Auth Attempts**
   - Check logs for 401 errors
   - Set up alerts for spike in auth failures

3. **Review Access Logs**
   - Use Cloudflare Analytics
   - Look for unusual patterns

4. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm update
   ```

## Performance Optimization

### Enable Caching (Optional)

If you want to cache responses temporarily:

```typescript
// Add to your worker
c.header('Cache-Control', 'private, max-age=60');
```

### Monitor Response Times

Target metrics:
- P50: < 200ms
- P95: < 500ms
- P99: < 1000ms

## Troubleshooting Deployment Issues

### Issue: Deployment fails with "Database not found"

```bash
# Verify database exists
npx wrangler d1 list

# Check wrangler.toml has correct database_id
cat wrangler.toml | grep database_id
```

### Issue: Secrets not working

```bash
# List secrets (shows names only, not values)
npx wrangler secret list

# Re-set secret
npx wrangler secret put SECRET_NAME
```

### Issue: Worker not responding

```bash
# Check worker status
npx wrangler deployments list

# View recent errors
npx wrangler tail --format pretty
```

## Scaling Considerations

Cloudflare Workers automatically scale, but consider:

1. **D1 Limits**:
   - 100,000 reads/day (free tier)
   - 1,000 writes/day (free tier)
   - Upgrade to paid plan for higher limits

2. **Worker Limits**:
   - CPU time: 10ms (free), 50ms (paid)
   - Request limit: 100,000/day (free), unlimited (paid)

3. **OpenRouter Limits**:
   - Check your provisioning API rate limits
   - Monitor quota usage

## Cost Estimation

**Free Tier:**
- Workers: 100,000 requests/day
- D1: 100,000 reads/day, 1,000 writes/day
- Estimated: $0/month for moderate usage

**Paid Tier:**
- Workers: $5/month + $0.50 per million requests
- D1: Varies based on usage
- Estimated: $5-20/month for production workloads

## Support & Resources

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- D1 Documentation: https://developers.cloudflare.com/d1/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- OpenRouter API: https://openrouter.ai/docs
