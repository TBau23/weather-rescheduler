import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

/**
 * GET /api/view-data
 * 
 * Returns a summary of current database state
 */
export async function GET() {
  try {
    // Get students
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get bookings (ordered by scheduled time)
    const bookingsQuery = query(
      collection(db, 'bookings'),
      orderBy('scheduledTime'),
      limit(50)
    );
    const bookingsSnapshot = await getDocs(bookingsQuery);
    const bookings = bookingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get weatherChecks
    const weatherChecksSnapshot = await getDocs(collection(db, 'weatherChecks'));
    const weatherChecks = weatherChecksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get notifications
    const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
    const notifications = notificationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Summary stats
    const statusCounts = bookings.reduce((acc, booking: any) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const trainingLevelCounts = students.reduce((acc, student: any) => {
      acc[student.trainingLevel] = (acc[student.trainingLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      summary: {
        totalStudents: students.length,
        totalBookings: bookings.length,
        totalWeatherChecks: weatherChecks.length,
        totalNotifications: notifications.length,
        bookingsByStatus: statusCounts,
        studentsByTrainingLevel: trainingLevelCounts,
      },
      data: {
        students,
        bookings,
        weatherChecks,
        notifications,
      }
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

