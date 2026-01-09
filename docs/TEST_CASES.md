# Maestro Hub - Comprehensive Test Cases Document

## Version: 1.0.0
## Last Updated: January 2025

---

## 1. Unit Tests

### 1.1 Authentication Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| AUTH-001 | Valid email/password login | Returns JWT token and user data | High |
| AUTH-002 | Invalid email login | Returns 401 Unauthorized | High |
| AUTH-003 | Invalid password login | Returns 401 Unauthorized | High |
| AUTH-004 | Empty email/password | Returns 400 Bad Request | Medium |
| AUTH-005 | User registration with valid data | Creates user and returns token | High |
| AUTH-006 | Registration with duplicate email | Returns 409 Conflict | High |
| AUTH-007 | JWT token validation | Valid token passes, expired fails | High |
| AUTH-008 | Password hashing | Passwords stored as bcrypt hashes | High |

### 1.2 User Management

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| USER-001 | Get current user profile | Returns user data | High |
| USER-002 | Update user profile | Successfully updates fields | Medium |
| USER-003 | Role-based access control | Unauthorized users blocked | High |
| USER-004 | Device tracking on login | Device info stored in user record | Low |

### 1.3 Tutor Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| TUTOR-001 | Create tutor profile | Returns tutor with tutor_id | High |
| TUTOR-002 | Search tutors by subject | Returns filtered results | High |
| TUTOR-003 | Search tutors by category | Returns filtered results | High |
| TUTOR-004 | Search tutors by market | Returns only market-specific tutors | High |
| TUTOR-005 | Get tutor availability | Returns availability rules | Medium |
| TUTOR-006 | Update tutor pricing | Price reflects in search | Medium |

### 1.4 Booking Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| BOOK-001 | Create booking hold | Returns hold_id, expires in 10 mins | High |
| BOOK-002 | Confirm booking with payment | Creates booking record | High |
| BOOK-003 | Cancel booking | Updates status, processes refund | High |
| BOOK-004 | Get user bookings | Returns user's bookings only | High |
| BOOK-005 | Cross-market booking blocked | Returns 400 error | High |

### 1.5 Payment Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| PAY-001 | Create payment intent | Returns client_secret | High |
| PAY-002 | Confirm payment | Updates booking status | High |
| PAY-003 | Process refund | Creates refund record | High |
| PAY-004 | Tutor payout on booking | Payout created immediately | High |
| PAY-005 | Platform fee calculation | Correct percentage deducted | High |

### 1.6 Reports Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| RPT-001 | Consumer report data | Returns user's sessions/spending | High |
| RPT-002 | Provider report data | Returns tutor's sessions/earnings | High |
| RPT-003 | PDF generation | Valid PDF file returned | Medium |
| RPT-004 | Date range filtering | Results filtered correctly | Medium |

---

## 2. Integration Tests

### 2.1 End-to-End Flows

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|------------------|
| E2E-001 | Complete Booking Flow | Login → Search → Select Tutor → Book → Pay | Booking confirmed, payout created |
| E2E-002 | Consumer Registration | Register → Select Market → Browse Tutors | User can search tutors |
| E2E-003 | Tutor Onboarding | Register → Complete Profile → Publish | Tutor appears in search |
| E2E-004 | Cancel and Refund | Book → Cancel → Check Refund | Refund processed |

### 2.2 API Integration

| Test ID | Test Case | Expected Result |
|---------|-----------|------------------|
| INT-001 | MongoDB connection | Database operations successful |
| INT-002 | Stripe webhook handling | Events processed correctly |
| INT-003 | IP Geolocation API | Returns country code |

---

## 3. Functional Tests

### 3.1 UI/UX Tests

| Test ID | Screen | Test Case | Expected Result |
|---------|--------|-----------|------------------|
| UI-001 | Login | Form validation | Shows error messages |
| UI-002 | Home | Category navigation | Opens search with filter |
| UI-003 | Search | Filter pills | Results update on select |
| UI-004 | Profile | Theme toggle | UI switches light/dark |
| UI-005 | Bookings | Calendar view | Shows sessions on dates |
| UI-006 | Reports | PDF download | File downloads successfully |

### 3.2 Responsive Design Tests

| Test ID | Viewport | Test Case | Expected Result |
|---------|----------|-----------|------------------|
| RSP-001 | Mobile (390x844) | All screens | Content fits, scrolls properly |
| RSP-002 | Tablet (768x1024) | All screens | 2-column layouts where applicable |
| RSP-003 | Desktop (1920x1080) | All screens | Max-width containers, centered |
| RSP-004 | Mobile Landscape | Forms | Keyboard doesn't obscure inputs |

---

## 4. Security Tests

### 4.1 Authentication Security

| Test ID | Test Case | Expected Result | OWASP Ref |
|---------|-----------|-----------------|----------|
| SEC-001 | SQL Injection in login | Query parameterized, attack fails | A03:2021 |
| SEC-002 | JWT tampering | Invalid signature rejected | A07:2021 |
| SEC-003 | Brute force protection | Rate limiting active | A07:2021 |
| SEC-004 | Password requirements | Minimum 8 chars enforced | A07:2021 |
| SEC-005 | Session expiration | Token expires after 7 days | A07:2021 |

