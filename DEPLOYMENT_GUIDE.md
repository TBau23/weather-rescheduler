# Deployment Guide - Weather Rescheduler

## Overview

This guide covers everything needed to deploy your Weather Rescheduler app from local development to production on Vercel.

## Current Status ✅

Based on your codebase, the following is **already configured**:
- ✅ Next.js build setup
- ✅ Vercel configuration (`vercel.json` with cron jobs)
- ✅ TypeScript configuration
- ✅ API route structure
- ✅ Firebase client SDK integration
- ✅ Email, Weather, and OpenAI integrations
- ✅ Test suite with Vitest

---

## Pre-Deployment Checklist

### 1. Environment Variables 🔑

Your app requires these environment variables. Currently, they're in `.env.local` (gitignored).

#### Required for Production:

**Firebase (6 variables)**
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**Weather API (1 variable)**
```
OPENWEATHERMAP_API_KEY=
```

**OpenAI (1 variable)**
```
OPENAI_API_KEY=
```

**Resend Email (1 variable)**
```
RESEND_API_KEY=
```

**Cron Job Security (1 variable)**
```
CRON_SECRET=
```
Generate with: `openssl rand -base64 32`

**Application URL (1 variable)**
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Email Configuration (2 variables - optional but recommended)**
```
FROM_EMAIL=notifications@yourdomain.com
DEMO_EMAIL=your-test-email@example.com  # For testing in production
```

#### How to Set in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable above
4. Set them for **Production**, **Preview**, and **Development** environments
5. **Important**: Variables with `NEXT_PUBLIC_` prefix are client-side accessible

---

### 2. Firebase Security Rules 🔒

**Current Status**: Your Firestore is likely in "test mode" (open access).

**Action Required**: Update Firebase security rules before production.

#### Recommended Security Rules:

