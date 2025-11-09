# Epic 6: Orchestration & Automation

**Status**: 🔄 Ready to Start  
**Estimated Time**: 2-3 hours  
**Dependencies**: Epic 1 (Data), Epic 2 (Weather), Epic 3 (AI), Epic 4 (Notifications) - ALL COMPLETE ✅  
**Blocking**: Epic 7 (Testing & Demo)

---

## Goal
Create the main orchestration workflow that ties all systems together: automatically check weather for upcoming bookings, detect conflicts, generate AI-powered reschedule options, and send notifications. Includes both manual trigger (for demos) and automated cron scheduling.

---

## Reference Files from Previous Epics

This epic orchestrates existing functionality. Here are the key files we'll be integrating:

### **Epic 1: Data Foundation**
- `src/types/index.ts` - TypeScript interfaces (Booking, Student, WeatherCheck, RescheduleOption, Notification)
- `src/lib/firebase.ts` - Firebase/Firestore client
- `src/scripts/seed-data.ts` - Test data generation
- `src/app/api/seed-data/route.ts` - Seeding endpoint
- `src/app/api/list-bookings/route.ts` - Query bookings

### **Epic 2: Weather Integration**
- `src/lib/weather-api.ts` - OpenWeatherMap API integration
- `src/lib/weather-evaluation.ts` - Safety evaluation logic (training level minimums)
- `src/lib/weather-minimums.ts` - FAA-based weather rules per training level
- `src/app/api/check-weather/route.ts` - Weather check endpoint

### **Epic 3: AI Rescheduling**
- `src/lib/prompts/reschedule-prompt.ts` - OpenAI prompt engineering
- `src/lib/availability-helpers.ts` - Mock availability logic
- `src/app/api/generate-reschedule/route.ts` - AI reschedule endpoint

### **Epic 4: Notification System**
- `src/lib/email-service.ts` - Resend integration with demo mode
- `src/lib/email-templates.ts` - HTML email templates (weather alert, reschedule, confirmation)
- `src/lib/notification-logger.ts` - Firestore notification logging
- `src/app/api/send-notification/route.ts` - Email sending endpoint
- `src/app/api/test-email/route.ts` - Email testing endpoint

**What Epic 6 Adds:**
- Orchestration service that calls the above APIs in sequence
- Manual trigger endpoint for demos
- Vercel Cron for automated hourly checks
- Error handling and workflow logging

---

## Deliverables

### 1. Main Orchestration Workflow
Single unified endpoint that executes the complete flow:
- Query upcoming bookings (next 24-48 hours)
- Check weather for each location
- Evaluate safety against training level minimums
- For unsafe bookings:
  - Update booking status to 'conflict'
  - Generate AI reschedule options
  - Send weather alert email
  - Send reschedule options email
- Log all actions to Firestore
- Return summary of actions taken

