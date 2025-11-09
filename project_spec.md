# Weather Rescheduler - Project Specification

## Project Overview
Build a working event-driven system that monitors weather conditions for scheduled flight lessons, automatically detects conflicts based on student training levels, and uses AI to generate optimized rescheduling options with real notifications.

---

## Demo Strategy

**Video Flow (5-7 minutes):**
1. Show pre-seeded bookings in dashboard (3-4 students, various training levels)
2. Trigger weather check (manual button for demo, auto-runs hourly in production)
3. Watch system detect conflicts in real-time
4. Show AI reasoning: "Student Pilot needs 10kt winds, current is 15kt → unsafe"
5. Display AI-generated reschedule options (3 alternatives)
6. Confirm a reschedule → show email notification sent
7. Dashboard updates → booking status changes
8. Quick code walkthrough: weather API integration, AI prompt, event flow

**Key Demo Moments:**
- Real weather data fetching and parsing
- AI making training-level-aware decisions
- Live notification sending
- State transitions in the database
- **Visual wow factors:**
  - Animated real-time dashboard with live state transitions
  - Interactive weather map showing conflicts visually

---

## Tech Stack

### Core
- **Frontend**: React (TypeScript) + Vite
- **Backend**: Next.js API routes (TypeScript)
- **Database**: Firebase Firestore
- **Hosting**: Vercel

### Integrations
- **Weather**: OpenWeatherMap API (free tier: 1000 calls/day)
- **AI**: OpenAI GPT-4 (via your existing key)
- **Notifications**: Resend (free tier: 100 emails/day, 1 API key)
- **Scheduling**: Vercel Cron (built-in)

### Development
- **AI Assistance**: Cursor/Windsurf for generation
- **Version Control**: Git + GitHub

### Visual Enhancements (Epic 5)
- **Animations**: Framer Motion / CSS transitions
- **Maps**: Mapbox GL JS or React Leaflet
- **UI Components**: Tailwind CSS + Headless UI
- **Icons**: Lucide React or Heroicons

---

## System Components

### 1. Weather Monitor (Backend)
**Purpose**: Fetch and evaluate weather conditions against flight safety rules

**Key Functions:**
- Fetch weather for booking locations (lat/lon)
- Parse conditions (visibility, ceiling, winds, precipitation)
- Apply training-level-specific minimums
- Flag unsafe bookings

### 2. AI Rescheduler (Backend)
**Purpose**: Generate optimal alternative booking times

**Key Functions:**
- Analyze student availability patterns (mock data)
- Check instructor availability (mock data)
- Consider aircraft availability (mock data)
- Generate 3 ranked reschedule options with reasoning
- Format as user-friendly suggestions

### 3. Notification System (Backend)
**Purpose**: Send alerts to students and instructors

**Key Functions:**
- Email composition (cancellation + options)
- Delivery via Resend API
- Log notification status in database

### 4. Dashboard (Frontend)
**Purpose**: Display flight status and weather alerts

**Key Views:**
- Active bookings list with status badges
- Weather alerts feed (real-time conflicts)
- Booking detail view with reschedule options
- Simple admin actions (confirm reschedule, dismiss alert)

### 5. Data Layer (Firebase)
**Purpose**: Store and manage all system state

**Collections:**
- `students` - profile, training level, contact info
- `bookings` - scheduled flights with status tracking
- `weatherChecks` - historical check results
- `notifications` - delivery log
- `rescheduleOptions` - AI-generated alternatives

---

## Epics & Parallel Workstreams

### Epic 1: Data Foundation (Day 1)
**Can start immediately**
- [ ] Firebase project setup
- [ ] Define Firestore schema
- [ ] Create seed data script (10 students, 20 bookings)
- [ ] Seed booking status enum (scheduled, conflict, rescheduled, confirmed)

### Epic 2: Weather Integration (Day 1-2)
**Can start immediately, parallel to Epic 1**
- [ ] OpenWeatherMap API setup
- [ ] Weather fetch function (lat/lon → conditions)
- [ ] Safety evaluation logic (training level → minimums → pass/fail)
- [ ] Unit tests for edge cases (IMC, thunderstorms, icing)

### Epic 3: AI Rescheduling (Day 2)
**Depends on: Epic 1 (data schema)**
- [ ] OpenAI integration setup
- [ ] Prompt engineering (system prompt with constraints)
- [ ] Reschedule generator function (booking → 3 options)
- [ ] Response parser (JSON structured output)

### Epic 4: Notification System (Day 2-3)
**Can start parallel to Epic 3**
- [ ] Resend API setup
- [ ] Email templates (cancellation, reschedule options)
- [ ] Send function with error handling
- [ ] Notification logger to Firestore

### Epic 5: Dashboard UI (Day 3-4)
**Depends on: Epic 1 (data schema)**
- [ ] Project scaffold (Vite + React + TypeScript)
- [ ] Booking list view with real-time Firestore listener
- [ ] Weather alert cards
- [ ] Booking detail modal with reschedule options
- [ ] Manual trigger button (for demo)
- [ ] **VISUAL ENHANCEMENT**: Real-time animated state transitions
  - Live progress indicators during weather checks
  - Animated status changes (Scheduled → Checking → Conflict → Rescheduled)
  - Toast notifications as emails send
  - Smooth transitions and loading states
