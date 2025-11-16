import { TrainingLevel, Booking } from '@/types';
import { db } from './firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

export interface TimeSlot {
  start: Date;
  end: Date;
}

// Seeded instructors from seed-data.ts
const INSTRUCTORS = [
  'Captain Smith',
  'Chief Instructor Davis',
  'CFI Johnson',
  'CFII Williams',
  'Captain Brown',
  'CFI Anderson',
  'CFII Martinez',
  'Captain Thompson',
];

// Seeded aircraft from seed-data.ts
const AIRCRAFT_IDS = [
  'N12345',
  'N67890',
  'N24680',
  'N13579',
  'N98765',
  'N11111',
  'N22222',
  'N33333',
];

/**
 * Generate time slots for the next 7 days within operational hours (7am-6pm)
 */
function generateBaseTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  
  // Generate slots for next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    
    // Generate hourly slots from 7am to 6pm (11 slots per day)
    for (let hour = 7; hour < 18; hour++) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(hour + 2, 0, 0, 0); // 2-hour lesson blocks
      
      // Only add future slots
      if (start > now) {
        slots.push({ start, end });
      }
    }
  }
  
  return slots;
}

/**
 * Fetch existing bookings from Firestore for a specific resource
 * @param filterField - Field to filter on ('studentId', 'instructorName', or 'aircraftId')
 * @param filterValue - Value to match
 * @param excludeBookingId - Optional booking ID to exclude (e.g., when rescheduling)
 * @returns Array of bookings
 */
async function fetchExistingBookings(
  filterField: 'studentId' | 'instructorName' | 'aircraftId',
  filterValue: string,
  excludeBookingId?: string
): Promise<Booking[]> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Query bookings in next 7 days for this resource
  const q = query(
    collection(db, 'bookings'),
    where(filterField, '==', filterValue),
    where('scheduledTime', '>=', Timestamp.fromDate(now)),
    where('scheduledTime', '<=', Timestamp.fromDate(sevenDaysFromNow))
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
  
  // Filter out cancelled bookings and optionally exclude a specific booking
  return bookings.filter(b => 
    b.status !== 'cancelled' && 
    (!excludeBookingId || b.id !== excludeBookingId)
  );
}

/**
 * Convert bookings to blocked time slots (with buffer time)
 * @param bookings - Array of existing bookings
 * @returns Array of time slots that are blocked
 */
function bookingsToBlockedSlots(bookings: Booking[]): TimeSlot[] {
  const blockedSlots: TimeSlot[] = [];
  
  for (const booking of bookings) {
    const start = new Date(booking.scheduledTime);
    const end = new Date(start.getTime() + booking.duration * 60 * 1000);
    
    // Add 30-minute buffer after each flight for turnaround/maintenance
    const bufferEnd = new Date(end.getTime() + 30 * 60 * 1000);
    
    blockedSlots.push({ start, end: bufferEnd });
  }
  
  return blockedSlots;
}

/**
 * Check if two time slots overlap
 */
function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.start < slot2.end && slot2.start < slot1.end;
}

/**
 * Filter available slots by removing blocked times
 * @param availableSlots - Candidate time slots
 * @param blockedSlots - Time slots that are already booked
 * @returns Filtered available slots
 */
function filterBlockedSlots(availableSlots: TimeSlot[], blockedSlots: TimeSlot[]): TimeSlot[] {
  return availableSlots.filter(available => {
    // Check if this available slot overlaps with any blocked slot
    return !blockedSlots.some(blocked => slotsOverlap(available, blocked));
  });
}

/**
 * Get student availability based on training level
 * 
 * Student pilots: Prefer afternoons/evenings (after 2pm)
 * Private pilots: More flexible, weekday afternoons + weekends
 * Instrument pilots: Can include early mornings and evenings
 * Commercial pilots: Most flexible schedule
 * 
 * Now queries real bookings from Firestore to exclude already-booked times
 * 
 * @param excludeBookingId - Optional booking ID to exclude (useful when rescheduling)
 */
