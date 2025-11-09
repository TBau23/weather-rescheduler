# Epic 4: Notification System

**Status**: 🔄 Not Started  
**Estimated Time**: 2-3 hours  
**Dependencies**: 
- Epic 1 (Data Foundation) - for Firestore schema
- Resend API key in `.env.local`  
**Can run parallel to**: Epic 3 (AI Rescheduling)

---

## Goal
Build a reliable email notification system that sends weather alerts and reschedule options to students and instructors using Resend API, with full logging to Firestore.

---

## Deliverables

### 1. Email Templates
Professional, branded HTML email templates for:
- **Weather Alert**: Notifies that flight is cancelled due to unsafe weather conditions
- **Reschedule Options**: Presents 3 AI-generated alternative times with reasoning
- **Confirmation**: Confirms a rescheduled booking
- **Plain text fallback** for all templates (accessibility)

### 2. Resend Integration
Core email sending functionality:
- Send single email with retry logic
- Handle Resend API errors gracefully
- Support attachments (future: weather charts)
- Rate limit awareness (100 emails/day on free tier)

### 3. Notification Logger
Track all email delivery attempts:
- Log to Firestore `notifications` collection
- Capture send status (sent, failed, bounced)
- Store email content for audit trail
- Link to related booking and weather check

### 4. Notification API Endpoint
Expose `/api/send-notification` for triggering emails:
- Accept notification type and booking data
- Generate appropriate email template
- Send via Resend
- Log result to Firestore
- Return delivery status

---

## Implementation Tasks

### Task 1: Resend API Integration
**File**: `src/lib/email-service.ts`

```typescript
// Key functions:
- sendEmail(to: string, subject: string, html: string, text: string) → Promise<SendResult>
- sendWeatherAlert(booking: Booking, weatherCheck: WeatherCheck) → Promise<SendResult>
- sendRescheduleOptions(booking: Booking, options: RescheduleOption[]) → Promise<SendResult>
- sendConfirmation(booking: Booking) → Promise<SendResult>

// With retry logic:
- retrySend(emailFn: Function, maxRetries: 3, backoff: exponential)

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

**Resend Configuration**:
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Send from verified domain
const FROM_EMAIL = 'noreply@yourdomain.com'; // Or use onboarding@resend.dev for testing
```

### Task 2: Email Template Engine
**File**: `src/lib/email-templates.ts`

```typescript
// Key functions:
- generateWeatherAlertEmail(booking, weatherCheck) → { html, text }
- generateRescheduleOptionsEmail(booking, options) → { html, text }
- generateConfirmationEmail(booking) → { html, text }

// Template structure:
interface EmailTemplate {
  html: string; // Rich HTML with styling
  text: string; // Plain text fallback
  subject: string;
}
```

