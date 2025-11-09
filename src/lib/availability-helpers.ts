import { TrainingLevel } from '@/types';

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
];

// Seeded aircraft from seed-data.ts
const AIRCRAFT_IDS = [
  'N12345',
  'N67890',
  'N24680',
  'N13579',
  'N98765',
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
 * Get student availability based on training level
 * 
 * Student pilots: Prefer afternoons/evenings (after 2pm)
 * Private pilots: More flexible, weekday afternoons + weekends
 * Instrument pilots: Can include early mornings and evenings
 * Commercial pilots: Most flexible schedule
 */
export function getStudentAvailability(
  studentId: string,
  trainingLevel: TrainingLevel
): TimeSlot[] {
  const baseSlots = generateBaseTimeSlots();
  const availableSlots: TimeSlot[] = [];
  
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
          availableSlots.push(slot);
        }
        break;
        
      case 'private':
        // Private pilots more flexible
        // Weekday afternoons + weekends
        if ((hour >= 12 && !isWeekend) || isWeekend) {
          availableSlots.push(slot);
        }
        break;
        
      case 'instrument':
        // Instrument pilots can fly early morning and evening
        // More flexible schedule
        if (hour >= 7 || isWeekend) {
          availableSlots.push(slot);
        }
        break;
        
      case 'commercial':
        // Commercial pilots most flexible - any time
        availableSlots.push(slot);
        break;
    }
  });
  
  return availableSlots;
}

/**
 * Get instructor availability based on their specific schedule
 * Each instructor has different availability patterns to simulate reality
 */
export function getInstructorAvailability(instructorName: string): TimeSlot[] {
  if (!INSTRUCTORS.includes(instructorName)) {
    // Unknown instructor, return empty
    return [];
  }
  
  const baseSlots = generateBaseTimeSlots();
  const availableSlots: TimeSlot[] = [];
  
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
    }
    
    if (isAvailable) {
      availableSlots.push(slot);
    }
  });
  
  return availableSlots;
}

/**
 * Get aircraft availability based on existing bookings
 * Simulates realistic aircraft scheduling with some times already booked
 */
export function getAircraftAvailability(aircraftId: string): TimeSlot[] {
  if (!AIRCRAFT_IDS.includes(aircraftId)) {
    // Unknown aircraft, return empty
    return [];
  }
  
  const baseSlots = generateBaseTimeSlots();
  const availableSlots: TimeSlot[] = [];
  
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
      availableSlots.push(slot);
    }
  });
  
  return availableSlots;
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
 * Check if two time slots overlap
 */
function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  // Slots overlap if one starts before the other ends
  return slot1.start < slot2.end && slot2.start < slot1.end;
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