export async function getStudentAvailability(
  studentId: string,
  trainingLevel: TrainingLevel,
  excludeBookingId?: string
): Promise<TimeSlot[]> {
  const baseSlots = generateBaseTimeSlots();
  const candidateSlots: TimeSlot[] = [];
  
  baseSlots.forEach((slot, index) => {
    const hour = slot.start.getHours();
    const dayOfWeek = slot.start.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Use student ID to create pseudo-random but consistent availability
    const slotHash = (studentId.charCodeAt(0) + index) % 10;
    const isAvailable = slotHash < 7; // ~70% availability base
    
    if (!isAvailable) return;
    
    // Training level specific patterns
    switch (trainingLevel) {
      case 'student':
        // Student pilots prefer afternoons (after 2pm) - more stable weather
        // Avoid early mornings (fog risk)
        if (hour >= 14 || (isWeekend && hour >= 10)) {
          candidateSlots.push(slot);
        }
        break;
        
      case 'private':
        // Private pilots more flexible
        // Weekday afternoons + weekends
        if ((hour >= 12 && !isWeekend) || isWeekend) {
          candidateSlots.push(slot);
        }
        break;
        
      case 'instrument':
        // Instrument pilots can fly early morning and evening
        // More flexible schedule
        if (hour >= 7 || isWeekend) {
          candidateSlots.push(slot);
        }
        break;
        
      case 'commercial':
        // Commercial pilots most flexible - any time
        candidateSlots.push(slot);
        break;
    }
  });
  
  // Fetch existing bookings for this student (excluding the current booking if rescheduling)
  const existingBookings = await fetchExistingBookings('studentId', studentId, excludeBookingId);
  const blockedSlots = bookingsToBlockedSlots(existingBookings);
  
  // Filter out times when student already has bookings
  return filterBlockedSlots(candidateSlots, blockedSlots);
}

/**
 * Get instructor availability based on their specific schedule
 * Each instructor has different availability patterns to simulate reality
 * 
 * Now queries real bookings from Firestore to exclude already-booked times
 * 
 * @param excludeBookingId - Optional booking ID to exclude (useful when rescheduling)
 */
export async function getInstructorAvailability(
  instructorName: string,
  excludeBookingId?: string
): Promise<TimeSlot[]> {
  if (!INSTRUCTORS.includes(instructorName)) {
    // Unknown instructor, return empty
    return [];
  }
  
  const baseSlots = generateBaseTimeSlots();
  const candidateSlots: TimeSlot[] = [];
  
  baseSlots.forEach((slot, index) => {
    const hour = slot.start.getHours();
    const dayOfWeek = slot.start.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Create different schedules for different instructors
    let isAvailable = false;
    
    switch (instructorName) {
      case 'Captain Smith':
        // Weekdays only, mornings and afternoons
        isAvailable = !isWeekend && hour >= 8 && hour <= 16 && index % 3 !== 0;
        break;
        
      case 'Chief Instructor Davis':
        // Limited availability (chief has admin duties)
        // Weekdays only, afternoons
        isAvailable = !isWeekend && hour >= 13 && hour <= 17 && index % 4 !== 0;
        break;
        
      case 'CFI Johnson':
        // Full week including weekends, all day
        isAvailable = hour >= 7 && hour <= 17 && index % 2 !== 0;
        break;
        
      case 'CFII Williams':
        // Instrument instructor - flexible hours
        // Including early morning and evening
        isAvailable = (hour >= 7 || hour >= 15) && index % 3 !== 0;
        break;
        
      case 'Captain Brown':
        // Weekend specialist + some weekday afternoons
        isAvailable = (isWeekend || (hour >= 14 && !isWeekend)) && index % 3 !== 0;
        break;
        
      case 'CFI Anderson':
        // Full-time instructor - weekdays all day
        isAvailable = !isWeekend && hour >= 8 && hour <= 17 && index % 2 !== 0;
        break;
        
      case 'CFII Martinez':
        // Instrument instructor - flexible schedule including weekends
        isAvailable = hour >= 8 && hour <= 17 && index % 3 !== 0;
        break;
        
      case 'Captain Thompson':
        // Experienced instructor - weekdays and Saturday mornings
        isAvailable = (!isWeekend && hour >= 7 && hour <= 16) || (dayOfWeek === 6 && hour >= 8 && hour <= 12);
        break;
    }
    
    if (isAvailable) {
      candidateSlots.push(slot);
    }
  });
  
  // Fetch existing bookings for this instructor (excluding the current booking if rescheduling)
  const existingBookings = await fetchExistingBookings('instructorName', instructorName, excludeBookingId);
  const blockedSlots = bookingsToBlockedSlots(existingBookings);
  
  // Filter out times when instructor already has bookings
  return filterBlockedSlots(candidateSlots, blockedSlots);
}

