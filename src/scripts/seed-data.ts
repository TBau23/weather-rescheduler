import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { Student, Booking, TrainingLevel, BookingStatus } from '@/types';

// Sample airports for realistic locations with diverse weather patterns
// Chosen to maximize likelihood of interesting weather for demos
//
// Note: Airport codes use ICAO format (KXXX) where:
// - K = United States (ICAO prefix)
// - XXX = 3-letter FAA code (e.g., SAN, SEA, ORD)
// This is standard aviation notation - US airports always have "K" prefix in ICAO format
const AIRPORTS = [
  // California - typically good weather (safe baseline)
  { name: 'San Diego Intl', code: 'KSAN', lat: 32.7338, lon: -117.1933 },
  
  // Pacific Northwest - often cloudy/rainy (good for IMC scenarios)
  { name: 'Seattle-Tacoma Intl', code: 'KSEA', lat: 47.4502, lon: -122.3088 },
  
  // Midwest - variable weather, thunderstorms (good for conflicts)
  { name: 'Chicago O\'Hare', code: 'KORD', lat: 41.9742, lon: -87.9073 },
  
  // Mountain - wind/turbulence (good for student pilot conflicts)
  { name: 'Denver Intl', code: 'KDEN', lat: 39.8561, lon: -104.6737 },
  
  // South - humid, thunderstorms common (diverse conditions)
  { name: 'Houston Hobby', code: 'KHOU', lat: 29.6454, lon: -95.2789 },
];

// Sample student data - expanded for realistic variety
const SAMPLE_STUDENTS = [
  // Student pilots (5)
  { name: 'Alex Thompson', trainingLevel: 'student' as TrainingLevel, email: 'alex.thompson@example.com', phone: '(555) 123-4567' },
  { name: 'Sarah Chen', trainingLevel: 'student' as TrainingLevel, email: 'sarah.chen@example.com', phone: '(555) 234-5678' },
  { name: 'Michael Rodriguez', trainingLevel: 'student' as TrainingLevel, email: 'michael.rodriguez@example.com', phone: '(555) 345-6789' },
  { name: 'Jennifer Wilson', trainingLevel: 'student' as TrainingLevel, email: 'jennifer.wilson@example.com', phone: '(555) 111-2222' },
  { name: 'Tom Anderson', trainingLevel: 'student' as TrainingLevel, email: 'tom.anderson@example.com', phone: '(555) 333-4444' },
  
  // Private pilots (5)
  { name: 'Emily Johnson', trainingLevel: 'private' as TrainingLevel, email: 'emily.johnson@example.com', phone: '(555) 456-7890' },
  { name: 'David Kim', trainingLevel: 'private' as TrainingLevel, email: 'david.kim@example.com', phone: '(555) 567-8901' },
  { name: 'Jessica Martinez', trainingLevel: 'private' as TrainingLevel, email: 'jessica.martinez@example.com', phone: '(555) 678-9012' },
  { name: 'Chris Taylor', trainingLevel: 'private' as TrainingLevel, email: 'chris.taylor@example.com', phone: '(555) 555-6666' },
  { name: 'Lauren White', trainingLevel: 'private' as TrainingLevel, email: 'lauren.white@example.com', phone: '(555) 777-8888' },
  
  // Instrument pilots (3)
  { name: 'Ryan Foster', trainingLevel: 'instrument' as TrainingLevel, email: 'ryan.foster@example.com', phone: '(555) 789-0123' },
  { name: 'Amanda Liu', trainingLevel: 'instrument' as TrainingLevel, email: 'amanda.liu@example.com', phone: '(555) 890-1234' },
  { name: 'Mark Stevens', trainingLevel: 'instrument' as TrainingLevel, email: 'mark.stevens@example.com', phone: '(555) 999-0000' },
  
  // Commercial pilots (2)
  { name: 'Brandon Scott', trainingLevel: 'commercial' as TrainingLevel, email: 'brandon.scott@example.com', phone: '(555) 901-2345' },
  { name: 'Rachel Green', trainingLevel: 'commercial' as TrainingLevel, email: 'rachel.green@example.com', phone: '(555) 012-3456' },
];

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
 * Generate fixed time slots for deterministic, conflict-free seed data
 * Creates 20+ unique time slots across 2 days
 */
