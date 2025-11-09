# Epic 3: AI Rescheduling

**Status**: ⏳ Not Started  
**Estimated Time**: 2-3 hours  
**Dependencies**: OpenAI API key in `.env.local`, Epic 1 (Data Foundation), Epic 2 (Weather Integration)  
**Can run parallel to**: Epic 4 (Notification System)

---

## Goal
Use OpenAI GPT-4 to intelligently generate alternative booking times when weather conditions are unsafe, considering student training patterns, instructor availability, and aircraft scheduling constraints.

---

## Deliverables

### 1. OpenAI Integration
Set up GPT-4 API client with structured output for generating reschedule options.

### 2. Reschedule Generator
AI-powered function that takes an unsafe booking and returns 3 ranked alternative times with reasoning:
- Analyze availability patterns (mock data for v1)
- Consider weather forecasts (mock data for v1)
- Prioritize minimal schedule disruption
- Provide human-readable reasoning

### 3. API Endpoint
Expose `/api/generate-reschedule` to request AI-generated alternatives:
- Accept booking ID
- Verify booking is unsafe (from weather check)
- Generate 3 options via OpenAI
- Store in `rescheduleOptions` collection
- Return ranked suggestions

### 4. Prompt Engineering
Craft effective system prompt with:
- Training level awareness
- Scheduling constraints
- Output format requirements (JSON)
- Reasoning expectations

---

## Implementation Tasks

### Task 1: OpenAI Client Setup
**File**: `src/lib/openai-client.ts`

```typescript
// Key functions:
- initOpenAI() → OpenAI client instance
- generateRescheduleOptions(booking, weatherCheck) → RescheduleOption[]
- parseAIResponse(response) → structured alternatives
```

**Configuration:**
- Model: `gpt-4` (or `gpt-4o-mini` for faster/cheaper testing)
- Temperature: 0.7 (balance creativity and consistency)
- Response format: JSON mode with structured schema

### Task 2: Availability Mock Data
**File**: `src/lib/availability-helpers.ts`

Create mock functions with realistic availability patterns:
- `getStudentAvailability(studentId)` → array of available time slots
  - Student pilots: typically weekday evenings (4-6pm), weekend mornings/afternoons
  - Private/Commercial: more flexible, weekday afternoons + weekends
  - Instrument: can include early mornings and evenings
  
- `getInstructorAvailability(instructorName)` → instructor schedule  
  - Each instructor has different availability blocks
  - Some instructors weekday-only, others include weekends
  - Realistic gaps for existing bookings
  
- `getAircraftAvailability(aircraftId)` → aircraft booking slots
  - 2-hour blocks for typical lessons
  - Some times already booked (show conflicts)
  - Maintenance windows (unavailable periods)

**Pattern**: Generate realistic schedules with ~60-70% availability, not 100%

### Task 3: AI Prompt Engineering
**File**: `src/lib/prompts/reschedule-prompt.ts`

System prompt structure:
```
Role: You are a flight school scheduler with expertise in weather minimums.

Context:
- Student: {name}, {trainingLevel}
- Original booking: {date/time}, {location}
- Cancellation reason: {weather violations}
- Training minimums: {visibility, ceiling, winds}

Constraints:
- Suggest 3 alternative times within next 7 days
- ONLY suggest times when student, instructor, AND aircraft are ALL available
- Prioritize times with historically better weather
- Avoid early mornings (dew/fog) for student pilots
- Prefer afternoon slots (more stable conditions)
- If no perfect matches, suggest best available options with trade-offs

Output Format:
Return JSON array with 3 options, each containing:
- suggestedTime: ISO8601 timestamp
- reasoning: Why this time works better
- weatherLikelihood: Expected conditions (qualitative)
- priority: 1 (best) to 3 (acceptable)
```

### Task 4: Reschedule Generator Function
**File**: `src/lib/reschedule-generator.ts`

```typescript
// Main function:
export async function generateRescheduleOptions(
  booking: Booking,
  weatherCheck: WeatherCheck
): Promise<RescheduleOption[]>

Steps:
1. Gather context (booking details, weather violations)
2. Get availability data from mock functions:
   - Student availability (specific time slots)
   - Instructor availability (schedule blocks)
   - Aircraft availability (booking slots)
3. Find overlapping available times (student AND instructor AND aircraft)
4. Build AI prompt with:
   - Available time slots
   - Weather constraints
   - Training level requirements
5. Call OpenAI API with JSON mode
6. AI picks best 3 options from available slots with reasoning
7. Parse, validate, and return ranked options
```

### Task 5: API Endpoint
**File**: `src/app/api/generate-reschedule/route.ts`

```typescript
// POST /api/generate-reschedule
// Body: { bookingId: string }

1. Fetch booking from Firestore
2. Check if booking has recent unsafe weather check
3. If no weather check, run one first
4. If weather is safe, return error (no need to reschedule)
5. Call generateRescheduleOptions()
6. Save options to rescheduleOptions collection
7. Return ranked suggestions
```

---

## Testing & Validation

