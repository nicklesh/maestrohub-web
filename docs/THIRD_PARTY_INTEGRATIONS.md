# MaestroHub - Third Party Integrations Guide

## Overview
This document consolidates all third-party integrations used in MaestroHub, including setup instructions, API usage, and troubleshooting.

---

## Table of Contents
1. [Payment Processing - Stripe](#1-payment-processing---stripe)
2. [Email Service - Resend](#2-email-service---resend)
3. [Image Storage - Cloudinary](#3-image-storage---cloudinary)
4. [Analytics - Mixpanel](#4-analytics---mixpanel)
5. [Error Tracking - Sentry](#5-error-tracking---sentry)
6. [APM - New Relic](#6-apm---new-relic)
7. [CDN - Cloudflare](#7-cdn---cloudflare)
8. [Database - MongoDB Atlas](#8-database---mongodb-atlas)
9. [AI/LLM - Emergent Integrations](#9-aillm---emergent-integrations)

---

## 1. PAYMENT PROCESSING - STRIPE

### Purpose
Handle all payment processing, including:
- One-time session bookings
- Package purchases
- Sponsorship subscriptions
- Coach payouts (Stripe Connect)

### Integration Location
- **Backend:** `/app/backend/server.py`
- **Environment:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-intent` | POST | Create payment intent |
| `/api/payments/confirm` | POST | Confirm payment |
| `/api/payments/manual` | POST | Manual payment recording |
| `/api/stripe/webhook` | POST | Webhook receiver |
| `/api/tutor/connect-stripe` | POST | Connect coach's Stripe account |
| `/api/tutor/stripe-dashboard` | GET | Get Stripe dashboard link |

### Code Example
```python
import stripe

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Create payment intent
payment_intent = stripe.PaymentIntent.create(
    amount=5000,  # $50.00 in cents
    currency='usd',
    metadata={'booking_id': booking_id}
)
```

### Webhook Events Handled
- `payment_intent.succeeded` - Mark booking as paid
- `payment_intent.payment_failed` - Notify user of failure
- `account.updated` - Update coach's Stripe status
- `transfer.created` - Record payout to coach

### Testing
```bash
# Test card numbers
4242424242424242 - Success
4000000000000002 - Decline
4000002500003155 - Requires authentication
```

### Troubleshooting
| Issue | Solution |
|-------|----------|
| "No such payment_intent" | Check API key matches environment |
| Webhook not receiving | Verify endpoint URL and signing secret |
| Connect account errors | Ensure OAuth flow completed |

---

## 2. EMAIL SERVICE - RESEND

### Purpose
Send transactional emails:
- Welcome emails
- Booking confirmations
- Payment receipts
- Password reset
- Session reminders

### Integration Location
- **Backend:** `/app/backend/server.py`
- **Environment:** `RESEND_API_KEY`, `FROM_EMAIL`

### Email Templates

| Template | Trigger |
|----------|--------|
| Welcome | User registration |
| Booking Confirmation | New booking created |
| Payment Receipt | Payment successful |
| Session Reminder | 24h and 1h before session |
| Password Reset | Reset request |
| Coach Approval | Profile approved |

### Code Example
```python
import resend

resend.api_key = os.environ.get('RESEND_API_KEY')

resend.Emails.send({
    "from": "MaestroHub <noreply@maestrohub.com>",
    "to": user_email,
    "subject": "Booking Confirmed!",
    "html": email_html_content
})
```

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Emails not sending | Verify API key and domain verification |
| Going to spam | Add SPF, DKIM, DMARC records |
| Rate limited | Implement queue for bulk sends |

---

## 3. IMAGE STORAGE - CLOUDINARY

### Purpose
Store and serve images:
- User profile pictures
- Coach portfolio images
- Document uploads

### Integration Location
- **Backend:** `/app/backend/services/integrations.py`
- **API Endpoints:** `/app/backend/server.py`
- **Environment:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/images/upload` | POST | Upload new image |
| `/api/images/{public_id}` | DELETE | Delete image |
| `/api/images/update` | PUT | Replace existing image |
| `/api/users/profile-picture` | PUT | Update profile picture |
| `/api/users/profile-picture` | DELETE | Remove profile picture |

### Code Example
```python
from services.integrations import cloudinary_service

# Upload image
result = await cloudinary_service.upload_image(
    image_data=base64_image,
    folder="maestrohub/profiles",
    public_id="user_123"
)

# Result: {"url": "...", "public_id": "...", "secure_url": "..."}
```

### Image Transformations
```
# Resize to 200x200 with face detection
https://res.cloudinary.com/your-cloud/image/upload/c_fill,g_face,h_200,w_200/profile.jpg

# Thumbnail 100x100
https://res.cloudinary.com/your-cloud/image/upload/c_thumb,h_100,w_100/profile.jpg
```

### Fallback Behavior
If Cloudinary is not configured, images are stored as base64 in MongoDB (not recommended for production).

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Upload fails | Check API credentials |
| Image not displaying | Verify URL and CORS settings |
| Slow loading | Use CDN transformation URLs |

---

## 4. ANALYTICS - MIXPANEL

### Purpose
Track user behavior and product analytics:
- User signups and logins
- Feature usage
- Conversion funnels
- Retention metrics

### Integration Location
- **Backend:** `/app/backend/services/integrations.py`
- **Environment:** `MIXPANEL_TOKEN`

### Events Tracked

| Event | Properties | Trigger |
|-------|------------|--------|
| `user_signup` | role, market | Registration |
| `user_login` | role | Login |
| `booking_created` | category, price | New booking |
| `payment_completed` | amount, method | Payment success |
| `profile_updated` | fields_changed | Profile save |
| `search_performed` | query, filters | Search |
| `coach_viewed` | coach_id, category | Profile view |
| `image_upload` | folder | Image upload |

### Code Example
```python
from services.integrations import track_event, mixpanel_service

# Track event
await track_event(
    event_name="booking_created",
    user_id=user_id,
    properties={
        "category": "academics",
        "price": 50.00,
        "coach_id": coach_id
    }
)

# Set user profile
await mixpanel_service.set_user_profile(
    distinct_id=user_id,
    properties={
        "$name": user_name,
        "$email": user_email,
        "role": "consumer"
    }
)
```

### Key Funnels to Monitor
1. **Signup Funnel:** Landing → Register → Verify → First Action
2. **Booking Funnel:** Search → View Coach → Select Time → Pay → Confirm
3. **Coach Onboarding:** Register → Profile → Availability → First Booking

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Events not appearing | Check token and wait 5-10 minutes |
| User not identified | Ensure distinct_id is consistent |
| Missing properties | Verify property names match |

---

## 5. ERROR TRACKING - SENTRY

### Purpose
Capture and track application errors:
- Runtime exceptions
- API failures
- Performance issues
- User impact assessment

### Integration Location
- **Backend:** `/app/backend/services/integrations.py`
- **Auto-initialized:** On application startup
- **Environment:** `SENTRY_DSN`

### Features Enabled
- Exception capture
- Performance monitoring (10% sample)
- Release tracking
- User context

### Code Example
```python
from services.integrations import sentry_service, capture_error

# Capture exception with context
try:
    process_payment()
except Exception as e:
    capture_error(e, {
        "user_id": user_id,
        "action": "payment_processing",
        "amount": amount
    })
    raise

# Set user context
sentry_service.set_user(
    user_id=user_id,
    email=user_email,
    role="consumer"
)

# Capture message
sentry_service.capture_message(
    "High payment failure rate detected",
    level="warning",
    extra={"failure_rate": 0.15}
)
```

### Alert Configuration
| Alert | Condition | Action |
|-------|-----------|--------|
| Error Spike | >10 errors/minute | Email + Slack |
| New Error | First occurrence | Email |
| High Priority | Payment/Auth errors | Immediate notification |

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Errors not appearing | Verify DSN and SDK initialization |
| Too many errors | Add filtering for known issues |
| Missing context | Add breadcrumbs before capture |

---

## 6. APM - NEW RELIC

### Purpose
Application Performance Monitoring:
- Response time tracking
- Database query analysis
- External service calls
- Custom metrics

### Integration Location
- **Backend:** `/app/backend/services/integrations.py`
- **Environment:** `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`

### Metrics Collected
- API endpoint response times
- Database query duration
- External HTTP call latency
- Memory and CPU usage
- Custom business metrics

### Code Example
```python
from services.integrations import newrelic_service

# Record custom event
newrelic_service.record_custom_event(
    "BookingCreated",
    {
        "user_id": user_id,
        "category": "academics",
        "price": 50.00
    }
)

# Record custom metric
newrelic_service.record_custom_metric(
    "Custom/Booking/AverageValue",
    50.00
)

# Report error
newrelic_service.notice_error(
    error=exception,
    params={"context": "payment_processing"}
)
```

### Key Dashboards
1. **API Performance:** Response times by endpoint
2. **Database:** Query performance and slow queries
3. **External Services:** Stripe, Cloudinary, Resend latency
4. **Business Metrics:** Bookings, payments, signups

### Troubleshooting
| Issue | Solution |
|-------|----------|
| No data appearing | Verify license key and agent initialization |
| Missing transactions | Check agent is loaded before app |
| High overhead | Reduce sampling rate |

---

## 7. CDN - CLOUDFLARE

### Purpose
Content Delivery Network:
- Static asset caching
- DDoS protection
- SSL/TLS termination
- Performance optimization

### Configuration (DNS Level)
Cloudflare is configured at the DNS/hosting level, not in application code.

### Recommended Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| SSL/TLS | Full (strict) | End-to-end encryption |
| Always HTTPS | On | Force secure connections |
| Auto Minify | JS, CSS, HTML | Reduce file sizes |
| Brotli | On | Better compression |
| Browser Cache TTL | 4 hours | Client-side caching |
| Edge Cache TTL | 1 day | CDN caching |

### Page Rules
```
# Cache static assets
*.maestrohub.com/static/*
Cache Level: Cache Everything
Edge Cache TTL: 1 month

# Bypass cache for API
*.maestrohub.com/api/*
Cache Level: Bypass
```

### Security Settings
- Web Application Firewall (WAF): On
- Bot Fight Mode: On
- Rate Limiting: Configure for API endpoints
- IP Access Rules: Allow/Block as needed

---

## 8. DATABASE - MONGODB ATLAS

### Purpose
Primary data storage for all application data.

### Integration Location
- **Backend:** `/app/backend/server.py`
- **Environment:** `MONGO_URL`, `DB_NAME`

### Collections

| Collection | Purpose |
|------------|--------|
| `users` | User accounts |
| `credentials` | Auth credentials (separate for security) |
| `tutors` | Coach profiles |
| `bookings` | Session bookings |
| `reviews` | Reviews and ratings |
| `payments` | Payment records |
| `packages` | Session packages |
| `sponsorships` | Coach sponsorships |
| `messages` | Chat messages |
| `notifications` | User notifications |
| `contacts` | Contact form submissions |
| `invites` | Referral invites |
| `markets` | Market configurations |
| `pricing_policies` | Pricing rules |

### Indexes (Recommended)
```javascript
// Users
db.users.createIndex({"email": 1}, {unique: true})
db.users.createIndex({"user_id": 1}, {unique: true})

// Tutors
db.tutors.createIndex({"user_id": 1}, {unique: true})
db.tutors.createIndex({"status": 1, "is_published": 1})
db.tutors.createIndex({"categories": 1})
db.tutors.createIndex({"market_id": 1})

// Bookings
db.bookings.createIndex({"consumer_id": 1, "created_at": -1})
db.bookings.createIndex({"tutor_id": 1, "created_at": -1})
db.bookings.createIndex({"status": 1})

// Credentials
db.credentials.createIndex({"user_id": 1}, {unique: true})
db.credentials.createIndex({"email": 1}, {unique: true})
```

### Backup Configuration
- Daily automated backups
- Point-in-time recovery enabled
- Cross-region replication (production)

---

## 9. AI/LLM - EMERGENT INTEGRATIONS

### Purpose
AI-powered features:
- Translation sync
- Content generation
- Smart recommendations

### Integration Location
- **Backend:** `/app/backend/sync_translations.py`
- **Environment:** `EMERGENT_LLM_KEY`

### Usage
```python
from emergentintegrations.llm import chat

response = await chat(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}],
    api_key=os.environ.get('EMERGENT_LLM_KEY')
)
```

---

## 10. INTEGRATION STATUS DASHBOARD

### Health Check Endpoint
`GET /api/health/integrations`

```json
{
  "database": {"status": "connected", "latency_ms": 5},
  "stripe": {"status": "configured", "mode": "test"},
  "resend": {"status": "configured"},
  "cloudinary": {"status": "configured"},
  "mixpanel": {"status": "configured"},
  "sentry": {"status": "initialized"},
  "newrelic": {"status": "initialized"}
}
```

---

## 11. TROUBLESHOOTING GUIDE

### Common Issues

| Service | Issue | Check |
|---------|-------|-------|
| All | Not working | Verify environment variables loaded |
| Stripe | Test vs Live confusion | Check key prefix (sk_test_ vs sk_live_) |
| Email | Not delivered | Check domain verification, spam folder |
| Cloudinary | Slow uploads | Check file size, use async upload |
| Mixpanel | Delayed events | Normal - wait 5-10 minutes |
| Sentry | Missing errors | Check SDK initialization order |
| New Relic | No data | Verify agent loaded before app start |

### Debug Logging
```python
import logging
logging.getLogger('services.integrations').setLevel(logging.DEBUG)
```

---

## Document History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-21 | AI Agent | Initial document |
