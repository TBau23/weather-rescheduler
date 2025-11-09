#!/usr/bin/env node

/**
 * Simple Firebase connectivity test
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';

async function testFirebase() {
  console.log('🔥 Testing Firebase connection...\n');

  try {
    // Test 1: Simple write
    console.log('Test 1: Writing a simple document...');
    const testData = {
      message: 'Hello Firebase',
      timestamp: Timestamp.now(),
      number: 42,
      flag: true,
    };
    
    console.log('Data:', testData);
    const docRef = await addDoc(collection(db, 'test'), testData);
    console.log('✅ Write successful! Doc ID:', docRef.id);

    // Test 2: Read it back
    console.log('\nTest 2: Reading documents...');
    const snapshot = await getDocs(collection(db, 'test'));
    console.log('✅ Found', snapshot.docs.length, 'documents');

    // Test 3: Clean up
    console.log('\nTest 3: Cleaning up...');
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
    }
    console.log('✅ Cleanup complete');

    console.log('\n🎉 All tests passed! Firebase is working correctly.');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Firebase test failed!');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    console.log('\n💡 Possible issues:');
    console.log('1. Check Firebase security rules (should be in test mode)');
    console.log('2. Verify .env.local has correct Firebase credentials');
    console.log('3. Ensure Firestore database is created in Firebase Console');
    
    process.exit(1);
  }
}

testFirebase();

