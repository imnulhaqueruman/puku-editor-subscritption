// Business Logic Module
import type { Env, JWTPayload, UserRecord, APIResponse } from './types';
import {
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from './database';
import {
  createOpenRouterKey,
  getOpenRouterKeyStatus,
  deleteOpenRouterKey,
} from './openrouter';

const CREDIT_RESET_THRESHOLD = 0.1;
const KEY_ROTATION_THRESHOLD = 0.5;
const INITIAL_CREDITS = 10.0;
const KEY_DAILY_LIMIT = 1.0;

/**
 * Handles new user creation flow
 * @param env - Environment bindings
 * @param userClaims - JWT user claims
 * @returns API response with new key
 */
async function handleNewUser(
  env: Env,
  userClaims: JWTPayload
): Promise<APIResponse> {
  console.log(`Creating new user: ${userClaims.uid}`);

  try {
    // Create OpenRouter API key
    const keyResponse = await createOpenRouterKey(
      `user-${userClaims.username}`,
      KEY_DAILY_LIMIT,
      env.PROVISIONING_API_KEY
    );

    if (!keyResponse.key || !keyResponse.data.hash) {
      throw new Error('Invalid response from OpenRouter API');
    }

    // Store user in database
    await createUser(env.DB, {
      user_id: userClaims.uid,
      user_name: userClaims.username,
      email: userClaims.email,
      key: keyResponse.key,
      hash: keyResponse.data.hash,
      total_limit: INITIAL_CREDITS,
      remaining_limit: INITIAL_CREDITS,
      usage_limit: KEY_DAILY_LIMIT,
    });

    console.log(`New user created successfully: ${userClaims.uid}`);

    return {
      success: true,
      data: {
        key: keyResponse.key,
        remaining_credits: INITIAL_CREDITS,
        total_credits: INITIAL_CREDITS,
        daily_limit: KEY_DAILY_LIMIT,
      },
    };
  } catch (error) {
    console.error('Error creating new user:', error);
    throw error;
  }
}

/**
 * Handles credit reset when user depletes all credits
 * @param env - Environment bindings
 * @param user - Existing user record
 * @param userClaims - JWT user claims
 * @returns API response with new key
 */
async function handleCreditReset(
  env: Env,
  user: UserRecord,
  userClaims: JWTPayload
): Promise<APIResponse> {
  console.log(`Resetting credits for user: ${user.user_id}`);

  try {
    // Delete old OpenRouter key if it exists
    try {
      await deleteOpenRouterKey(user.hash, env.PROVISIONING_API_KEY);
      console.log(`Deleted old key for user: ${user.user_id}`);
    } catch (error) {
      console.warn(`Failed to delete old key (may not exist): ${error}`);
    }

    // Delete user record
    await deleteUser(env.DB, user.user_id);

    // Create fresh user
    return await handleNewUser(env, userClaims);
  } catch (error) {
    console.error('Error resetting user credits:', error);
    throw error;
  }
}

/**
 * Rotates the OpenRouter API key for a user
 * @param env - Environment bindings
 * @param user - User record
 * @param consumed - Credits consumed since last check
 * @returns Updated user key and remaining credits
 */
async function rotateKey(
  env: Env,
  user: UserRecord,
  consumed: number
): Promise<{ key: string; remainingCredits: number }> {
  console.log(`Rotating key for user: ${user.user_id}`);

  try {
    // Update credits first
    const newRemainingLimit = user.remaining_limit - consumed;

    // Delete old key
    await deleteOpenRouterKey(user.hash, env.PROVISIONING_API_KEY);
    console.log(`Deleted old key: ${user.hash}`);

    // Create new key
    const keyResponse = await createOpenRouterKey(
      `user-${user.user_id}`,
      KEY_DAILY_LIMIT,
      env.PROVISIONING_API_KEY
    );

    if (!keyResponse.key || !keyResponse.data.hash) {
      throw new Error('Invalid response from OpenRouter API during rotation');
    }

    // Update database with new key
    await updateUser(env.DB, user.user_id, {
      key: keyResponse.key,
      hash: keyResponse.data.hash,
      remaining_limit: newRemainingLimit,
      usage_limit: KEY_DAILY_LIMIT,
    });

    console.log(`Key rotated successfully for user: ${user.user_id}`);

    return {
      key: keyResponse.key,
      remainingCredits: newRemainingLimit,
    };
  } catch (error) {
    console.error('Error rotating key:', error);
    throw error;
  }
}

/**
 * Handles existing user flow - checks usage and rotates key if needed
 * @param env - Environment bindings
 * @param user - Existing user record
 * @param userClaims - JWT user claims
 * @returns API response with key
 */
async function handleExistingUser(
  env: Env,
  user: UserRecord,
  userClaims: JWTPayload
): Promise<APIResponse> {
  console.log(`Handling existing user: ${user.user_id}`);

  try {
    // Check if credits are depleted
    if (user.remaining_limit <= CREDIT_RESET_THRESHOLD) {
      console.log(
        `User ${user.user_id} has depleted credits (${user.remaining_limit}), resetting...`
      );
      return await handleCreditReset(env, user, userClaims);
    }

    // Get current key status from OpenRouter
    const keyStatus = await getOpenRouterKeyStatus(
      user.hash,
      env.PROVISIONING_API_KEY
    );

    const limitRemaining = keyStatus.data.limit_remaining;
    console.log(
      `User ${user.user_id} key status - limit_remaining: ${limitRemaining}, usage_limit: ${user.usage_limit}`
    );

    // Calculate consumed credits
    const consumed = user.usage_limit - limitRemaining;
    const newRemainingLimit = user.remaining_limit - consumed;

    // Check if key needs rotation
    if (limitRemaining <= KEY_ROTATION_THRESHOLD) {
      console.log(
        `Key usage below threshold (${limitRemaining}), rotating key...`
      );
      const { key, remainingCredits } = await rotateKey(env, user, consumed);

      return {
        success: true,
        data: {
          key,
          remaining_credits: Math.max(0, remainingCredits),
          total_credits: INITIAL_CREDITS,
          daily_limit: KEY_DAILY_LIMIT,
        },
      };
    }

    // Key is still good, just update credits
    await updateUser(env.DB, user.user_id, {
      remaining_limit: newRemainingLimit,
      usage_limit: limitRemaining,
    });

    console.log(
      `Returning existing key for user ${user.user_id}, remaining credits: ${newRemainingLimit}`
    );

    return {
      success: true,
      data: {
        key: user.key,
        remaining_credits: Math.max(0, newRemainingLimit),
        total_credits: INITIAL_CREDITS,
        daily_limit: KEY_DAILY_LIMIT,
      },
    };
  } catch (error) {
    console.error('Error handling existing user:', error);

    // If key doesn't exist in OpenRouter anymore (404), recreate it
    if (error instanceof Error && error.message.includes('404')) {
      console.log('Key not found in OpenRouter, creating new key...');
      return await rotateKey(env, user, 0);
    }

    throw error;
  }
}

/**
 * Main entry point for getting or creating an API key
 * @param env - Environment bindings
 * @param userClaims - JWT user claims
 * @returns API response with key and credit information
 */
export async function getOrCreateAPIKey(
  env: Env,
  userClaims: JWTPayload
): Promise<APIResponse> {
  try {
    // Check if user exists
    const user = await getUser(env.DB, userClaims.uid);

    if (!user) {
      // New user flow
      return await handleNewUser(env, userClaims);
    }

    // Existing user flow
    return await handleExistingUser(env, user, userClaims);
  } catch (error) {
    console.error('Error in getOrCreateAPIKey:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Internal server error',
    };
  }
}
