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
 * Generate date within next 24-48 hours (all bookings meaningful for weather check)
 */
function getDateWithin48Hours(preferredSlot: 'morning' | 'afternoon' | 'nextmorning'): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  if (preferredSlot === 'morning') {
    // Tomorrow morning: 8am-12pm
    const hour = 8 + Math.floor(Math.random() * 4);
    tomorrow.setHours(hour, 0, 0, 0);
    return tomorrow;
  } else if (preferredSlot === 'afternoon') {
    // Tomorrow afternoon: 1pm-5pm
    const hour = 13 + Math.floor(Math.random() * 4);
    tomorrow.setHours(hour, 0, 0, 0);
    return tomorrow;
  } else {
    // Day after tomorrow morning: 8am-12pm
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const hour = 8 + Math.floor(Math.random() * 4);
    dayAfter.setHours(hour, 0, 0, 0);
    return dayAfter;
  }
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
 * Strategy: 20 bookings, 1-2 per student, ALL within next 24-48 hours
 * Smart logic prevents:
 * - Same instructor booked twice at same time
 * - Same student in two different locations on same day
 * - Students with multiple bookings same day = same location
 */
export function generateBookings(studentIds: string[]): any[] {
  const bookings: any[] = [];
  const now = Timestamp.now();
  
  // Track instructor availability: Map<timeKey, Set<instructorName>>
  const instructorBookings = new Map<string, Set<string>>();
  
  // Track student bookings: Map<studentId, Array<{time, airportIndex}>>
  const studentSchedule = new Map<string, Array<{time: Date, airportIndex: number}>>();
  
  // Helper to get available instructor
  const getAvailableInstructor = (time: Date): string => {
    const timeKey = time.toISOString();
    const bookedInstructors = instructorBookings.get(timeKey) || new Set();
    
    for (const instructor of INSTRUCTORS) {
      if (!bookedInstructors.has(instructor)) {
        return instructor;
      }
    }
    // Fallback (shouldn't happen with 8 instructors)
    return randomItem(INSTRUCTORS);
  };
  
  // Helper to book an instructor
  const bookInstructor = (instructor: string, time: Date) => {
    const timeKey = time.toISOString();
    if (!instructorBookings.has(timeKey)) {
      instructorBookings.set(timeKey, new Set());
    }
    instructorBookings.get(timeKey)!.add(instructor);
  };
  
  // Helper to get airport for student, considering same-day bookings
  const getAirportForStudent = (studentId: string, studentIndex: number, time: Date): number => {
    const schedule = studentSchedule.get(studentId) || [];
    const sameDay = time.toDateString();
    
    // Check if student has any bookings on the same day
    const sameDayBookings = schedule.filter(b => b.time.toDateString() === sameDay);
    
    if (sameDayBookings.length > 0) {
      // Use the same airport as the other booking(s) that day
      console.log(`   📍 ${SAMPLE_STUDENTS[studentIndex].name} already has booking on ${sameDay}, using same airport`);
      return sameDayBookings[0].airportIndex;
    }
    
    // No same-day booking, assign based on training level
    const trainingLevel = SAMPLE_STUDENTS[studentIndex].trainingLevel;
    
    if (trainingLevel === 'student') {
      // Student pilots: Chicago, Denver, Seattle (more challenging)
      return randomItem([2, 3, 1]);
    } else if (trainingLevel === 'private') {
      // Private pilots: Mix of all
      return randomItem([0, 1, 2, 3, 4]);
    } else if (trainingLevel === 'instrument') {
      // Instrument pilots: Seattle, Houston (IMC capable)
      return randomItem([1, 4]);
    } else {
      // Commercial: San Diego, Denver
      return randomItem([0, 3]);
    }
  };
  
  // Generate 20 bookings spread across 15 students (some get 1, some get 2)
  const bookingCounts = [
    1, 1, 1, 1, 1,  // Students 0-4: 1 booking each
    2, 2, 2, 2, 2,  // Students 5-9: 2 bookings each
    1, 1, 1, 1, 1,  // Students 10-14: 1 booking each
  ];
  
  let bookingIndex = 0;
  for (let studentIndex = 0; studentIndex < SAMPLE_STUDENTS.length && bookingIndex < 20; studentIndex++) {
    const studentId = studentIds[studentIndex];
    const studentData = SAMPLE_STUDENTS[studentIndex];
    const numBookings = bookingCounts[studentIndex] || 1;
    
    for (let b = 0; b < numBookings && bookingIndex < 20; b++) {
      // Generate time (distribute across tomorrow and day after)
      const slot = bookingIndex < 10 ? 'morning' : (bookingIndex < 16 ? 'afternoon' : 'nextmorning');
      const futureDate = getDateWithin48Hours(slot);
      
      // Get appropriate airport (respects same-day constraint)
      const airportIndex = getAirportForStudent(studentId, studentIndex, futureDate);
      const airport = AIRPORTS[airportIndex];
      
      // Track this booking for the student
      if (!studentSchedule.has(studentId)) {
        studentSchedule.set(studentId, []);
      }
      studentSchedule.get(studentId)!.push({ time: futureDate, airportIndex });
      
      // Get available instructor
      const instructor = getAvailableInstructor(futureDate);
      bookInstructor(instructor, futureDate);
      
      bookings.push({
        studentId,
        studentName: studentData.name,
        instructorName: instructor,
        aircraftId: randomItem(AIRCRAFT_IDS),
        scheduledTime: Timestamp.fromDate(futureDate),
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
      
      bookingIndex++;
    }
  }

  // Sort by scheduled time
  bookings.sort((a, b) => a.scheduledTime.toMillis() - b.scheduledTime.toMillis());

  console.log(`   ✅ Generated ${bookings.length} realistic bookings`);
  console.log(`   ✅ No instructor conflicts, no impossible student travel`);
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

