import { NextResponse } from 'next/server';
import { secretsManager } from '@/lib/secrets-manager';

// Force refresh secrets cache
export async function POST() {
  try {
    await secretsManager.refreshCache();
    const cacheInfo = secretsManager.getCacheInfo();
    
    return NextResponse.json({
      success: true,
      message: 'Cache refreshed successfully',
      cacheInfo
    });
  } catch (error: any) {
    console.error('Cache refresh error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to refresh cache' 
      },
      { status: 500 }
    );
  }
} 