Go to Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Bookings collection - read-only for now
    match /bookings/{bookingId} {
      allow read: if true;  // Anyone can read bookings
      allow write: if false;  // Only server-side can write
    }
    
    // Weather checks collection - read-only
    match /weatherChecks/{checkId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Instructors collection - read-only
    match /instructors/{instructorId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Aircraft collection - read-only
    match /aircraft/{aircraftId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Students collection - read-only
    match /students/{studentId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Notifications collection - read-only
    match /notifications/{notificationId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

**Why these rules?**
- Your app uses Firebase from server-side API routes (not authenticated users)
- All writes happen server-side through Next.js API routes
- Read access is allowed for the app to fetch data
- This prevents unauthorized writes to your database

#### Future Enhancement:
Consider implementing Firebase Admin SDK for server-side operations with full access control.

---

### 3. Vercel Cron Job Configuration ⏰

**Already configured** in `vercel.json`:
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

This runs hourly weather checks automatically.

#### Important Notes:
1. **Cron jobs only work on Vercel's paid plans** (Pro or Enterprise)
   - Hobby plan: You'll need to use an external cron service (see alternatives below)

2. **Authentication**: Your cron endpoint is protected by `CRON_SECRET`
   - Vercel automatically adds `Authorization: Bearer <CRON_SECRET>` header
   - Your endpoint validates this in `src/app/api/cron/weather-check/route.ts`

#### Alternative Cron Solutions (if on Hobby plan):
- **GitHub Actions** (free): Schedule workflow to hit your endpoint
- **Cron-job.org** (free): External cron service
- **Uptime Robot** (free): Can ping endpoints on schedule

Example GitHub Actions workflow:
```yaml
# .github/workflows/cron-weather-check.yml
name: Hourly Weather Check
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
jobs:
  trigger-check:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Weather Check
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/weather-check" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

### 4. Email Service Configuration 📧

**Current Setup**:
- Using Resend (configured in `src/lib/email-service.ts`)
- Demo mode redirects emails to `DEMO_EMAIL` if set
- Default FROM email: `onboarding@resend.dev`

#### Production Email Setup:

**Option A: Use Resend's test email** (quick start)
```
FROM_EMAIL=onboarding@resend.dev
```
- Limited to verified recipient emails only
- Good for initial testing

**Option B: Use your own domain** (recommended for production)
1. Add your domain in Resend dashboard
2. Add DNS records (SPF, DKIM, DMARC)
3. Verify domain
4. Update environment variable:
```
FROM_EMAIL=notifications@yourdomain.com
```

#### Demo Mode Configuration:
```
DEMO_EMAIL=your-email@example.com
```
- When set, all emails redirect to this address
- Useful for testing in production without spamming users
- Email includes banner showing original recipient

---

### 5. API Rate Limits & Quotas 📊

Monitor usage of third-party services:

#### OpenWeatherMap (Free Tier)
- **Limit**: 1,000 calls/day, 60 calls/minute
- **Current usage**: 1 call per booking check
- **Monitoring**: Check dashboard at openweathermap.org
- **Upgrade path**: Professional plan if needed

#### OpenAI (Pay-per-use)
- **Model**: gpt-4o-mini (cheaper than GPT-4)
- **Current usage**: 1 call per weather alert (only when rescheduling)
- **Cost**: ~$0.001-0.002 per reschedule
- **Monitoring**: platform.openai.com/usage
- **Rate limits**: Depends on your account tier

#### Resend (Free Tier)
- **Limit**: 100 emails/day, 1 API key
- **Current usage**: 1-4 emails per cancelled booking
- **Monitoring**: resend.com dashboard
- **Upgrade**: $20/month for 50,000 emails

#### Firebase (Free Spark Plan)
- **Reads**: 50,000/day
- **Writes**: 20,000/day
- **Storage**: 1 GB
- **Current usage**: Low (few hundred ops per day expected)
- **Monitoring**: Firebase Console → Usage

---

### 6. Database Seeding 🌱

**Current Status**: You have seed scripts in `src/scripts/seed-data.ts`

#### For Production:
You need to populate your production Firestore with initial data.

**Option A: Run seed script pointing to production Firebase**
1. Temporarily set production Firebase credentials locally
2. Run: `npm run seed`
3. Verify data in Firebase Console

**Option B: Create API endpoint to seed** (already exists)
```bash
curl https://your-app.vercel.app/api/seed-data
```

**Recommendation**: Seed before going live, or use real production data integration.

---

### 7. Testing in Production 🧪

Before going live with real users:

#### Test Endpoints:
Your app has built-in test endpoints:

```bash
# Test Firebase connection
curl https://your-app.vercel.app/api/test-firebase

# Test Weather API
curl https://your-app.vercel.app/api/test-weather-simple

# Test OpenAI
curl https://your-app.vercel.app/api/test-ai

# Test Email
curl https://your-app.vercel.app/api/test-email

# Manually trigger weather check
curl https://your-app.vercel.app/api/run-weather-check
```

#### End-to-End Test:
1. Seed test data with booking 24 hours ahead
2. Manually trigger weather check
3. Verify email delivery
4. Test reschedule acceptance link

---

### 8. Monitoring & Observability 📈

#### Built-in Logging:
Your app has console logging throughout. View logs in:
- **Vercel Dashboard** → Your Project → Functions → Logs
- Real-time logs: `vercel logs --follow`

#### Key Metrics to Monitor:
- **Cron job execution**: Check hourly runs are successful
- **Email delivery rate**: Track in Resend dashboard
- **Weather API errors**: Monitor for rate limit issues
- **Database operations**: Watch Firebase usage

#### Error Handling:
Your app includes error handling in:
- ✅ Weather API timeouts (10 seconds)
- ✅ Email retry logic (3 attempts with exponential backoff)
- ✅ OpenAI error handling
- ✅ Cron secret validation

#### Future Enhancements:
Consider adding:
- **Sentry** for error tracking
- **LogDNA/Datadog** for log aggregation
- **Uptime monitoring** (Uptime Robot, Pingdom)

---

### 9. Build & Deploy Process 🚀

#### Deploying to Vercel:

**Option A: GitHub Integration** (recommended)
1. Push your code to GitHub
2. Connect repository to Vercel
3. Import project
4. Configure environment variables
5. Deploy automatically on push to `main`

**Option B: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Build Configuration:
Your `package.json` already has correct scripts:
```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start"
  }
}
```

Vercel will automatically:
1. Run `npm install`
2. Run `npm run build`
3. Deploy the optimized build

#### Build Checks:
Before deploying, verify locally:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Build for production
npm run build

# Test production build locally
npm start

# Run tests
npm test
```

---

### 10. Domain Configuration 🌐

#### Setting up Custom Domain:

1. **In Vercel Dashboard**:
   - Go to your project → Settings → Domains
   - Add your domain (e.g., `weather-rescheduler.yourdomain.com`)
   - Vercel provides DNS instructions

2. **Update Environment Variables**:
   ```
   NEXT_PUBLIC_APP_URL=https://weather-rescheduler.yourdomain.com
   ```

3. **Update Email Configuration**:
   - If using custom domain for emails, update `FROM_EMAIL`

4. **SSL Certificate**:
   - Vercel automatically provisions SSL
   - No action needed

---

### 11. Post-Deployment Checklist ✅

After deploying:

- [ ] All environment variables set in Vercel
- [ ] Firebase security rules updated
- [ ] Production build succeeds
- [ ] All test endpoints return 200 OK
- [ ] Cron job executes successfully (check logs after 1 hour)
- [ ] Email delivery works (test with DEMO_EMAIL first)
- [ ] Weather API calls succeed
- [ ] OpenAI generates reschedule options
- [ ] Reschedule acceptance links work
- [ ] Database reads/writes work
- [ ] No console errors in browser
- [ ] Mobile responsiveness verified
- [ ] Performance is acceptable (check Vercel Analytics)

---

### 12. Rollback Plan 🔄

If something goes wrong:

#### Vercel Instant Rollback:
1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "⋯" → "Promote to Production"
4. Changes take effect immediately

#### Database Rollback:
- Firebase doesn't have automatic rollback
- Consider regular Firestore exports for backup
- Enable "Point-in-time recovery" in Firebase (paid plans)

---

### 13. Cost Estimation 💰

**Free Tier (for testing/small scale)**:
- Vercel Hobby: Free
  - No cron jobs (use GitHub Actions)
- Firebase Spark: Free
  - 50K reads, 20K writes/day
- OpenWeatherMap Free: Free
  - 1,000 calls/day
- Resend Free: Free
  - 100 emails/day
- OpenAI: Pay-per-use
  - ~$0.001 per reschedule

**Total monthly cost: ~$0-5** (mostly OpenAI usage)

**Production Scale (Pro tier)**:
- Vercel Pro: $20/month
  - Includes cron jobs
  - Better performance
- Firebase Blaze: Pay-as-you-go
  - ~$5-10/month for moderate usage
- OpenWeatherMap Professional: $40/month
  - 100,000 calls/day
- Resend Pro: $20/month
  - 50,000 emails/month
- OpenAI: Pay-per-use
  - ~$10-50/month depending on volume

**Total monthly cost: ~$95-140** for production scale

---

### 14. Security Best Practices 🔐

- [x] Environment variables not committed (`.env*` in `.gitignore`)
- [x] Cron endpoint protected with secret
- [ ] Firebase security rules configured (TODO)
- [x] API keys stored securely in Vercel
- [x] HTTPS enforced (Vercel default)
- [ ] Consider rate limiting on public endpoints
- [ ] Add CORS configuration if needed
- [ ] Review API route permissions

---

### 15. Performance Optimization ⚡

Current optimizations:
- ✅ Weather API caching (10 minutes TTL)
- ✅ Request timeouts (10 seconds)
- ✅ Retry logic for email service

Additional recommendations:
- **Enable Vercel Analytics** for performance insights
- **Add ISR/SSG** for static pages if needed
- **Optimize images** with Next.js Image component
- **Consider CDN** for static assets
- **Database indexes** in Firestore for common queries

---

### 16. Legal & Compliance 📋

Before production:
- [ ] Privacy policy (if collecting user data)
- [ ] Terms of service
- [ ] GDPR compliance (if serving EU users)
- [ ] CAN-SPAM compliance for emails
- [ ] Data retention policy
- [ ] Review third-party service ToS

---

## Quick Deployment Steps

**TL;DR - Fastest path to deployment**:

```bash
# 1. Push to GitHub
git add .
git commit -m "Prepare for deployment"
git push origin main

# 2. Import to Vercel
# Go to vercel.com → Import Project → Select repo

# 3. Set Environment Variables in Vercel
# Copy all from .env.local to Vercel dashboard

# 4. Update Firebase Security Rules
# Copy rules from section 2 above

# 5. Update NEXT_PUBLIC_APP_URL in Vercel
# Set to: https://your-app.vercel.app

# 6. Generate and set CRON_SECRET
openssl rand -base64 32
# Add to Vercel environment variables

# 7. Deploy
# Vercel auto-deploys on push

# 8. Test all endpoints
curl https://your-app.vercel.app/api/ping
curl https://your-app.vercel.app/api/test-firebase
# etc...

# 9. Monitor first cron run
# Check Vercel logs after 1 hour
```

---

## Troubleshooting Common Issues

### "Firebase not initialized" error
- **Cause**: Missing Firebase environment variables
- **Fix**: Verify all `NEXT_PUBLIC_FIREBASE_*` variables in Vercel

### Cron job not running
- **Cause**: Not on Vercel Pro plan
- **Fix**: Upgrade or use GitHub Actions alternative

### Emails not sending
- **Cause**: Invalid Resend API key or FROM_EMAIL
- **Fix**: Verify key and use `onboarding@resend.dev` for testing

### Weather API timeout
- **Cause**: OpenWeatherMap API key inactive
- **Fix**: Wait 10-15 minutes after signup for activation

### OpenAI "insufficient quota" error
- **Cause**: No billing set up
- **Fix**: Add payment method in OpenAI platform

---

## Support Resources

- **Next.js**: https://nextjs.org/docs
- **Vercel**: https://vercel.com/docs
- **Firebase**: https://firebase.google.com/docs
- **Resend**: https://resend.com/docs
- **OpenAI**: https://platform.openai.com/docs

---

## Summary

Your app is **deployment-ready** with minimal changes needed:

**Must Do**:
1. ✅ Set environment variables in Vercel
2. ⚠️ Update Firebase security rules
3. ✅ Generate CRON_SECRET
4. ✅ Set production NEXT_PUBLIC_APP_URL

**Should Do**:
5. Configure custom domain for professional emails
6. Set up monitoring/logging
7. Test all endpoints post-deployment

**Nice to Have**:
8. Set up Vercel Analytics
9. Configure custom domain
10. Add error tracking (Sentry)

**Total time to deploy**: 30-60 minutes

Good luck with your deployment! 🚀

