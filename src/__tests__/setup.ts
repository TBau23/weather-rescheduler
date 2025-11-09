import { expect } from 'vitest';

// Setup file for global test configuration
// This runs before all tests

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key-12345';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-firebase-key';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';

export {};

