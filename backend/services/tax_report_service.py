"""
Tax Report Service for Maestro Habitat
Handles generation and storage of tax reports (1099s) for providers and consumers
"""
import uuid
import io
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch
import base64

logger = logging.getLogger(__name__)

# Constants
CURRENT_YEAR = datetime.now(timezone.utc).year
YEARS_AVAILABLE = 5  # Current year + 4 previous years
# Use the same logo as regular reports (blue/yellow trimmed logo)
LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'mh_logo_trimmed.png')


class TaxReportService:
    def __init__(self, db, email_service=None, notification_service=None):
        self.db = db
        self.email_service = email_service
        self.notification_service = notification_service
    
    # ============== AVAILABLE YEARS ==============
    def get_available_years(self) -> List[int]:
        """Get list of years available for direct download (last 5 years)"""
        return list(range(CURRENT_YEAR, CURRENT_YEAR - YEARS_AVAILABLE, -1))
    
    def is_year_archived(self, year: int) -> bool:
        """Check if a year's reports are archived (>5 years old)"""
        return year < (CURRENT_YEAR - YEARS_AVAILABLE + 1)
    
    # ============== REPORT GENERATION ==============
    async def generate_monthly_report(self, user_id: str, user_type: str,
                                      year: int, month: int) -> Dict:
        """Generate a monthly summary report for a user"""
        # Get user info
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"success": False, "error": "User not found"}
        
        # Get transactions for the month
        transactions = await self.db.payment_transactions.find({
            "user_id": user_id,
            "user_type": user_type,
            "year": year,
            "month": month,
            "status": "completed"
        }, {"_id": 0}).to_list(1000)
        
        # Calculate totals (will be 0 if no transactions)
        total_amount = sum(t.get("amount_cents", 0) for t in transactions)
        total_fees = sum(t.get("platform_fee_cents", 0) for t in transactions)
        total_payouts = sum(t.get("tutor_payout_cents", 0) for t in transactions) if user_type == "provider" else 0
        
        # Generate PDF (even for empty transactions)
        pdf_data = self._generate_monthly_pdf(
            user=user,
            user_type=user_type,
            year=year,
            month=month,
            transactions=transactions,
            total_amount=total_amount,
            total_fees=total_fees,
            total_payouts=total_payouts
        )
        
        # Store report in database
        report_id = f"report_{uuid.uuid4().hex[:12]}"
        report_doc = {
            "report_id": report_id,
            "user_id": user_id,
            "user_type": user_type,
            "report_type": "monthly_summary",
            "report_year": year,
            "report_month": month,
            "report_data": pdf_data,  # Base64 encoded PDF
            "total_amount_cents": total_amount,
            "total_fees_cents": total_fees,
            "total_payouts_cents": total_payouts,
            "transaction_count": len(transactions),
            "generated_date": datetime.now(timezone.utc),
            "is_archived": self.is_year_archived(year),
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.tax_reports.insert_one(report_doc)
        
        logger.info(f"Generated monthly report {report_id} for {user_id} ({year}/{month})")
        
        return {
            "success": True,
            "report_id": report_id,
            "total_amount_cents": total_amount,
            "transaction_count": len(transactions)
        }
    
    async def generate_annual_report(self, user_id: str, user_type: str,
                                     year: int) -> Dict:
        """Generate annual 1099-equivalent report for a user"""
        # Get user info
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"success": False, "error": "User not found"}
        
        # Get all transactions for the year
        transactions = await self.db.payment_transactions.find({
            "user_id": user_id,
            "user_type": user_type,
            "year": year,
            "status": "completed"
        }, {"_id": 0}).to_list(10000)
        
        # Calculate totals (will be 0 if no transactions)
        total_amount = sum(t.get("amount_cents", 0) for t in transactions)
        total_fees = sum(t.get("platform_fee_cents", 0) for t in transactions)
        total_payouts = sum(t.get("tutor_payout_cents", 0) for t in transactions) if user_type == "provider" else 0
        
        # Group by month for breakdown
        monthly_breakdown = {}
        for t in transactions:
            month = t.get("month", 1)
            if month not in monthly_breakdown:
                monthly_breakdown[month] = {"count": 0, "amount": 0, "fees": 0}
            monthly_breakdown[month]["count"] += 1
            monthly_breakdown[month]["amount"] += t.get("amount_cents", 0)
            monthly_breakdown[month]["fees"] += t.get("platform_fee_cents", 0)
        
        # Generate PDF (even for empty transactions)
        pdf_data = self._generate_annual_pdf(
            user=user,
            user_type=user_type,
            year=year,
            monthly_breakdown=monthly_breakdown,
            total_amount=total_amount,
            total_fees=total_fees,
            total_payouts=total_payouts,
            transaction_count=len(transactions)
        )
        
        # Convert monthly_breakdown keys to strings for MongoDB (BSON requires string keys)
        monthly_breakdown_str = {str(k): v for k, v in monthly_breakdown.items()}
        
        # Store report
        report_id = f"report_{uuid.uuid4().hex[:12]}"
        report_doc = {
            "report_id": report_id,
            "user_id": user_id,
            "user_type": user_type,
            "report_type": "annual_1099",
            "report_year": year,
            "report_month": None,
            "report_data": pdf_data,
            "total_amount_cents": total_amount,
            "total_fees_cents": total_fees,
            "total_payouts_cents": total_payouts,
            "transaction_count": len(transactions),
            "monthly_breakdown": monthly_breakdown_str,
            "generated_date": datetime.now(timezone.utc),
            "is_archived": self.is_year_archived(year),
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.tax_reports.insert_one(report_doc)
        
        logger.info(f"Generated annual 1099 report {report_id} for {user_id} ({year})")
        
        return {
            "success": True,
            "report_id": report_id,
            "total_amount_cents": total_amount,
            "total_payouts_cents": total_payouts,
            "transaction_count": len(transactions)
        }
    
    # ============== PDF GENERATION ==============
    def _generate_monthly_pdf(self, user: Dict, user_type: str, year: int, month: int,
                              transactions: List[Dict], total_amount: int,
                              total_fees: int, total_payouts: int) -> str:
        """Generate monthly summary PDF and return as base64"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, 
                                     textColor=colors.HexColor('#2563EB'))
        
        month_name = datetime(year, month, 1).strftime('%B')
        currency = transactions[0].get("currency", "USD") if transactions else "USD"
        currency_symbol = "$" if currency == "USD" else "₹"
        
        elements = []
        
        # Logo Header
        if os.path.exists(LOGO_PATH):
            try:
                # Logo is vertical, maintain aspect ratio (same as regular reports)
                logo = Image(LOGO_PATH, width=0.75*inch, height=1*inch)
                logo.hAlign = 'LEFT'
                elements.append(logo)
                elements.append(Spacer(1, 8))
            except Exception as e:
                logger.warning(f"Failed to add logo to PDF: {e}")
        
        # Header
        elements.append(Paragraph("Maestro Habitat", title_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"Monthly {user_type.title()} Statement", styles['Heading2']))
        elements.append(Paragraph(f"{month_name} {year}", styles['Normal']))
        elements.append(Spacer(1, 24))
        
        # User info
        elements.append(Paragraph(f"<b>Name:</b> {user.get('name', 'N/A')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Email:</b> {user.get('email', 'N/A')}", styles['Normal']))
        elements.append(Paragraph(f"<b>User ID:</b> {user.get('user_id', 'N/A')}", styles['Normal']))
        elements.append(Spacer(1, 24))
        
        # Summary
        elements.append(Paragraph("<b>Summary</b>", styles['Heading3']))
        summary_data = [
            ['Description', 'Amount'],
            ['Total Transactions', str(len(transactions))],
            ['Total Amount', f"{currency_symbol}{total_amount/100:.2f}"],
        ]
        if user_type == "provider":
            summary_data.append(['Platform Fees', f"{currency_symbol}{total_fees/100:.2f}"])
            summary_data.append(['Net Payouts', f"{currency_symbol}{total_payouts/100:.2f}"])
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 24))
        
        # Transaction list
        elements.append(Paragraph("<b>Transaction Details</b>", styles['Heading3']))
        txn_data = [['Date', 'Type', 'Amount', 'Funding Source']]
        for t in transactions[:50]:  # Limit to 50 for PDF size
            date_str = t.get("payment_date", "")
            if hasattr(date_str, 'strftime'):
                date_str = date_str.strftime('%Y-%m-%d')
            txn_data.append([
                str(date_str)[:10],
                t.get("transaction_type", "N/A"),
                f"{currency_symbol}{t.get('amount_cents', 0)/100:.2f}",
                t.get("funding_source_code", "****")
            ])
        
        txn_table = Table(txn_data, colWidths=[1.2*inch, 1.8*inch, 1.2*inch, 1.3*inch])
        txn_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(txn_table)
        elements.append(Spacer(1, 24))
        
        # Footer
        elements.append(Paragraph(
            f"<i>Generated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
            styles['Normal']
        ))
        elements.append(Paragraph(
            "<i>This document is for informational purposes. Please consult a tax professional.</i>",
            styles['Normal']
        ))
        
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return base64.b64encode(pdf_bytes).decode('utf-8')
    
    def _generate_annual_pdf(self, user: Dict, user_type: str, year: int,
                            monthly_breakdown: Dict, total_amount: int,
                            total_fees: int, total_payouts: int,
                            transaction_count: int) -> str:
        """Generate annual 1099-style PDF and return as base64"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20,
                                     textColor=colors.HexColor('#2563EB'))
        
        # Determine currency from user's market
        currency = "USD"
        currency_symbol = "$"
        
        elements = []
        
        # Logo Header
        if os.path.exists(LOGO_PATH):
            try:
                # Logo is vertical, maintain aspect ratio (same as regular reports)
                logo = Image(LOGO_PATH, width=0.75*inch, height=1*inch)
                logo.hAlign = 'LEFT'
                elements.append(logo)
                elements.append(Spacer(1, 8))
            except Exception as e:
                logger.warning(f"Failed to add logo to PDF: {e}")
        
        # Header
        elements.append(Paragraph("Maestro Habitat", title_style))
        elements.append(Spacer(1, 12))
        if user_type == "provider":
            elements.append(Paragraph(f"Form 1099-K Equivalent - Tax Year {year}", styles['Heading2']))
            elements.append(Paragraph("Payment Card and Third Party Network Transactions", styles['Normal']))
        else:
            elements.append(Paragraph(f"Annual Payment Summary - Tax Year {year}", styles['Heading2']))
            elements.append(Paragraph("Record of Educational Service Payments", styles['Normal']))
        elements.append(Spacer(1, 24))
        
        # Platform info
        elements.append(Paragraph("<b>PAYER'S Information</b>", styles['Heading3']))
        elements.append(Paragraph("Maestro Habitat Inc.", styles['Normal']))
        elements.append(Paragraph("Platform for Educational Services", styles['Normal']))
        elements.append(Spacer(1, 16))
        
        # Recipient info
        elements.append(Paragraph(f"<b>{'PAYEE' if user_type == 'provider' else 'PAYER'}'S Information</b>", styles['Heading3']))
        elements.append(Paragraph(f"Name: {user.get('name', 'N/A')}", styles['Normal']))
        elements.append(Paragraph(f"Email: {user.get('email', 'N/A')}", styles['Normal']))
        elements.append(Paragraph(f"Account ID: {user.get('user_id', 'N/A')}", styles['Normal']))
        elements.append(Spacer(1, 24))
        
        # Annual Summary
        elements.append(Paragraph("<b>Annual Summary</b>", styles['Heading3']))
        summary_data = [
            ['Box', 'Description', 'Amount'],
            ['1a', 'Gross Amount of Payment Card/Third Party Network Transactions', f"{currency_symbol}{total_amount/100:,.2f}"],
        ]
        if user_type == "provider":
            summary_data.append(['1b', 'Platform Fees Deducted', f"{currency_symbol}{total_fees/100:,.2f}"])
            summary_data.append(['', 'Net Payments to Provider', f"{currency_symbol}{total_payouts/100:,.2f}"])
        summary_data.append(['5a', 'Number of Payment Transactions', str(transaction_count)])
        
        summary_table = Table(summary_data, colWidths=[0.6*inch, 3.5*inch, 1.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 24))
        
        # Monthly breakdown
        elements.append(Paragraph("<b>Monthly Breakdown</b>", styles['Heading3']))
        month_data = [['Month', 'Transactions', 'Amount', 'Fees']]
        month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for m in range(1, 13):
            if m in monthly_breakdown:
                mb = monthly_breakdown[m]
                month_data.append([
                    month_names[m],
                    str(mb['count']),
                    f"{currency_symbol}{mb['amount']/100:,.2f}",
                    f"{currency_symbol}{mb['fees']/100:,.2f}"
                ])
            else:
                month_data.append([month_names[m], '0', f"{currency_symbol}0.00", f"{currency_symbol}0.00"])
        
        month_table = Table(month_data, colWidths=[1*inch, 1.2*inch, 1.5*inch, 1.5*inch])
        month_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        elements.append(month_table)
        elements.append(Spacer(1, 24))
        
        # Important notice
        elements.append(Paragraph("<b>Important Tax Information</b>", styles['Heading3']))
        elements.append(Paragraph(
            "This document summarizes payment transactions processed through Maestro Habitat. "
            "It is provided for your records and to assist with tax preparation. "
            "This is NOT an official IRS form but contains equivalent information for your tax reporting needs.",
            styles['Normal']
        ))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(
            "Please retain this document for your records and consult with a qualified tax professional "
            "for advice on reporting these amounts on your tax return.",
            styles['Normal']
        ))
        elements.append(Spacer(1, 24))
        
        # Footer
        elements.append(Paragraph(
            f"<i>Document generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
            styles['Normal']
        ))
        
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return base64.b64encode(pdf_bytes).decode('utf-8')
    
    # ============== REPORT RETRIEVAL ==============
    async def get_user_reports(self, user_id: str, user_type: str = None) -> List[Dict]:
        """Get all reports for a user (last 5 years only, no archived)"""
        query = {
            "user_id": user_id,
            "is_archived": False
        }
        if user_type:
            query["user_type"] = user_type
        
        reports = await self.db.tax_reports.find(
            query,
            {"_id": 0, "report_data": 0}  # Exclude PDF data for listing
        ).sort([("report_year", -1), ("report_month", -1)]).to_list(100)
        
        return reports
    
    async def get_report_by_id(self, report_id: str, user_id: str) -> Optional[Dict]:
        """Get a specific report by ID"""
        report = await self.db.tax_reports.find_one(
            {"report_id": report_id, "user_id": user_id},
            {"_id": 0}
        )
        return report
    
    async def download_report(self, report_id: str, user_id: str) -> Optional[bytes]:
        """Get PDF bytes for download"""
        report = await self.db.tax_reports.find_one(
            {"report_id": report_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not report:
            return None
        
        # Check if archived
        if report.get("is_archived"):
            return None  # Must request through inbox
        
        pdf_base64 = report.get("report_data")
        if pdf_base64:
            return base64.b64decode(pdf_base64)
        
        return None
    
    # ============== AUTOMATED REPORT GENERATION ==============
    async def generate_monthly_reports_for_all_users(self, year: int, month: int) -> Dict:
        """Generate monthly reports for all users with transactions (run on 1st of each month)"""
        # Find all users with transactions in the given month
        pipeline = [
            {"$match": {"year": year, "month": month, "status": "completed"}},
            {"$group": {"_id": {"user_id": "$user_id", "user_type": "$user_type"}}},
        ]
        
        user_groups = await self.db.payment_transactions.aggregate(pipeline).to_list(10000)
        
        generated_count = 0
        errors = []
        
        for group in user_groups:
            user_id = group["_id"]["user_id"]
            user_type = group["_id"]["user_type"]
            
            try:
                result = await self.generate_monthly_report(user_id, user_type, year, month)
                if result.get("success"):
                    generated_count += 1
                    
                    # Notify user
                    if self.notification_service:
                        month_name = datetime(year, month, 1).strftime('%B')
                        await self.notification_service.create_notification(
                            user_id=user_id,
                            notification_type="report_available",
                            title=f"{month_name} {year} Report Ready",
                            message=f"Your monthly {user_type} report for {month_name} {year} is now available for download.",
                            data={"report_id": result["report_id"]}
                        )
            except Exception as e:
                errors.append({"user_id": user_id, "error": str(e)})
                logger.error(f"Failed to generate report for {user_id}: {e}")
        
        logger.info(f"Generated {generated_count} monthly reports for {year}/{month}")
        
        return {
            "success": True,
            "generated_count": generated_count,
            "errors": errors
        }
    
    async def generate_annual_reports_for_all_providers(self, year: int) -> Dict:
        """Generate annual 1099 reports for all providers (run on Jan 1st)"""
        # Find all providers with transactions in the year
        pipeline = [
            {"$match": {"year": year, "user_type": "provider", "status": "completed"}},
            {"$group": {"_id": "$user_id"}},
        ]
        
        provider_ids = await self.db.payment_transactions.aggregate(pipeline).to_list(10000)
        
        generated_count = 0
        errors = []
        
        for item in provider_ids:
            user_id = item["_id"]
            
            try:
                result = await self.generate_annual_report(user_id, "provider", year)
                if result.get("success"):
                    generated_count += 1
                    
                    # Notify provider
                    if self.notification_service:
                        await self.notification_service.create_notification(
                            user_id=user_id,
                            notification_type="annual_report_available",
                            title=f"Tax Year {year} 1099 Report Ready",
                            message=f"Your annual tax report (1099 equivalent) for {year} is now available for download.",
                            data={"report_id": result["report_id"]}
                        )
                    
                    # Email provider
                    if self.email_service:
                        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
                        if user and user.get("email"):
                            try:
                                await self.email_service.send_email(
                                    to=user["email"],
                                    subject=f"Your {year} Tax Report is Ready - Maestro Habitat",
                                    html=f"""
                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                        <h2 style="color: #2563EB;">Your Annual Tax Report is Ready</h2>
                                        <p>Hi {user.get('name', 'there')},</p>
                                        <p>Your tax report (1099 equivalent) for {year} is now available for download in your Maestro Habitat account.</p>
                                        <p><strong>Summary:</strong></p>
                                        <ul>
                                            <li>Total Earnings: ${result['total_payouts_cents']/100:,.2f}</li>
                                            <li>Transaction Count: {result['transaction_count']}</li>
                                        </ul>
                                        <p>Log in to your account to download the full report.</p>
                                        <p>Thank you for being part of Maestro Habitat!</p>
                                    </div>
                                    """
                                )
                            except Exception as e:
                                logger.error(f"Failed to email annual report notification to {user_id}: {e}")
                                
            except Exception as e:
                errors.append({"user_id": user_id, "error": str(e)})
                logger.error(f"Failed to generate annual report for {user_id}: {e}")
        
        logger.info(f"Generated {generated_count} annual 1099 reports for {year}")
        
        return {
            "success": True,
            "generated_count": generated_count,
            "errors": errors
        }
    
    # ============== ARCHIVED REPORT REQUESTS ==============
    async def request_archived_report(self, user_id: str, year: int, 
                                      month: int = None) -> Dict:
        """Request an archived report (>5 years old) via inbox"""
        if not self.is_year_archived(year):
            return {"success": False, "error": "This report is not archived. Download directly."}
        
        # Check if report exists
        query = {
            "user_id": user_id,
            "report_year": year,
            "is_archived": True
        }
        if month:
            query["report_month"] = month
        
        existing = await self.db.tax_reports.find_one(query, {"_id": 0})
        if not existing:
            return {"success": False, "error": "No archived report found for this period"}
        
        # Create request via notification service
        if self.notification_service:
            result = await self.notification_service.request_archived_report(
                user_id=user_id,
                report_type="tax_report",
                year=year,
                month=month
            )
            return result
        
        return {"success": False, "error": "Notification service not available"}
    
    async def fulfill_archived_report_request(self, request_id: str) -> Dict:
        """Fulfill an archived report request (auto-process)"""
        # Get request
        request = await self.db.report_requests.find_one({"request_id": request_id}, {"_id": 0})
        if not request:
            return {"success": False, "error": "Request not found"}
        
        # Get the archived report
        query = {
            "user_id": request["user_id"],
            "report_year": request["year"],
            "is_archived": True
        }
        if request.get("month"):
            query["report_month"] = request["month"]
        
        report = await self.db.tax_reports.find_one(query, {"_id": 0})
        if not report:
            return {"success": False, "error": "Archived report not found"}
        
        # Update request status
        await self.db.report_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "fulfilled",
                "fulfilled_at": datetime.now(timezone.utc),
                "report_id": report["report_id"]
            }}
        )
        
        # Notify user
        if self.notification_service:
            await self.notification_service.create_notification(
                user_id=request["user_id"],
                notification_type="archived_report_ready",
                title="Your Archived Report is Ready",
                message=f"Your requested report for {request['year']} is now available in your inbox.",
                data={"report_id": report["report_id"], "request_id": request_id}
            )
        
        return {"success": True, "report_id": report["report_id"]}
