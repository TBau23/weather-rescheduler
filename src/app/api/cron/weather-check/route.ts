import { NextRequest, NextResponse } from 'next/server';
import { runWeatherCheckWorkflow } from '@/lib/orchestration-service';

/**
 * GET /api/cron/weather-check
 * Automated weather check triggered by Vercel Cron
 * Runs hourly to check weather for upcoming bookings
 * 
 * Protected by Authorization header with CRON_SECRET
 * 
 * Returns: WorkflowResult with summary of actions taken
 */
export async function GET(request: NextRequest) {
  // 1. Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('⚠️  CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.error('❌ Unauthorized cron request');
    console.error('Expected:', expectedAuth);
    console.error('Received:', authHeader);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('⏰ Automated weather check (cron) triggered');
    console.log('Time:', new Date().toISOString());

    // Run workflow with production settings
    const result = await runWeatherCheckWorkflow({
      hoursAhead: 24, // Check next 24 hours
      dryRun: false, // Actually send emails
    });

    console.log('✅ Cron workflow completed successfully');
    console.log('Summary:', result);

    return NextResponse.json({
      success: true,
      message: 'Automated weather check completed',
      result,
    });
  } catch (error: any) {
    console.error('❌ Cron weather check failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Cron job failed',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

