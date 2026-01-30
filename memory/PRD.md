# Maestro Habitat - PRD (Product Requirements Document)

## Project Overview
**Date Created:** January 30, 2026  
**Project Type:** React Native to Pure React Webapp Conversion  
**Domain:** www.maestrohabitat.com  
**Deployment:** Emergent Platform  

## Original Problem Statement
Build a webapp from GitHub repo [https://github.com/nicklesh/maestrohub-web.git] - Deploy as a webapp with custom domain www.maestrohabitat.com. No Expo, pure webapp only.

## User Choices
- Framework: React.js (not Next.js)
- Deployment: Emergent webapp deployment with custom domain
- Authentication: JWT-based (already customized in repo)
- Features: Keep exactly same as native app
- Backend: Reuse existing APIs and integrations

---

## Architecture

### Tech Stack
- **Frontend:** React 18, React Router 6, Axios, Lucide React, date-fns
- **Backend:** FastAPI (Python), Motor (MongoDB async driver)
- **Database:** MongoDB Atlas (cloud hosted)
- **Email Service:** Resend API
- **File Storage:** Cloudinary
- **Analytics:** Mixpanel, Sentry

### Project Structure
```
/app
├── backend/           # FastAPI backend (from original repo)
│   ├── server.py     # Main FastAPI application
│   ├── config/       # Database, settings
│   ├── models/       # Pydantic schemas
│   ├── services/     # Business logic services
│   └── utils/        # Auth utilities
├── frontend/          # Pure React webapp (converted)
│   ├── src/
│   │   ├── App.js          # Main router
│   │   ├── contexts/       # Auth, Theme, Toast, i18n
│   │   ├── pages/          # All page components
│   │   ├── services/       # API service
│   │   └── i18n/           # Translations
│   └── public/             # Static assets, logos
└── memory/
    └── PRD.md
```

---

## User Personas

### 1. Consumer/Parent
- Search for coaches/tutors
- Book sessions
- Manage kids profiles
- View booking history

### 2. Tutor/Coach
- Dashboard with stats
- Manage availability calendar
- View upcoming sessions
- Edit profile

### 3. Admin
- View all users, coaches
- Platform statistics
- Manage bookings

---

## Core Requirements (Static)

### Authentication
- [x] JWT-based login/register
- [x] Google OAuth integration (Emergent Auth)
- [x] Email verification flow
- [x] Password reset flow
- [x] Device tracking

### Consumer Features
- [x] Home dashboard with navigation cards
- [x] Search coaches with filters
- [x] Tutor detail page with booking
- [x] Bookings management (upcoming/completed/cancelled)
- [x] Kids profile management
- [x] User profile editing
- [x] Theme toggle (light/dark)

### Tutor Features
- [x] Tutor dashboard with stats
- [x] Quick action cards
- [x] Upcoming sessions list

### Admin Features
- [x] Admin dashboard with tabs
- [x] Overview stats
- [x] Coaches list
- [x] Users list

---

## What's Been Implemented

### January 30, 2026 - Initial Conversion
- Converted React Native/Expo app to pure React webapp
- Implemented all auth pages (Login, Register, Forgot Password, Reset Password, Verify Email)
- Implemented consumer pages (Home, Search, Profile, Bookings, Kids, TutorDetail)
- Implemented tutor dashboard
- Implemented admin dashboard
- Created contexts (Auth, Theme, Toast, i18n)
- Connected to existing MongoDB Atlas database
- All original APIs preserved and working
- Theme system (light/dark mode)
- i18n translations (English)

### Test Results
- Backend: 85% (minor CORS note)
- Frontend: 100%
- Integration: 100%

---

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Authentication flows
- [x] Core navigation
- [x] Coach search
- [x] Booking system

### P1 (High Priority)
- [ ] Custom domain deployment (www.maestrohabitat.com)
- [ ] Tutor calendar management page
- [ ] Booking notifications
- [ ] Payment integration (Stripe)

### P2 (Medium Priority)
- [ ] Reviews/ratings system
- [ ] Real-time chat
- [ ] Push notifications
- [ ] Multi-language support

### P3 (Low Priority)
- [ ] Advanced analytics
- [ ] Export/reporting features
- [ ] Social sharing

---

## Next Tasks
1. **Deploy to Custom Domain** - Use Emergent deployment with www.maestrohabitat.com
2. Complete tutor calendar management page
3. Add booking confirmation emails
4. Implement payment flow

---

## Environment Variables

### Frontend (.env)
```
REACT_APP_BACKEND_URL=<backend_url>
REACT_APP_APP_NAME=Maestro Habitat
```

### Backend (.env)
```
MONGO_URL=<mongodb_atlas_url>
DB_NAME=maestrohub
RESEND_API_KEY=<resend_key>
JWT_SECRET=<jwt_secret>
CLOUDINARY_URL=<cloudinary_url>
```

---

## Notes
- Original codebase had Expo/React Native components that were converted to standard React components
- All APIs maintained same structure (/api prefix)
- MongoDB Atlas database retained from original project
- i18n translations copied from original repo
