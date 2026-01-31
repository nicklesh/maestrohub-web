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

### January 31, 2026 - Mobile App Parity Session (Iteration 5)
**Major UI Overhaul to Match Mobile App:**

1. **New AppHeader Component** - Created comprehensive header matching mobile app:
   - Left: Avatar circle (with user initial) + Name + Role
   - Center: MH Logo (inline SVG)
   - Right: Bell (notifications), Mail (contact), Logout icons

2. **Updated BottomNav** - Now matches mobile app exactly:
   - Consumer: Home, Search, Bookings, My Kids, Account
   - Tutor: Dashboard, Calendar, Bookings, Account
   - Icons use Lucide React (Home, Search, Calendar, Users, User)

3. **Rewrote HomePage** - 4 navigation cards layout:
   - Search a Coach (Search icon)
   - Your Bookings (Calendar icon)
   - My Kids Sessions (Users icon)
   - View Your Account (User icon)
   - Pro Tip section at bottom

4. **Rewrote SearchPage** - Category browse with filters:
   - Search box with placeholder
   - Browse Categories grid (10 categories)
   - Category cards with icon + name + subject count
   - Filter controls: category dropdown, subject dropdown, country toggle
   - Coach cards with: flag, avatar, name, price, rating, bio, category, subjects, modality

5. **Enhanced TutorDetailPage** - All sections matching mobile:
   - Profile card: avatar, name, flag badge, rating, modality badge, price
   - Cross-market info box (if coach from different country)
   - About section
   - Subjects pills
   - Policies section (cancellation, no-show)
   - Available slots with selection
   - Book Session button

6. **Updated BookingsPage** - Pill-style tabs:
   - Upcoming, Past, Rescheduled, Cancelled
   - Empty state with icon and message

7. **Updated KidsPage** - Add Child bottom sheet:
   - Name (required), Age, Grade fields
   - Notification Contact section (Email, Phone)
   - Checkbox options (reminders, schedules)

8. **Updated ProfilePage** - Uses new AppHeader

**Test Results - Iteration 5:**
- Frontend: 100%
- All 13 test cases passed
- 1 translation fix applied (pages.search.no_results)

### January 31, 2026 - Account Navigation & Bug Fixes (Iteration 6)
**Issues Fixed:**
1. **Missing Account Page Routes** - Created 10 new pages for Account navigation:
   - EditProfilePage (`/edit-profile`)
   - LanguagePage (`/language`)
   - NotificationsPage (`/notifications`)
   - SubscriptionPage (`/subscription`)
   - RemindersPage (`/reminders`)
   - ReportsPage (`/reports`)
   - TaxReportsPage (`/tax-reports`)
   - InviteParentPage (`/invite-parent`)
   - InviteProviderPage (`/invite-provider`)
   - BecomeTutorPage (`/become-tutor`)

2. **ForgotPasswordPage.css Missing** - Created CSS file that was causing webpack compilation error

3. **TutorDetailPage Key Warning** - Fixed React key warning in slots list by adding index fallback

4. **Translation Keys Added:**
   - `forms.hints.email_cannot_change`
   - `pages.profile.profile_info`
   - `subscription.*` keys (via testing agent)
   - `reports.*` keys (via testing agent)
   - `pages.settings.current_language` (via testing agent)

**Test Results - Iteration 6:**
- Frontend: 100%
- All 9 test cases passed
- Login page confirmed NO Google Sign-In
- Forgot Password page shows proper lock icon design
- All Account page navigation links working
- Coach Detail page loads without crashing
- Search page shows country flags on coach cards

### January 31, 2026 - User Feedback Fixes (Iteration 7)
**13 Issues Reported by User - Fixed:**

1. **Registration page Google sign-in** - Removed Google sign-in button and divider from RegisterPage.js

2. **Add child error** - Fixed KidsPage.js to use `/students` API endpoint instead of `/kids`

3. **Search page 2-column layout** - Updated SearchPage.css with 2-column grid for coach cards

4. **Academics first in categories** - Updated SearchPage.js to sort categories with 'academics' first

5. **Header/footer width** - Fixed AppHeader.css with max-width: 600px on large screens, matching footer

6. **Fixed header positioning** - Changed AppHeader to `position: fixed` and added padding-top to all pages

7. **Country flags in search** - Fixed coach cards to show flag next to name instead of overlapping price

8. **Slot styling** - Updated TutorDetailPage to use light blue (primaryLight) for unselected slots

9. **Booking error handling** - Fixed error handling to properly stringify API validation errors

10. **Edit Profile save** - Fixed endpoint from `/user/profile` to `/profile`

11. **Subscription page** - Rewrote with upgrade functionality, feature list, and premium management

12. **Reminders page** - Added working Add button with modal for creating reminders

13. **Translation keys** - Added missing keys for Kids, Subscription, and Reminders pages

**Bugs Fixed by Testing Agent:**
- TutorDetailPage.js slot comparison was using undefined `slot_id` - fixed to use `start_at` field
- Added missing translation keys: pages.kids.years_old, subscription.*, reminders.*, empty_states.no_reminders_title

**Test Results - Iteration 7:**
- Frontend: 100%
- All 10 test cases passed

---

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Authentication flows
- [x] Core navigation
- [x] Coach search
- [x] Booking system
- [x] All 3 role pages created
- [x] Translations working
- [x] Account page navigation fixed
- [x] UI/UX mobile parity

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
