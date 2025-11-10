-- Puku Subscription Database Schema
-- This schema tracks users, their OpenRouter API keys, and credit usage

DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL,
  key TEXT NOT NULL,
  hash TEXT NOT NULL,
  total_limit REAL NOT NULL DEFAULT 10.0,
  remaining_limit REAL NOT NULL DEFAULT 10.0,
  usage_limit REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user lookups (though PRIMARY KEY already creates an index)
CREATE INDEX IF NOT EXISTS idx_user_id ON users(user_id);

-- Index for email lookups (optional, for admin queries)
CREATE INDEX IF NOT EXISTS idx_email ON users(email);