### Success Criteria
- [ ] OpenAI API connection works
- [ ] AI generates 3 valid alternative times
- [ ] Response includes clear reasoning for each option
- [ ] Times are within next 7 days
- [ ] Times are during reasonable hours (7am-6pm)
- [ ] Options saved to Firestore `rescheduleOptions` collection
- [ ] Generation completes in < 10 seconds
- [ ] JSON parsing handles AI response reliably

### Manual Testing
1. Use Michael Rodriguez's unsafe booking (student pilot, 2000ft ceiling)
   ```bash
   curl -X POST http://localhost:3000/api/generate-reschedule \
     -H "Content-Type: application/json" \
     -d '{"bookingId": "wIVzVYBpG1zvwx8y5X1T"}'
   ```

2. Verify response contains 3 options with:
   - Valid future timestamps
   - Specific reasoning (references weather, training level, time of day)
   - Priority ranking (1, 2, 3)

3. Check Firestore Console → `rescheduleOptions` collection has new entries

4. Test with different training levels (student vs. instrument pilot)

---

## Files to Create

```
src/
├── lib/
│   ├── openai-client.ts           # OpenAI API setup
│   ├── reschedule-generator.ts    # Main AI logic
│   ├── availability-helpers.ts    # Mock availability data
│   └── prompts/
│       └── reschedule-prompt.ts   # System prompt template
└── app/
    └── api/
        └── generate-reschedule/
            └── route.ts            # API endpoint
```

---

## Sample AI Output

Expected response structure:
```json
[
  {
    "suggestedTime": "2025-11-13T14:00:00.000Z",
    "reasoning": "Wednesday afternoon typically has more stable weather with higher ceilings. Winds are lighter in early afternoon. This gives student pilot Michael Rodriguez safer conditions for training.",
    "weatherLikelihood": "Good - expect 4000ft ceilings, 8kt winds",
    "priority": 1,
    "studentAvailable": true,
    "instructorAvailable": true,
    "aircraftAvailable": true
  },
  {
    "suggestedTime": "2025-11-14T15:30:00.000Z",
    "reasoning": "Thursday mid-afternoon provides backup option. Historical data shows clearing conditions by this time. Allows flexibility if Wednesday doesn't work.",
    "weatherLikelihood": "Fair - expect 3500ft ceilings, 10kt winds",
    "priority": 2,
    "studentAvailable": true,
    "instructorAvailable": true,
    "aircraftAvailable": true
  },
  {
    "suggestedTime": "2025-11-16T13:00:00.000Z",
    "reasoning": "Weekend option for students with weekday conflicts. Saturday early afternoon typically good for training flights. More scheduling flexibility.",
    "weatherLikelihood": "Good - expect 3500-4000ft ceilings",
    "priority": 3,
    "studentAvailable": true,
    "instructorAvailable": true,
    "aircraftAvailable": true
  }
]
```

---

## Prompt Engineering Tips

### Context to Include:
- Student training level and current progress
- Specific weather violations (ceiling, winds, visibility)
- Original booking time (day of week, time of day)
- Historical weather patterns for location
- Training type (pattern work, cross-country, instrument training)

### Constraints to Specify:
- Must be within 7 days
- Must be during daylight hours (7am-6pm local)
- Avoid very early morning (fog risk)
- Student pilots prefer afternoon (more stable)
- Instrument pilots can handle wider range

### Quality Indicators:
- Reasoning mentions specific weather factors
- Shows understanding of training level limitations
- Considers time-of-day weather patterns
- Acknowledges trade-offs between options

---

## Error Handling

### OpenAI API Issues:
- Rate limiting → retry with exponential backoff
- Invalid JSON → parse manually or request regeneration
- Timeout → fall back to rule-based scheduling

### Validation:
- Verify all times are in the future
- Check times are during operational hours
- Ensure no duplicate suggestions
- Validate JSON structure matches expected schema

---

## Cost Considerations

**OpenAI Pricing (GPT-4):**
- ~$0.03-0.06 per reschedule generation
- Expected prompt: ~500 tokens
- Expected completion: ~300 tokens

**For Demo:**
- 20 bookings × 1-2 weather conflicts = ~$0.10-0.20
- Well within free tier limits

**Production Optimization:**
- Cache common scenarios
- Use GPT-4o-mini for faster/cheaper results
- Batch requests when possible

---

## Time Estimate Breakdown

- OpenAI client setup: 30 min
- Prompt engineering & testing: 45 min
- Reschedule generator logic: 45 min
- API endpoint + Firestore: 30 min
- Testing & refinement: 30 min
- **Total: ~3 hours**

---

## Next Epic Preview

Once Epic 3 is complete, we move to **Epic 4: Notification System**:
- Resend email API integration
- Email templates for cancellations
- Include reschedule options in notifications
- Log delivery status

With AI generating smart alternatives, we'll make the notifications actually useful! 📧

---

## Notes

- For v1, availability uses mock data with realistic patterns (not everything available)
- Mock data should show realistic conflicts: some instructors unavailable certain days, aircraft in maintenance, students with work schedules
- Weather forecasts are qualitative guesses (no real forecast API for v1)
- AI should explain when it's making trade-offs (e.g., "Saturday morning is available but not ideal weather-wise")
- In production, integrate real availability systems and forecast APIs
- Consider adding student preference learning over time
- Could expand to suggest alternative locations (other airports with better weather)

