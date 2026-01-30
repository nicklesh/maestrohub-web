"""
Search Service for Maestro Habitat
Handles tutor/coach search and discovery
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import math

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, db):
        self.db = db
    
    async def search_tutors(self, query: str = None, category: str = None,
                           subject: str = None, modality: str = None,
                           level: str = None, min_price: float = None,
                           max_price: float = None, market_id: str = None,
                           lat: float = None, lng: float = None,
                           radius_miles: int = 25, page: int = 1,
                           limit: int = 20, sort_by: str = "relevance") -> Dict:
        """Search for tutors with filters"""
        
        # Build query
        db_query = {
            "status": "approved",
            "is_published": True
        }
        
        if market_id:
            db_query["market_id"] = market_id
        
        if category:
            db_query["categories"] = category
        
        if subject:
            db_query["subjects"] = {"$regex": subject, "$options": "i"}
        
        if modality:
            db_query["modality"] = modality
        
        if level:
            db_query["levels"] = level
        
        if min_price is not None:
            db_query["base_price"] = {"$gte": min_price}
        
        if max_price is not None:
            if "base_price" in db_query:
                db_query["base_price"]["$lte"] = max_price
            else:
                db_query["base_price"] = {"$lte": max_price}
        
        # Text search
        if query:
            db_query["$or"] = [
                {"subjects": {"$regex": query, "$options": "i"}},
                {"bio": {"$regex": query, "$options": "i"}},
                {"categories": {"$regex": query, "$options": "i"}}
            ]
        
        # Sort options
        sort_options = {
            "relevance": [("is_sponsored", -1), ("rating_avg", -1)],
            "rating": [("rating_avg", -1)],
            "price_low": [("base_price", 1)],
            "price_high": [("base_price", -1)],
            "newest": [("created_at", -1)]
        }
        sort = sort_options.get(sort_by, sort_options["relevance"])
        
        # Get total count
        total = await self.db.tutors.count_documents(db_query)
        
        # Pagination
        skip = (page - 1) * limit
        
        # Execute query
        tutors = await self.db.tutors.find(db_query, {"_id": 0}).sort(sort).skip(skip).limit(limit).to_list(limit)
        
        # Enrich with user info
        results = []
        for tutor in tutors:
            user = await self.db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
            if user:
                results.append({
                    **tutor,
                    "name": user.get("name", "Unknown"),
                    "picture": user.get("picture")
                })
        
        return {
            "tutors": results,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit) if total > 0 else 0
        }
    
    async def get_tutor_detail(self, tutor_id: str) -> Optional[Dict]:
        """Get detailed tutor profile"""
        tutor = await self.db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
        if not tutor:
            return None
        
        user = await self.db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        if not user:
            return None
        
        # Get reviews
        reviews = await self.db.reviews.find(
            {"tutor_id": tutor_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(10)
        
        # Get packages
        packages = await self.db.session_packages.find(
            {"tutor_id": tutor_id, "is_active": True},
            {"_id": 0}
        ).to_list(10)
        
        return {
            **tutor,
            "name": user.get("name", "Unknown"),
            "picture": user.get("picture"),
            "email": user.get("email"),
            "reviews": reviews,
            "packages": packages
        }
    
    async def get_sponsored_tutors(self, category: str = None, market_id: str = None,
                                   limit: int = 5) -> List[Dict]:
        """Get sponsored tutors for featured placement"""
        query = {
            "status": "approved",
            "is_published": True,
            "is_sponsored": True
        }
        
        if category:
            query["sponsored_categories"] = category
        
        if market_id:
            query["market_id"] = market_id
        
        tutors = await self.db.tutors.find(query, {"_id": 0}).limit(limit).to_list(limit)
        
        results = []
        for tutor in tutors:
            user = await self.db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
            if user:
                results.append({
                    **tutor,
                    "name": user.get("name", "Unknown"),
                    "picture": user.get("picture")
                })
        
        return results
    
    async def get_categories(self) -> Dict:
        """Get all categories, subcategories, levels, and modalities from DB"""
        # Fetch from database
        categories_docs = await self.db.categories.find({}, {"_id": 0}).to_list(100)
        levels_docs = await self.db.levels.find({}, {"_id": 0}).to_list(100)
        modalities_docs = await self.db.modalities.find({}, {"_id": 0}).to_list(100)
        
        # Format categories
        categories = []
        for cat in categories_docs:
            categories.append({
                "id": cat.get("name", "").lower().replace(" ", "_"),
                "name": cat.get("name", ""),
                "subcategories": cat.get("subcategories", [])
            })
        
        levels = [l.get("name", "") for l in levels_docs]
        modalities = [m.get("name", "") for m in modalities_docs]
        
        return {
            "categories": categories,
            "levels": levels,
            "modalities": modalities
        }
