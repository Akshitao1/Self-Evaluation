// Server component to initialize secrets on app startup
import { initializeApp } from '@/lib/startup';

/**
 * Server component that initializes AWS Secrets Manager on app startup
 * This runs once per server instance when the app starts
 */
export default async function SecretsInitializer() {
  // Only run on server-side
  if (typeof window !== 'undefined') {
    return null;
  }

  console.log('🏗️ SecretsInitializer - Component executing...');
  try {
    await initializeApp();
    console.log('🏗️ SecretsInitializer - Initialization completed');
  } catch (error) {
    console.error('🏗️ SecretsInitializer - Failed to initialize secrets:', error);
    // Don't throw here - let individual secret calls handle errors
  }

  // This component renders nothing
  return null;
}