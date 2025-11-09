# Epic 1: Data Foundation

**Status**: ✅ Complete  
**Actual Time**: ~1 hour  
**Dependencies**: Firebase configured in `.env.local`

---

## Goal
Set up Firestore collections with proper schema and seed realistic test data for demo.

---

## Deliverables

### 1. Firestore Collections Schema
Define 4 collections in code (TypeScript interfaces already exist):

- **`students`** - Student profiles with training levels
- **`bookings`** - Scheduled flight lessons
- **`weatherChecks`** - Historical weather evaluation results (empty for now)
- **`notifications`** - Email delivery log (empty for now)

### 2. Seed Data Script
Create `src/scripts/seed-data.ts` that generates:

- **10 Students**
  - Mix of training levels: 3 student, 3 private, 2 instrument, 2 commercial
  - Realistic names, emails, phone numbers
  - Different locations (variety for weather testing)

- **20 Bookings**
  - Distributed across next 7 days
  - Various times (morning, afternoon, evening)
  - Mix of statuses: mostly "scheduled", a few "conflict"
  - Different locations: 3-4 airports (lat/lon for weather API)
  - Assign to students based on their training level

### 3. Seed Runner
Create `src/scripts/run-seed.ts` or API route `/api/seed-data` to execute seeding with one command/call.

---

## Implementation Tasks

### Task 1: Create Seed Data Generator
**File**: `src/scripts/seed-data.ts`

```typescript
// Functions to create:
- generateStudents(count: 10) → Student[]
- generateBookings(students: Student[], count: 20) → Booking[]
- clearCollections() // Optional: clear existing data
- seedDatabase() // Main function
```

**Sample Locations** (for realistic weather testing):
- KJFK - New York JFK (40.6413°N, -73.7781°W)
- KLAX - Los Angeles LAX (33.9416°N, -118.4085°W)
- KORD - Chicago O'Hare (41.9742°N, -87.9073°W)
- KDFW - Dallas/Fort Worth (32.8998°N, -97.0403°W)

**Booking Distribution**:
- 15 bookings with status "scheduled"
- 3 bookings with status "conflict" (for demo)
- 2 bookings with status "confirmed"
- Times: spread across 7am-6pm
- Dates: tomorrow through next 7 days

### Task 2: Create Seed Runner
**File**: `src/app/api/seed-data/route.ts`

Simple POST endpoint that:
1. Calls `seedDatabase()` from seed script
2. Returns success with counts
3. Includes safety check (only in development mode)

### Task 3: Add Helper Script to package.json
```json
"scripts": {
  "seed": "tsx src/scripts/run-seed.ts"
}
```

Install `tsx` for running TypeScript directly: `npm install -D tsx`

---

## Data Schema Reference

Already defined in `src/types/index.ts`:
- ✅ `Student` interface
- ✅ `Booking` interface  
- ✅ `WeatherCheck` interface
- ✅ `Notification` interface
- ✅ `TrainingLevel` type
- ✅ `BookingStatus` type

No changes needed to types!

---

## Testing & Validation

### How to Test
```bash
# Seed database
npm run seed

# Or via API
curl -X POST http://localhost:3000/api/seed-data

# View seeded data
curl http://localhost:3000/api/view-data
```

### Success Criteria
- [x] Seed script runs without errors
- [x] 10 students created in Firestore `students` collection
- [x] 20 bookings created in Firestore `bookings` collection
- [x] Data viewable in Firebase Console
- [x] Dates are realistic (next 7 days)
- [x] Training levels properly distributed
- [x] Bookings reference valid student IDs

---

## Files to Create

```
src/
├── scripts/
│   ├── seed-data.ts           # Main seed logic
│   └── run-seed.ts            # CLI runner
└── app/
    └── api/
        └── seed-data/
            └── route.ts        # HTTP endpoint for seeding
```

---

## Notes

- Use `faker` or manual realistic data (your choice)
- Make sure dates are in the future (Date.now() + random hours)
- Keep student emails unique (e.g., student1@example.com)
- Use consistent phone format: (555) XXX-XXXX
- Firestore auto-generates document IDs (use those for references)

---

## Time Estimate Breakdown

- Seed data generator: 30 min
- API route/CLI runner: 15 min  
- Testing & validation: 15 min
- **Total: ~1 hour**

---

## Next Epic Preview

Once Epic 1 is complete, we move to **Epic 2: Weather Integration**:
- Fetch real weather data for booking locations
- Evaluate against training level minimums
- Flag unsafe bookings

But first, let's get the data foundation solid! 🎯

