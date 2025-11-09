import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { fetchWeather, getRunwayHeading } from '@/lib/weather-api';
import { evaluateSafety, getWeatherSummary } from '@/lib/weather-evaluation';
import { Booking, TrainingLevel, WeatherCheck } from '@/types';

/**
 * POST /api/check-weather
 * Check weather conditions for a booking or location
 * 
 * Body options:
 * 1. { bookingId: string } - Check weather for a specific booking
 * 2. { lat: number, lon: number, trainingLevel: string, runwayHeading?: number } - Check weather for arbitrary location
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Option 1: Check weather for a booking
    if (body.bookingId) {
      return await checkWeatherForBooking(body.bookingId);
    }

    // Option 2: Check weather for arbitrary location
    if (body.lat && body.lon && body.trainingLevel) {
      return await checkWeatherForLocation(
        body.lat,
        body.lon,
        body.trainingLevel,
        body.runwayHeading
      );
    }

    return NextResponse.json(
      { 
        error: 'Invalid request. Provide either bookingId or (lat, lon, trainingLevel)' 
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Check Weather] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check weather',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Check weather for a specific booking
 */
async function checkWeatherForBooking(bookingId: string) {
  // Fetch booking from Firestore
  const bookingRef = doc(db, 'bookings', bookingId);
  const bookingSnap = await getDoc(bookingRef);

  if (!bookingSnap.exists()) {
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404 }
    );
  }

  const booking = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;

  // Fetch weather for booking location
  const weather = await fetchWeather(
    booking.location.lat,
    booking.location.lon
  );

  // Determine runway heading (use airport code from location name if available)
  const airportCode = extractAirportCode(booking.location.name);
  const runwayHeading = getRunwayHeading(airportCode);

  // Evaluate safety
  const evaluation = evaluateSafety(
    weather,
    booking.trainingLevel,
    runwayHeading
  );

  // Log weather check to Firestore
  const weatherCheckData: Omit<WeatherCheck, 'id'> = {
    bookingId: booking.id,
    checkTime: new Date(),
    conditions: weather,
    isSafe: evaluation.isSafe,
    trainingLevel: booking.trainingLevel,
    reasons: [...evaluation.violations, ...evaluation.hazards],
  };

  const weatherChecksRef = collection(db, 'weatherChecks');
  const checkDoc = await addDoc(weatherChecksRef, {
    ...weatherCheckData,
    checkTime: serverTimestamp(),
  });

  console.log(
    `[Check Weather] Booking ${bookingId}: ${evaluation.isSafe ? 'SAFE' : 'UNSAFE'} for ${booking.trainingLevel} pilot`
  );

  return NextResponse.json({
    success: true,
    checkId: checkDoc.id,
    booking: {
      id: booking.id,
      studentName: booking.studentName,
      scheduledTime: booking.scheduledTime,
      location: booking.location,
      trainingLevel: booking.trainingLevel,
    },
    weather: {
      summary: getWeatherSummary(weather),
      conditions: weather,
    },
    evaluation: {
      isSafe: evaluation.isSafe,
      violations: evaluation.violations,
      hazards: evaluation.hazards,
      reasoning: evaluation.reasoning,
      minimums: evaluation.minimums,
      actual: evaluation.actual,
    },
  });
}

/**
 * Check weather for arbitrary location
 */
async function checkWeatherForLocation(
  lat: number,
  lon: number,
  trainingLevel: string,
  runwayHeading: number = 360
) {
  // Validate training level
  const validLevels: TrainingLevel[] = ['student', 'private', 'instrument', 'commercial'];
  if (!validLevels.includes(trainingLevel as TrainingLevel)) {
    return NextResponse.json(
      { error: `Invalid training level. Must be one of: ${validLevels.join(', ')}` },
      { status: 400 }
    );
  }

  // Fetch weather
  const weather = await fetchWeather(lat, lon);

  // Evaluate safety
  const evaluation = evaluateSafety(
    weather,
    trainingLevel as TrainingLevel,
    runwayHeading
  );

  console.log(
    `[Check Weather] Location (${lat}, ${lon}): ${evaluation.isSafe ? 'SAFE' : 'UNSAFE'} for ${trainingLevel} pilot`
  );

  return NextResponse.json({
    success: true,
    location: { lat, lon },
    trainingLevel,
    weather: {
      summary: getWeatherSummary(weather),
      conditions: weather,
    },
    evaluation: {
      isSafe: evaluation.isSafe,
      violations: evaluation.violations,
      hazards: evaluation.hazards,
      reasoning: evaluation.reasoning,
      minimums: evaluation.minimums,
      actual: evaluation.actual,
    },
  });
}

/**
 * Extract airport code from location name (e.g., "KJFK - New York" -> "KJFK")
 */
function extractAirportCode(locationName: string): string {
  const match = locationName.match(/^([A-Z]{4})/);
  return match ? match[1] : '';
}

