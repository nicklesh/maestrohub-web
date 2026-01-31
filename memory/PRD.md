# Maestro Habitat - PRD (Product Requirements Document)

## Project Overview
**Date Created:** January 30, 2026  
**Last Updated:** January 31, 2026  
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
│   │   ├── App.js          # Main router (40+ routes)
│   │   ├── components/     # AppHeader, BottomNav
│   │   ├── contexts/       # Auth, Theme, Toast, i18n
│   │   ├── pages/          # 20+ page components
│   │   ├── services/       # API service
│   │   ├── theme/          # Color theme (colors.js)
│   │   └── i18n/           # 2760+ translation keys
│   └── public/             # Static assets, logos
├── mobile_screenshots/    # Reference screenshots from mobile app
│   └── UI_REFERENCE.md    # Comprehensive UI documentation
└── memory/
    └── PRD.md
```

---

## Components

### Bottom Navigation (Mobile)
Role-specific navigation matching mobile app design:
- **Consumer/Parent**: Home, Search, Bookings, My Kids, Account
- **Tutor**: Dashboard, Calendar, Bookings, Account  
- **Admin**: Dashboard, Users, Account

Visible on all screen sizes (desktop included per user request)

---

## User Personas

### 1. Consumer/Parent
- Search for coaches/tutors
- Book sessions
- Manage kids profiles
- View booking history
- Manage billing & payments
- Track referrals
- Leave reviews

### 2. Tutor/Coach
- Dashboard with stats
- Manage availability calendar
- View upcoming sessions
- Edit profile
- Track earnings
- Manage reviews

### 3. Admin
- View all users, coaches
- Platform statistics
- Manage bookings
- Monitor system health

---

## Pages by Role

### Auth Pages (Public)
| Page | Route | Status |
|------|-------|--------|
| Login | `/login` | ✅ Complete |
| Register | `/register` | ✅ Complete |
| Forgot Password | `/forgot-password` | ✅ Complete |
| Reset Password | `/reset-password` | ✅ Complete |
| Verify Email | `/verify-email` | ✅ Complete |

### Consumer/Parent Pages
| Page | Route | Status |
|------|-------|--------|
| Home Dashboard | `/home` | ✅ Complete |
| Search Coaches | `/search` | ✅ Complete |
| Profile | `/profile` | ✅ Complete |
| Bookings | `/bookings` | ✅ Complete |
| Kids Management | `/kids` | ✅ Complete |
| Tutor Detail | `/tutor/:tutorId` | ✅ Complete |
| Billing | `/billing` | ✅ Complete |
| Referrals | `/referrals` | ✅ Complete |
| Reviews | `/reviews` | ✅ Complete |
| FAQ | `/faq` | ✅ Complete |
| Contact | `/contact` | ✅ Complete |
| Notifications Settings | `/notifications-settings` | ✅ Complete |

### Tutor Pages
| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/tutor/dashboard` | ✅ Complete |
| Calendar | `/tutor/calendar` | ✅ Complete |
| Billing | `/tutor/billing` | ✅ Complete |
| Reviews | `/tutor/reviews` | ✅ Complete |

### Admin Pages
| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/admin` | ✅ Complete |

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
- [x] Billing & payment methods
- [x] Referral system
- [x] Reviews management
- [x] FAQ & Help center
- [x] Contact support
- [x] Notification settings

### Tutor Features
- [x] Tutor dashboard with stats
- [x] Quick action cards
- [x] Upcoming sessions list
- [x] Calendar management
- [x] Billing access
- [x] Reviews access

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
- Implemented consumer pages (Home, Search, Profile, Bookings, Kids, TutorDetail, Billing, Referrals, Reviews, FAQ, Contact, NotificationsSettings)
- Implemented tutor pages (Dashboard, Calendar)
- Implemented admin dashboard
- Created contexts (Auth, Theme, Toast, i18n)
- Connected to existing MongoDB Atlas database
- All original APIs preserved and working
- Theme system (light/dark mode)
- i18n translations (2760+ keys in English)

### Test Results - Iteration 2
- Backend: 90%
- Frontend: 100%
- Integration: 100%
- Translations: 100%
- Authentication: 100%
- Navigation: 100%

### January 30, 2026 - Bug Fixes Session (Iteration 4)
**Issues Fixed:**
1. ProfilePage Alarm icon error - Changed `Alarm` to `AlarmClock` (lucide-react fix)
2. SearchPage coach links - Changed from `user_id` to `tutor_id` for correct routing
3. TutorDetailPage slots endpoint - Changed `/slots` to `/availability` (correct API endpoint)
4. Translation keys verified and complete
5. BottomNav "My Kids" link - Already present and working

**Test Results - Iteration 4:**
- Frontend: 100%
- All 8 test cases passed
- Additional translation fix applied to My Kids page by testing agent

---

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Authentication flows
- [x] Core navigation
- [x] Coach search
- [x] Booking system
- [x] All 3 role pages created
- [x] Translations working

### P1 (High Priority)
- [ ] Custom domain deployment (www.maestrohabitat.com)
- [ ] Payment integration (Stripe)
- [ ] Booking notifications
- [ ] Real-time updates

### P2 (Medium Priority)
- [ ] Reviews/ratings system (backend integration)
- [ ] Real-time chat
- [ ] Push notifications
- [ ] Multi-language support (Spanish, Hindi, etc.)

### P3 (Low Priority)
- [ ] Advanced analytics
- [ ] Export/reporting features
- [ ] Social sharing

---

## Next Tasks
1. **Deploy to Custom Domain** - Use Emergent deployment with www.maestrohabitat.com
2. Integrate Stripe for payments
3. Add booking confirmation emails
4. Implement real-time session updates

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
- i18n translations copied from original repo (2760+ keys)
- 18 page components created with CSS
- All 3 user roles (consumer, tutor, admin) fully supported
