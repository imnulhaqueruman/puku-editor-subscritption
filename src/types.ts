// Type definitions for the Puku Subscription Service

export interface Env {
  DB: D1Database;
  JWT_SECRET_CLOUD: string;
  PROVISIONING_API_KEY: string;
  ENVIRONMENT?: string;
}

export interface JWTPayload {
  uid: string;
  email: string;
  username: string;
  [key: string]: any;
}

export interface UserRecord {
  user_id: string;
  user_name: string;
  email: string;
  key: string;
  hash: string;
  total_limit: number;
  remaining_limit: number;
  usage_limit: number;
  created_at: string;
  updated_at: string;
}

export interface OpenRouterKeyResponse {
  data: {
    hash: string;
    name: string;
    label: string;
    disabled: boolean;
    limit: number;
    limit_remaining: number;
    limit_reset: string;
    include_byok_in_limit: boolean;
    usage: number;
    usage_daily: number;
    usage_weekly: number;
    usage_monthly: number;
    byok_usage: number;
    byok_usage_daily: number;
    byok_usage_weekly: number;
    byok_usage_monthly: number;
    created_at: string;
    updated_at: string | null;
    id?: string;
  };
  key?: string;
}

export interface CreateKeyPayload {
  name: string;
  limit: number;
  include_byok_in_limit: boolean;
}

export interface APIResponse {
  success: boolean;
  data?: {
    key: string;
    remaining_credits: number;
    total_credits: number;
    daily_limit: number;
  };
  error?: string;
}

export interface DeleteKeyResponse {
  deleted: boolean;
}
