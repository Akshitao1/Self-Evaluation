// Server startup initialization
import { secretsManager } from './secrets-manager';

let initializationStarted = false;

/**
 * Initialize application secrets at startup
 * Only runs on server-side, skips during build process
 */
export async function initializeApp(): Promise<void> {
  // Skip during any build process
  if (process.env.NEXT_PHASE === 'phase-production-build' || 
      process.env.NEXT_PHASE === 'phase-development-build' ||
      process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('🏗️ Skipping secrets initialization during build...');
    return;
  }

  // Skip if SECRET_NAME is not provided (no AWS Secrets Manager needed)
  if (!process.env.SECRET_NAME) {
    console.log('ℹ️ AWS Secrets Manager - Skipped');
    console.log('   📝 Reason: SECRET_NAME environment variable not provided');
    console.log('   💡 To enable: Set SECRET_NAME=your-secret-name');
    return;
  }

  // Skip if already started initialization
  if (initializationStarted) {
    return;
  }

  initializationStarted = true;

  try {
    console.log('🚀 Application Startup - Initializing...');
    console.log(`   📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   🔐 Secret Name: ${process.env.SECRET_NAME || 'Not configured'}`);
    
    // Initialize secrets manager
    await secretsManager.initialize();
    
    console.log('✅ Application Startup - Complete');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    
    // Fail fast - throw error if secrets can't be loaded
    if (process.env.NODE_ENV === 'production') {
      console.error('💥 Critical failure in production - secrets unavailable');
      throw new Error(`Production startup failed: ${error}`);
    } else {
      console.warn('⚠️ Continuing in development mode despite initialization failure');
      throw error;
    }
  }
}

/**
 * Check if the app has been initialized
 */
export function isAppInitialized(): boolean {
  return initializationStarted;
} 