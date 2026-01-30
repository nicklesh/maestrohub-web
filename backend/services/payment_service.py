"""
Payment Service for Maestro Habitat
Handles payment processing, transaction recording, and payment methods
"""
import uuid
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Payment providers by market
PAYMENT_PROVIDERS_USD = [
    {"id": "paypal", "name": "PayPal", "icon": "logo-paypal"},
    {"id": "google_pay", "name": "Google Pay", "icon": "logo-google"},
    {"id": "apple_pay", "name": "Apple Pay", "icon": "logo-apple"},
    {"id": "venmo", "name": "Venmo", "icon": "phone-portrait"},
    {"id": "zelle", "name": "Zelle", "icon": "flash"},
]

PAYMENT_PROVIDERS_INR = [
    {"id": "phonepe", "name": "PhonePe", "icon": "wallet"},
    {"id": "google_pay", "name": "Google Pay (GPay)", "icon": "logo-google"},
    {"id": "paytm", "name": "Paytm", "icon": "wallet"},
    {"id": "amazon_pay", "name": "Amazon Pay", "icon": "cart"},
]

PLATFORM_FEE_PERCENT = 10.0  # 10% platform fee


class PaymentService:
    def __init__(self, db):
        self.db = db
    
    def get_providers_for_market(self, market_id: str) -> List[Dict]:
        """Get available payment providers for a market"""
        if market_id == "IN_INR":
            return PAYMENT_PROVIDERS_INR
        return PAYMENT_PROVIDERS_USD
    
    async def get_user_payment_providers(self, user_id: str) -> Dict:
        """Get user's linked payment providers"""
        user_doc = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        market_id = user_doc.get("market_id", "US_USD")
        
        return {
            "available_providers": self.get_providers_for_market(market_id),
            "linked_providers": user_doc.get("payment_providers", []),
            "market_id": market_id
        }
    
    async def link_payment_provider(self, user_id: str, provider_id: str, is_default: bool = False) -> Dict:
        """Link a payment provider to user account"""
        user_doc = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        market_id = user_doc.get("market_id", "US_USD")
        
        valid_providers = self.get_providers_for_market(market_id)
        provider_info = next((p for p in valid_providers if p["id"] == provider_id), None)
        if not provider_info:
            return {"success": False, "error": "Invalid payment provider for your market"}
        
        existing_providers = user_doc.get("payment_providers", [])
        
        if any(p["provider_id"] == provider_id for p in existing_providers):
            return {"success": False, "error": "Provider already linked"}
        
        # Set default logic
        set_as_default = is_default or len(existing_providers) == 0
        if set_as_default:
            for p in existing_providers:
                p["is_default"] = False
        
        new_provider = {
            "provider_id": provider_id,
            "display_name": provider_info["name"],
            "is_default": set_as_default,
            "linked_at": datetime.now(timezone.utc).isoformat()
        }
        existing_providers.append(new_provider)
        
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": {"payment_providers": existing_providers}}
        )
        
        return {"success": True, "provider": new_provider}
    
    async def process_payment(self, user_id: str, booking_hold_id: str, 
                             amount_cents: int, provider_id: str = None) -> Dict:
        """Process payment for a booking"""
        user_doc = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        market_id = user_doc.get("market_id", "US_USD")
        currency = "INR" if market_id == "IN_INR" else "USD"
        
        linked_providers = user_doc.get("payment_providers", [])
        
        if not linked_providers:
            return {
                "success": False,
                "error": "no_payment_method",
                "message": "No payment method configured."
            }
        
        # Get provider to charge
        if not provider_id:
            default_provider = next((p for p in linked_providers if p.get("is_default")), None)
            provider_id = default_provider["provider_id"] if default_provider else linked_providers[0]["provider_id"]
        
        # Get hold info
        hold = await self.db.booking_holds.find_one({"hold_id": booking_hold_id}, {"_id": 0})
        if not hold:
            return {"success": False, "error": "Booking hold not found"}
        
        # Calculate split
        tutor_amount = int(amount_cents * (100 - PLATFORM_FEE_PERCENT) / 100)
        platform_fee = amount_cents - tutor_amount
        
        # Simulate payment (90% success rate)
        payment_success = random.random() > 0.1
        payment_id = f"pay_{uuid.uuid4().hex[:12]}"
        
        if payment_success:
            # Record transaction
            transaction_doc = {
                "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                "payment_id": payment_id,
                "user_id": user_id,
                "user_type": "consumer",
                "transaction_type": "session_payment",
                "amount_cents": amount_cents,
                "currency": currency,
                "funding_source_type": provider_id,
                "funding_source_id": f"src_{uuid.uuid4().hex[:8]}",
                "funding_source_code": "****" + str(random.randint(1000, 9999)),
                "related_booking_hold_id": booking_hold_id,
                "related_tutor_id": hold["tutor_id"],
                "platform_fee_cents": platform_fee,
                "tutor_payout_cents": tutor_amount,
                "month": datetime.now(timezone.utc).month,
                "year": datetime.now(timezone.utc).year,
                "payment_date": datetime.now(timezone.utc),
                "status": "completed",
                "created_at": datetime.now(timezone.utc)
            }
            await self.db.payment_transactions.insert_one(transaction_doc)
            
            # Record payment
            payment_record = {
                "payment_id": payment_id,
                "booking_hold_id": booking_hold_id,
                "tutor_id": hold["tutor_id"],
                "consumer_id": user_id,
                "amount_cents": amount_cents,
                "currency": currency,
                "provider_id": provider_id,
                "platform_fee_cents": platform_fee,
                "tutor_payout_cents": tutor_amount,
                "status": "completed",
                "processed_at": datetime.now(timezone.utc)
            }
            await self.db.payments.insert_one(payment_record)
            
            logger.info(f"Payment {payment_id} processed: {amount_cents/100:.2f} {currency}")
            
            return {
                "success": True,
                "payment_id": payment_id,
                "provider_used": provider_id,
                "amount_cents": amount_cents,
                "currency": currency,
                "split": {
                    "tutor_payout_cents": tutor_amount,
                    "platform_fee_cents": platform_fee
                }
            }
        
        return {
            "success": False,
            "error": "payment_failed",
            "message": "Payment could not be processed. Please try again."
        }
    
    async def record_provider_fee(self, tutor_id: str, amount_cents: int, 
                                  fee_type: str, booking_id: str = None,
                                  currency: str = "USD") -> Dict:
        """Record a provider platform fee transaction"""
        transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
        
        tutor = await self.db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
        if not tutor:
            return {"success": False, "error": "Tutor not found"}
        
        transaction_doc = {
            "transaction_id": transaction_id,
            "user_id": tutor["user_id"],
            "user_type": "provider",
            "transaction_type": fee_type,  # "platform_fee", "subscription", "sponsorship"
            "amount_cents": amount_cents,
            "currency": currency,
            "funding_source_type": "platform_deduction",
            "funding_source_id": None,
            "funding_source_code": "PLATFORM",
            "related_booking_id": booking_id,
            "related_tutor_id": tutor_id,
            "month": datetime.now(timezone.utc).month,
            "year": datetime.now(timezone.utc).year,
            "payment_date": datetime.now(timezone.utc),
            "status": "completed",
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.payment_transactions.insert_one(transaction_doc)
        
        return {"success": True, "transaction_id": transaction_id}
    
    async def get_payment_history(self, user_id: str, user_type: str = "consumer",
                                  limit: int = 50) -> List[Dict]:
        """Get payment transaction history for a user"""
        transactions = await self.db.payment_transactions.find(
            {"user_id": user_id, "user_type": user_type},
            {"_id": 0}
        ).sort("payment_date", -1).to_list(limit)
        
        return transactions
    
    async def get_monthly_summary(self, user_id: str, user_type: str,
                                  year: int, month: int) -> Dict:
        """Get monthly payment summary for reporting"""
        transactions = await self.db.payment_transactions.find(
            {
                "user_id": user_id,
                "user_type": user_type,
                "year": year,
                "month": month,
                "status": "completed"
            },
            {"_id": 0}
        ).to_list(1000)
        
        total_amount = sum(t.get("amount_cents", 0) for t in transactions)
        total_fees = sum(t.get("platform_fee_cents", 0) for t in transactions)
        
        return {
            "year": year,
            "month": month,
            "transaction_count": len(transactions),
            "total_amount_cents": total_amount,
            "total_fees_cents": total_fees,
            "transactions": transactions
        }
