// Main Worker Entry Point
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, APIResponse } from './types';
import { validateJWT, extractBearerToken } from './auth';
import { getOrCreateAPIKey } from './business-logic';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    service: 'Puku Subscription Service',
    status: 'running',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'unknown',
  });
});

// Main API endpoint - Get or create API key
// Authentication is done inline (NOT as middleware) following Go auth.VerifyToken pattern
app.post('/api/key', async (c) => {
  try {
    // Get the Authorization header (like Go: r.Header.Get("Authorization"))
    const authHeader = c.req.header('Authorization');

    if (!authHeader || authHeader === '') {
      console.error('Authorization header missing');
      return c.json<APIResponse>(
        {
          success: false,
          error: 'Authorization header missing',
        },
        403 // Using 403 Forbidden like the Go code
      );
    }

    // Split the token from the "Bearer " prefix
    // Equivalent to: strings.Split(authHeader, "Bearer ")
    const token = extractBearerToken(authHeader);

    if (!token) {
      console.error('Token missing from authorization header');
      return c.json<APIResponse>(
        {
          success: false,
          error: 'Token missing from authorization header',
        },
        403 // Using 403 Forbidden like the Go code
      );
    }

    // Validate JWT secret is configured
    if (!c.env.JWT_SECRET_CLOUD || c.env.JWT_SECRET_CLOUD === '') {
      console.error('JWT_SECRET_CLOUD environment variable not set');
      return c.json<APIResponse>(
        {
          success: false,
          error: 'Internal server error',
        },
        500
      );
    }

    // Parse and validate the token (equivalent to jwt.ParseWithClaims in Go)
    const userClaims = await validateJWT(token, c.env.JWT_SECRET_CLOUD);

    if (!userClaims) {
      // Token validation failed - could be expired or invalid
      return c.json<APIResponse>(
        {
          success: false,
          error: 'Unauthorized',
        },
        401
      );
    }

    // User is authenticated, proceed with business logic
    console.log(`Authenticated user: ${userClaims.uid}`);


    // Validate required environment variables
    if (!c.env.PROVISIONING_API_KEY) {
      console.error('PROVISIONING_API_KEY not configured');
      return c.json<APIResponse>(
        {
          success: false,
          error: 'Service configuration error',
        },
        500
      );
    }

    if (!c.env.DB) {
      console.error('Database not configured');
      return c.json<APIResponse>(
        {
          success: false,
          error: 'Service configuration error',
        },
        500
      );
    }

    // Get or create API key
    const result = await getOrCreateAPIKey(c.env, userClaims);

    if (!result.success) {
      // Determine appropriate status code
      if (result.error?.includes('OpenRouter')) {
        return c.json<APIResponse>(result, 503);
      }
      return c.json<APIResponse>(result, 500);
    }

    return c.json<APIResponse>(result, 200);
  } catch (error) {
    console.error('Unexpected error in /api/key:', error);
    return c.json<APIResponse>(
      {
        success: false,
        error: 'Internal server error',
      },
      500
    );
  }
});

// Error handling for 404
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Endpoint not found',
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Global error handler:', err);
  return c.json(
    {
      success: false,
      error: 'An unexpected error occurred',
    },
    500
  );
});

export default app;
