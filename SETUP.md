# Weather Rescheduler - Setup Guide

## Prerequisites
- Node.js 18+ installed
- npm or yarn
- Git

## API Keys Required

### 1. Firebase Setup (5 minutes)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or use existing project
3. Enter project name (e.g., "weather-rescheduler")
4. Disable Google Analytics (optional for this project)
5. Once created, click "Web" icon (</>) to add a web app
6. Register app with nickname "Weather Rescheduler"
7. Copy the config values to `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
8. In Firebase Console, go to "Build" → "Firestore Database"
9. Click "Create Database"
10. Choose "Start in test mode" (we'll add security rules later)
11. Select a location (choose closest to you)

### 2. OpenWeatherMap API Key (2 minutes)
1. Go to [OpenWeatherMap](https://openweathermap.org/api)
2. Click "Sign Up" (free account)
3. Verify your email
4. Go to "API keys" tab
5. Copy the default API key (or create a new one)
6. Add to `.env.local`:
   ```
   OPENWEATHERMAP_API_KEY=your_key_here
   ```
7. Note: Free tier includes 1,000 calls/day, 60 calls/minute

### 3. OpenAI API Key (2 minutes)
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create account
3. Go to "API keys" section
4. Click "Create new secret key"
5. Copy the key (you won't see it again!)
6. Add to `.env.local`:
   ```
   OPENAI_API_KEY=sk-...
   ```
7. Note: You'll need billing set up for GPT-4 access

### 4. Resend API Key (3 minutes)
1. Go to [Resend](https://resend.com/)
2. Sign up for free account
3. Verify your email
4. Go to "API Keys" section
5. Click "Create API Key"
6. Give it a name (e.g., "Weather Rescheduler")
7. Copy the key
8. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_...
   ```
9. Note: Free tier includes 100 emails/day, 1 API key
10. For testing, use `onboarding@resend.dev` as FROM email
11. For production, add and verify your domain

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify Environment Variables
```bash
# Check that .env.local has all required keys
cat .env.local
```

### 3. Test Firebase Connection
```bash
npm run dev
```
Visit http://localhost:3000 - if no Firebase errors appear in console, you're good!

### 4. Initialize Git Repository (if not done)
```bash
git init
git add .
git commit -m "Initial setup with API integrations"
```

## Project Structure
```
weather-rescheduler/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── api/          # API routes (will be created)
│   │   ├── components/   # React components (will be created)
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── lib/              # Utility functions
│   │   ├── firebase.ts   # Firebase configuration
│   │   └── weather-minimums.ts  # Training level rules
│   └── types/            # TypeScript types
│       └── index.ts      # All type definitions
├── .env.local            # Your API keys (DO NOT COMMIT)
├── .env.example          # Template for API keys
└── package.json          # Dependencies
```

## Next Steps

Once setup is complete, you're ready to start the epics:

1. **Epic 1: Data Foundation**
   - Create Firestore collections
   - Build seed data script
   - Test data structure

2. **Epic 2: Weather Integration**
   - Build weather fetch function
   - Implement safety evaluation logic
   - Test with real API

3. **Epic 3: AI Rescheduling**
   - Set up OpenAI integration
   - Build reschedule generator
   - Test prompt engineering

4. **Epic 4: Notification System**
   - Implement email templates
   - Build notification sender
   - Test email delivery

5. **Epic 5: Dashboard UI**
   - Create booking list view
   - Build weather alerts
   - Add manual trigger button

6. **Epic 6: Orchestration**
   - Wire up complete workflow
   - Add cron job configuration
   - Implement error handling

7. **Epic 7: Testing & Polish**
   - End-to-end testing
   - Demo preparation
   - Documentation

## Testing Your Setup

### Test Firebase
Create a test API route at `src/app/api/test-firebase/route.ts`:
```typescript
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const testRef = await addDoc(collection(db, 'test'), {
      message: 'Firebase connected!',
      timestamp: new Date(),
    });
    return NextResponse.json({ success: true, id: testRef.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
```

### Test OpenWeatherMap
Visit: `http://localhost:3000/api/test-weather?lat=40.7128&lon=-74.0060`

### Test OpenAI
Visit: `http://localhost:3000/api/test-ai`

### Test Resend
Visit: `http://localhost:3000/api/test-email`

## Troubleshooting

### Firebase Errors
- Ensure all `NEXT_PUBLIC_FIREBASE_*` variables are set
- Check Firebase Console for project status
- Verify Firestore is enabled in "test mode"

### OpenWeatherMap Errors
- API key can take 10-15 minutes to activate after signup
- Verify you're using the correct API endpoint
- Check rate limits (60 calls/minute)

### OpenAI Errors
- Ensure billing is set up for GPT-4 access
- Check API key starts with `sk-`
- Verify organization ID if using team account

### Resend Errors
- For testing, use `onboarding@resend.dev` as FROM email
- Verify your email as TO address for testing
- Check API key starts with `re_`

## Ready to Start!

Once all API keys are configured and tests pass, you're ready to begin Epic 1: Data Foundation. 🚀