function generateFixedTimeSlots(): Date[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  const slots: Date[] = [];
  
  // Day 1 (Tomorrow): 8am, 10am, 12pm, 2pm, 4pm (5 slots)
  const day1Hours = [8, 10, 12, 14, 16];
  day1Hours.forEach(hour => {
    const slot = new Date(tomorrow);
    slot.setHours(hour, 0, 0, 0);
    slots.push(slot);
  });
  
  // Day 2 (Day After): 8am, 10am, 12pm, 2pm, 4pm (5 slots)
  const day2Hours = [8, 10, 12, 14, 16];
  day2Hours.forEach(hour => {
    const slot = new Date(dayAfter);
    slot.setHours(hour, 0, 0, 0);
    slots.push(slot);
  });
  
  // Add more slots for flexibility (9am, 11am, 1pm, 3pm, 5pm each day)
  const extraHours = [9, 11, 13, 15, 17];
  extraHours.forEach(hour => {
    const slot1 = new Date(tomorrow);
    slot1.setHours(hour, 0, 0, 0);
    slots.push(slot1);
    
    const slot2 = new Date(dayAfter);
    slot2.setHours(hour, 0, 0, 0);
    slots.push(slot2);
  });
  
  return slots;
}

/**
 * Get random item from array
 */
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate students for seeding
 */
export function generateStudents(): any[] {
  const now = Timestamp.now();
  return SAMPLE_STUDENTS.map(student => ({
    ...student,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Generate bookings for seeding
 * Strategy: Fixed time slots, deterministic assignments, ZERO conflicts
 * 
 * Rules:
 * - Each booking gets ONE unique time slot
 * - Students with 2 bookings on same day = same airport
 * - One instructor per time slot (impossible conflicts)
 * - Simple, clean, predictable demo data
 */
export function generateBookings(studentIds: string[]): any[] {
  const bookings: any[] = [];
  const now = Timestamp.now();
  
  // Generate 20 fixed time slots
  const timeSlots = generateFixedTimeSlots();
  
  // Track which students get how many bookings
  const studentBookingPlan = [
    { studentIndex: 0, count: 1 },  // Alex Thompson (student) - 1 booking
    { studentIndex: 1, count: 1 },  // Sarah Chen (student) - 1 booking
    { studentIndex: 2, count: 1 },  // Michael Rodriguez (student) - 1 booking
    { studentIndex: 3, count: 2 },  // Jennifer Wilson (student) - 2 bookings
    { studentIndex: 4, count: 2 },  // Tom Anderson (student) - 2 bookings
    { studentIndex: 5, count: 1 },  // Emily Johnson (private) - 1 booking
    { studentIndex: 6, count: 2 },  // David Kim (private) - 2 bookings
    { studentIndex: 7, count: 1 },  // Jessica Martinez (private) - 1 booking
    { studentIndex: 8, count: 2 },  // Chris Taylor (private) - 2 bookings
    { studentIndex: 9, count: 1 },  // Lauren White (private) - 1 booking
    { studentIndex: 10, count: 2 }, // Ryan Foster (instrument) - 2 bookings
    { studentIndex: 11, count: 1 }, // Amanda Liu (instrument) - 1 booking
    { studentIndex: 12, count: 2 }, // Mark Stevens (instrument) - 2 bookings
    { studentIndex: 13, count: 1 }, // Brandon Scott (commercial) - 1 booking
    { studentIndex: 14, count: 1 }, // Rachel Green (commercial) - 1 booking
  ];
  
  // Track student schedules for same-day airport logic
  const studentSchedules = new Map<number, Array<{ time: Date, airportIndex: number }>>();
  
  let slotIndex = 0;
  
  for (const plan of studentBookingPlan) {
    const studentIndex = plan.studentIndex;
    const studentId = studentIds[studentIndex];
    const studentData = SAMPLE_STUDENTS[studentIndex];
    
    if (!studentSchedules.has(studentIndex)) {
      studentSchedules.set(studentIndex, []);
    }
    
    for (let b = 0; b < plan.count; b++) {
      if (slotIndex >= timeSlots.length) break; // Safety check
      
      const bookingTime = timeSlots[slotIndex];
      const schedule = studentSchedules.get(studentIndex)!;
      
      // Determine airport based on same-day constraint
      let airportIndex: number;
      const sameDay = schedule.find(s => s.time.toDateString() === bookingTime.toDateString());
      
      if (sameDay) {
        // Same day = same airport
        airportIndex = sameDay.airportIndex;
        console.log(`   📍 ${studentData.name} has 2nd booking same day, using same airport`);
      } else {
        // New day, assign based on training level
        const trainingLevel = studentData.trainingLevel;
        if (trainingLevel === 'student') {
          airportIndex = [2, 3, 1][slotIndex % 3]; // Chicago, Denver, Seattle
        } else if (trainingLevel === 'private') {
          airportIndex = slotIndex % 5; // All airports
        } else if (trainingLevel === 'instrument') {
          airportIndex = [1, 4][slotIndex % 2]; // Seattle, Houston
        } else {
          airportIndex = [0, 3][slotIndex % 2]; // San Diego, Denver
        }
      }
      
      schedule.push({ time: bookingTime, airportIndex });
      
      const airport = AIRPORTS[airportIndex];
      const instructor = INSTRUCTORS[slotIndex % INSTRUCTORS.length]; // Round-robin instructors
      const aircraft = AIRCRAFT_IDS[slotIndex % AIRCRAFT_IDS.length]; // Round-robin aircraft
      
      bookings.push({
        studentId,
        studentName: studentData.name,
        instructorName: instructor,
        aircraftId: aircraft,
        scheduledTime: Timestamp.fromDate(bookingTime),
        duration: 60,
        location: {
          name: `${airport.name} (${airport.code})`,
          lat: airport.lat,
          lon: airport.lon,
        },
        status: 'scheduled',
        trainingLevel: studentData.trainingLevel,
        createdAt: now,
        updatedAt: now,
      });
      
      slotIndex++;
    }
  }
  
  // Sort by scheduled time
  bookings.sort((a, b) => a.scheduledTime.toMillis() - b.scheduledTime.toMillis());
  
  console.log(`   ✅ Generated ${bookings.length} bookings with FIXED time slots`);
  console.log(`   ✅ Zero conflicts guaranteed - each booking has unique time`);
  console.log(`   ✅ Students with multiple bookings on same day = same airport`);
  
  return bookings;
}

/**
 * Clear all collections (optional - use with caution!)
 */
export async function clearCollections(): Promise<void> {
  console.log('🗑️  Clearing existing data...');
  
  const collections = ['students', 'bookings', 'weatherChecks', 'notifications'];
  
  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName));
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`   Cleared ${snapshot.docs.length} documents from ${collectionName}`);
  }
}

