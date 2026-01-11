# Maestro Hub - Pending Tasks for Production Deployment

**Document Created:** June 2025  
**Last Updated:** June 2025  
**Status:** PRE-PRODUCTION CHECKLIST

---

## Executive Summary

The Maestro Hub application is **feature-complete for MVP** but has several critical items that must be addressed before production deployment. This document outlines all pending tasks organized by priority.

### Overall Readiness Score: 65%

| Category | Status | Blocking Production? |
|----------|--------|---------------------|
| Core Features | ✅ Complete | No |
| Security | ⚠️ Critical Issues | **YES** |
| Payment Integration | ❌ MOCKED | **YES** |
| Email Integration | ❌ MOCKED | **YES** |
| Web Auth State | ⚠️ Known Bug | Partial |

---

## 🚨 P0 - CRITICAL (Must Fix Before Launch)

### 1. Security Vulnerabilities (From Security Test Report)

**Reference:** `/app/SECURITY_TEST_RESULTS.md`

#### 1.1 JWT Token Validation Bypass
- **Severity:** CRITICAL (CVSS 9.8)
- **Issue:** System accepts ANY invalid JWT tokens
- **Impact:** Complete authentication bypass, account impersonation
- **File:** `backend/server.py`
- **Fix Required:**
```python
# Implement proper JWT validation with PyJWT
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

async def verify_token(token: str):
    try:
        payload = jwt.decode(
            token, 
            JWT_SECRET, 
            algorithms=["HS256"],
            options={"verify_exp": True}
        )
        return payload
    except (InvalidTokenError, ExpiredSignatureError) as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

#### 1.2 Weak Password Policy
- **Severity:** CRITICAL (CVSS 8.1)
- **Issue:** No password complexity requirements, accepts empty/simple passwords
- **Impact:** Brute force attacks, credential stuffing
- **Fix Required:**
```python
def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "Password must contain uppercase letter")
    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "Password must contain lowercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(400, "Password must contain a number")
```

#### 1.3 Missing Rate Limiting
- **Severity:** HIGH
- **Issue:** Unlimited login attempts allowed
- **Impact:** Brute force attacks, DoS
- **Fix Required:** Install `slowapi` and add rate limiting to auth endpoints

#### 1.4 Missing Security Headers
- **Severity:** HIGH
- **Issue:** Missing X-Frame-Options, CSP, HSTS, X-XSS-Protection
- **Fix Required:** Add SecurityHeadersMiddleware to FastAPI app

#### 1.5 NoSQL Injection in Search
- **Severity:** HIGH
- **Issue:** Search endpoints vulnerable to injection attacks
- **Fix Required:** Sanitize all user inputs before MongoDB queries

---

### 2. Payment Integration (Currently MOCKED)

**Status:** ❌ Not Production Ready  
**Current Implementation:** All payments are simulated, no real money processed

#### Required Actions:
1. **Obtain Stripe API Keys**
   - Create Stripe account at https://stripe.com
   - Get publishable key and secret key
   - Set up webhook endpoint for payment events

2. **Environment Variables to Add:**
   ```env
   STRIPE_SECRET_KEY=sk_live_xxxxx
   STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

3. **Backend Updates Required:**
   - Replace mocked payment processing in `server.py`
   - Implement real Stripe checkout flow
   - Set up Connect for tutor payouts (90/10 split)
   - Handle webhook events (payment success/failure)

4. **Frontend Updates Required:**
   - Add Stripe Elements for card input
   - Implement secure payment confirmation UI

---

### 3. Email Integration (Currently MOCKED)

**Status:** ❌ Not Production Ready  
**Current Implementation:** `email_service.py` logs to console, no emails sent

#### Required Actions:
1. **Obtain Email Service API Key (Resend recommended)**
   - Create account at https://resend.com
   - Verify domain for sending
   - Get API key

2. **Environment Variables to Add:**
   ```env
   RESEND_API_KEY=re_xxxxx
   FROM_EMAIL=noreply@yourdomain.com
   ```

3. **Backend Updates Required:**
   - Update `email_service.py` to use Resend SDK
   - Test all email templates:
     - Booking confirmation
     - Booking cancellation
     - Payment receipt
     - Session reminders

---

