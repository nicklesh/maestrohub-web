# Maestro Hub - Product Requirements Document (PRD)

## Version: 2.0
## Last Updated: January 9, 2025
## Status: In Development

---

## 1. Product Overview

### 1.1 Product Name
**Maestro Hub**

### 1.2 Tagline
"Find your coach, master your skill"

### 1.3 Product Description
Maestro Hub is a Zocdoc-style marketplace that connects families with tutors across various subjects and skills. The platform enables parents to discover, book, and pay for tutoring sessions with real-time availability and multi-market support.

### 1.4 Target Users
- **Parents/Guardians (Consumers)**: Families seeking tutors for their children
- **Tutors (Providers)**: Instructors offering tutoring services
- **Administrators**: Platform operators managing the marketplace

---

## 2. Feature Requirements

### 2.1 Core Features (MVP) ✅

| Feature | Status | Notes |
|---------|--------|-------|
| User Authentication | ✅ Complete | Email/password, JWT tokens |
| User Registration | ✅ Complete | Consumer, Tutor, Admin roles |
| Tutor Profiles | ✅ Complete | Bio, subjects, pricing, availability |
| Search & Discovery | ✅ Complete | Filter by subject, category, price |
| Booking System | ✅ Complete | Holds, confirmations, cancellations |
| Payment Processing | ✅ Complete | Stripe integration (placeholder keys) |
| Multi-Market Support | ✅ Complete | US (USD) and India (INR) |
| Reports & Analytics | ✅ Complete | Session history, spending/earnings |

### 2.2 New Features (v2.0) 🚧

| Feature | Status | Notes |
|---------|--------|-------|
| Dark/Light Theme | ✅ Complete | Premium Academy palette for dark mode |
| Notifications | ✅ Complete | Payment, session, system notifications |
| Reminders | ✅ Complete | Upcoming sessions, payments |
| Contact Support | ✅ Complete | In-app support form |
| PDF Reports | ✅ Complete | Downloadable session reports |
| Tutor Payouts | ✅ Complete | Immediate payout per session |
| Calendar View | 🚧 Pending | Visual booking calendar |
| Edit Profile | 🚧 Pending | Profile editing screen |
| Payment Methods | 🚧 Pending | Saved payment methods |

### 2.3 Planned Features (Backlog)

| Feature | Priority | Sprint |
|---------|----------|--------|
| Push Notifications | P1 | Sprint 4 |
| Real-time Chat | P2 | Sprint 5 |
| Video Sessions | P2 | Sprint 6 |
| Review System UI | P1 | Sprint 4 |
| Student Management UI | P2 | Sprint 5 |
| Subscription Plans | P3 | Sprint 7 |

---

## 3. Technical Architecture

### 3.1 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native (Expo) |
| Backend | FastAPI (Python) |
| Database | MongoDB |
| Payments | Stripe |
| Hosting | Kubernetes |

### 3.2 Key Endpoints

```
/api/auth/*        - Authentication
/api/users/*       - User management
/api/tutors/*      - Tutor profiles & search
/api/bookings/*    - Booking management
/api/payments/*    - Payment processing
/api/reports/*     - Analytics & reports
/api/notifications/* - User notifications
/api/reminders/*   - User reminders
/api/contact       - Support requests
/api/markets/*     - Market configuration
```

### 3.3 Database Collections

```
users              - User accounts
tutors             - Tutor profiles
students           - Student records
bookings           - Session bookings
booking_holds      - Temporary holds
payment_intents    - Payment records
payouts            - Tutor payouts
refunds            - Refund records
notifications      - User notifications
contact_requests   - Support tickets
markets            - Market configuration
pricing_policies   - Pricing rules
```

---

## 4. User Stories

### 4.1 Consumer Stories

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| C-001 | As a parent, I can register and create an account | Email verification, role selection | ✅ Done |
| C-002 | As a parent, I can search for tutors | Filter by subject, price, location | ✅ Done |
| C-003 | As a parent, I can view tutor profiles | See bio, reviews, availability | ✅ Done |
| C-004 | As a parent, I can book a session | Select time, pay, confirm | ✅ Done |
| C-005 | As a parent, I can view my bookings | Upcoming and past sessions | ✅ Done |
| C-006 | As a parent, I can download reports | PDF with spending history | ✅ Done |
| C-007 | As a parent, I can switch themes | Light and dark mode | ✅ Done |
| C-008 | As a parent, I can contact support | In-app form submission | ✅ Done |
| C-009 | As a parent, I can view calendar | Visual booking calendar | 🚧 Pending |

