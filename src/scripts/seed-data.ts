import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { Student, Booking, TrainingLevel, BookingStatus } from '@/types';

// Sample airports for realistic locations
const AIRPORTS = [
  { name: 'New York JFK', code: 'KJFK', lat: 40.6413, lon: -73.7781 },
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
 * Generate random date in the next 7 days
 */
function getRandomFutureDate(): Date {
  const now = new Date();
  const daysAhead = Math.floor(Math.random() * 7) + 1; // 1-7 days
  const hoursInDay = Math.floor(Math.random() * 11) + 7; // 7am-6pm
  
  const date = new Date(now);
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hoursInDay, 0, 0, 0); // On the hour
  
  return date;
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
 */
export function generateBookings(studentIds: string[]): any[] {
  const bookings: any[] = [];
  const now = Timestamp.now();
  
  // Create 50 bookings - all scheduled (let weather check create conflicts naturally)
  const statuses: BookingStatus[] = [
    ...Array(46).fill('scheduled'),
    ...Array(4).fill('confirmed'),
  ];

  for (let i = 0; i < 50; i++) {
    const studentIndex = Math.floor(Math.random() * studentIds.length);
    const studentId = studentIds[studentIndex];
    const studentData = SAMPLE_STUDENTS[studentIndex];
    const airport = randomItem(AIRPORTS);
    const futureDate = getRandomFutureDate();
    
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
      status: statuses[i],
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

