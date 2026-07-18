// src/config/aws.ts

/**
 * Returns the AWS Secrets Manager secret name to use.
 * Reads from the SECRET_NAME environment variable, or falls back to a default.
 */
export function getAwsSecretName(): string {
  return process.env.SECRET_NAME;
} 