### 2. Manual Trigger Endpoint
For demo purposes and testing:
- `/api/run-weather-check` - Trigger full workflow on demand
- Optional filters (specific booking, specific location)
- Detailed response showing each step
- Dry-run mode (check only, don't send emails)

### 3. Vercel Cron Job
Automated hourly checks:
- `/api/cron/weather-check` - Protected cron endpoint
- Runs automatically every hour
- Checks only bookings within next 24 hours
- Rate-limited to avoid API quotas

### 4. Error Handling & Resilience
Robust error management:
- Graceful degradation (continue processing other bookings if one fails)
- Retry logic for transient failures
- Error logging to Firestore
- Summary of successes/failures

---

## Implementation Tasks

### Task 1: Main Orchestration Service
**File**: `src/lib/orchestration-service.ts`

```typescript
// Key functions:
- runWeatherCheckWorkflow(options?: WorkflowOptions) → WorkflowResult
- processBooking(booking: Booking) → BookingResult
- handleUnsafeBooking(booking: Booking, weatherCheck: WeatherCheck) → void

interface WorkflowOptions {
  bookingIds?: string[]; // Filter to specific bookings
  hoursAhead?: number; // Check bookings N hours ahead (default: 24)
  dryRun?: boolean; // Don't actually send emails
}

interface WorkflowResult {
  totalBookings: number;
  checkedBookings: number;
  unsafeBookings: number;
  emailsSent: number;
  errors: string[];
  duration: number; // milliseconds
  timestamp: Date;
}
```

**Workflow Steps**:
```typescript
async function runWeatherCheckWorkflow(options: WorkflowOptions): Promise<WorkflowResult> {
  const startTime = Date.now();
  const result: WorkflowResult = {
    totalBookings: 0,
    checkedBookings: 0,
    unsafeBookings: 0,
    emailsSent: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
  };

  try {
    // 1. Query upcoming bookings
    const bookings = await getUpcomingBookings(options.hoursAhead || 24);
    result.totalBookings = bookings.length;

    // 2. Process each booking
    for (const booking of bookings) {
      try {
        const bookingResult = await processBooking(booking, options.dryRun);
        
        result.checkedBookings++;
        if (!bookingResult.isSafe) {
          result.unsafeBookings++;
          result.emailsSent += bookingResult.emailsSent;
        }
      } catch (error) {
        result.errors.push(`Booking ${booking.id}: ${error.message}`);
      }
    }

    result.duration = Date.now() - startTime;
    
    // 3. Log workflow run to Firestore
    await logWorkflowRun(result);
    
    return result;
  } catch (error) {
    result.errors.push(`Workflow failed: ${error.message}`);
    result.duration = Date.now() - startTime;
    return result;
  }
}
```

**Process Individual Booking**:
```typescript
async function processBooking(booking: Booking, dryRun: boolean = false): Promise<BookingResult> {
  // 1. Check weather
  const weatherCheck = await checkWeatherForBooking(booking);
  
  // 2. If safe, continue
  if (weatherCheck.isSafe) {
    return { isSafe: true, emailsSent: 0 };
  }
  
  // 3. If unsafe, handle conflict
  await handleUnsafeBooking(booking, weatherCheck, dryRun);
  
  return { isSafe: false, emailsSent: dryRun ? 0 : 2 }; // alert + reschedule email
}

async function handleUnsafeBooking(
  booking: Booking, 
  weatherCheck: WeatherCheck,
  dryRun: boolean
): Promise<void> {
  // 1. Update booking status to 'conflict'
  await updateBookingStatus(booking.id, 'conflict');
  
  // 2. Generate AI reschedule options
  const rescheduleOptions = await generateRescheduleOptions(booking);
  
  // 3. Send weather alert email
  if (!dryRun) {
    await sendWeatherAlertNotification(booking.id);
  }
  
  // 4. Send reschedule options email
  if (!dryRun && rescheduleOptions.length > 0) {
    await sendRescheduleNotification(booking.id);
  }
}
```

### Task 2: Manual Trigger Endpoint
**File**: `src/app/api/run-weather-check/route.ts`

```typescript
// POST /api/run-weather-check
// Body: { bookingIds?: string[], hoursAhead?: number, dryRun?: boolean }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options: WorkflowOptions = {
      bookingIds: body.bookingIds,
      hoursAhead: body.hoursAhead || 24,
      dryRun: body.dryRun || false,
    };

    console.log('Starting manual weather check workflow...');
    console.log('Options:', options);

    // Run the workflow
    const result = await runWeatherCheckWorkflow(options);

    // Return detailed results
    return NextResponse.json({
      success: true,
      message: 'Weather check workflow completed',
      result,
    });
  } catch (error) {
    console.error('Weather check workflow failed:', error);
    return NextResponse.json(
      { error: error.message || 'Workflow failed' },
      { status: 500 }
    );
  }
}

// GET /api/run-weather-check
// Quick trigger for testing (no options)
export async function GET(request: NextRequest) {
  try {
    console.log('Starting quick weather check workflow...');

    const result = await runWeatherCheckWorkflow({
      hoursAhead: 24,
      dryRun: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Weather check workflow completed',
      result,
    });
  } catch (error) {
    console.error('Weather check workflow failed:', error);
    return NextResponse.json(
      { error: error.message || 'Workflow failed' },
      { status: 500 }
    );
  }
}
```

### Task 3: Vercel Cron Job
**File**: `src/app/api/cron/weather-check/route.ts`

```typescript
// GET /api/cron/weather-check
// Called by Vercel Cron (hourly)
// Protected by Authorization header

export async function GET(request: NextRequest) {
  // 1. Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting automated weather check (cron)...');

    // Run workflow with production settings
    const result = await runWeatherCheckWorkflow({
      hoursAhead: 24, // Check next 24 hours
      dryRun: false, // Actually send emails
    });

    console.log('Cron workflow completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Automated weather check completed',
      result,
    });
  } catch (error) {
    console.error('Cron weather check failed:', error);
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}
```

**Vercel Configuration**:
**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/weather-check",
      "schedule": "0 * * * *"
    }
  ]
}
```

Schedule format: `"0 * * * *"` = every hour at minute 0

### Task 4: Helper Functions
**File**: `src/lib/orchestration-helpers.ts`

```typescript
// Query upcoming bookings
// Uses Epic 1's data schema from src/types/index.ts
// Queries Firestore 'bookings' collection (seeded by src/scripts/seed-data.ts)
async function getUpcomingBookings(hoursAhead: number): Promise<Booking[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const q = query(
    collection(db, 'bookings'),
    where('scheduledTime', '>=', Timestamp.fromDate(now)),
    where('scheduledTime', '<=', Timestamp.fromDate(cutoff)),
    where('status', 'in', ['scheduled', 'confirmed'])
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => convertToBooking(doc));
}