/**
 * Get aircraft availability based on existing bookings
 * Queries real Firestore bookings and applies maintenance windows
 * 
 * @param excludeBookingId - Optional booking ID to exclude (useful when rescheduling)
 */
export async function getAircraftAvailability(
  aircraftId: string,
  excludeBookingId?: string
): Promise<TimeSlot[]> {
  if (!AIRCRAFT_IDS.includes(aircraftId)) {
    // Unknown aircraft, return empty
    return [];
  }
  
  const baseSlots = generateBaseTimeSlots();
  const candidateSlots: TimeSlot[] = [];
  
  baseSlots.forEach((slot, index) => {
    const hour = slot.start.getHours();
    const dayOfWeek = slot.start.getDay();
    
    // Create different booking patterns for different aircraft
    const aircraftIndex = AIRCRAFT_IDS.indexOf(aircraftId);
    const slotHash = (aircraftIndex * 7 + index) % 10;
    
    // Each aircraft has ~65% availability (some times booked)
    const isAvailable = slotHash < 6.5;
    
    // Simulate maintenance windows
    const isMaintenanceDay = dayOfWeek === 1 && aircraftId === 'N12345'; // Monday maintenance for N12345
    const isMaintenanceDay2 = dayOfWeek === 3 && aircraftId === 'N67890'; // Wednesday for N67890
    
    if (isAvailable && !isMaintenanceDay && !isMaintenanceDay2) {
      candidateSlots.push(slot);
    }
  });
  
  // Fetch existing bookings for this aircraft (excluding the current booking if rescheduling)
  const existingBookings = await fetchExistingBookings('aircraftId', aircraftId, excludeBookingId);
  const blockedSlots = bookingsToBlockedSlots(existingBookings);
  
  // Filter out times when aircraft already has bookings
  return filterBlockedSlots(candidateSlots, blockedSlots);
}

/**
 * Find overlapping availability across student, instructor, and aircraft
 * Returns only times when ALL three are available simultaneously
 */
export function findOverlappingAvailability(
  studentSlots: TimeSlot[],
  instructorSlots: TimeSlot[],
  aircraftSlots: TimeSlot[]
): TimeSlot[] {
  if (studentSlots.length === 0 || instructorSlots.length === 0 || aircraftSlots.length === 0) {
    return [];
  }
  
  const overlapping: TimeSlot[] = [];
  
  // For each student slot, check if there's a matching instructor and aircraft slot
  studentSlots.forEach(studentSlot => {
    const hasInstructorMatch = instructorSlots.some(instructorSlot =>
      slotsOverlap(studentSlot, instructorSlot)
    );
    
    const hasAircraftMatch = aircraftSlots.some(aircraftSlot =>
      slotsOverlap(studentSlot, aircraftSlot)
    );
    
    // Only add if ALL three have overlapping availability
    if (hasInstructorMatch && hasAircraftMatch) {
      overlapping.push(studentSlot);
    }
  });
  
  return overlapping;
}

/**
 * Format time slots for display
 */
export function formatTimeSlot(slot: TimeSlot): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  return `${slot.start.toLocaleString('en-US', options)} - ${slot.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

