// Database Operations Module
import type { UserRecord } from './types';

/**
 * Gets a user from the database by user_id
 * @param db - D1 database instance
 * @param userId - User ID to lookup
 * @returns User record or null if not found
 */
export async function getUser(
  db: D1Database,
  userId: string
): Promise<UserRecord | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE user_id = ?')
    .bind(userId)
    .first<UserRecord>();

  return result;
}

/**
 * Creates a new user in the database
 * @param db - D1 database instance
 * @param user - User data to insert
 */
export async function createUser(
  db: D1Database,
  user: Omit<UserRecord, 'created_at' | 'updated_at'>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (user_id, user_name, email, key, hash, total_limit, remaining_limit, usage_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      user.user_id,
      user.user_name,
      user.email,
      user.key,
      user.hash,
      user.total_limit,
      user.remaining_limit,
      user.usage_limit
    )
    .run();
}

/**
 * Updates user credit tracking and key information
 * @param db - D1 database instance
 * @param userId - User ID to update
 * @param updates - Fields to update
 */
export async function updateUser(
  db: D1Database,
  userId: string,
  updates: {
    key?: string;
    hash?: string;
    remaining_limit?: number;
    usage_limit?: number;
  }
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.key !== undefined) {
    fields.push('key = ?');
    values.push(updates.key);
  }
  if (updates.hash !== undefined) {
    fields.push('hash = ?');
    values.push(updates.hash);
  }
  if (updates.remaining_limit !== undefined) {
    fields.push('remaining_limit = ?');
    values.push(updates.remaining_limit);
  }
  if (updates.usage_limit !== undefined) {
    fields.push('usage_limit = ?');
    values.push(updates.usage_limit);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');

  const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
  values.push(userId);

  await db.prepare(query).bind(...values).run();
}

/**
 * Deletes a user from the database
 * @param db - D1 database instance
 * @param userId - User ID to delete
 */
export async function deleteUser(
  db: D1Database,
  userId: string
): Promise<void> {
  await db.prepare('DELETE FROM users WHERE user_id = ?').bind(userId).run();
}

/**
 * Gets all users (for admin purposes)
 * @param db - D1 database instance
 * @param limit - Maximum number of users to return
 * @returns Array of user records
 */
export async function getAllUsers(
  db: D1Database,
  limit: number = 100
): Promise<UserRecord[]> {
  const result = await db
    .prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<UserRecord>();

  return result.results || [];
}
