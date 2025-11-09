#!/usr/bin/env node

/**
 * Check Firebase configuration
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

console.log('🔍 Checking Firebase Configuration...\n');

console.log('Environment Variables:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅ Set' : '❌ Missing');

console.log('\n📋 Firebase Config Object:');
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
console.log(JSON.stringify(config, null, 2));

console.log('\n💡 Checking for issues:');
if (!config.projectId) {
  console.log('❌ Missing projectId - this is required!');
}
if (config.projectId && config.projectId.includes('your_project') || config.projectId === 'your_project_id') {
  console.log('❌ projectId still has placeholder value!');
}
if (!config.apiKey || config.apiKey.includes('your_')) {
  console.log('❌ API key is missing or has placeholder value!');
}

console.log('\n📍 Expected Firestore URL:');
console.log(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`);

console.log('\n🔗 Firebase Console URL:');
console.log(`https://console.firebase.google.com/project/${config.projectId}/firestore`);

