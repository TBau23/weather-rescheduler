import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { Booking } from '@/types';

/**
 * GET /api/list-bookings
 * List all bookings in the database
 */
export async function GET() {
  try {
    const bookingsRef = collection(db, 'bookings');
    const q = query(bookingsRef, limit(20));
    const snapshot = await getDocs(q);

    const bookings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        studentName: data.studentName,
        trainingLevel: data.trainingLevel,
        scheduledTime: data.scheduledTime?.toDate?.() || data.scheduledTime,
        location: data.location,
        status: data.status,
        instructorName: data.instructorName,
        aircraftId: data.aircraftId,
      };
    });

    return NextResponse.json({
      success: true,
      count: bookings.length,
      bookings: bookings.sort((a, b) => 
        new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      ),
    });
  } catch (error) {
    console.error('[List Bookings] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

