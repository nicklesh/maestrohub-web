"""
Exchange Rate Service - Fetches live currency exchange rates
"""
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional
import asyncio

logger = logging.getLogger(__name__)

# Cache for exchange rates (to avoid too many API calls)
_rate_cache: Dict[str, dict] = {}
_cache_expiry: Dict[str, datetime] = {}
CACHE_DURATION = timedelta(hours=1)  # Cache rates for 1 hour

# Free exchange rate API (no key required for basic usage)
EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest"

# Fallback rates if API fails
FALLBACK_RATES = {
    "USD": {
        "USD": 1.0,
        "INR": 83.0,
        "EUR": 0.92,
        "GBP": 0.79,
    },
    "INR": {
        "INR": 1.0,
        "USD": 0.012,
        "EUR": 0.011,
        "GBP": 0.0095,
    }
}

async def get_exchange_rates(base_currency: str = "USD") -> Dict[str, float]:
    """
    Get exchange rates for a base currency.
    Uses caching to minimize API calls.
    """
    base_currency = base_currency.upper()
    
    # Check cache
    if base_currency in _rate_cache:
        if datetime.now() < _cache_expiry.get(base_currency, datetime.min):
            return _rate_cache[base_currency]
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{EXCHANGE_RATE_API}/{base_currency}")
            if response.status_code == 200:
                data = response.json()
                rates = data.get("rates", {})
                
                # Cache the results
                _rate_cache[base_currency] = rates
                _cache_expiry[base_currency] = datetime.now() + CACHE_DURATION
                
                logger.info(f"Fetched exchange rates for {base_currency}: {len(rates)} currencies")
                return rates
            else:
                logger.warning(f"Exchange rate API returned {response.status_code}")
    except Exception as e:
        logger.error(f"Failed to fetch exchange rates: {e}")
    
    # Return fallback rates
    return FALLBACK_RATES.get(base_currency, {"USD": 1.0})


async def convert_price(
    amount: float,
    from_currency: str,
    to_currency: str
) -> tuple[float, float]:
    """
    Convert price from one currency to another.
    Returns (converted_amount, exchange_rate)
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    if from_currency == to_currency:
        return amount, 1.0
    
    rates = await get_exchange_rates(from_currency)
    rate = rates.get(to_currency, 1.0)
    
    converted = round(amount * rate, 2)
    return converted, rate


async def get_recommended_price(
    base_price: float,
    base_currency: str,
    target_currency: str,
    adjustment_factor: float = 1.0
) -> dict:
    """
    Get recommended price for a target market.
    Applies purchasing power parity adjustments.
    
    Returns:
        {
            "recommended_price": float,
            "exchange_rate": float,
            "direct_conversion": float,
            "adjustment_factor": float
        }
    """
    converted, rate = await convert_price(base_price, base_currency, target_currency)
    
    # Apply adjustment factor (for PPP or market-specific adjustments)
    recommended = round(converted * adjustment_factor, 2)
    
    return {
        "recommended_price": recommended,
        "exchange_rate": rate,
        "direct_conversion": converted,
        "adjustment_factor": adjustment_factor
    }


# Market-specific adjustment factors (Purchasing Power Parity approximation)
PPP_ADJUSTMENTS = {
    ("USD", "INR"): 0.35,  # Services in India are typically 35% of direct conversion
    ("INR", "USD"): 2.0,   # Indian coaches charging in US get premium
}

async def get_market_price_recommendations(
    base_price: float,
    base_market: str,  # e.g., "US_USD"
    target_markets: list[str]  # e.g., ["IN_INR", "GB_GBP"]
) -> dict:
    """
    Get price recommendations for multiple markets.
    """
    base_currency = base_market.split("_")[-1] if "_" in base_market else "USD"
    
    recommendations = {}
    for target_market in target_markets:
        target_currency = target_market.split("_")[-1] if "_" in target_market else "USD"
        
        # Get PPP adjustment
        ppp_key = (base_currency, target_currency)
        adjustment = PPP_ADJUSTMENTS.get(ppp_key, 1.0)
        
        rec = await get_recommended_price(
            base_price, base_currency, target_currency, adjustment
        )
        recommendations[target_market] = rec
    
    return recommendations


# Country code to flag emoji mapping
COUNTRY_FLAGS = {
    "US": "🇺🇸",
    "IN": "🇮🇳",
    "GB": "🇬🇧",
    "CA": "🇨🇦",
    "AU": "🇦🇺",
    "DE": "🇩🇪",
    "FR": "🇫🇷",
    "JP": "🇯🇵",
    "CN": "🇨🇳",
    "BR": "🇧🇷",
    "MX": "🇲🇽",
    "SG": "🇸🇬",
    "AE": "🇦🇪",
    "NL": "🇳🇱",
    "SE": "🇸🇪",
}

def get_country_flag(country_code: str) -> str:
    """Get flag emoji for a country code"""
    return COUNTRY_FLAGS.get(country_code.upper(), "🌐")


def get_market_display(market_id: str) -> dict:
    """
    Get display info for a market.
    Returns: {"flag": "🇺🇸", "code": "US", "display": "🇺🇸 US"}
    """
    if "_" in market_id:
        country = market_id.split("_")[0]
    else:
        country = market_id
    
    flag = get_country_flag(country)
    return {
        "flag": flag,
        "code": country,
        "display": f"{flag} {country}"
    }