// Check weather for a specific booking
// Calls Epic 2's weather check endpoint (src/app/api/check-weather/route.ts)
async function checkWeatherForBooking(booking: Booking): Promise<WeatherCheck> {
  const response = await fetch('/api/check-weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: booking.id }),
  });

  const data = await response.json();
  return data.weatherCheck;
}

// Update booking status
async function updateBookingStatus(
  bookingId: string, 
  status: BookingStatus
): Promise<void> {
  const bookingRef = doc(db, 'bookings', bookingId);
  await updateDoc(bookingRef, {
    status,
    updatedAt: Timestamp.now(),
  });
}

// Generate reschedule options
// Calls Epic 3's AI reschedule endpoint (src/app/api/generate-reschedule/route.ts)
async function generateRescheduleOptions(booking: Booking): Promise<RescheduleOption[]> {
  const response = await fetch('/api/generate-reschedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: booking.id }),
  });

  const data = await response.json();
  return data.options || [];
}

// Send weather alert notification
// Calls Epic 4's notification endpoint (src/app/api/send-notification/route.ts)
// Uses email templates from src/lib/email-templates.ts
async function sendWeatherAlertNotification(bookingId: string): Promise<void> {
  await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      bookingId, 
      type: 'weather_alert' 
    }),
  });
}

// Send reschedule options notification
// Calls Epic 4's notification endpoint (src/app/api/send-notification/route.ts)
async function sendRescheduleNotification(bookingId: string): Promise<void> {
  await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      bookingId, 
      type: 'reschedule_options' 
    }),
  });
}

// Log workflow run
async function logWorkflowRun(result: WorkflowResult): Promise<void> {
  await addDoc(collection(db, 'workflowRuns'), {
    ...result,
    timestamp: Timestamp.fromDate(result.timestamp),
  });
}
```

### Task 5: Error Handling & Resilience
**File**: `src/lib/orchestration-service.ts` (add to main file)

```typescript
// Graceful error handling - continue processing other bookings
async function processBookingWithErrorHandling(
  booking: Booking,
  dryRun: boolean
): Promise<{ success: boolean; error?: string; result?: BookingResult }> {
  try {
    const result = await processBooking(booking, dryRun);
    return { success: true, result };
  } catch (error) {
    console.error(`Error processing booking ${booking.id}:`, error);
    
    // Log error to Firestore for monitoring
    await logBookingError(booking.id, error.message);
    
    return { 
      success: false, 
      error: `${booking.studentName}: ${error.message}` 
    };
  }
}