**Weather Alert Template** (example structure):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Modern, professional styling */
    body { font-family: Arial, sans-serif; }
    .alert-box { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px; }
    .weather-details { background: #F3F4F6; padding: 12px; border-radius: 4px; }
    .cta-button { background: #2563EB; color: white; padding: 12px 24px; }
  </style>
</head>
<body>
  <h1>Flight Cancelled - Weather Below Minimums</h1>
  <div class="alert-box">
    <strong>Your flight on {date} at {time} has been cancelled due to unsafe weather conditions.</strong>
  </div>
  
  <h2>Weather Details</h2>
  <div class="weather-details">
    <p><strong>Visibility:</strong> {visibility} miles (minimum: {minVisibility})</p>
    <p><strong>Ceiling:</strong> {ceiling} feet (minimum: {minCeiling})</p>
    <p><strong>Winds:</strong> {windSpeed}kt, gusts {windGust}kt (maximum: {maxWind})</p>
    <p><strong>Conditions:</strong> {conditions}</p>
  </div>
  
  <h2>Reason</h2>
  <p>{reasoning}</p>
  
  <p>We'll send you alternative scheduling options shortly.</p>
  
  <a href="{dashboardUrl}" class="cta-button">View Dashboard</a>
</body>
</html>
```

**Reschedule Options Template**:
```html
<!-- Similar structure with: -->
- List of 3 options with date, time, duration
- AI reasoning for each option
- "Accept This Option" button for each
- Link to view all options in dashboard
```

### Task 3: Notification Logger
**File**: `src/lib/notification-logger.ts`

```typescript
// Key functions:
- logNotification(notification: Notification) → Promise<string>
- getNotificationsByBooking(bookingId: string) → Promise<Notification[]>
- updateNotificationStatus(notificationId: string, status: string) → Promise<void>

interface Notification {
  id: string;
  bookingId: string;
  studentId: string;
  type: 'weather_alert' | 'reschedule_options' | 'confirmation';
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  resendMessageId?: string;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}
```

**Firestore Operations**:
```typescript
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

// Log notification to Firestore
const notificationRef = await addDoc(collection(db, 'notifications'), {
  bookingId: booking.id,
  studentId: booking.studentId,
  type: 'weather_alert',
  recipientEmail: student.email,
  subject: 'Flight Cancelled - Weather Alert',
  htmlContent: emailTemplate.html,
  textContent: emailTemplate.text,
  status: 'pending',
  createdAt: new Date(),
});
```

### Task 4: Notification API Route
**File**: `src/app/api/send-notification/route.ts`

```typescript
// POST /api/send-notification
// Body: { bookingId: string, type: 'weather_alert' | 'reschedule_options' | 'confirmation' }

async function POST(request: Request) {
  const { bookingId, type } = await request.json();
  
  // 1. Fetch booking + student data from Firestore
  const booking = await getBooking(bookingId);
  const student = await getStudent(booking.studentId);
  
  // 2. Generate appropriate email template
  let emailTemplate;
  switch (type) {
    case 'weather_alert':
      const weatherCheck = await getLatestWeatherCheck(bookingId);
      emailTemplate = generateWeatherAlertEmail(booking, weatherCheck);
      break;
    case 'reschedule_options':
      const options = await getRescheduleOptions(bookingId);
      emailTemplate = generateRescheduleOptionsEmail(booking, options);
      break;
    case 'confirmation':
      emailTemplate = generateConfirmationEmail(booking);
      break;
  }
  
  // 3. Send email via Resend
  const result = await sendEmail(
    student.email,
    emailTemplate.subject,
    emailTemplate.html,
    emailTemplate.text
  );
  
  // 4. Log notification to Firestore
  await logNotification({
    bookingId,
    studentId: student.id,
    type,
    recipientEmail: student.email,
    subject: emailTemplate.subject,
    htmlContent: emailTemplate.html,
    textContent: emailTemplate.text,
    status: result.success ? 'sent' : 'failed',
    resendMessageId: result.messageId,
    error: result.error,
    sentAt: result.success ? new Date() : undefined,
    createdAt: new Date(),
  });
  
  // 5. Return result
  return Response.json({
    success: result.success,
    notificationId: notificationRef.id,
    messageId: result.messageId,
    error: result.error,
  });
}
```

### Task 5: Error Handling & Retry Logic
**File**: `src/lib/email-service.ts` (continued)

```typescript
async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  text: string,
  maxRetries: number = 3
): Promise<SendResult> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        text,
      });
      
      return { success: true, messageId: result.id };
    } catch (error) {
      lastError = error as Error;
      console.error(`Email send attempt ${attempt + 1} failed:`, error);
      
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  
  return { success: false, error: lastError.message };
}
```

**Handle Specific Resend Errors**:
```typescript
- 401: Invalid API key → log critical error, don't retry
- 429: Rate limit → wait 60s, retry
- 422: Invalid email format → log validation error, don't retry
- 5xx: Server error → retry with backoff
```

---

## Testing & Validation

### Success Criteria
- [ ] Resend API integration sends emails successfully
- [ ] Email templates render correctly in Gmail, Outlook, Apple Mail
- [ ] Plain text fallback works for clients that don't support HTML
- [ ] Notifications logged to Firestore with correct status
- [ ] Error handling gracefully catches Resend API failures
- [ ] Retry logic attempts 3 times with exponential backoff
- [ ] API endpoint returns proper success/error responses
- [ ] Rate limiting respected (don't exceed 100 emails/day on free tier)

### Manual Testing

#### 1. Test Resend Integration
```bash
# Simple test endpoint
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

