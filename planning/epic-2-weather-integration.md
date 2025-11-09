# Epic 2: Weather Integration

**Status**: ✅ Complete  
**Estimated Time**: 2-3 hours  
**Dependencies**: OpenWeatherMap API key in `.env.local`  
**Can run parallel to**: Epic 1 (Data Foundation)

---

## Goal
Integrate OpenWeatherMap API to fetch real-time weather data and evaluate flight safety based on training-level-specific minimums.

---

## Deliverables

### 1. Weather Fetch Function
Fetch current weather conditions for any location (lat/lon):
- Visibility (statute miles)
- Ceiling/cloud base (feet AGL)
- Wind speed & gusts (knots)
- Wind direction (for crosswind calculation)
- Precipitation type (rain, snow, thunderstorms)
- Temperature & dewpoint (for icing assessment)

### 2. Safety Evaluation Engine
Compare weather against training level minimums:
- Load minimums from `src/lib/weather-minimums.ts` (already exists ✅)
- Evaluate each condition (visibility, ceiling, winds, crosswind, IMC)
- Return pass/fail with reasoning
- Flag special hazards (thunderstorms, icing, gusts)

### 3. Weather Check API Endpoint
Expose `/api/check-weather` for manual and automated checks:
- Accept booking ID or lat/lon + training level
- Fetch weather
- Evaluate safety
- Log result to `weatherChecks` collection
- Return detailed result with reasoning

### 4. Unit Tests
Test edge cases and safety logic accuracy.

---

## Implementation Tasks

### Task 1: OpenWeatherMap Integration
**File**: `src/lib/weather-api.ts`

```typescript
// Key functions:
- fetchWeather(lat: number, lon: number) → WeatherData
- parseWeatherResponse(apiResponse) → WeatherData
- calculateCrosswind(windDir, windSpeed, runwayHeading) → number
```

**API Endpoint**: https://api.openweathermap.org/data/2.5/weather  
**Required params**: `lat`, `lon`, `appid`, `units=imperial`

**Response parsing**:
- Visibility: `response.visibility` (meters → convert to miles)
- Ceiling: `response.clouds.all` + cloud base algorithm
- Wind: `response.wind.speed` (convert to knots), `response.wind.gust`
- Direction: `response.wind.deg`
- Conditions: `response.weather[0].main` (Rain, Thunderstorm, Snow, etc.)

### Task 2: Safety Evaluation Logic
**File**: `src/lib/weather-evaluation.ts`

```typescript
// Key functions:
- evaluateSafety(weather: WeatherData, trainingLevel: TrainingLevel) → EvaluationResult
- checkVisibility(current, minimum) → boolean
- checkCeiling(current, minimum) → boolean  
- checkWinds(current, gusts, minimum) → boolean
- checkCrosswind(windDir, windSpeed, runwayHeading, maxCrosswind) → boolean
- detectHazards(weather) → Hazard[] // thunderstorms, icing, IMC
```

**Evaluation result**:
```typescript
interface EvaluationResult {
  isSafe: boolean;
  violations: string[]; // e.g., "Wind speed 15kt exceeds 10kt minimum"
  hazards: string[]; // e.g., "Thunderstorms in area"
  reasoning: string; // AI-friendly summary
}
```

### Task 3: Weather Check API Route
**File**: `src/app/api/check-weather/route.ts`

```typescript
// POST /api/check-weather
// Body: { bookingId: string } OR { lat, lon, trainingLevel }

1. Fetch booking (if bookingId provided) from Firestore
2. Call fetchWeather(lat, lon)
3. Call evaluateSafety(weather, trainingLevel)
4. Log to weatherChecks collection:
   - timestamp
   - bookingId
   - weather snapshot
   - evaluation result
5. Return result
```

### Task 4: Unit Tests
**File**: `src/lib/__tests__/weather-evaluation.test.ts`