// Rate limiting helper
const RATE_LIMITS = {
  openWeatherMap: 60, // 60 calls per hour (free tier)
  openAI: 3500, // 3500 requests per minute
  resend: 100, // 100 emails per day
};

async function checkRateLimits(): Promise<{ ok: boolean; message?: string }> {
  // Check recent API usage from logs
  const recentCalls = await getRecentAPICalls(1); // Last 1 hour
  
  if (recentCalls.weather >= RATE_LIMITS.openWeatherMap) {
    return { ok: false, message: 'Weather API rate limit reached' };
  }
  
  if (recentCalls.email >= RATE_LIMITS.resend) {
    return { ok: false, message: 'Email rate limit reached' };
  }
  
  return { ok: true };
}
```

---

## Testing & Validation

### Success Criteria
- [ ] Manual trigger processes all bookings without errors
- [ ] Unsafe bookings correctly identified and flagged
- [ ] AI reschedule options generated for conflicts
- [ ] Emails sent successfully (verified in inbox with demo mode)
- [ ] Booking status updated in Firestore
- [ ] Workflow run logged with accurate metrics
- [ ] Error handling continues processing after individual failures
- [ ] Dry-run mode works (checks but doesn't send emails)

### Manual Testing

#### Test 1: Dry Run (Safe)
```bash
# Check workflow without sending emails
curl -X POST http://localhost:3000/api/run-weather-check \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

Expected: Returns summary with bookings checked, no emails sent.

#### Test 2: Single Booking
```bash
# Process specific booking
curl -X POST http://localhost:3000/api/run-weather-check \
  -H "Content-Type: application/json" \
  -d '{
    "bookingIds": ["booking123"],
    "dryRun": false
  }'
```

Expected: Processes one booking, sends emails if unsafe.

#### Test 3: Full Workflow
```bash
# Run full workflow (all upcoming bookings)
curl http://localhost:3000/api/run-weather-check
```

Expected:
- Checks all bookings in next 24 hours
- Identifies unsafe bookings
- Generates reschedule options
- Sends 2 emails per unsafe booking (alert + options)
- Returns detailed summary

#### Test 4: Check Results in Firestore
After running workflow:
1. Open Firebase Console
2. Check `bookings` collection - status updated to 'conflict'
3. Check `weatherChecks` collection - new entries logged
4. Check `rescheduleOptions` collection - 3 options per unsafe booking
5. Check `notifications` collection - emails logged
6. Check `workflowRuns` collection - workflow summary

#### Test 5: Email Verification
Check your inbox (DEMO_EMAIL):
- Should receive weather alert emails
- Should receive reschedule options emails
- Emails should have [DEMO] prefix
- Demo banner shows original recipient

---

## Files to Create

```
src/
├── lib/
│   ├── orchestration-service.ts      # Main workflow logic
│   └── orchestration-helpers.ts      # Helper functions
└── app/
    └── api/
        ├── run-weather-check/
        │   └── route.ts               # Manual trigger endpoint
        └── cron/
            └── weather-check/
                └── route.ts           # Vercel cron endpoint

vercel.json                            # Cron configuration
```

---

## Environment Variables

