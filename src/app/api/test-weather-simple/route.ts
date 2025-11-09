import { NextRequest, NextResponse } from 'next/server';
import { fetchWeather } from '@/lib/weather-api';
import { evaluateSafety, getWeatherSummary } from '@/lib/weather-evaluation';
import { TrainingLevel } from '@/types';

/**
 * Simple weather test endpoint - no Firestore
 * GET /api/test-weather-simple?lat=40.6413&lon=-73.7781&level=student
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '40.6413');
    const lon = parseFloat(searchParams.get('lon') || '-73.7781');
    const level = (searchParams.get('level') || 'student') as TrainingLevel;

    console.log(`[Test Weather Simple] Fetching for ${lat}, ${lon}, ${level}`);

    // Fetch weather
    const weather = await fetchWeather(lat, lon);

    console.log('[Test Weather Simple] Weather fetched successfully');

    // Evaluate safety
    const evaluation = evaluateSafety(weather, level, 310);

    console.log(`[Test Weather Simple] Evaluation: ${evaluation.isSafe ? 'SAFE' : 'UNSAFE'}`);

    return NextResponse.json({
      success: true,
      weather: {
        summary: getWeatherSummary(weather),
        raw: weather,
      },
      evaluation: {
        isSafe: evaluation.isSafe,
        reasoning: evaluation.reasoning,
        violations: evaluation.violations,
        hazards: evaluation.hazards,
      },
    });
  } catch (error) {
    console.error('[Test Weather Simple] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