Test cases:
- ✅ Student pilot: Safe conditions (10kt winds, 5mi vis, 3000ft ceiling)
- ✅ Student pilot: Unsafe winds (15kt exceeds 10kt limit)
- ✅ Private pilot: Same 15kt winds are safe
- ✅ Instrument pilot: IMC conditions are allowed
- ✅ Non-instrument pilot: IMC conditions are unsafe
- ✅ Thunderstorm detection (any training level → unsafe)
- ✅ Icing conditions detection (temp near freezing + visible moisture)
- ✅ High gusts exceed limit
- ✅ Crosswind calculation accuracy

---

## Testing & Validation

### Success Criteria
- [ ] Weather API returns valid data for test coordinates (KJFK: 40.6413, -73.7781)
- [ ] Safety evaluation correctly flags unsafe conditions per training level
- [ ] API endpoint accepts bookingId and returns evaluation
- [ ] Results logged to Firestore `weatherChecks` collection
- [ ] Unit tests pass for all edge cases
- [ ] Error handling for API failures (rate limit, network error)

### Manual Testing
1. Test API endpoint: `POST /api/check-weather`
   ```json
   {
     "lat": 40.6413,
     "lon": -73.7781,
     "trainingLevel": "student"
   }
   ```
2. Verify response includes weather data and safety evaluation
3. Check Firestore Console → `weatherChecks` collection has new entry
4. Test with different training levels (student → private → instrument)
5. Run unit tests: `npm test weather-evaluation`

---

## Files to Create

```
src/
├── lib/
│   ├── weather-api.ts              # OpenWeatherMap integration
│   ├── weather-evaluation.ts       # Safety logic
│   └── __tests__/
│       └── weather-evaluation.test.ts
└── app/
    └── api/
        └── check-weather/
            └── route.ts             # Weather check endpoint
```

---

## Data Schema Reference

Add to `src/types/index.ts` if not already present:

```typescript
interface WeatherData {
  visibility: number; // statute miles
  ceiling: number; // feet AGL
  windSpeed: number; // knots
  windGust: number; // knots
  windDirection: number; // degrees
  temperature: number; // fahrenheit
  dewpoint: number; // fahrenheit
  precipitation: string; // "none" | "rain" | "snow" | "thunderstorm"
  timestamp: Date;
}

interface WeatherCheck {
  id: string;
  bookingId?: string;
  location: { lat: number; lon: number };
  trainingLevel: TrainingLevel;
  weather: WeatherData;
  evaluation: EvaluationResult;
  createdAt: Date;
}
```

---

## Notes

### Runway Heading for Crosswind
For demo purposes, use most common runway at each airport:
- KJFK: Runway 31L (310°)
- KLAX: Runway 24R (240°)
- KORD: Runway 28R (280°)
- KDFW: Runway 18R (180°)

In production, this would come from booking data.

### Ceiling Calculation
OpenWeatherMap doesn't provide exact cloud base. Use approximation:
- Clear (< 10% clouds): 10,000 ft
- Scattered (10-50%): 3,500 ft
- Broken (50-90%): 2,000 ft
- Overcast (> 90%): 1,000 ft

### Rate Limiting
Free tier: 1000 calls/day = ~40/hour. Cache responses for 10 minutes to avoid duplicate calls during demo.

### Special Conditions
- **Thunderstorms**: Always unsafe (any training level)
- **Icing**: temp 0-10°C + visible moisture → flag warning
- **IMC**: visibility < 3mi OR ceiling < 1000ft

---

## Time Estimate Breakdown

- Weather API integration: 45 min
- Safety evaluation logic: 45 min
- API route + Firestore logging: 30 min
- Unit tests: 30 min
- **Total: ~2.5 hours**

---

## Next Epic Preview

Once Epic 2 is complete, we move to **Epic 3: AI Rescheduling**:
- OpenAI integration for generating optimal alternative times
- Prompt engineering with constraints
- JSON structured output parsing

But first, let's get real weather data flowing! ⛈️