Add to `.env.local`:
```env
# Cron job security
CRON_SECRET=your-random-secret-string-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Manual Trigger / Cron                      │
│                  /api/run-weather-check                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Query Upcoming Bookings (next 24 hours)                 │
│     - Status: 'scheduled' or 'confirmed'                    │
│     - scheduledTime >= now && <= now + 24h                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. For Each Booking:                                        │
│     ┌─────────────────────────────────────────────────┐    │
│     │ Check Weather (Epic 2)                          │    │
│     │ - Fetch conditions for location                 │    │
│     │ - Evaluate against training level minimums      │    │
│     └─────────────────────┬───────────────────────────┘    │
│                           │                                  │
│              ┌────────────┴──────────┐                      │
│              ▼                       ▼                       │
│        ┌─────────┐            ┌──────────┐                 │
│        │  Safe   │            │  Unsafe  │                  │
│        └────┬────┘            └─────┬────┘                 │
│             │                       │                        │
│             │                       ▼                        │
│             │         ┌────────────────────────────┐       │
│             │         │ 3. Update Status: conflict │       │
│             │         └─────────────┬──────────────┘       │
│             │                       │                        │
│             │                       ▼                        │
│             │         ┌────────────────────────────┐       │
│             │         │ 4. Generate AI Reschedules │       │
│             │         │    (Epic 3)                 │       │
│             │         └─────────────┬──────────────┘       │
│             │                       │                        │
│             │                       ▼                        │
│             │         ┌────────────────────────────┐       │
│             │         │ 5. Send Weather Alert      │       │
│             │         │    Email (Epic 4)          │       │
│             │         └─────────────┬──────────────┘       │
│             │                       │                        │
│             │                       ▼                        │
│             │         ┌────────────────────────────┐       │
│             │         │ 6. Send Reschedule Options │       │
│             │         │    Email (Epic 4)          │       │
│             │         └────────────────────────────┘       │
│             │                                                │
│             └────────────────┬───────────────────────────┬─┘
│                              │                           │
└──────────────────────────────┼───────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Return Workflow Summary                                  │
│     - Total bookings checked                                 │
│     - Unsafe bookings found                                  │
│     - Emails sent                                            │
│     - Errors encountered                                     │
│     - Duration                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Demo Strategy

### For Video Demo
1. **Setup**: Seed database with bookings in next 24 hours
2. **Trigger**: Click manual trigger button (or call API)
3. **Watch**: Show real-time processing in console
4. **Results**: Display workflow summary
5. **Verify**: 
   - Check inbox for emails
   - Show Firestore updates
   - Display booking status changes
6. **Explain**: Walk through code showing how Epics 2, 3, 4 are integrated

### Demo Script
```
"Let me show you the orchestration workflow that ties everything together.

First, I'll trigger a weather check manually. [Click button]

The system is now:
1. Checking weather for all flights in the next 24 hours
2. [Show console] Detected 3 unsafe bookings
3. [Show screen] Generating AI-powered reschedule options
4. [Show inbox] Sending email notifications

And here's the summary: 
- Checked 15 bookings
- Found 3 weather conflicts
- Sent 6 emails total
- Completed in 8.5 seconds

Let me show you one of the emails... [Open inbox]
Perfect! Weather alert with detailed conditions and reschedule options.

In production, this runs automatically every hour via Vercel Cron,
ensuring students are always notified of weather changes."
```

---

## Time Estimate Breakdown

- Orchestration service: 60 min
- Manual trigger endpoint: 20 min
- Cron job setup: 20 min
- Error handling: 30 min
- Testing & validation: 30 min
- **Total: ~2.5 hours**

---

## Next Epic Preview

Once Epic 6 is complete, we move to **Epic 5: Dashboard UI**:
- React components to visualize workflow results
- Real-time booking status display
- Manual trigger button
- Weather alerts feed

Or skip to **Epic 7: Testing & Polish**:
- End-to-end testing
- Demo video recording
- Documentation

**Epic 6 is the heart of the system** - once this is done, everything works end-to-end! 🚀

---

## Critical Success Factors

✅ **Must Work**:
- Query bookings correctly (date range, status filter)
- Weather checks execute without failures
- Booking status updates persist
- Emails send successfully in order
- Workflow completes even if individual bookings fail

⚠️ **Error Scenarios to Handle**:
- Weather API timeout → skip booking, continue
- AI API failure → log error, don't send reschedule email
- Email send failure → log error, mark notification as failed
- Firestore write failure → log to console, continue

💡 **Performance Considerations**:
- Process bookings sequentially to respect rate limits
- Cache weather results for same location
- Batch Firestore writes where possible
- Target: Process 20 bookings in < 10 seconds

---