#### 2. Test Weather Alert Email
```bash
curl -X POST http://localhost:3000/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking123",
    "type": "weather_alert"
  }'
```

#### 3. Verify in Firestore
- Open Firebase Console
- Check `notifications` collection
- Verify entry has `status: 'sent'` and `resendMessageId`

#### 4. Check Email Inbox
- Verify email received
- Check spam folder if not in inbox
- Test rendering in multiple email clients

#### 5. Test Error Handling
```typescript
// Test with invalid email
await sendEmail('invalid-email', 'Test', '<p>Test</p>', 'Test');
// Should return { success: false, error: '...' }

// Test with invalid API key (temporarily break .env)
// Should fail gracefully and log error
```

---

## Files to Create

```
src/
├── lib/
│   ├── email-service.ts           # Resend integration + send functions
│   ├── email-templates.ts         # HTML/text template generators
│   └── notification-logger.ts     # Firestore notification logging
└── app/
    └── api/
        ├── send-notification/
        │   └── route.ts            # Main notification endpoint
        └── test-email/
            └── route.ts            # Simple test endpoint
```

---

## Data Schema Reference

Update `src/types/index.ts` if not already present:

```typescript
interface Notification {
  id: string;
  bookingId: string;
  studentId: string;
  type: 'weather_alert' | 'reschedule_options' | 'confirmation';
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  resendMessageId?: string;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

---

## Notes

### Resend Setup
1. Sign up at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Add to `.env.local`: `RESEND_API_KEY=re_...`
4. For testing, use `onboarding@resend.dev` as sender (no domain verification needed)
5. For production, verify your domain and use `noreply@yourdomain.com`

### Demo Email Configuration
**Problem**: Seed data uses fake emails (`alex.thompson@example.com`) that can't receive real emails.

**Solution Options**:

**Option 1: Test Email Override (Recommended for Demo)**
```typescript
// In src/lib/email-service.ts
const DEMO_MODE = process.env.NODE_ENV === 'development';
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'your-email@gmail.com';

async function sendEmail(to: string, subject: string, html: string, text: string) {
  // In demo mode, send all emails to your test address but show original in UI
  const actualRecipient = DEMO_MODE ? DEMO_EMAIL : to;
  
  // Add note to email in demo mode
  const demoNote = DEMO_MODE 
    ? `<p><em>📧 Demo Mode: This email would normally be sent to ${to}</em></p><hr/>`
    : '';
  
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: actualRecipient,
    subject: DEMO_MODE ? `[DEMO] ${subject}` : subject,
    html: demoNote + html,
    text,
  });
  
  return { success: true, messageId: result.id };
}
```

**Option 2: Update Seed Data with Real Emails**
Modify `src/scripts/seed-data.ts` to use your actual email(s):
```typescript
// Use your email for all students in dev
const DEV_EMAIL = process.env.DEMO_EMAIL || 'your-email@gmail.com';

