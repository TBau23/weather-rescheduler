# Deployment Checklist

Quick reference checklist for deploying Weather Rescheduler to Vercel.

## Pre-Deployment (Do Once)

### 1. Environment Variables Setup
Copy these to Vercel Dashboard → Settings → Environment Variables:

```bash
# Firebase (6 variables)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# APIs (3 variables)
OPENWEATHERMAP_API_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=

# App Config (3 variables)
CRON_SECRET=                                    # Generate: openssl rand -base64 32
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app # Update after deployment
FROM_EMAIL=onboarding@resend.dev                # Or your verified domain

# Optional - Testing
DEMO_EMAIL=your-email@example.com               # Redirects all emails here for testing
```

### 2. Firebase Security Rules
Update in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### 3. Vercel Cron Jobs
- ⚠️ **Requires Vercel Pro plan** ($20/month)
- Already configured in `vercel.json`
- Alternative: Use GitHub Actions (see DEPLOYMENT_GUIDE.md)

---

## Deployment Steps

### Option A: GitHub (Recommended)
```bash
# 1. Commit and push
git add .
git commit -m "Prepare for deployment"
git push origin main

# 2. Import to Vercel
# - Go to vercel.com
# - New Project → Import Git Repository
# - Select your repo
# - Add environment variables
# - Deploy
```

### Option B: Vercel CLI
```bash
# 1. Install and login
npm i -g vercel
vercel login

# 2. Deploy
vercel --prod
```

---

## Post-Deployment Testing

### Quick Health Check
```bash
# Replace YOUR_APP with your Vercel URL

# 1. Basic ping
curl https://YOUR_APP.vercel.app/api/ping

# 2. Test Firebase
curl https://YOUR_APP.vercel.app/api/test-firebase

# 3. Test Weather API
curl https://YOUR_APP.vercel.app/api/test-weather-simple

# 4. Test OpenAI
curl https://YOUR_APP.vercel.app/api/test-ai

# 5. Test Email (only if DEMO_EMAIL is set)
curl https://YOUR_APP.vercel.app/api/test-email

# 6. Seed database (optional)
curl https://YOUR_APP.vercel.app/api/seed-data

# 7. Manual weather check
curl https://YOUR_APP.vercel.app/api/run-weather-check
```

### Verify Cron Job (After 1 Hour)
1. Go to Vercel Dashboard → Functions → Logs
2. Filter by `/api/cron/weather-check`
3. Verify hourly execution

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Firebase not initialized" | Add Firebase env vars in Vercel |
| "CRON_SECRET not configured" | Generate and add to Vercel env vars |
| Emails not sending | Set `FROM_EMAIL=onboarding@resend.dev` |
| Cron not running | Upgrade to Vercel Pro or use GitHub Actions |
| Weather API errors | Wait 10-15 min after API key creation |
| OpenAI quota error | Add billing in OpenAI dashboard |

---

## Final Checklist

Before going live:

- [ ] All 12 environment variables set in Vercel
- [ ] Firebase security rules updated
- [ ] Build succeeds (check Vercel deployment logs)
- [ ] `/api/ping` returns 200 OK
- [ ] `/api/test-firebase` returns success
- [ ] `/api/test-weather-simple` returns weather data
- [ ] `/api/test-ai` returns OK
- [ ] `/api/test-email` sends successfully (if DEMO_EMAIL set)
- [ ] Database seeded with initial data
- [ ] Cron job logs show successful execution (wait 1 hour)
- [ ] `NEXT_PUBLIC_APP_URL` updated to production URL
- [ ] Demo mode tested (set DEMO_EMAIL, trigger weather check)
- [ ] Reschedule acceptance link works

---

## Quick Reference

**Vercel Dashboard**: https://vercel.com/dashboard  
**Firebase Console**: https://console.firebase.google.com  
**Resend Dashboard**: https://resend.com/dashboard  
**OpenAI Platform**: https://platform.openai.com  
**OpenWeather Dashboard**: https://home.openweathermap.org

**Full Documentation**: See `DEPLOYMENT_GUIDE.md`

---

## Emergency Rollback

If something breaks:
1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "⋯" → "Promote to Production"
4. Done! ✅

