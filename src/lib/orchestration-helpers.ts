import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, Timestamp, getDoc } from 'firebase/firestore';
import { Booking, WeatherCheck, RescheduleOption, BookingStatus } from '@/types';
import { fetchWeather } from './weather-api';
import { evaluateSafety } from './weather-evaluation';
import { generateRescheduleOptionsForBooking } from './reschedule-generator';

/**
 * Query upcoming bookings from Firestore
 * @param hoursAhead - Number of hours ahead to check (default: 24)
 * @returns Array of upcoming bookings
 */
export async function getUpcomingBookings(hoursAhead: number = 24): Promise<Booking[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  console.log(`Querying bookings from ${now.toISOString()} to ${cutoff.toISOString()}`);

  const q = query(
    collection(db, 'bookings'),
    where('scheduledTime', '>=', Timestamp.fromDate(now)),
    where('scheduledTime', '<=', Timestamp.fromDate(cutoff)),
    where('status', 'in', ['scheduled', 'confirmed'])
  );

  const snapshot = await getDocs(q);
  
  const bookings: Booking[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      studentId: data.studentId,
      studentName: data.studentName,
      instructorName: data.instructorName,
      aircraftId: data.aircraftId,
      scheduledTime: data.scheduledTime.toDate(),
      duration: data.duration,
      location: data.location,
      status: data.status,
      trainingLevel: data.trainingLevel,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    };
  });

  console.log(`Found ${bookings.length} upcoming bookings`);
  return bookings;
}

/**
 * Check weather for a specific booking
 * Directly calls weather functions instead of HTTP API
 * @param booking - The booking to check weather for
 * @returns Weather check result
 */
export async function checkWeatherForBooking(booking: Booking): Promise<WeatherCheck> {
  console.log(`    Fetching weather for lat: ${booking.location.lat}, lon: ${booking.location.lon}`);
  
  // Fetch weather data from OpenWeatherMap
  const conditions = await fetchWeather(
    booking.location.lat,
    booking.location.lon
  );

  console.log(`    Weather fetched: ${conditions.windSpeed}kt wind, ${(conditions.visibility / 1609).toFixed(1)}mi vis`);

  // Evaluate safety based on training level
  const evaluation = evaluateSafety(conditions, booking.trainingLevel);

  // Combine violations and hazards into reasons array
  const reasons = [...evaluation.hazards, ...evaluation.violations];

  // Create weather check object
  const weatherCheck: WeatherCheck = {
    id: '', // Will be set when saved to Firestore
    bookingId: booking.id,
    checkTime: new Date(),
    conditions,
    isSafe: evaluation.isSafe,
    trainingLevel: booking.trainingLevel,
    reasons,
  };

  // Save to Firestore
  const weatherCheckRef = await addDoc(collection(db, 'weatherChecks'), {
    bookingId: weatherCheck.bookingId,
    checkTime: Timestamp.fromDate(weatherCheck.checkTime),
    conditions: {
      ...weatherCheck.conditions,
      timestamp: Timestamp.fromDate(weatherCheck.conditions.timestamp),
    },
    isSafe: weatherCheck.isSafe,
    trainingLevel: weatherCheck.trainingLevel,
    reasons: weatherCheck.reasons,
  });

  weatherCheck.id = weatherCheckRef.id;
  console.log(`    Weather check saved: ${evaluation.isSafe ? 'SAFE' : 'UNSAFE'}`);

  return weatherCheck;
}

/**
 * Update booking status in Firestore
 * @param bookingId - The booking ID to update
 * @param status - The new status
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<void> {
  const bookingRef = doc(db, 'bookings', bookingId);
  await updateDoc(bookingRef, {
    status,
    updatedAt: Timestamp.now(),
  });
  
  console.log(`Updated booking ${bookingId} status to: ${status}`);
}

/**
 * Generate reschedule options for a booking
 * Directly calls reschedule generator instead of HTTP API
 * @param booking - The booking to generate options for
 * @returns Array of reschedule options
 */
export async function generateRescheduleOptions(booking: Booking): Promise<RescheduleOption[]> {
  console.log(`    Generating reschedule options with AI...`);
  
  // Generate options using AI
  const options = await generateRescheduleOptionsForBooking(booking);
  
  console.log(`    Generated ${options.length} reschedule options`);
  
  return options;
}

/**
 * Send combined weather alert + reschedule notification
 * Directly handles email generation and sending
 * @param booking - The booking to send notification for
 * @param weatherCheck - The weather check result
 * @param rescheduleOptions - The reschedule options
 */
export async function sendWeatherAlertWithReschedule(
  booking: Booking,
  weatherCheck: WeatherCheck,
  rescheduleOptions: RescheduleOption[]
): Promise<void> {
  console.log(`    Sending combined notification email...`);
  
  // Import email functions
  const { generateWeatherAlertWithRescheduleEmail } = await import('./email-templates');
  const { sendWeatherAlert } = await import('./email-service');
  const { logNotification } = await import('./notification-logger');
  
  // Fetch student data
  const studentRef = doc(db, 'students', booking.studentId);
  const studentSnap = await getDoc(studentRef);
  
  if (!studentSnap.exists()) {
    throw new Error(`Student not found: ${booking.studentId}`);
  }
  
  const studentData = studentSnap.data();
  const student = {
    id: studentSnap.id,
    name: studentData.name,
    email: studentData.email,
    phone: studentData.phone,
    trainingLevel: studentData.trainingLevel,
    createdAt: studentData.createdAt.toDate(),
    updatedAt: studentData.updatedAt.toDate(),
  };
  
  // Generate email template
  const emailTemplate = generateWeatherAlertWithRescheduleEmail(
    booking,
    weatherCheck,
    rescheduleOptions
  );
  
  // Send email
  const sendResult = await sendWeatherAlert(student.email, student.name, emailTemplate);
  
  if (!sendResult.success) {
    throw new Error(sendResult.error || 'Failed to send email');
  }
  
  // Log notification
  await logNotification({
    bookingId: booking.id,
    studentId: student.id,
    type: 'weather_alert_with_reschedule',
    recipientEmail: student.email,
    subject: emailTemplate.subject,
    htmlContent: emailTemplate.html,
    textContent: emailTemplate.text,
    status: 'sent',
    resendMessageId: sendResult.messageId,
    sentAt: new Date(),
  });
  
  console.log(`    ✅ Email sent successfully to ${student.email}`);
}

/**
 * Log workflow run to Firestore
 * @param result - The workflow result to log
 */
export async function logWorkflowRun(result: any): Promise<void> {
  await addDoc(collection(db, 'workflowRuns'), {
    ...result,
    timestamp: Timestamp.fromDate(result.timestamp),
  });

  console.log('Workflow run logged to Firestore');
}

/**
 * Log booking error to Firestore for monitoring
 * @param bookingId - The booking ID
 * @param error - The error message
 */
export async function logBookingError(bookingId: string, error: string): Promise<void> {
  await addDoc(collection(db, 'workflowErrors'), {
    bookingId,
    error,
    timestamp: Timestamp.now(),
  });

  console.error(`Logged error for booking ${bookingId}: ${error}`);
}

