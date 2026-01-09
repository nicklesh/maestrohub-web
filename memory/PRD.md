# Maestro Hub - City-First Tutor Marketplace

## Overview
A Zocdoc-like marketplace where families can discover tutors (academic, music, activities), view real availability, book instantly, complete enrollment/intake, and pay.

## Branding
- **App Name**: Maestro Hub
- **Consumer Tagline**: "The easiest way to book a tutor."
- **Provider Tagline**: "Scheduling, enrollment, and payments for tutors."

## Color Theme
| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Trust Blue) | #2563EB | Buttons, links, primary actions |
| Primary Dark | #1E3A8A | Headers, emphasis |
| Accent (Amber) | #F59E0B | CTAs, highlights, badges |
| Success | #16A34A | Confirmations, completed states |
| Background | #F8FAFC | App background |
| Surface | #FFFFFF | Cards, modals |
| Text | #0F172A | Primary text |
| Muted Text | #64748B | Secondary text, placeholders |
| Border | #E2E8F0 | Dividers, input borders |

## User Personas
1. **Parent (Consumer)**: Creates account, adds students, books tutors, pays
2. **Tutor (Provider)**: Creates profile, sets availability, receives bookings + payouts
3. **Admin**: Approves/suspends tutors, manages refunds, configures pricing

## MVP Features (4 Weeks)

### Week 1: Foundation + Tutor Listings
- [x] Auth (Google OAuth + JWT email/password)
- [x] Role-based access (Consumer, Tutor, Admin)
- [x] Device ID tracking
- [x] Tutor profile creation
- [x] Availability templates
- [x] Search/discovery

### Week 2: Booking Engine + Payments
- [x] Slot locking mechanism
- [x] Booking state machine (HOLD → BOOKED → COMPLETED/CANCELED)
- [x] Stripe payments (placeholder)
- [x] Basic reschedule/cancel

### Week 3: Intake + Notifications + Reviews
- [x] Student profile management
- [x] Intake forms per booking
- [x] Email notifications (Resend placeholder)
- [x] Verified reviews after completion

### Week 4: Admin + Provider Fees
- [x] Admin console (approve/suspend tutors)
- [x] Refund tool
- [x] Trial tracking
- [x] NSF event logging

## Technical Stack
- **Frontend**: Expo React Native
- **Backend**: FastAPI
- **Database**: MongoDB
- **Payments**: Stripe Connect (placeholder)
- **Email**: Resend (placeholder)
- **Push**: Expo Push Notifications

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- POST /api/auth/google/callback

### Consumers
- GET /api/students
- POST /api/students
- PUT /api/students/{id}
- DELETE /api/students/{id}

### Tutors
- GET /api/tutors/search
- GET /api/tutors/{id}
- POST /api/tutors/profile
- PUT /api/tutors/profile
- GET /api/tutors/{id}/availability

### Availability
- GET /api/availability/rules
- POST /api/availability/rules
- PUT /api/availability/rules/{id}
- POST /api/availability/exceptions

### Bookings
- POST /api/booking-holds
- POST /api/bookings
- GET /api/bookings
- POST /api/bookings/{id}/cancel
- POST /api/bookings/{id}/reschedule
- POST /api/bookings/{id}/complete

### Reviews
- POST /api/bookings/{id}/review
- GET /api/tutors/{id}/reviews

### Admin
- GET /api/admin/tutors
- POST /api/admin/tutors/{id}/approve
- POST /api/admin/tutors/{id}/suspend
- POST /api/admin/bookings/{id}/refund

### Billing
- GET /api/billing/summary
- GET /api/billing/fee-events

## Data Models

### Users
```json
{
  "user_id": "string",
  "email": "string",
  "name": "string",
  "picture": "string?",
  "role": "consumer | tutor | admin",
  "password_hash": "string?",
  "devices": [{ "device_id": "string", "device_name": "string", "platform": "string" }],
  "created_at": "datetime"
}
```

### Tutors
```json
{
  "tutor_id": "string",
  "user_id": "string",
  "bio": "string",
  "categories": ["academic", "music", "activities"],
  "subjects": ["math", "piano"],
  "levels": ["elementary", "high_school"],
  "modality": ["online", "in_person"],
  "service_area_radius": "number",
  "base_price": "number",
  "duration_minutes": "number",
  "policies": { "cancel_window_hours": 24, "no_show_policy": "string" },
  "status": "pending | approved | suspended",
  "is_published": "boolean",
  "trial_start_at": "datetime?",
  "created_at": "datetime"
}
```

### Bookings
```json
{
  "booking_id": "string",
  "tutor_id": "string",
  "consumer_id": "string",
  "student_id": "string",
  "service_id": "string",
  "start_at": "datetime",
  "end_at": "datetime",
  "status": "hold | booked | confirmed | completed | canceled_by_consumer | canceled_by_provider",
  "price_snapshot": "number",
  "policy_snapshot": "object",
  "payment_id": "string?",
  "intake_response": "object?",
  "created_at": "datetime"
}
```

## Monetization
- Consumer fees: $0 (Phase 1)
- Provider fees: Pay-per-new-student (NSF) after 90-day trial
- Pro subscription: $49/mo (optional)
