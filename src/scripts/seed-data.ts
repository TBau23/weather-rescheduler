import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { Student, Booking, TrainingLevel, BookingStatus } from '@/types';

// Sample airports for realistic locations (focused on 3 for demo)
const AIRPORTS = [
  { name: 'Los Angeles LAX', code: 'KLAX', lat: 33.9416, lon: -118.4085 },
  { name: 'Chicago O\'Hare', code: 'KORD', lat: 41.9742, lon: -87.9073 },
  { name: 'Dallas/Fort Worth', code: 'KDFW', lat: 32.8998, lon: -97.0403 },
];

// Sample student data
const SAMPLE_STUDENTS = [
  { name: 'Alex Thompson', trainingLevel: 'student' as TrainingLevel, email: 'alex.thompson@example.com', phone: '(555) 123-4567' },
  { name: 'Sarah Chen', trainingLevel: 'student' as TrainingLevel, email: 'sarah.chen@example.com', phone: '(555) 234-5678' },
  { name: 'Michael Rodriguez', trainingLevel: 'student' as TrainingLevel, email: 'michael.rodriguez@example.com', phone: '(555) 345-6789' },
  { name: 'Emily Johnson', trainingLevel: 'private' as TrainingLevel, email: 'emily.johnson@example.com', phone: '(555) 456-7890' },
  { name: 'David Kim', trainingLevel: 'private' as TrainingLevel, email: 'david.kim@example.com', phone: '(555) 567-8901' },
  { name: 'Jessica Martinez', trainingLevel: 'private' as TrainingLevel, email: 'jessica.martinez@example.com', phone: '(555) 678-9012' },
  { name: 'Ryan Foster', trainingLevel: 'instrument' as TrainingLevel, email: 'ryan.foster@example.com', phone: '(555) 789-0123' },
  { name: 'Amanda Liu', trainingLevel: 'instrument' as TrainingLevel, email: 'amanda.liu@example.com', phone: '(555) 890-1234' },
  { name: 'Brandon Scott', trainingLevel: 'commercial' as TrainingLevel, email: 'brandon.scott@example.com', phone: '(555) 901-2345' },
  { name: 'Rachel Green', trainingLevel: 'commercial' as TrainingLevel, email: 'rachel.green@example.com', phone: '(555) 012-3456' },
];

const INSTRUCTORS = [
  'Captain Smith',
  'Chief Instructor Davis',
  'CFI Johnson',
  'CFII Williams',
  'Captain Brown',
];

const AIRCRAFT_IDS = [
  'N12345',
  'N67890',
  'N24680',
  'N13579',
  'N98765',
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
 * Strategy: 20 bookings total, 1-2 per student, ALL within next 24-48 hours
 */
export function generateBookings(studentIds: string[]): any[] {
  const bookings: any[] = [];
  const now = Timestamp.now();
  
  // Time slot distribution for 20 bookings
  const timeSlots: ('morning' | 'afternoon' | 'nextmorning')[] = [
    ...Array(7).fill('morning'),      // Tomorrow morning
    ...Array(8).fill('afternoon'),    // Tomorrow afternoon
    ...Array(5).fill('nextmorning'),  // Day after morning
  ];
  
  // Shuffle time slots for variety
  timeSlots.sort(() => Math.random() - 0.5);
  
  // Create 20 bookings: 1-2 per student (10 students)
  // First 10 bookings: one per student
  // Next 10 bookings: second booking for each student
  for (let i = 0; i < 20; i++) {
    const studentIndex = i < 10 ? i : i - 10; // First pass: 0-9, second pass: 0-9 again
    const studentId = studentIds[studentIndex];
    const studentData = SAMPLE_STUDENTS[studentIndex];
    const airport = AIRPORTS[i % 3]; // Rotate through 3 airports
    const timeSlot = timeSlots[i];
    const futureDate = getDateWithin48Hours(timeSlot);
    
    bookings.push({
      studentId,
      studentName: studentData.name,
      instructorName: randomItem(INSTRUCTORS),
      aircraftId: randomItem(AIRCRAFT_IDS),
      scheduledTime: Timestamp.fromDate(futureDate),
      duration: 60, // 1 hour lessons
      location: {
        name: `${airport.name} (${airport.code})`,
        lat: airport.lat,
        lon: airport.lon,
      },
      status: 'scheduled', // All start as scheduled (no pre-seeded conflicts)
      trainingLevel: studentData.trainingLevel,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Sort by scheduled time
  bookings.sort((a, b) => a.scheduledTime.toMillis() - b.scheduledTime.toMillis());

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

