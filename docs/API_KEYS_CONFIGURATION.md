# MaestroHub - API Keys & Environment Configuration

## Overview
This document lists all API keys and environment variables required for sandbox (development/staging) and production environments.

---

## 1. ENVIRONMENT VARIABLES SUMMARY

| Variable | Required | Sandbox | Production | Description |
|----------|----------|---------|------------|-------------|
| `MONGO_URL` | ✅ Yes | Local/Atlas | Atlas | MongoDB connection string |
| `DB_NAME` | ✅ Yes | maestrohub_dev | maestrohub | Database name |
| `JWT_SECRET` | ✅ Yes | Any 64+ chars | Secure 256-bit | JWT signing secret |
| `PASSWORD_PEPPER` | ✅ Yes | Any 32+ chars | Secure 64-char hex | Password hashing pepper |
| `STRIPE_SECRET_KEY` | ✅ Yes | sk_test_xxx | sk_live_xxx | Stripe API secret |
| `STRIPE_PUBLISHABLE_KEY` | ✅ Yes | pk_test_xxx | pk_live_xxx | Stripe public key |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | whsec_xxx | whsec_xxx | Stripe webhook signing |
| `RESEND_API_KEY` | ✅ Yes | re_xxx | re_xxx | Email service API key |
| `CLOUDINARY_CLOUD_NAME` | 🔶 Optional | xxx | xxx | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | 🔶 Optional | xxx | xxx | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | 🔶 Optional | xxx | xxx | Cloudinary API secret |
| `MIXPANEL_TOKEN` | 🔶 Optional | xxx | xxx | Mixpanel project token |
| `SENTRY_DSN` | 🔶 Optional | xxx | xxx | Sentry DSN URL |
| `NEW_RELIC_LICENSE_KEY` | 🔶 Optional | xxx | xxx | New Relic license key |
| `PLATFORM_FEE_PERCENT` | ✅ Yes | 10 | 10 | Platform fee percentage |

---

## 2. SANDBOX ENVIRONMENT (.env.sandbox)

```bash
# ============================================
# MAESTROHUB SANDBOX ENVIRONMENT CONFIGURATION
# ============================================

# Database - Use local MongoDB or Atlas free tier
MONGO_URL="mongodb://localhost:27017"
DB_NAME="maestrohub_sandbox"

# Authentication - Can use simple values for testing
JWT_SECRET="sandbox-jwt-secret-key-for-development-testing-only-minimum-64-characters"
PASSWORD_PEPPER="sandbox-pepper-for-dev-testing-32chars"

# Stripe - Use TEST keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Email - Resend (get from https://resend.com/api-keys)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
FROM_EMAIL="MaestroHub <noreply@yourdomain.com>"

# Image Storage - Cloudinary (get from https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="xxxxxxxxxxxxx"
CLOUDINARY_API_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Analytics - Mixpanel (get from https://mixpanel.com/settings/project)
MIXPANEL_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Error Tracking - Sentry (get from https://sentry.io/settings/projects/)
SENTRY_DSN="https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"

# APM - New Relic (get from https://one.newrelic.com/admin-portal/api-keys/home)
NEW_RELIC_LICENSE_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxNRAL"
NEW_RELIC_APP_NAME="MaestroHub-Sandbox"

# Platform Settings
PLATFORM_FEE_PERCENT=10
ENVIRONMENT="sandbox"
APP_VERSION="1.0.0"
```

---

## 3. PRODUCTION ENVIRONMENT (.env.production)

```bash
# ============================================
# MAESTROHUB PRODUCTION ENVIRONMENT CONFIGURATION
# ============================================

# Database - Use MongoDB Atlas production cluster
MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/maestrohub?retryWrites=true&w=majority"
DB_NAME="maestrohub"

# Authentication - Use secure generated values
# Generate with: openssl rand -hex 64
JWT_SECRET="<GENERATE_SECURE_256_BIT_SECRET>"
# Generate with: openssl rand -hex 32
PASSWORD_PEPPER="<GENERATE_SECURE_64_CHAR_HEX>"

# Stripe - Use LIVE keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY="sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Email - Resend Production
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
FROM_EMAIL="MaestroHub <noreply@maestrohub.com>"

# Image Storage - Cloudinary Production
CLOUDINARY_CLOUD_NAME="maestrohub-prod"
CLOUDINARY_API_KEY="xxxxxxxxxxxxx"
CLOUDINARY_API_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Analytics - Mixpanel Production
MIXPANEL_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Error Tracking - Sentry Production
SENTRY_DSN="https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"

# APM - New Relic Production
NEW_RELIC_LICENSE_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxNRAL"
NEW_RELIC_APP_NAME="MaestroHub-Production"

# Platform Settings
PLATFORM_FEE_PERCENT=10
ENVIRONMENT="production"
APP_VERSION="1.0.0"
```

