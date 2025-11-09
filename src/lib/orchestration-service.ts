import { Booking, WeatherCheck } from '@/types';
import {
  getUpcomingBookings,
  checkWeatherForBooking,
  updateBookingStatus,
  generateRescheduleOptions,
  sendWeatherAlertWithReschedule,
  logWorkflowRun,
  logBookingError,
} from './orchestration-helpers';

/**
 * Workflow Options
 */
export interface WorkflowOptions {
  bookingIds?: string[]; // Filter to specific bookings
  hoursAhead?: number; // Check bookings N hours ahead (default: 24)
  dryRun?: boolean; // Don't actually send emails
}

/**
 * Workflow Result
 */
export interface WorkflowResult {
  totalBookings: number;
  checkedBookings: number;
  unsafeBookings: number;
  emailsSent: number;
  errors: string[];
  duration: number; // milliseconds
  timestamp: Date;
}

/**
 * Booking Processing Result
 */
interface BookingResult {
  isSafe: boolean;
  emailsSent: number;
}

/**
 * Main orchestration workflow
 * Checks weather for upcoming bookings, detects conflicts, generates AI reschedule options, and sends notifications
 * 
 * @param options - Workflow configuration options
 * @returns Workflow result summary
 */
export async function runWeatherCheckWorkflow(options: WorkflowOptions = {}): Promise<WorkflowResult> {
  const startTime = Date.now();
  const result: WorkflowResult = {
    totalBookings: 0,
    checkedBookings: 0,
    unsafeBookings: 0,
    emailsSent: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
  };

  try {
    console.log('🚀 Starting weather check workflow...');
    console.log('Options:', options);

    // 1. Query upcoming bookings
    let bookings = await getUpcomingBookings(options.hoursAhead || 24);
    result.totalBookings = bookings.length;

    // 2. Filter to specific bookings if requested
    if (options.bookingIds && options.bookingIds.length > 0) {
      bookings = bookings.filter((b) => options.bookingIds!.includes(b.id));
      console.log(`Filtered to ${bookings.length} specific bookings`);
    }

    if (bookings.length === 0) {
      console.log('No bookings to process');
      result.duration = Date.now() - startTime;
      await logWorkflowRun(result);
      return result;
    }

    // 3. Process each booking
    console.log(`Processing ${bookings.length} bookings...`);
    for (const booking of bookings) {
      try {
        console.log(`\n📋 Processing booking ${booking.id} (${booking.studentName})`);
        const bookingResult = await processBooking(booking, options.dryRun || false);

        result.checkedBookings++;
        if (!bookingResult.isSafe) {
          result.unsafeBookings++;
          result.emailsSent += bookingResult.emailsSent;
        }

        console.log(`✅ Booking ${booking.id} processed successfully`);
      } catch (error: any) {
        const errorMessage = `${booking.studentName} (${booking.id}): ${error.message}`;
        result.errors.push(errorMessage);
        console.error(`❌ Error processing booking ${booking.id}:`, error);

        // Log error to Firestore for monitoring
        await logBookingError(booking.id, error.message);
      }
    }

    result.duration = Date.now() - startTime;

    // 4. Log workflow run to Firestore
    await logWorkflowRun(result);

    console.log('\n✨ Workflow completed!');
    console.log(`Summary: ${result.checkedBookings}/${result.totalBookings} checked, ${result.unsafeBookings} unsafe, ${result.emailsSent} emails sent`);

    return result;
  } catch (error: any) {
    result.errors.push(`Workflow failed: ${error.message}`);
    result.duration = Date.now() - startTime;
    console.error('❌ Workflow failed:', error);
    return result;
  }
}

/**
 * Process a single booking
 * Checks weather, handles conflicts if unsafe
 * 
 * @param booking - The booking to process
 * @param dryRun - If true, don't send emails
 * @returns Booking result
 */
async function processBooking(booking: Booking, dryRun: boolean): Promise<BookingResult> {
  // 1. Check weather
  console.log(`  🌤️  Checking weather for ${booking.location.name}...`);
  const weatherCheck = await checkWeatherForBooking(booking);

  // 2. If safe, we're done
  if (weatherCheck.isSafe) {
    console.log(`  ✅ Weather is safe for ${booking.trainingLevel} pilot`);
    return { isSafe: true, emailsSent: 0 };
  }

  // 3. If unsafe, handle the conflict
  console.log(`  ⚠️  Weather is UNSAFE! Reasons:`);
  weatherCheck.reasons.forEach((reason) => console.log(`     - ${reason}`));

  await handleUnsafeBooking(booking, weatherCheck, dryRun);

  return { isSafe: false, emailsSent: dryRun ? 0 : 1 };
}

/**
 * Handle an unsafe booking
 * Updates status, generates reschedule options, sends notification
 * 
 * @param booking - The unsafe booking
 * @param weatherCheck - The weather check result
 * @param dryRun - If true, don't send emails
 */
async function handleUnsafeBooking(
  booking: Booking,
  weatherCheck: WeatherCheck,
  dryRun: boolean
): Promise<void> {
  // 1. Update booking status to 'conflict'
  console.log(`  📝 Updating booking status to 'conflict'...`);
  await updateBookingStatus(booking.id, 'conflict');

  // 2. Generate AI reschedule options
  console.log(`  🤖 Generating AI reschedule options...`);
  const rescheduleOptions = await generateRescheduleOptions(booking);
  console.log(`  ✅ Generated ${rescheduleOptions.length} reschedule options`);

  // 3. Send combined weather alert + reschedule notification
  if (!dryRun) {
    console.log(`  📧 Sending weather alert + reschedule notification...`);
    await sendWeatherAlertWithReschedule(booking, weatherCheck, rescheduleOptions);
    console.log(`  ✅ Notification sent successfully`);
  } else {
    console.log(`  🔍 DRY RUN: Would send weather alert + reschedule notification`);
  }
}

