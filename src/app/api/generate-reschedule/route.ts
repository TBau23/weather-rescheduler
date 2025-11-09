import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, addDoc, Timestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Booking, WeatherCheck, RescheduleOption } from '@/types';
import { generateRescheduleOptions } from '@/lib/reschedule-generator';

/**
 * POST /api/generate-reschedule
 * 
 * Generate AI-powered reschedule options for an unsafe booking
 * 
 * Body: { bookingId: string }
 * 
 * Returns: {
 *   success: true,
 *   booking: Booking,
 *   weatherCheck: WeatherCheck,
 *   options: RescheduleOption[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { bookingId } = body;
    
    // Validate bookingId
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json(
        { error: 'bookingId is required and must be a string' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Generating reschedule options for booking ${bookingId}...`);
    
    // Step 1: Fetch booking from Firestore
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      console.error(`❌ Booking ${bookingId} not found`);
      return NextResponse.json(
        { error: `Booking with ID ${bookingId} not found` },
        { status: 404 }
      );
    }
    
    // Convert Firestore document to Booking object
    const bookingData = bookingSnap.data();
    const booking: Booking = {
      id: bookingSnap.id,
      studentId: bookingData.studentId,
      studentName: bookingData.studentName,
      instructorName: bookingData.instructorName,
      aircraftId: bookingData.aircraftId,
      scheduledTime: bookingData.scheduledTime.toDate(),
      duration: bookingData.duration,
      location: bookingData.location,
      status: bookingData.status,
      trainingLevel: bookingData.trainingLevel,
      createdAt: bookingData.createdAt.toDate(),
      updatedAt: bookingData.updatedAt.toDate(),
    };
    
    console.log(`✓ Found booking for ${booking.studentName}`);
    
    // Step 2: Find most recent weather check for this booking
    const weatherChecksQuery = query(
      collection(db, 'weatherChecks'),
      where('bookingId', '==', bookingId),
      orderBy('checkTime', 'desc'),
      limit(1)
    );
    
    const weatherChecksSnap = await getDocs(weatherChecksQuery);
    
    let weatherCheck: WeatherCheck | null = null;
    
    if (!weatherChecksSnap.empty) {
      const weatherDoc = weatherChecksSnap.docs[0];
      const weatherData = weatherDoc.data();
      
      weatherCheck = {
        id: weatherDoc.id,
        bookingId: weatherData.bookingId,
        checkTime: weatherData.checkTime.toDate(),
        conditions: {
          ...weatherData.conditions,
          timestamp: weatherData.conditions.timestamp.toDate(),
        },
        isSafe: weatherData.isSafe,
        trainingLevel: weatherData.trainingLevel,
        reasons: weatherData.reasons,
      };
      
      console.log(`✓ Found weather check: ${weatherCheck.isSafe ? 'SAFE' : 'UNSAFE'}`);
    } else {
      console.log(`⚠️  No weather check found for booking ${bookingId}`);
      return NextResponse.json(
        { 
          error: 'No weather check found for this booking. Please run a weather check first.',
          bookingId: bookingId,
        },
        { status: 400 }
      );
    }
    
    // Step 3: Verify weather is unsafe (otherwise no need to reschedule)
    if (weatherCheck.isSafe) {
      console.log(`✓ Weather is safe - no need to reschedule`);
      return NextResponse.json(
        { 
          error: 'Weather conditions are safe for this booking. No rescheduling needed.',
          booking: {
            id: booking.id,
            studentName: booking.studentName,
            scheduledTime: booking.scheduledTime.toISOString(),
          },
          weatherCheck: {
            isSafe: true,
            checkTime: weatherCheck.checkTime.toISOString(),
          }
        },
        { status: 400 }
      );
    }
    
    // Step 4: Generate reschedule options using AI
    console.log(`🤖 Generating reschedule options...`);
    
    const rescheduleOptions = await generateRescheduleOptions(booking, weatherCheck);
    
    console.log(`✓ Generated ${rescheduleOptions.length} options`);
    
    // Step 5: Save options to Firestore
    const savedOptions: RescheduleOption[] = [];
    
    for (const option of rescheduleOptions) {
      const optionData = {
        bookingId: option.bookingId,
        suggestedTime: Timestamp.fromDate(option.suggestedTime),
        reasoning: option.reasoning,
        priority: option.priority,
        studentAvailable: option.studentAvailable,
        instructorAvailable: option.instructorAvailable,
        aircraftAvailable: option.aircraftAvailable,
        weatherForecast: option.weatherForecast,
        createdAt: Timestamp.fromDate(option.createdAt),
      };
      
      const docRef = await addDoc(collection(db, 'rescheduleOptions'), optionData);
      
      savedOptions.push({
        id: docRef.id,
        ...option,
      });
      
      console.log(`   ✓ Saved option ${option.priority}: ${docRef.id}`);
    }
    
    console.log(`✅ Successfully generated and saved ${savedOptions.length} reschedule options`);
    
    // Step 6: Return response
    return NextResponse.json(
      {
        success: true,
        booking: {
          id: booking.id,
          studentName: booking.studentName,
          studentId: booking.studentId,
          instructorName: booking.instructorName,
          aircraftId: booking.aircraftId,
          scheduledTime: booking.scheduledTime.toISOString(),
          location: booking.location,
          trainingLevel: booking.trainingLevel,
        },
        weatherCheck: {
          id: weatherCheck.id,
          isSafe: weatherCheck.isSafe,
          checkTime: weatherCheck.checkTime.toISOString(),
          reasons: weatherCheck.reasons,
          conditions: {
            ...weatherCheck.conditions,
            timestamp: weatherCheck.conditions.timestamp.toISOString(),
          },
        },
        options: savedOptions.map(opt => ({
          id: opt.id,
          bookingId: opt.bookingId,
          suggestedTime: opt.suggestedTime.toISOString(),
          reasoning: opt.reasoning,
          priority: opt.priority,
          studentAvailable: opt.studentAvailable,
          instructorAvailable: opt.instructorAvailable,
          aircraftAvailable: opt.aircraftAvailable,
          weatherForecast: opt.weatherForecast,
          createdAt: opt.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('❌ Error generating reschedule options:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate reschedule options',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

