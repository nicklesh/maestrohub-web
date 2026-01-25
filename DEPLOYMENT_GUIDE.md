# Maestro Habitat - Deployment Guide

## Domain: maestrohabitat.com

---

## 🌐 PART 1: WEB APP DEPLOYMENT

### Option A: Deploy via Vercel (Recommended for Expo Web)

#### Step 1: Export Web Build
```bash
cd /app/frontend
npx expo export:web
```

#### Step 2: Deploy to Vercel
1. Go to https://vercel.com
2. Sign up / Login with GitHub
3. Click "Add New Project"
4. Import your repository or upload the `dist` folder
5. Configure:
   - Framework: "Other"
   - Build Command: `npx expo export:web`
   - Output Directory: `dist`
6. Add Environment Variables:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://api.maestrohabitat.com
   ```
7. Click "Deploy"

#### Step 3: Connect Domain
1. In Vercel Dashboard → Your Project → Settings → Domains
2. Add `maestrohabitat.com` and `www.maestrohabitat.com`
3. Update DNS at your domain registrar:
   ```
   Type: A     Name: @    Value: 76.76.19.19
   Type: CNAME Name: www  Value: cname.vercel-dns.com
   ```

---

### Option B: Deploy Backend API Separately

Your backend needs to be deployed to serve the API. Options:

#### Railway.app (Recommended)
1. Go to https://railway.app
2. Connect GitHub repo
3. Add `/app/backend` as service
4. Set environment variables (copy from /app/backend/.env)
5. Get your API URL → Update frontend EXPO_PUBLIC_BACKEND_URL

#### Render.com
1. Go to https://render.com
2. Create "Web Service"
3. Connect repo, set root to `/app/backend`
4. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

---

## 📱 PART 2: MOBILE APP DEPLOYMENT (iOS & Android)

### Prerequisites

1. **Expo Account**: https://expo.dev (free)
2. **Apple Developer Account**: https://developer.apple.com ($99/year)
3. **Google Play Console**: https://play.google.com/console ($25 one-time)

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure Project
```bash
cd /app/frontend
eas build:configure
```

### Step 3: Update eas.json
Edit `/app/frontend/eas.json` with your credentials:
- Apple ID
- Apple Team ID  
- App Store Connect App ID
- Google Service Account JSON

---

## 🍎 iOS App Store Deployment

### Step 1: Build for iOS
```bash
eas build --platform ios --profile production
```
Wait 15-30 minutes for build to complete.

### Step 2: Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click "+" → "New App"
3. Fill in:
   - Platform: iOS
   - Name: Maestro Habitat
   - Bundle ID: com.maestrohabitat.app
   - SKU: maestrohabitat001

### Step 3: Submit to App Store
```bash
eas submit --platform ios --profile production
```

### Step 4: Complete App Store Listing
In App Store Connect:
- Add screenshots (6.7", 6.5", 5.5" sizes)
- Write description
- Set age rating
- Add privacy policy URL: https://maestrohabitat.com/privacy
- Submit for review

---

## 🤖 Android Play Store Deployment

### Step 1: Build for Android
```bash
eas build --platform android --profile production
```
Wait 15-30 minutes for build to complete.

### Step 2: Create App in Google Play Console
1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - App name: Maestro Habitat
   - Default language: English
   - App type: App
   - Category: Education

### Step 3: Submit to Play Store
```bash
eas submit --platform android --profile production
```

### Step 4: Complete Store Listing
In Google Play Console:
- Add screenshots
- Write description
- Create feature graphic (1024x500)
- Set content rating
- Add privacy policy URL
- Submit for review

---

## 🔗 DNS Configuration for maestrohabitat.com

### Recommended Setup:
```
# Root domain for web app
Type: A      Name: @      Value: [Vercel IP or hosting IP]

# WWW subdomain
Type: CNAME  Name: www    Value: [Vercel CNAME]

# API subdomain for backend
Type: CNAME  Name: api    Value: [Railway/Render URL]
```

### Final URLs:
- **Web App**: https://maestrohabitat.com
- **API**: https://api.maestrohabitat.com
- **iOS App**: App Store
- **Android App**: Play Store

---

## 📋 Pre-Launch Checklist

### Legal Pages (Required for App Stores)
- [ ] Privacy Policy page
- [ ] Terms of Service page
- [ ] Support/Contact page

### App Store Assets Needed
- [ ] App Icon (1024x1024 PNG, no transparency)
- [ ] iOS Screenshots (6.7", 6.5", 5.5")
- [ ] Android Screenshots + Feature Graphic
- [ ] App Description (short & long)
- [ ] Keywords/Tags

### Environment Variables for Production
```bash
# Backend (.env)
MONGO_URL=mongodb+srv://...
OPENAI_API_KEY=sk-...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NEW_RELIC_LICENSE_KEY=...
MIXPANEL_TOKEN=...
RESEND_API_KEY=...

# Frontend
EXPO_PUBLIC_BACKEND_URL=https://api.maestrohabitat.com
```

---

## 🚀 Quick Start Commands

```bash
# Build iOS
eas build --platform ios --profile production

# Build Android  
eas build --platform android --profile production

# Submit iOS
eas submit --platform ios

# Submit Android
eas submit --platform android

# Export Web
npx expo export:web
```

---

## Need Help?

- Expo Docs: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- App Store Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Play Store Policy: https://play.google.com/about/developer-content-policy/
