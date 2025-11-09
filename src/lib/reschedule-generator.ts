import { Booking, WeatherCheck, RescheduleOption } from '@/types';
import {
  getStudentAvailability,
  getInstructorAvailability,
  getAircraftAvailability,
  findOverlappingAvailability,
  type TimeSlot,
} from '@/lib/availability-helpers';
import { generateRescheduleOptionsWithAI, type AIRescheduleOption } from '@/lib/openai-client';

/**
 * Generate reschedule options for an unsafe booking
 * 
 * This is the main orchestration function that:
 * 1. Gathers availability from all resources (student, instructor, aircraft)
 * 2. Finds overlapping available times
 * 3. Calls AI to generate smart reschedule suggestions
 * 4. Returns structured options ready to save to Firestore
 * 
 * @param booking - The booking that needs rescheduling
 * @param weatherCheck - The weather check that deemed it unsafe
 * @returns Array of 3 reschedule options (without IDs - will be assigned by Firestore)
 */
export async function generateRescheduleOptions(
  booking: Booking,
  weatherCheck: WeatherCheck
): Promise<Omit<RescheduleOption, 'id'>[]> {
  // Validate inputs
  if (!booking) {
    throw new Error('Booking is required to generate reschedule options');
  }
  
  if (!weatherCheck) {
    throw new Error('Weather check is required to generate reschedule options');
  }
  
  if (weatherCheck.isSafe) {
    throw new Error('Weather is safe - no need to reschedule');
  }
  
  // Step 1: Gather availability from all resources
  console.log(`📅 Gathering availability for booking ${booking.id}...`);
  console.log(`   Student: ${booking.studentName} (${booking.trainingLevel})`);
  console.log(`   Instructor: ${booking.instructorName}`);
  console.log(`   Aircraft: ${booking.aircraftId}`);
  
  const studentAvailability = await getStudentAvailability(
    booking.studentId,
    booking.trainingLevel
  );
  console.log(`   ✓ Student has ${studentAvailability.length} available slots`);
  
  const instructorAvailability = await getInstructorAvailability(
    booking.instructorName
  );
  console.log(`   ✓ Instructor has ${instructorAvailability.length} available slots`);
  
  const aircraftAvailability = await getAircraftAvailability(
    booking.aircraftId
  );
  console.log(`   ✓ Aircraft has ${aircraftAvailability.length} available slots`);
  
  // Step 2: Find overlapping availability (times when ALL are available)
  const overlappingSlots = findOverlappingAvailability(
    studentAvailability,
    instructorAvailability,
    aircraftAvailability
  );
  
  console.log(`   ✓ Found ${overlappingSlots.length} overlapping slots`);
  
  if (overlappingSlots.length === 0) {
    throw new Error(
      'No overlapping availability found. Student, instructor, and aircraft have no common available times.'
    );
  }
  
  // Step 3: Call AI to generate smart reschedule suggestions
  console.log(`🤖 Calling AI to generate reschedule options...`);
  
  const aiOptions: AIRescheduleOption[] = await generateRescheduleOptionsWithAI(
    booking,
    weatherCheck,
    overlappingSlots
  );
  
  console.log(`   ✓ AI generated ${aiOptions.length} options`);
  
  // Step 4: Convert AI options to RescheduleOption format (without ID)
  const now = new Date();
  const rescheduleOptions: Omit<RescheduleOption, 'id'>[] = aiOptions.map(option => ({
    bookingId: booking.id,
    suggestedTime: option.suggestedTime,
    reasoning: option.reasoning,
    priority: option.priority,
    studentAvailable: option.studentAvailable,
    instructorAvailable: option.instructorAvailable,
    aircraftAvailable: option.aircraftAvailable,
    weatherForecast: option.weatherLikelihood,
    createdAt: now,
  }));
  
  // Validate we have exactly 3 options
  if (rescheduleOptions.length !== 3) {
    throw new Error(
      `Expected 3 reschedule options, got ${rescheduleOptions.length}`
    );
  }
  
  // Log summary
  console.log(`✅ Successfully generated reschedule options:`);
  rescheduleOptions.forEach(option => {
    console.log(`   ${option.priority}. ${option.suggestedTime.toLocaleString()} - ${option.reasoning.substring(0, 60)}...`);
  });
  
  return rescheduleOptions;
}

/**
 * Preview reschedule options without saving
 * Useful for testing and debugging
 */
export async function previewRescheduleOptions(
  booking: Booking,
  weatherCheck: WeatherCheck
): Promise<{
  booking: Booking;
  weatherCheck: WeatherCheck;
  studentSlots: number;
  instructorSlots: number;
  aircraftSlots: number;
  overlappingSlots: number;
  options: Omit<RescheduleOption, 'id'>[];
}> {
  const studentAvailability = await getStudentAvailability(
    booking.studentId,
    booking.trainingLevel
  );
  
  const instructorAvailability = await getInstructorAvailability(
    booking.instructorName
  );
  
  const aircraftAvailability = await getAircraftAvailability(
    booking.aircraftId
  );
  
  const overlappingSlots = findOverlappingAvailability(
    studentAvailability,
    instructorAvailability,
    aircraftAvailability
  );
  
  const options = await generateRescheduleOptions(booking, weatherCheck);
  
  return {
    booking,
    weatherCheck,
    studentSlots: studentAvailability.length,
    instructorSlots: instructorAvailability.length,
    aircraftSlots: aircraftAvailability.length,
    overlappingSlots: overlappingSlots.length,
    options,
  };
}