## ⚠️ P1 - HIGH PRIORITY (Should Fix Before Launch)

### 4. Web Authentication State Bug

**Status:** Known recurring issue  
**Impact:** Users may see blank pages or 401 errors after login on web

#### Symptoms:
- Data doesn't load after login on web preview
- Requires page refresh to see content
- `window.location.reload()` workaround currently in place

#### Root Cause Investigation Needed:
- **File:** `frontend/src/context/AuthContext.tsx`
- Issue with token storage/retrieval on web platform
- React Navigation state not syncing with auth context

#### Fix Approach:
1. Review token persistence mechanism in AuthContext
2. Ensure proper async token loading before rendering protected routes
3. Remove `window.reload()` workaround after proper fix
4. Test on both web and mobile (Expo Go)

---

### 5. Force Market Selection on Onboarding

**Status:** Not implemented  
**Impact:** Non-USD users may encounter broken booking flows

#### Issue:
- New users can access app without selecting market
- Leads to currency mismatches and booking failures

#### Required Implementation:
1. Add market selection step to registration flow
2. Block access to booking features until market is set
3. Use geo-detection API to suggest default market

---

## 📋 P2 - MEDIUM PRIORITY (Post-Launch Enhancements)

### 6. Video Session Integration

**Current State:** Coaches can add personal meeting links manually  
**Enhancement:** Auto-generate unique session links

#### Options:
- Zoom API integration
- Google Meet API integration
- Daily.co or similar service

---

### 7. Push Notifications

**Current State:** In-app notifications only  
**Enhancement:** Mobile push notifications for:
- Upcoming session reminders
- New booking requests
- Payment confirmations

---

### 8. Analytics Dashboard Enhancement

**Current State:** Basic reports available  
**Enhancement:**
- Advanced charting
- Export to CSV/PDF
- Scheduled email reports

---

## 🔧 Technical Debt

### 9. Code Quality Items

- [ ] Add comprehensive unit tests for backend
- [ ] Add E2E tests for critical user flows
- [ ] Implement proper error boundaries in frontend
- [ ] Add structured logging (replace print statements)
- [ ] Set up monitoring (Sentry, DataDog, etc.)

### 10. Performance Optimization

- [ ] Add database indexes for common queries
- [ ] Implement caching for category/market data
- [ ] Optimize image loading in tutor profiles
- [ ] Add pagination to all list endpoints

---

## 📝 Pre-Deployment Checklist

### Environment Setup
- [ ] Set all production environment variables
- [ ] Verify MongoDB connection string for production
- [ ] Configure CORS for production domain
- [ ] Set up SSL certificates

### Third-Party Services
- [ ] Stripe account verified and keys obtained
- [ ] Email service configured and domain verified
- [ ] (Optional) Video service API keys

### Security
- [ ] Fix all CRITICAL security issues
- [ ] Fix all HIGH priority security issues
- [ ] Enable HTTPS only
- [ ] Review and restrict CORS origins
- [ ] Set secure cookie flags

### Testing
- [ ] Full regression test of all features
- [ ] Load testing for expected traffic
- [ ] Security penetration test
- [ ] Mobile testing on iOS and Android

### Monitoring
- [ ] Error tracking service configured
- [ ] Uptime monitoring configured
- [ ] Database monitoring configured
- [ ] Log aggregation configured

---

## Test Credentials (Development Only)

⚠️ **Remove or change all test accounts before production!**

| Role | Email | Password |
|------|-------|----------|
| Consumer (USD) | parent2@test.com | password123 |
| Consumer (INR) | parent_india@test.com | password123 |
| Coach | tutor3@test.com | password123 |
| Admin | admin@maestrohub.com | password123 |

---

## Estimated Effort

| Task | Estimated Hours | Skills Required |
|------|-----------------|-----------------|
| Security fixes (P0) | 8-12 hours | Backend Python |
| Stripe integration | 16-24 hours | Full-stack |
| Email integration | 4-8 hours | Backend Python |
| Web auth fix | 4-8 hours | Frontend React |
| Market selection flow | 4-6 hours | Full-stack |

**Total Estimated Effort:** 36-58 hours for production readiness

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| June 2025 | AI Agent | Initial document creation |

---

*This document should be reviewed and updated as tasks are completed.*
