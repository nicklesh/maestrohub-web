"""Application configuration settings"""
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'maestrohub-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7

# Stripe Config (placeholder)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_placeholder')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder')
PLATFORM_FEE_PERCENT = float(os.environ.get('PLATFORM_FEE_PERCENT', '10'))

# Resend Config (placeholder)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', 're_placeholder')

# Feature Flags
FEATURE_FLAGS = {
    "CROSS_BORDER_ONLINE_ENABLED": False,
    "MARKET_SWITCHING_ENABLED": True,
    "IN_MARKET_ONLY_BOOKING_ENFORCED": True,
}

# Market Configuration
MARKETS_CONFIG = {
    "US_USD": {
        "market_id": "US_USD",
        "country": "US",
        "currency": "USD",
        "currency_symbol": "$",
        "default_timezone": "America/New_York",
        "is_enabled": True,
        "payment_provider_key": "stripe_us",
        "min_price": 10,
        "max_price": 500,
    },
    "IN_INR": {
        "market_id": "IN_INR",
        "country": "IN",
        "currency": "INR",
        "currency_symbol": "₹",
        "default_timezone": "Asia/Kolkata",
        "is_enabled": True,
        "payment_provider_key": "stripe_in",
        "min_price": 200,
        "max_price": 10000,
    }
}

# Country to Market mapping
COUNTRY_TO_MARKET = {
    "US": "US_USD",
    "IN": "IN_INR",
    "default": "US_USD"
}