### 4.2 Tutor Stories

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| T-001 | As a tutor, I can create my profile | Add bio, subjects, pricing | ✅ Done |
| T-002 | As a tutor, I can set availability | Weekly schedule rules | ✅ Done |
| T-003 | As a tutor, I can view my bookings | Upcoming sessions list | ✅ Done |
| T-004 | As a tutor, I can view earnings | Payout history, reports | ✅ Done |
| T-005 | As a tutor, I receive payouts | Immediate per-session | ✅ Done |

### 4.3 Admin Stories

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| A-001 | As admin, I can view dashboard | Key metrics overview | ✅ Done |
| A-002 | As admin, I can manage markets | Enable/disable markets | ✅ Done |
| A-003 | As admin, I can view analytics | Market-level metrics | ✅ Done |

---

## 5. Multi-Market Support

### 5.1 Supported Markets

| Market | Currency | Status |
|--------|----------|--------|
| United States | USD ($) | ✅ Active |
| India | INR (₹) | ✅ Active |

### 5.2 Market Features

- IP-based market suggestion on first visit
- Market selection modal for new users
- Market-filtered search results
- Market-specific pricing display
- Cross-market booking prevention

---

## 6. Design System

### 6.1 Light Theme (Default)

```
Primary: #2563EB (Blue)
Accent: #F59E0B (Amber)
Success: #16A34A (Green)
Background: #F8FAFC (Light Gray)
Surface: #FFFFFF (White)
Text: #0F172A (Dark)
Border: #E2E8F0 (Gray)
```

### 6.2 Dark Theme (Premium Academy)

```
Primary: #D4A72C (Gold)
Background: #0B1F3B (Navy)
Surface: #142E54 (Dark Blue)
Text: #F6F7FB (Light)
Border: #334155 (Slate)
```

### 6.3 Responsive Breakpoints

```
Mobile: < 768px
Tablet: 768px - 1024px
Desktop: > 1024px
```

---

## 7. Success Metrics

| Metric | Target | Current |
|--------|--------|--------|
| User Registration | 100/month | - |
| Booking Conversion | 15% | - |
| Session Completion | 90% | - |
| Tutor Retention | 80% | - |
| NPS Score | > 50 | - |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Payment failures | High | Retry logic, fallback methods |
| Cross-market fraud | Medium | Market validation on booking |
| Tutor no-shows | Medium | Cancellation policies, reviews |
| Data breach | High | Encryption, access controls |

---

## 9. Dependencies

### 9.1 External Services

| Service | Purpose | Status |
|---------|---------|--------|
| Stripe | Payments | ⚠️ Placeholder keys |
| ip-api.com | Geolocation | ✅ Active |
| Resend | Email | ⚠️ Placeholder keys |

### 9.2 Environment Variables

```
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
PLATFORM_FEE_PERCENT=10
```

---

## 10. Release History

| Version | Date | Changes |
|---------|------|--------|
| 1.0.0 | Jan 2025 | MVP release with core features |
| 1.1.0 | Jan 2025 | Multi-market support (US, India) |
| 1.2.0 | Jan 2025 | Rebranding to Maestro Hub |
| 2.0.0 | Jan 2025 | Dark mode, notifications, reports |

---

## 11. Appendix

### 11.1 Test Accounts

| Email | Password | Role |
|-------|----------|------|
| parent1@test.com | password123 | Consumer |
| parent2@test.com | password123 | Consumer |
| tutor1@test.com | password123 | Tutor |
| tutor2@test.com | password123 | Tutor |
| admin@maestrohub.com | password123 | Admin |

### 11.2 Documentation

- Test Cases: `/app/docs/TEST_CASES.md`
- Test Results: `/app/docs/TEST_RESULTS.md`
- API Docs: Auto-generated at `/api/docs`
