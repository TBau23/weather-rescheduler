#!/usr/bin/env node

/**
 * Debug Firebase field by field
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../lib/firebase';
import { collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

async function testFields() {
  console.log('🔍 Testing each field individually...\n');

  const tests = [
    {
      name: 'Test 1: Just a string',
      data: { test: 'hello' }
    },
    {
      name: 'Test 2: String field called "name"',
      data: { name: 'Alex Thompson' }
    },
    {
      name: 'Test 3: Multiple strings',
      data: { 
        name: 'Alex Thompson',
        email: 'alex@example.com'
      }
    },
    {
      name: 'Test 4: With phone',
      data: { 
        name: 'Alex Thompson',
        email: 'alex@example.com',
        phone: '(555) 123-4567'
      }
    },
    {
      name: 'Test 5: With trainingLevel',
      data: { 
        name: 'Alex Thompson',
        email: 'alex@example.com',
        phone: '(555) 123-4567',
        trainingLevel: 'student'
      }
    },
    {
      name: 'Test 6: With serverTimestamp()',
      data: { 
        name: 'Alex Thompson',
        email: 'alex@example.com',
        phone: '(555) 123-4567',
        trainingLevel: 'student',
        createdAt: serverTimestamp()
      }
    },
    {
      name: 'Test 7: With Timestamp.now()',
      data: { 
        name: 'Alex Thompson',
        email: 'alex@example.com',
        phone: '(555) 123-4567',
        trainingLevel: 'student',
        createdAt: Timestamp.now()
      }
    },
  ];

  for (const test of tests) {
    try {
      console.log(`${test.name}...`);
      console.log('  Data:', JSON.stringify(test.data, null, 2));
      const docRef = await addDoc(collection(db, 'debug_test'), test.data);
      console.log(`  ✅ SUCCESS! Doc ID: ${docRef.id}\n`);
    } catch (error: any) {
      console.log(`  ❌ FAILED!`);
      console.log(`  Error: ${error.message}`);
      console.log(`  Code: ${error.code}\n`);
      console.log('  ^ This is the problematic field combination!\n');
      break; // Stop at first failure
    }
  }

  process.exit(0);
}

testFields();

