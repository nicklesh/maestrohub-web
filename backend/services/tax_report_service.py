"""
Tax Report Service for Maestro Habitat
Generates tax documents (1099 for US, equivalent for other markets)
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

logger = logging.getLogger(__name__)

# Market-specific tax document types
TAX_DOCUMENT_TYPES = {
    "US_USD": {
        "coach": "1099-NEC",  # Non-employee compensation
        "consumer": "Payment Summary",
        "threshold": 60000,  # $600 threshold for 1099
    },
    "IN_INR": {
        "coach": "Form 16A",  # TDS Certificate
        "consumer": "Payment Summary",
        "threshold": 0,
    }
}

class TaxReportService:
    def __init__(self, db):
        self.db = db
    
    async def get_available_years(self, user_id: str, user_role: str) -> List[int]:
        """Get list of years with transaction data (current + last 4)"""
        current_year = datetime.now(timezone.utc).year
        available_years = []
        
        for year in range(current_year, current_year - 5, -1):
            # Check if there are bookings for this year
            start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            
            if user_role == "tutor":
                # Find tutor profile first
                tutor = await self.db.tutors.find_one({"user_id": user_id})
                if tutor:
                    count = await self.db.bookings.count_documents({
                        "tutor_id": tutor["tutor_id"],
                        "status": {"$in": ["completed", "booked", "confirmed"]},
                        "start_at": {"$gte": start_date, "$lte": end_date}
                    })
                    if count > 0:
                        available_years.append(year)
            else:
                count = await self.db.bookings.count_documents({
                    "consumer_id": user_id,
                    "status": {"$in": ["completed", "booked", "confirmed"]},
                    "start_at": {"$gte": start_date, "$lte": end_date}
                })
                if count > 0:
                    available_years.append(year)
        
        # Always include current year
        if current_year not in available_years:
            available_years.insert(0, current_year)
        
        return available_years
    
    async def get_existing_report(self, user_id: str, year: int, market_id: str) -> Optional[Dict]:
        """Check if a report already exists and is ready"""
        report = await self.db.tax_reports.find_one({
            "user_id": user_id,
            "year": year,
            "market_id": market_id,
            "status": "ready"
        }, {"_id": 0})
        return report
    
    async def request_report_generation(self, user_id: str, user_role: str, year: int, market_id: str) -> Dict:
        """Request a tax report to be generated"""
        # Check if already generating
        existing = await self.db.tax_reports.find_one({
            "user_id": user_id,
            "year": year,
            "market_id": market_id,
            "status": {"$in": ["pending", "generating"]}
        })
        
        if existing:
            return {"status": "already_requested", "report_id": existing.get("report_id")}
        
        # Create report request
        report_id = f"tax_{uuid.uuid4().hex[:12]}"
        market_config = TAX_DOCUMENT_TYPES.get(market_id, TAX_DOCUMENT_TYPES["US_USD"])
        
        report_doc = {
            "report_id": report_id,
            "user_id": user_id,
            "user_role": user_role,
            "year": year,
            "market_id": market_id,
            "status": "pending",
            "report_type": market_config["coach"] if user_role == "tutor" else market_config["consumer"],
            "total_amount": 0,
            "currency": market_id.split("_")[1] if "_" in market_id else "USD",
            "file_url": None,
            "created_at": datetime.now(timezone.utc),
            "generated_at": None
        }
        
        await self.db.tax_reports.insert_one(report_doc)
        
        # Generate the report immediately (in production, this would be a background job)
        await self.generate_report(report_id)
        
        return {"status": "requested", "report_id": report_id}
    
    async def generate_report(self, report_id: str) -> bool:
        """Generate the tax report PDF"""
        try:
            # Update status to generating
            await self.db.tax_reports.update_one(
                {"report_id": report_id},
                {"$set": {"status": "generating"}}
            )
            
            report = await self.db.tax_reports.find_one({"report_id": report_id})
            if not report:
                return False
            
            # Get user info
            user = await self.db.users.find_one({"user_id": report["user_id"]})
            if not user:
                return False
            
            # Calculate totals
            year = report["year"]
            start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            
            if report["user_role"] == "tutor":
                tutor = await self.db.tutors.find_one({"user_id": report["user_id"]})
                if tutor:
                    bookings = await self.db.bookings.find({
                        "tutor_id": tutor["tutor_id"],
                        "status": {"$in": ["completed", "booked", "confirmed"]},
                        "start_at": {"$gte": start_date, "$lte": end_date}
                    }).to_list(None)
                else:
                    bookings = []
            else:
                bookings = await self.db.bookings.find({
                    "consumer_id": report["user_id"],
                    "status": {"$in": ["completed", "booked", "confirmed"]},
                    "start_at": {"$gte": start_date, "$lte": end_date}
                }).to_list(None)
            
            # Calculate total
            total_amount = sum(b.get("amount_cents", 0) for b in bookings) / 100
            currency_symbol = "$" if report["currency"] == "USD" else "₹"
            
            # Generate PDF
            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
            
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, spaceAfter=20)
            heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceAfter=10)
            normal_style = styles['Normal']
            
            elements = []
            
            # Header
            elements.append(Paragraph(f"<b>Maestro Habitat</b>", title_style))
            elements.append(Paragraph(f"<b>{report['report_type']} - Tax Year {year}</b>", heading_style))
            elements.append(Spacer(1, 20))
            
            # User Info
            elements.append(Paragraph(f"<b>Prepared for:</b> {user.get('name', 'N/A')}", normal_style))
            elements.append(Paragraph(f"<b>Email:</b> {user.get('email', 'N/A')}", normal_style))
            elements.append(Paragraph(f"<b>Market:</b> {report['market_id']}", normal_style))
            elements.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%B %d, %Y')}", normal_style))
            elements.append(Spacer(1, 30))
            
            # Summary
            elements.append(Paragraph("<b>Annual Summary</b>", heading_style))
            
            summary_data = [
                ["Description", "Amount"],
                ["Total Sessions", str(len(bookings))],
                [f"Total {'Earnings' if report['user_role'] == 'tutor' else 'Payments'}", f"{currency_symbol}{total_amount:,.2f}"],
            ]
            
            if report["user_role"] == "tutor":
                platform_fees = total_amount * 0.10  # 10% platform fee
                net_earnings = total_amount - platform_fees
                summary_data.append(["Platform Fees (10%)", f"{currency_symbol}{platform_fees:,.2f}"])
                summary_data.append(["Net Earnings", f"{currency_symbol}{net_earnings:,.2f}"])
            
            summary_table = Table(summary_data, colWidths=[4*inch, 2*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 30))
            
            # Disclaimer
            disclaimer_style = ParagraphStyle('Disclaimer', parent=normal_style, fontSize=9, textColor=colors.gray)
            elements.append(Paragraph(
                "<b>Disclaimer:</b> This document is provided for informational purposes only. "
                "Consult with a tax professional for specific tax advice. Maestro Habitat does not "
                "provide tax, legal, or accounting advice.",
                disclaimer_style
            ))
            
            doc.build(elements)
            
            # In production, upload to cloud storage and get URL
            # For now, we'll store the reference
            file_url = f"/api/tax-reports/{report_id}/download"
            
            # Update report
            await self.db.tax_reports.update_one(
                {"report_id": report_id},
                {
                    "$set": {
                        "status": "ready",
                        "total_amount": total_amount,
                        "file_url": file_url,
                        "generated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Create notification for user
            await self.db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": report["user_id"],
                "type": "tax_report_ready",
                "title": f"Tax Report Ready",
                "message": f"Your {report['report_type']} for {year} is ready for download.",
                "data": {"report_id": report_id},
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            logger.info(f"Tax report {report_id} generated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate tax report {report_id}: {e}")
            await self.db.tax_reports.update_one(
                {"report_id": report_id},
                {"$set": {"status": "failed"}}
            )
            return False
    
    async def get_report_status(self, report_id: str) -> Optional[Dict]:
        """Get the status of a report"""
        return await self.db.tax_reports.find_one(
            {"report_id": report_id},
            {"_id": 0}
        )
    
    async def get_user_reports(self, user_id: str) -> List[Dict]:
        """Get all reports for a user"""
        reports = await self.db.tax_reports.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("year", -1).to_list(50)
        return reports
