import { Booking, WeatherCheck, BookingStatus } from '@/types';
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
  forceConflict?: boolean; // Force all bookings to be marked as unsafe (for testing)
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
    console.log('Starting weather check workflow...');
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

    // 3. Process bookings in parallel batches
    console.log(`Processing ${bookings.length} bookings in parallel...`);
    if (options.forceConflict) {
      console.log(`🧪 TEST MODE: All bookings will be forced to conflict status`);
    }
    
    // Set all bookings to 'checking' status for real-time dashboard updates
    await Promise.all(
      bookings.map(booking => 
        updateBookingStatus(booking.id, 'checking').catch(err => 
          console.error(`Failed to set checking status for ${booking.id}:`, err)
        )
      )
    );
    
    // Process bookings in parallel batches to avoid overwhelming APIs
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
      batches.push(bookings.slice(i, i + BATCH_SIZE));
    }
    
    for (const batch of batches) {
      console.log(`\n📦 Processing batch of ${batch.length} bookings...`);
      
      const batchResults = await Promise.allSettled(
        batch.map(booking => processBooking(booking, options.dryRun || false, options.forceConflict || false))
      );
      
      // Collect results from batch
      batchResults.forEach((settledResult, index) => {
        const booking = batch[index];
        
        if (settledResult.status === 'fulfilled') {
          const bookingResult = settledResult.value;
          result.checkedBookings++;
          
          if (!bookingResult.isSafe) {
            result.unsafeBookings++;
            result.emailsSent += bookingResult.emailsSent;
          }
          
          console.log(`✅ Booking ${booking.id} (${booking.studentName}) processed successfully`);
        } else {
          const error = settledResult.reason;
          const errorMessage = `${booking.studentName} (${booking.id}): ${error.message}`;
          result.errors.push(errorMessage);
          console.error(`❌ Error processing booking ${booking.id}:`, error);
          
          // Log error to Firestore for monitoring
          logBookingError(booking.id, error.message).catch(err => 
            console.error(`Failed to log error for ${booking.id}:`, err)
          );
        }
      });
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
async function processBooking(booking: Booking, dryRun: boolean, forceConflict: boolean = false): Promise<BookingResult> {
  // 1. Check weather
  console.log(`  🌤️  Checking weather for ${booking.location.name}...`);
  const weatherCheck = await checkWeatherForBooking(booking);

  // 2. If forcing conflicts for testing, override the result
  if (forceConflict && weatherCheck.isSafe) {
    console.log(`  🧪 TEST MODE: Forcing this booking to be marked as UNSAFE`);
    weatherCheck.isSafe = false;
    weatherCheck.reasons = [
      'TEST MODE: Simulated unsafe conditions',
      'Wind speed 25kt exceeds maximum 10kt (forced for testing)',
      'This is a test conflict to demonstrate the reschedule flow',
    ];
  }

  // 3. If safe, restore original status
  if (weatherCheck.isSafe) {
    console.log(`  ✅ Weather is safe for ${booking.trainingLevel} pilot`);
    // Restore to original status (confirmed if it was confirmed, otherwise scheduled)
    const restoredStatus: BookingStatus = booking.status === 'checking' ? 'scheduled' : booking.status;
    await updateBookingStatus(booking.id, restoredStatus);
    return { isSafe: true, emailsSent: 0 };
  }

  // 4. If unsafe, handle the conflict
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
  console.log(`   Updating booking status to 'conflict'...`);
  await updateBookingStatus(booking.id, 'conflict');

  // 2. Generate AI reschedule options
  console.log(`  Generating AI reschedule options...`);
  const rescheduleOptions = await generateRescheduleOptions(booking, weatherCheck);
  console.log(`  Generated ${rescheduleOptions.length} reschedule options`);

  // 3. Send combined weather alert + reschedule notification
  if (!dryRun) {
    console.log(`   Sending weather alert + reschedule notification...`);
    await sendWeatherAlertWithReschedule(booking, weatherCheck, rescheduleOptions);
    console.log(`  Notification sent successfully`);
  } else {
    console.log(`  🔍DRY RUN: Would send weather alert + reschedule notification`);
  }
}