- [ ] **VISUAL ENHANCEMENT**: Interactive weather map
  - Embedded map (Mapbox/Leaflet) showing booking locations
  - Color-coded pins: Green (safe), Red (conflict), Yellow (checking)
  - Click pin to see weather details + booking info
  - Visual flight school location overview

### Epic 6: Orchestration & Automation (Day 4)
**Depends on: Epic 2, 3, 4**
- [ ] Main weather check workflow (fetch → evaluate → AI → notify)
- [ ] Vercel cron job setup (hourly checks)
- [ ] Manual trigger endpoint (for demo)
- [ ] Error handling and retry logic

### Epic 7: Testing & Polish (Day 5)
**Final integration**
- [ ] End-to-end test: create booking → trigger check → verify email
- [ ] Dashboard real-time updates verification
- [ ] Demo video recording setup
- [ ] README documentation

---

## Parallel Execution Strategy

**Day 1:**
- Developer 1 (You + AI): Epic 1 + Epic 2 in sequence
- These are foundational and block later work

**Day 2:**
- Morning: Epic 3 (AI integration)
- Afternoon: Epic 4 (Notifications) - parallel track

**Day 3-4:**
- Epic 5 (Dashboard) - can work independently with mock data initially
- Integrate Epics 2, 3, 4 as they complete
- Add visual enhancements (animations + map) - 4-5 hours extra

**Day 4:**
- Epic 6 (Orchestration) - ties everything together

**Day 5:**
- Epic 7 (Testing & demo prep)

**Critical Path**: Epic 1 → Epic 2 → Epic 6 → Epic 7  
**Parallel Opportunities**: Epic 3 & 4 can happen simultaneously, Epic 5 can start early with mock data

---

## Key Design Decisions

### Why Firebase?
- You're familiar with it
- Real-time listeners for dashboard updates (no polling)
- Free tier sufficient for demo
- Quick setup, no server management

### Why OpenWeatherMap?
- Free tier includes all needed data points
- Simple REST API (one call per location)
- Reliable and well-documented

### Why Resend?
- Simplest email API (one function call)
- Free tier sufficient for demo
- Better deliverability than SendGrid free tier

### Why Next.js API Routes?
- Co-located with React frontend
- Easy Vercel deployment
- Built-in API route structure
- TypeScript support out of the box

### Weather Check Frequency
- Hourly checks (not real-time)
- Checks 24 hours ahead of scheduled flight
- Allows time for rescheduling coordination

---

## Success Validation

**Must Work for Demo:**
1. ✅ Weather API returns valid data for any lat/lon
2. ✅ Safety logic correctly flags unsafe conditions per training level
3. ✅ AI generates 3 valid reschedule options in <5 seconds
4. ✅ Email sends successfully and logs to database
5. ✅ Dashboard shows live updates when booking status changes
6. ✅ Manual trigger button works for repeatable demo

**Visual Polish (High Priority for Demo Impact):**
- ✨ Real-time animated dashboard (Epic 5 enhancement)
- 🗺️ Interactive weather map with color-coded pins (Epic 5 enhancement)

**Nice to Have (Lower Priority):**
- SMS notifications (skip for v1)
- Google Calendar integration (skip for v1)
- Historical analytics (skip for v1)
- Email preview panel in dashboard
- Multi-location weather tracking (departure + arrival)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Weather API rate limits during demo | Cache responses for repeated demos, use manual trigger |
| AI generates invalid times | Validate AI output, fallback to rule-based options |
| Email deliverability issues | Use your own email as recipient for demo, verify inbox |
| Real-time dashboard updates lag | Use Firestore real-time listeners (built-in), test beforehand |
| Vercel cron doesn't trigger | Implement manual trigger as primary demo method |

---

## Deliverables

1. **GitHub Repository**
   - Clean, commented code
   - README with setup instructions
   - `.env.example` with required keys
   - Seed data script

2. **Working Application**
   - Deployed on Vercel
   - Accessible URL for testing
   - Pre-seeded with demo data

3. **Demo Video (5-7 min)**
   - Screen recording of full workflow
   - Code walkthrough (2-3 minutes)
   - Architecture diagram discussion

4. **Documentation**
   - API integration guides
   - AI prompt used for rescheduling
   - Database schema diagram

---

## Out of Scope (Explicitly Not Building)

- Multi-tenant support (single organization only)
- Payment processing
- Mobile app
- User authentication (admin-only access)
- Instructor/student portals
- Historical weather analytics
- Machine learning prediction models
- SMS notifications
- Calendar integrations

---

## Next Steps

1. Set up Firebase project and get credentials
2. Get OpenWeatherMap API key (free tier)
3. Get Resend API key (free tier)
4. Create GitHub repository
5. Start with Epic 1 (Data Foundation)