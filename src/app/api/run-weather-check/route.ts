import { NextRequest, NextResponse } from 'next/server';
import { runWeatherCheckWorkflow, WorkflowOptions } from '@/lib/orchestration-service';

/**
 * POST /api/run-weather-check
 * Manual trigger for weather check workflow
 * 
 * Body (all optional): {
 *   bookingIds?: string[],
 *   hoursAhead?: number,
 *   dryRun?: boolean
 * }
 * 
 * Returns: WorkflowResult with summary of actions taken
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const options: WorkflowOptions = {
      bookingIds: body.bookingIds,
      hoursAhead: body.hoursAhead || 24,
      dryRun: body.dryRun || false,
    };

    console.log('🎯 Manual weather check workflow triggered');
    console.log('Options:', options);

    // Run the workflow
    const result = await runWeatherCheckWorkflow(options);

    // Return detailed results
    return NextResponse.json({
      success: true,
      message: 'Weather check workflow completed',
      result,
    });
  } catch (error: any) {
    console.error('❌ Weather check workflow failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Workflow failed',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/run-weather-check
 * Quick trigger for testing (no options, uses defaults)
 * 
 * Returns: WorkflowResult with summary of actions taken
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Quick weather check workflow triggered (GET)');

    const result = await runWeatherCheckWorkflow({
      hoursAhead: 24,
      dryRun: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Weather check workflow completed',
      result,
    });
  } catch (error: any) {
    console.error('❌ Weather check workflow failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Workflow failed',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

