import { NextResponse } from 'next/server';

/**
 * Simplest possible endpoint to verify Next.js API routes work
 * GET /api/ping
 */
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'pong',
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /api/ping
 */
export async function POST() {
  return NextResponse.json({ 
    success: true, 
    message: 'pong from POST',
    timestamp: new Date().toISOString()
  });
}

