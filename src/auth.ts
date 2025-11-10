// JWT Authentication Module
// Based on the Go auth package pattern with UserClaims validation
import { jwtVerify } from 'jose';
import type { JWTPayload } from './types';

/**
 * Validates JWT token and extracts user claims
 * Matches the Go auth.VerifyToken pattern:
 * - Validates token is present
 * - Checks JWT secret is configured
 * - Validates signing method is HMAC
 * - Extracts UserID, Email, UserName claims
 * - Validates UserID is not empty
 *
 * @param token - JWT token string
 * @param secret - JWT secret for verification
 * @returns User claims if valid, null otherwise
 */
export async function validateJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    // Check if token is empty
    if (!token || token === '') {
      console.error('Token is empty');
      return null;
    }

    // Get JWT secret - equivalent to os.Getenv("JWT_SECRET_CLOUD")
    if (!secret || secret === '') {
      console.error('JWT secret not configured');
      return null;
    }

    // Create a secret key from the string
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    // Parse and validate the token with claims
    // Equivalent to jwt.ParseWithClaims in Go
    const { payload, protectedHeader } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'], // Validate signing method is HMAC
    });

    // Validate signing method (additional explicit check like Go code)
    if (protectedHeader.alg !== 'HS256') {
      console.error(`Unexpected signing method: ${protectedHeader.alg}`);
      return null;
    }

    // Extract user claims matching Go UserClaims struct
    // UserID   string `json:"uid,omitempty"`
    // Email    string `json:"email,omitempty"`
    // UserName string `json:"username,omitempty"`
    const uid = payload.uid as string;
    const email = payload.email as string;
    const username = payload.username as string;

    // Log JWT claims for debugging (like Go code)
    console.log('JWT claims:', { uid, email, username });

    // Check if UserID is empty (critical validation from Go code)
    if (!uid || uid === '') {
      console.log('WARNING: UserID is empty in the JWT token');
      return null;
    }

    // Return validated user claims
    return {
      uid,
      email: email || '',
      username: username || '',
      ...payload,
    };
  } catch (error) {
    // Token validation failed - could be expired or invalid signature
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        console.error('Token is expired');
      } else {
        console.error('Token validation failed:', error.message);
      }
    } else {
      console.error('Token validation failed:', error);
    }
    return null;
  }
}

/**
 * Extracts Bearer token from Authorization header
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
