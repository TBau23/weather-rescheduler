# Weather Rescheduler - System Explained

## What This App Does

**Purpose**: Automatically detect when flight lessons have unsafe weather conditions and generate AI-powered reschedule options.

## How It Works

### 1. Data Structure (The Schema)

**Students**
- Contains student info: name, email, phone, training level (student/private/instrument/commercial)
- Training level determines weather minimums (student pilots need better weather than instrument pilots)

**Bookings**
- Each booking represents a scheduled flight lesson
- Fields: student, instructor, aircraft, scheduled time, location (lat/lon), duration, status
- Status can be: `scheduled`, `checking`, `conflict`, `rescheduled`, `confirmed`, `cancelled`

**WeatherChecks**
- Records of weather checks performed
- Stores actual conditions and whether they're safe for that training level

**RescheduleOptions**
- AI-generated alternative times when weather conflicts are found
- Includes reasoning, weather forecast, availability

### 2. The Workflow

**Step 1: Trigger Weather Check**
- Click "Run Weather Check" button on dashboard
- System finds all upcoming bookings (next 7 days by default)

**Step 2: Check Each Booking**
- For each booking:
  1. Fetch current weather from OpenWeatherMap (using lat/lon)
  2. Compare weather against training level minimums
  3. Mark as safe or unsafe

**Step 3: Handle Conflicts**
- If weather is unsafe:
  1. Update booking status to 'conflict'
  2. Find available times for student, instructor, and aircraft
  3. Call OpenAI to generate 3 smart reschedule options
  4. Send email to student with options
  5. Log everything to Firestore

**Step 4: Student Accepts Reschedule**
- Student clicks link in email or from dashboard
- Views 3 options with AI reasoning
- Accepts preferred option
- Booking updates to 'rescheduled' status
- Confirmation email sent

### 3. Why You Have Pre-existing Conflicts

Your seed data script creates 50 bookings:
- **38 scheduled** - normal bookings
- **8 conflict** - PRE-SEEDED conflicts for demo purposes
- **4 confirmed** - already confirmed bookings

These 8 pre-seeded conflicts allow you to have data to show without running weather checks. They're intentional!

## Current Errors Explained

### Error 1: "Invalid response format from OpenAI - missing options array"

**What's happening**: OpenAI is returning JSON, but not in the format we expect

**Fix applied**: Added logging to see actual response format. Next weather check will show what OpenAI is actually returning.

**Why it might happen**:
- Token limit reached (prompt too long)
- Model returned different structure
- API timeout

### Error 2: "Unsupported field value: undefined (found in field resendMessageId)"

**What's happening**: Trying to save `undefined` to Firestore, which it doesn't allow

**Fix applied**: Filter out undefined fields before saving notifications

### Error 3: "No overlapping availability found"

**What's happening**: Student, instructor, and aircraft have no common free times

**This is expected!** Sometimes there genuinely aren't good reschedule options. The system handles this gracefully by throwing an error and moving to the next booking.

### Error 4: "fetch failed"

**What's happening**: Network timeout or API rate limit

**This is transient** - retry usually works. The parallel processing continues with other bookings.

## What You Have Now

### Current Dashboard (List View)
- Shows all bookings in a scrollable list
- Color-coded status badges
- Real-time updates via Firestore
- "Run Weather Check" button
- "View Reschedule Options" for conflicts
- Toast notifications
- Fast parallel processing

**Good for**: 
- Seeing detailed info for each booking
- Real-time status tracking
- Quick testing and debugging

**Not ideal for**:
- Seeing time overlaps visually
- Understanding daily schedule at a glance
- Spotting double-bookings

### What You're Asking For (Calendar View)
- Week/day view like Google Calendar
- Bookings shown as time blocks
- Visual overlap detection
- Drag-and-drop rescheduling (future)

**Good for**:
- Visual schedule management
- Spotting conflicts intuitively
- Understanding daily capacity

**Takes longer to build**:
- Need calendar library (FullCalendar, React Big Calendar)
- More complex UI
- Different interaction patterns

## Recommendations

### Option 1: Fix Bugs First, Keep List View (Fastest)
1. ✅ Fixed undefined field error
2. ✅ Added OpenAI response logging
3. ⏳ Run weather check again to see actual OpenAI output
4. ⏳ Fix OpenAI prompt/parsing based on logs
5. Test the complete flow
6. Record demo with working list view

**Time**: 30 minutes to 1 hour  
**Gets you**: Working demo today

### Option 2: Add Simple Calendar View (Medium)
1. Do Option 1 first (fix bugs)
2. Add a calendar library
3. Build day/week view
4. Keep list view as alternate view (tabs)

**Time**: 3-4 hours  
**Gets you**: Choice of views, better visual demo

### Option 3: Calendar-First Redesign (Slowest)
1. Do Option 1 first (fix bugs)
2. Make calendar the primary view
3. Remove/minimize list view
4. Add calendar-specific features (drag/drop, etc.)

**Time**: 4-6 hours  
**Gets you**: Professional scheduling interface

## My Recommendation

**Go with Option 1** for now because:
1. Your demo doesn't need calendar view to be impressive
2. The real "wow factor" is AI rescheduling + real-time updates
3. You're close to having everything working
4. You can always add calendar view later

**Next step**: Run the weather check again with the new logging, and share the console output. I'll fix the OpenAI parsing issue immediately.

## Quick Reference: Testing Commands

```bash
# Start dev server
npm run dev

# Seed fresh data (clears old data)
npm run seed

# Manually trigger weather check
curl -X POST http://localhost:3000/api/run-weather-check \
  -H "Content-Type: application/json" \
  -d '{"forceConflict": true, "hoursAhead": 168}'

# View all bookings
curl http://localhost:3000/api/list-bookings

# View all data
curl http://localhost:3000/api/view-data
```

## Understanding the Flow Visually

```
User Dashboard                  Backend System                    External APIs
     │                               │                                 │
     │  Click "Run Check"            │                                 │
     ├──────────────────────────────>│                                 │
     │                               │                                 │
     │                               │  Fetch weather for each booking │
     │                               ├────────────────────────────────>│ OpenWeatherMap
     │                               │<────────────────────────────────┤
     │                               │                                 │
     │                               │  Evaluate safety                │
     │                               │  (training level + conditions)  │
     │                               │                                 │
     │                               │  If unsafe: generate reschedules│
     │                               ├────────────────────────────────>│ OpenAI
     │                               │<────────────────────────────────┤
     │                               │                                 │
     │                               │  Send notification email        │
     │                               ├────────────────────────────────>│ Resend
     │                               │<────────────────────────────────┤
     │                               │                                 │
     │                               │  Update Firestore               │
     │  Real-time update (Firestore) │  (booking status = conflict)    │
     │<──────────────────────────────┤                                 │
     │  (booking turns red)          │                                 │
     │                               │                                 │
     │  Click "View Reschedule"      │                                 │
     ├──────────────────────────────>│  Query reschedule options       │
     │<──────────────────────────────┤                                 │
     │  (opens page with 3 options)  │                                 │
     │                               │                                 │
     │  Click "Accept Option 1"      │                                 │
     ├──────────────────────────────>│                                 │
     │                               │  Update booking                 │
     │                               │  Send confirmation email        │
     │                               ├────────────────────────────────>│ Resend
     │  Real-time update             │                                 │
     │<──────────────────────────────┤                                 │
     │  (booking turns blue)         │                                 │
```

