// Server-side only AWS operations
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getAwsSecretName } from '@/config/aws';

interface SecretRequest {
  secretName?: string;
  key?: string;
  region?: string;
}

interface SecretResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class AWSProxyService {
  private static instance: AWSProxyService;
  private secretsClient: SecretsManagerClient | null = null;

  private constructor() {}

  static getInstance(): AWSProxyService {
    if (!AWSProxyService.instance) {
      AWSProxyService.instance = new AWSProxyService();
    }
    return AWSProxyService.instance;
  }

  private getSecretsClient(): SecretsManagerClient {
    if (!this.secretsClient) {
      const config = {
        region: process.env.AWS_REGION || 'us-east-1',
      };
      this.secretsClient = new SecretsManagerClient(config);
    }
    return this.secretsClient;
  }

  // Get secret value securely (server-side only)
  async getSecret(request: SecretRequest): Promise<SecretResponse> {
    try {
      const client = this.getSecretsClient();
      const secretName = request.secretName || getAwsSecretName();
      
      if (!secretName) {
        return { success: false, error: 'Secret name not provided' };
      }

      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await client.send(command);
      
      if (!response.SecretString) {
        return { success: false, error: 'Secret value not found' };
      }

      const secrets = JSON.parse(response.SecretString);
      
      // If specific key requested, return only that
      if (request.key) {
        const value = secrets[request.key];
        if (value === undefined) {
          return { success: false, error: `Key '${request.key}' not found` };
        }
        return { success: true, data: { key: request.key, value } };
      }

      // Return all keys (without values for security)
      return { 
        success: true, 
        data: {
          secretName,
          keys: Object.keys(secrets),
          count: Object.keys(secrets).length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('AWS Proxy Error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to retrieve secret' 
      };
    }
  }

  // Validate AWS connection (server-side only)
  async validateConnection(): Promise<SecretResponse> {
    try {
      const client = this.getSecretsClient();
      const secretName = getAwsSecretName();
      
      if (!secretName) {
        return { success: false, error: 'No secret name configured' };
      }

      const command = new GetSecretValueCommand({ SecretId: secretName });
      await client.send(command);
      
      return { 
        success: true, 
        data: { message: 'AWS connection successful', timestamp: new Date().toISOString() }
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `AWS connection failed: ${error.message}` 
      };
    }
  }
}

// Export singleton instance
export const awsProxy = AWSProxyService.getInstance(); 