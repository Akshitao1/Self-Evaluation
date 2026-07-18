import { NextRequest} from 'next/server';
import { initializeApp } from '@/lib/startup';

// Initialize secrets on first middleware execution
let initializationStarted = false;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('🌐 Middleware - Pathname:', pathname);
  // Ignore Next.js internals and public assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return;
  }
  console.log('🌐 Middleware - Initialization started:', initializationStarted);
  // Initialize app secrets on first request (server-side only)
  if (!initializationStarted && typeof window === 'undefined') {
    initializationStarted = true;
    console.log('🌐 Middleware - Triggering AWS Secrets Manager initialization...');
    try {
      await initializeApp();
      console.log('🌐 Middleware - Secrets initialization completed');
    } catch (error) {
      console.error('🌐 Middleware - Failed to initialize secrets:', error);
      // Continue processing - the individual secret calls will handle errors
    }
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}; 