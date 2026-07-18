// Additional utility functions for AWS Secrets Manager
import { getSecret, getRequiredSecret, getAllSecrets } from './secrets-manager';

/**
 * Get multiple secrets at once
 */
export async function getSecrets(keys: string[]): Promise<Record<string, string | undefined>> {
  const allSecrets = await getAllSecrets();
  const result: Record<string, string | undefined> = {};
  
  for (const key of keys) {
    result[key] = allSecrets[key];
  }
  
  return result;
}

/**
 * Get multiple required secrets at once - throws if any are missing
 */
export async function getRequiredSecrets(keys: string[]): Promise<Record<string, string>> {
  const allSecrets = await getAllSecrets();
  const result: Record<string, string> = {};
  const missing: string[] = [];
  
  for (const key of keys) {
    const value = allSecrets[key];
    if (value === undefined) {
      missing.push(key);
    } else {
      result[key] = value;
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Required secrets missing: ${missing.join(', ')}`);
  }
  
  return result;
}

/**
 * Check if a secret exists without retrieving its value
 */
export async function hasSecret(key: string): Promise<boolean> {
  try {
    const value = await getSecret(key);
    return value !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get secret with a default value
 */
export async function getSecretWithDefault(key: string, defaultValue: string): Promise<string> {
  const value = await getSecret(key);
  return value ?? defaultValue;
}

/**
 * Get database connection string from secrets
 * Common pattern for database URLs
 */
export async function getDatabaseUrl(): Promise<string> {
  return getRequiredSecret('database_url');
}

/**
 * Get API configuration from secrets
 * Common pattern for external API configurations
 */
export async function getApiConfig(): Promise<{
  apiKey: string;
  apiUrl?: string;
  timeout?: number;
}> {
  const apiKey = await getRequiredSecret('api_key');
  const apiUrl = await getSecret('api_url');
  const timeoutStr = await getSecret('api_timeout');
  
  return {
    apiKey,
    apiUrl,
    timeout: timeoutStr ? parseInt(timeoutStr, 10) : undefined,
  };
}

/**
 * Get JWT configuration from secrets
 */
export async function getJwtConfig(): Promise<{
  secret: string;
  expiresIn?: string;
  issuer?: string;
}> {
  const secret = await getRequiredSecret('jwt_secret');
  const expiresIn = await getSecret('jwt_expires_in');
  const issuer = await getSecret('jwt_issuer');
  
  return {
    secret,
    expiresIn,
    issuer,
  };
}

/**
 * Validate that all required secrets are available
 * Useful for health checks
 */
export async function validateRequiredSecrets(requiredKeys: string[]): Promise<{
  valid: boolean;
  missing: string[];
  available: string[];
}> {
  const allSecrets = await getAllSecrets();
  const available: string[] = [];
  const missing: string[] = [];
  
  for (const key of requiredKeys) {
    if (allSecrets[key] !== undefined) {
      available.push(key);
    } else {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    available,
  };
}