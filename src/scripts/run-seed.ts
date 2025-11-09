#!/usr/bin/env node

/**
 * CLI script to seed the database
 * Usage: npm run seed [-- --clear]
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { seedDatabase } from './seed-data';

async function main() {
  const clearFirst = process.argv.includes('--clear');

  if (clearFirst) {
    console.log('⚠️  Will clear existing data before seeding');
  }

  try {
    const result = await seedDatabase(clearFirst);
    console.log('\n✅ Success!');
    console.log(`   Students: ${result.studentsCreated}`);
    console.log(`   Bookings: ${result.bookingsCreated}`);
    console.log('\n📊 View data in Firebase Console:');
    console.log('   https://console.firebase.google.com/');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  }
}

main();

