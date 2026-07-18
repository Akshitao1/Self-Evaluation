// Server-side only AWS Secrets Manager Singleton
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const getSecretName = (): string => {
  const secretName = process.env.SECRET_NAME;
  if (!secretName) {
    throw new Error('SECRET_NAME environment variable is required at runtime');
  }
  return secretName;
};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface SecretsCache {
  data: Record<string, string>;
  timestamp: number;
}

export class SecretsManager {
  private static instance: SecretsManager;
  private client: SecretsManagerClient | null = null;
  private cache: SecretsCache | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  private constructor() {
    // Constructor is now lightweight - no AWS client initialization
  }

  private getSecretsClient(): SecretsManagerClient {
    if (!this.client) {
      // Initialize AWS client using default credential provider chain

      this.client = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });
    }
    return this.client;
  }

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Initialize secrets at startup - call this once during app startup
   * Fail fast if AWS is unavailable
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.loadSecrets();
    
    try {
      await this.initializationPromise;
      this.isInitialized = true;
      console.log('🚀 AWS Secrets Manager - Initialization Complete');
      
      // Log cache info after successful initialization
      const cacheInfo = this.getCacheInfo();
      console.log(`   ✅ Status: Ready`);
      console.log(`   📈 Cache: ${cacheInfo.keyCount} secrets loaded`);
    } catch (error) {
      console.error('❌ Secrets Manager initialization failed:', error);
      throw error; // Fail fast
    }
  }

  /**
   * Load secrets from AWS Secrets Manager
   */
  private async loadSecrets(): Promise<void> {
    try {
      const secretName = getSecretName();
      const client = this.getSecretsClient();
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await client.send(command);
      
      if (!response.SecretString) {
        throw new Error(`No secret string found for secret: ${secretName}`);
      }

      const secrets = JSON.parse(response.SecretString);
      
      // Cache with timestamp
      this.cache = {
        data: secrets,
        timestamp: Date.now(),
      };

      const secretCount = Object.keys(secrets).length;
      const secretKeys = Object.keys(secrets).sort();
      
      console.log('🔐 AWS Secrets Manager - Load Complete');
      console.log(`   📊 Total Secrets: ${secretCount}`);
      console.log(`   🔑 Secret Keys: [${secretKeys.join(', ')}]`);
      console.log(`   📍 Secret Name: ${secretName}`);
      console.log(`   🌍 AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
      console.log(`   ⏰ Cached at: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to load secrets from AWS:', error);
      throw error; // Fail fast
    }
  }

  /**
   * Check if cache is still valid (within 1 hour)
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;
    return (Date.now() - this.cache.timestamp) < CACHE_DURATION;
  }

  /**
   * Get all secrets as key-value pairs
   * Returns cached version if valid, otherwise reloads from AWS
   */
  async getAllSecrets(): Promise<Record<string, string>> {
    // Ensure initialization (this will now validate SECRET_NAME at runtime)
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache validity
    if (!this.isCacheValid()) {
      console.log('🔄 AWS Secrets Manager - Cache Refresh');
      console.log('   ⏰ Cache expired, reloading secrets...');
      await this.loadSecrets();
      console.log('   ✅ Cache refreshed successfully');
    }

    if (!this.cache) {
      throw new Error('Failed to load secrets');
    }

    return { ...this.cache.data }; // Return copy to prevent mutation
  }

  /**
   * Get a specific secret value by key
   */
  async getSecret(key: string): Promise<string | undefined> {
    const secrets = await this.getAllSecrets();
    return secrets[key];
  }

  /**
   * Get a specific secret value by key, throw if not found
   */
  async getRequiredSecret(key: string): Promise<string> {
    const value = await this.getSecret(key);
    if (value === undefined) {
      throw new Error(`Required secret '${key}' not found`);
    }
    return value;
  }

  /**
   * Get all secret keys
   */
  async getSecretKeys(): Promise<string[]> {
    const secrets = await this.getAllSecrets();
    return Object.keys(secrets);
  }

  /**
   * Force refresh cache (useful for testing or manual refresh)
   */
  async refreshCache(): Promise<void> {
    console.log('🔄 AWS Secrets Manager - Manual Cache Refresh');
    await this.loadSecrets();
    const cacheInfo = this.getCacheInfo();
    console.log(`   ✅ Manual refresh complete: ${cacheInfo.keyCount} secrets loaded`);
  }

  /**
   * Get cache info for debugging
   */
  getCacheInfo(): { isValid: boolean; age: number; keyCount: number } {
    if (!this.cache) {
      return { isValid: false, age: 0, keyCount: 0 };
    }

    const age = Date.now() - this.cache.timestamp;
    return {
      isValid: this.isCacheValid(),
      age,
      keyCount: Object.keys(this.cache.data).length,
    };
  }
}

// Export singleton instance
export const secretsManager = SecretsManager.getInstance();

// Utility functions for easier usage in server components
export async function getSecret(key: string): Promise<string | undefined> {
  return secretsManager.getSecret(key);
}

export async function getRequiredSecret(key: string): Promise<string> {
  return secretsManager.getRequiredSecret(key);
}

export async function getAllSecrets(): Promise<Record<string, string>> {
  return secretsManager.getAllSecrets();
}

export async function getSecretKeys(): Promise<string[]> {
  return secretsManager.getSecretKeys();
} 