### 4.2 Authorization Security

| Test ID | Test Case | Expected Result | OWASP Ref |
|---------|-----------|-----------------|----------|
| SEC-006 | IDOR - Access other user's data | 403 Forbidden | A01:2021 |
| SEC-007 | Role escalation attempt | Blocked by role checks | A01:2021 |
| SEC-008 | Admin endpoints protected | Requires admin role | A01:2021 |

### 4.3 Data Security

| Test ID | Test Case | Expected Result | OWASP Ref |
|---------|-----------|-----------------|----------|
| SEC-009 | Passwords not in responses | password_hash never returned | A02:2021 |
| SEC-010 | HTTPS enforcement | HTTP redirects to HTTPS | A02:2021 |
| SEC-011 | Input sanitization | XSS payloads escaped | A03:2021 |
| SEC-012 | File upload validation | Only allowed types accepted | A04:2021 |

### 4.4 API Security

| Test ID | Test Case | Expected Result | OWASP Ref |
|---------|-----------|-----------------|----------|
| SEC-013 | CORS configuration | Only allowed origins | A05:2021 |
| SEC-014 | Rate limiting | 429 after threshold | A04:2021 |
| SEC-015 | API versioning | Version in URL/header | A09:2021 |

---

## 5. Compliance Tests

### 5.1 Data Privacy (GDPR/CCPA)

| Test ID | Requirement | Test Case | Status |
|---------|-------------|-----------|--------|
| CPL-001 | Data minimization | Only necessary fields collected | Pass |
| CPL-002 | User consent | Terms acceptance on registration | Pending |
| CPL-003 | Data export | User can download their data | Pending |
| CPL-004 | Right to deletion | Account deletion removes PII | Pending |
| CPL-005 | Cookie consent | Banner displayed for non-essential cookies | Pending |

### 5.2 Payment Compliance (PCI-DSS)

| Test ID | Requirement | Test Case | Status |
|---------|-------------|-----------|--------|
| CPL-006 | Card data handling | No card data stored locally | Pass |
| CPL-007 | Stripe integration | Uses Stripe Elements/Checkout | Pass |
| CPL-008 | Payment logs | No full card numbers in logs | Pass |

### 5.3 Accessibility (WCAG 2.1)

| Test ID | Requirement | Test Case | Status |
|---------|-------------|-----------|--------|
| CPL-009 | Color contrast | 4.5:1 ratio for text | Pending |
| CPL-010 | Screen reader | Labels on all inputs | Pending |
| CPL-011 | Keyboard navigation | All actions via keyboard | Pending |
| CPL-012 | Focus indicators | Visible focus states | Pending |

---

## 6. Vulnerability Assessment

### 6.1 OWASP Top 10 Checklist

| Rank | Vulnerability | Status | Mitigation |
|------|---------------|--------|------------|
| A01 | Broken Access Control | ✅ Mitigated | Role-based checks on all endpoints |
| A02 | Cryptographic Failures | ✅ Mitigated | bcrypt passwords, JWT signing |
| A03 | Injection | ✅ Mitigated | MongoDB parameterized queries |
| A04 | Insecure Design | ⚠️ Review | Need threat modeling |
| A05 | Security Misconfiguration | ⚠️ Review | CORS, headers need audit |
| A06 | Vulnerable Components | ⚠️ Review | npm audit needed |
| A07 | Auth Failures | ✅ Mitigated | JWT, secure sessions |
| A08 | Data Integrity Failures | ⚠️ Review | Need signature verification |
| A09 | Security Logging | ⚠️ Partial | Basic logging, need SIEM |
| A10 | SSRF | ✅ Mitigated | No user-controlled URLs |

### 6.2 Dependency Vulnerabilities

```
Run: npm audit (frontend)
Run: pip-audit (backend)
```

---

## 7. Performance Tests

| Test ID | Test Case | Target | Method |
|---------|-----------|--------|--------|
| PERF-001 | API response time | <200ms p95 | k6 load test |
| PERF-002 | Page load time | <3s mobile | Lighthouse |
| PERF-003 | Concurrent users | 100 users | k6 stress test |
| PERF-004 | Database queries | <50ms | MongoDB profiler |

---

## Test Execution Commands

```bash
# Backend Tests
cd /app/backend
pytest tests/ -v --cov=server

# Frontend Tests (if configured)
cd /app/frontend
npm test

# Security Scan
npm audit
pip-audit

# API Tests
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "parent1@test.com", "password": "password123"}'
```

---

## Appendix: Test Data

### Test Users
| Email | Password | Role |
|-------|----------|------|
| parent1@test.com | password123 | consumer |
| parent2@test.com | password123 | consumer |
| tutor1@test.com | password123 | tutor |
| tutor2@test.com | password123 | tutor |
| admin@maestrohub.com | password123 | admin |