const SAMPLE_STUDENTS = [
  { name: 'Alex Thompson', trainingLevel: 'student', email: DEV_EMAIL, phone: '(555) 123-4567' },
  { name: 'Sarah Chen', trainingLevel: 'student', email: DEV_EMAIL, phone: '(555) 234-5678' },
  // ... rest use same email
];
```

**Option 3: Email Alias (Best for Demo Video)**
Use Gmail's `+` alias feature:
- `youremail+alex@gmail.com`
- `youremail+sarah@gmail.com`
- All deliver to `youremail@gmail.com` but show different recipients in inbox
- Dashboard/logs show different emails (looks realistic for demo)

**Recommended Setup**:
```env
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev
DEMO_EMAIL=your-actual-email@gmail.com  # Where emails actually go
NODE_ENV=development  # Enables demo mode override
```

**For Demo Video**:
1. Use Option 1 (override) so all emails come to your inbox
2. Email content shows "Would be sent to: sarah.chen@example.com"
3. You can demonstrate receiving multiple notifications
4. Dashboard still shows original student emails (maintains realism)

### Email Deliverability Tips
- Always include plain text version (helps avoid spam)
- Use descriptive subject lines (avoid "Re:", "FWD:")
- Include unsubscribe link (not required for transactional emails, but good practice)
- Test with [mail-tester.com](https://www.mail-tester.com) before production

### Rate Limiting
- Free tier: 100 emails/day, 10,000/month
- For demo: 5-10 test emails max
- Cache notification logs to avoid duplicate sends
- Consider batch sending for multiple recipients

### Content Guidelines
- Keep subject under 60 characters (mobile preview)
- Use responsive design (mobile-friendly)
- Include clear call-to-action button
- Add company branding/logo if available
- Include contact information for questions

### Future Enhancements (v2)
- SMS notifications via Twilio (for urgent weather changes)
- Push notifications (web + mobile)
- Notification preferences per student (email vs SMS)
- Scheduled sends (e.g., send reminder 2 hours before flight)
- Email tracking (opens, clicks) via Resend webhooks

---

## Time Estimate Breakdown

- Resend integration: 30 min
- Email template design: 60 min
- Notification logger: 30 min
- API route + error handling: 30 min
- Testing & validation: 30 min
- **Total: ~3 hours**

---

## Next Epic Preview

Once Epic 4 is complete, we move to **Epic 5: Dashboard UI**:
- React frontend with real-time Firestore listeners
- Booking list view with status badges
- Weather alert cards
- Manual trigger button for demo

But first, let's get those emails flying! 📧

---

## Integration Points

### Epic 2 (Weather) → Epic 4 (Notifications)
When weather check detects conflict:
```typescript
// In /api/check-weather/route.ts
if (!evaluation.isSafe && booking.status !== 'conflict') {
  // Update booking status
  await updateBooking(bookingId, { status: 'conflict' });
  
  // Send weather alert
  await fetch('/api/send-notification', {
    method: 'POST',
    body: JSON.stringify({ bookingId, type: 'weather_alert' }),
  });
}
```

### Epic 3 (AI) → Epic 4 (Notifications)
After generating reschedule options:
```typescript
// In /api/generate-reschedules/route.ts
const options = await generateRescheduleOptions(booking);
await saveRescheduleOptions(bookingId, options);

// Send reschedule options email
await fetch('/api/send-notification', {
  method: 'POST',
  body: JSON.stringify({ bookingId, type: 'reschedule_options' }),
});
```

### Epic 6 (Orchestration)
Main workflow will chain:
1. Weather check → conflict detected
2. Send weather alert email
3. Generate AI reschedule options
4. Send reschedule options email
5. Update dashboard (via Firestore listeners)

---

## Dependencies

### NPM Packages
```bash
npm install resend
```

### Environment Variables
```env
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev  # or your verified domain
DEMO_EMAIL=your-actual-email@gmail.com  # For prototype: where emails actually go
NODE_ENV=development  # Enables demo mode email override
```

### API Keys Needed
- Resend API key (get from [resend.com/api-keys](https://resend.com/api-keys))

---

## Demo Checklist

Before recording demo video:
- [ ] Set `DEMO_EMAIL` in `.env.local` to your actual email address
- [ ] Verify demo mode is enabled (`NODE_ENV=development`)
- [ ] Send test weather alert - should arrive at your email with "[DEMO]" prefix
- [ ] Verify email renders correctly in your inbox
- [ ] Confirm email shows "Would normally be sent to: [original-email]" note
- [ ] Check Firestore has notification log entry with original student email
- [ ] Test reschedule options email with 3 AI-generated options
- [ ] Verify all links work (dashboard URL, accept button)
- [ ] Test error handling (invalid email, API failure)
- [ ] Confirm plain text version works
- [ ] Check spam score (should be < 5 on mail-tester.com)
- [ ] Clear your inbox before recording to show clean demo

---

