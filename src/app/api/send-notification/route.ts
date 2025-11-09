import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { sendWeatherAlert, sendRescheduleOptions, sendConfirmation } from '@/lib/email-service';
import { generateWeatherAlertEmail, generateRescheduleOptionsEmail, generateConfirmationEmail, generateWeatherAlertWithRescheduleEmail } from '@/lib/email-templates';
import { logNotification } from '@/lib/notification-logger';
import { Booking, WeatherCheck, RescheduleOption, Student } from '@/types';

/**
 * POST /api/send-notification
 * Send an email notification for a booking
 * 
 * Body: {
 *   bookingId: string,
 *   type: 'weather_alert' | 'reschedule_options' | 'confirmation'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, type } = body;

    // Validate input
    if (!bookingId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId and type' },
        { status: 400 }
      );
    }

    if (!['weather_alert', 'reschedule_options', 'confirmation', 'weather_alert_with_reschedule'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type. Must be: weather_alert, reschedule_options, confirmation, or weather_alert_with_reschedule' },
        { status: 400 }
      );
    }

    console.log(`Sending ${type} notification for booking ${bookingId}`);

    // 1. Fetch booking data
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json(
        { error: `Booking not found: ${bookingId}` },
        { status: 404 }
      );
    }

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

    // 2. Fetch student data
    const studentRef = doc(db, 'students', booking.studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json(
        { error: `Student not found: ${booking.studentId}` },
        { status: 404 }
      );
    }

    const studentData = studentSnap.data();
    const student: Student = {
      id: studentSnap.id,
      name: studentData.name,
      email: studentData.email,
      phone: studentData.phone,
      trainingLevel: studentData.trainingLevel,
      createdAt: studentData.createdAt.toDate(),
      updatedAt: studentData.updatedAt.toDate(),
    };

    // 3. Generate email content based on type
    let emailTemplate;
    let sendResult;

    switch (type) {
      case 'weather_alert':
        // Fetch latest weather check for this booking
        const weatherChecksQuery = query(
          collection(db, 'weatherChecks'),
          where('bookingId', '==', bookingId),
          orderBy('checkTime', 'desc'),
          limit(1)
        );
        const weatherChecksSnap = await getDocs(weatherChecksQuery);

        if (weatherChecksSnap.empty) {
          return NextResponse.json(
            { error: 'No weather check found for this booking' },
            { status: 404 }
          );
        }

        const weatherCheckData = weatherChecksSnap.docs[0].data();
        const weatherCheck: WeatherCheck = {
          id: weatherChecksSnap.docs[0].id,
          bookingId: weatherCheckData.bookingId,
          checkTime: weatherCheckData.checkTime.toDate(),
          conditions: {
            ...weatherCheckData.conditions,
            timestamp: weatherCheckData.conditions.timestamp.toDate(),
          },
          isSafe: weatherCheckData.isSafe,
          trainingLevel: weatherCheckData.trainingLevel,
          reasons: weatherCheckData.reasons,
        };

        emailTemplate = generateWeatherAlertEmail(booking, weatherCheck);
        sendResult = await sendWeatherAlert(student.email, student.name, emailTemplate);
        break;

      case 'reschedule_options':
        // Fetch reschedule options for this booking
        const rescheduleQuery = query(
          collection(db, 'rescheduleOptions'),
          where('bookingId', '==', bookingId),
          orderBy('priority', 'asc'),
          limit(3)
        );
        const rescheduleSnap = await getDocs(rescheduleQuery);

        if (rescheduleSnap.empty) {
          return NextResponse.json(
            { error: 'No reschedule options found for this booking' },
            { status: 404 }
          );
        }

        const rescheduleOptions: RescheduleOption[] = [];
        rescheduleSnap.forEach((doc) => {
          const data = doc.data();
          rescheduleOptions.push({
            id: doc.id,
            bookingId: data.bookingId,
            suggestedTime: data.suggestedTime.toDate(),
            reasoning: data.reasoning,
            priority: data.priority,
            studentAvailable: data.studentAvailable,
            instructorAvailable: data.instructorAvailable,
            aircraftAvailable: data.aircraftAvailable,
            weatherForecast: data.weatherForecast,
            createdAt: data.createdAt.toDate(),
          });
        });

        emailTemplate = generateRescheduleOptionsEmail(booking, rescheduleOptions);
        sendResult = await sendRescheduleOptions(student.email, student.name, emailTemplate);
        break;

      case 'weather_alert_with_reschedule':
        // Fetch latest weather check
        const weatherChecksQuery2 = query(
          collection(db, 'weatherChecks'),
          where('bookingId', '==', bookingId),
          orderBy('checkTime', 'desc'),
          limit(1)
        );
        const weatherChecksSnap2 = await getDocs(weatherChecksQuery2);

        if (weatherChecksSnap2.empty) {
          return NextResponse.json(
            { error: 'No weather check found for this booking' },
            { status: 404 }
          );
        }

        const weatherCheckData2 = weatherChecksSnap2.docs[0].data();
        const weatherCheck2: WeatherCheck = {
          id: weatherChecksSnap2.docs[0].id,
          bookingId: weatherCheckData2.bookingId,
          checkTime: weatherCheckData2.checkTime.toDate(),
          conditions: {
            ...weatherCheckData2.conditions,
            timestamp: weatherCheckData2.conditions.timestamp.toDate(),
          },
          isSafe: weatherCheckData2.isSafe,
          trainingLevel: weatherCheckData2.trainingLevel,
          reasons: weatherCheckData2.reasons,
        };

        // Fetch reschedule options
        const rescheduleQuery2 = query(
          collection(db, 'rescheduleOptions'),
          where('bookingId', '==', bookingId),
          orderBy('priority', 'asc'),
          limit(3)
        );
        const rescheduleSnap2 = await getDocs(rescheduleQuery2);

        if (rescheduleSnap2.empty) {
          return NextResponse.json(
            { error: 'No reschedule options found for this booking' },
            { status: 404 }
          );
        }

        const rescheduleOptions2: RescheduleOption[] = [];
        rescheduleSnap2.forEach((doc) => {
          const data = doc.data();
          rescheduleOptions2.push({
            id: doc.id,
            bookingId: data.bookingId,
            suggestedTime: data.suggestedTime.toDate(),
            reasoning: data.reasoning,
            priority: data.priority,
            studentAvailable: data.studentAvailable,
            instructorAvailable: data.instructorAvailable,
            aircraftAvailable: data.aircraftAvailable,
            weatherForecast: data.weatherForecast,
            createdAt: data.createdAt.toDate(),
          });
        });

        emailTemplate = generateWeatherAlertWithRescheduleEmail(booking, weatherCheck2, rescheduleOptions2);
        sendResult = await sendWeatherAlert(student.email, student.name, emailTemplate);
        break;

      case 'confirmation':
        emailTemplate = generateConfirmationEmail(booking);
        sendResult = await sendConfirmation(student.email, student.name, emailTemplate);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    // 4. Log notification to Firestore
    const notificationId = await logNotification({
      bookingId: booking.id,
      studentId: student.id,
      type,
      recipientEmail: student.email,
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.html,
      textContent: emailTemplate.text,
      status: sendResult.success ? 'sent' : 'failed',
      resendMessageId: sendResult.messageId,
      error: sendResult.error,
      sentAt: sendResult.success ? new Date() : undefined,
    });

    // 5. Return result
    return NextResponse.json({
      success: sendResult.success,
      notificationId,
      messageId: sendResult.messageId,
      type,
      recipient: student.email,
      subject: emailTemplate.subject,
      error: sendResult.error,
    });

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/send-notification?bookingId=xxx
 * Get all notifications for a booking
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing bookingId parameter' },
        { status: 400 }
      );
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('bookingId', '==', bookingId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(notificationsQuery);
    
    const notifications = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        bookingId: data.bookingId,
        studentId: data.studentId,
        type: data.type,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        status: data.status,
        resendMessageId: data.resendMessageId,
        error: data.error,
        sentAt: data.sentAt?.toDate().toISOString(),
        createdAt: data.createdAt?.toDate().toISOString(),
      };
    });

    return NextResponse.json({
      bookingId,
      count: notifications.length,
      notifications,
    });

  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