/**
 * Seed the database with initial data
 */
export async function seedDatabase(clearFirst: boolean = false): Promise<{
  studentsCreated: number;
  bookingsCreated: number;
}> {
  console.log('🌱 Starting database seed...');

  // Optionally clear existing data
  if (clearFirst) {
    await clearCollections();
  }

  // Generate and insert students
  console.log('👨‍🎓 Creating students...');
  const students = generateStudents();
  const studentIds: string[] = [];

  for (const student of students) {
    const studentData = {
      name: student.name,
      email: student.email,
      phone: student.phone,
      trainingLevel: student.trainingLevel,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
    
    console.log('   📝 Attempting to create student:', JSON.stringify({
      ...studentData,
      createdAt: studentData.createdAt.toDate().toISOString(),
      updatedAt: studentData.updatedAt.toDate().toISOString(),
    }, null, 2));
    
    try {
      const docRef = await addDoc(collection(db, 'students'), studentData);
      studentIds.push(docRef.id);
      console.log(`   ✅ Created student: ${student.name} (${docRef.id})`);
    } catch (error) {
      console.error('   ❌ Failed to create student:', student.name);
      console.error('   Error:', error);
      console.error('   Student data:', studentData);
      throw error;
    }
  }
  console.log(`   ✅ Created ${students.length} students total`);

  // Generate and insert bookings
  console.log('📅 Creating bookings...');
  const bookings = generateBookings(studentIds);
  
  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const bookingData = {
      studentId: booking.studentId,
      studentName: booking.studentName,
      instructorName: booking.instructorName,
      aircraftId: booking.aircraftId,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration,
      location: booking.location,
      status: booking.status,
      trainingLevel: booking.trainingLevel,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
    
    console.log(`   📝 Creating booking ${i + 1}/${bookings.length} for ${booking.studentName}`);
    
    try {
      const docRef = await addDoc(collection(db, 'bookings'), bookingData);
      console.log(`   ✅ Created booking ${docRef.id}`);
    } catch (error) {
      console.error(`   ❌ Failed to create booking ${i + 1}`);
      console.error('   Error:', error);
      console.error('   Booking data:', {
        ...bookingData,
        scheduledTime: bookingData.scheduledTime.toDate().toISOString(),
        createdAt: bookingData.createdAt.toDate().toISOString(),
        updatedAt: bookingData.updatedAt.toDate().toISOString(),
      });
      throw error;
    }
  }
  console.log(`   ✅ Created ${bookings.length} bookings total`);

  console.log('🎉 Seed complete!');

  return {
    studentsCreated: students.length,
    bookingsCreated: bookings.length,
  };
}

