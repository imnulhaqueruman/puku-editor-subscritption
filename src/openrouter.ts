// OpenRouter API Client
import type {
  OpenRouterKeyResponse,
  CreateKeyPayload,
  DeleteKeyResponse,
} from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/keys';

/**
 * Creates a new OpenRouter API key
 * @param name - Name/label for the API key
 * @param limit - Daily credit limit
 * @param provisioningKey - OpenRouter provisioning API key
 * @returns OpenRouter key response
 */
export async function createOpenRouterKey(
  name: string,
  limit: number,
  provisioningKey: string
): Promise<OpenRouterKeyResponse> {
  const payload: CreateKeyPayload = {
    name,
    limit,
    include_byok_in_limit: false,
  };

  const response = await fetch(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provisioningKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create OpenRouter key: ${response.status} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Gets the status and usage of an OpenRouter API key
 * @param hash - OpenRouter key hash/identifier
 * @param provisioningKey - OpenRouter provisioning API key
 * @returns Key status and usage information
 */
export async function getOpenRouterKeyStatus(
  hash: string,
  provisioningKey: string
): Promise<OpenRouterKeyResponse> {
  const url = `${OPENROUTER_BASE_URL}/${hash}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${provisioningKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get OpenRouter key status: ${response.status} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Deletes an OpenRouter API key
 * @param hash - OpenRouter key hash/identifier
 * @param provisioningKey - OpenRouter provisioning API key
 * @returns Deletion confirmation
 */
export async function deleteOpenRouterKey(
  hash: string,
  provisioningKey: string
): Promise<DeleteKeyResponse> {
  const url = `${OPENROUTER_BASE_URL}/${hash}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${provisioningKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete OpenRouter key: ${response.status} - ${errorText}`
    );
  }

  return await response.json();
}