---

## 4. KEY ACQUISITION GUIDE

### 4.1 MongoDB Atlas
**URL:** https://cloud.mongodb.com

1. Create account or sign in
2. Create a new cluster (M0 free tier for sandbox)
3. Create database user with read/write permissions
4. Whitelist IP addresses (or 0.0.0.0/0 for development)
5. Get connection string from "Connect" > "Connect your application"

**Sandbox:** Use M0 free tier
**Production:** Use M10+ dedicated cluster with:
- Encryption at rest
- Automatic backups
- VPC peering

---

### 4.2 Stripe
**URL:** https://dashboard.stripe.com

1. Create account at https://stripe.com
2. Complete business verification for production
3. Get API keys from Developers > API keys

**Sandbox Keys:**
- Secret: `sk_test_...`
- Publishable: `pk_test_...`

**Production Keys:**
- Secret: `sk_live_...`
- Publishable: `pk_live_...`

**Webhook Setup:**
1. Go to Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `account.updated` (for Connect)
4. Copy webhook signing secret

---

### 4.3 Resend (Email)
**URL:** https://resend.com

1. Create account at https://resend.com
2. Verify your domain (for production)
3. Get API key from API Keys section

**Domain Verification (Production):**
1. Add TXT record for verification
2. Add MX records for receiving
3. Add DKIM records for deliverability

---

### 4.4 Cloudinary (Image Storage)
**URL:** https://cloudinary.com

1. Create account at https://cloudinary.com
2. Go to Dashboard for credentials
3. Note: Cloud Name, API Key, API Secret

**Settings for Production:**
- Enable backup
- Set up upload presets
- Configure transformation limits
- Set up access controls

---

### 4.5 Mixpanel (Analytics)
**URL:** https://mixpanel.com

1. Create account at https://mixpanel.com
2. Create a new project
3. Get Project Token from Project Settings

**Recommended Events to Track:**
- User signups
- Logins
- Bookings created
- Payments completed
- Profile updates
- Search queries

---

### 4.6 Sentry (Error Tracking)
**URL:** https://sentry.io

1. Create account at https://sentry.io
2. Create a new project (select Python/FastAPI)
3. Get DSN from Project Settings > Client Keys

**Configuration:**
- Set up alerts for error spikes
- Configure release tracking
- Set up source maps for frontend

---

### 4.7 New Relic (APM)
**URL:** https://newrelic.com

1. Create account at https://newrelic.com
2. Go to API Keys in account settings
3. Create new INGEST - LICENSE key

**Dashboards to Create:**
- API response times
- Error rates
- Database query performance
- External service calls

---

### 4.8 Cloudflare (CDN)
**URL:** https://cloudflare.com

1. Create account at https://cloudflare.com
2. Add your domain
3. Update nameservers at your registrar
4. Configure SSL/TLS (Full strict)

**Recommended Settings:**
- Enable HTTPS always
- Enable auto minification
- Set up page rules for caching
- Configure security headers
- Enable bot protection

---

## 5. SECURITY BEST PRACTICES

### 5.1 Key Management
- ❌ Never commit API keys to git
- ✅ Use environment variables
- ✅ Use secrets management (AWS Secrets Manager, Vault)
- ✅ Rotate keys periodically
- ✅ Use different keys for sandbox/production

### 5.2 JWT Secret Generation
```bash
# Generate secure JWT secret
openssl rand -hex 64
```

### 5.3 Password Pepper Generation
```bash
# Generate secure password pepper
openssl rand -hex 32
```

### 5.4 Key Rotation Schedule
| Key Type | Rotation Frequency |
|----------|--------------------|
| JWT Secret | Every 90 days |
| Password Pepper | Never (would invalidate passwords) |
| Stripe Keys | On security incident |
| API Keys | Every 180 days |

---

## 6. VERIFICATION CHECKLIST

### Sandbox
- [ ] MongoDB connection works
- [ ] Stripe test payments work
- [ ] Test emails send successfully
- [ ] Image uploads work
- [ ] Analytics events appear in Mixpanel
- [ ] Errors appear in Sentry
- [ ] APM data shows in New Relic

### Production
- [ ] All sandbox checks pass with production keys
- [ ] SSL certificate valid
- [ ] Domain verified for email
- [ ] Stripe webhook receiving events
- [ ] CDN serving static assets
- [ ] Monitoring alerts configured
- [ ] Backup verification complete

---

## Document History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-21 | AI Agent | Initial document |
