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
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import base64
from bson import ObjectId

logger = logging.getLogger(__name__)

# Constants
CURRENT_YEAR = datetime.now(timezone.utc).year
YEARS_AVAILABLE = 5  # Current year + 4 previous years
# Use the same logo as regular reports (blue/yellow trimmed logo)
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets')
LOGO_PATH = os.path.join(ASSETS_DIR, 'mh_logo_trimmed.png')

# Font paths for Hindi/Devanagari support
NOTO_DEVANAGARI_PATH = os.path.join(ASSETS_DIR, 'NotoSansDevanagari-Regular.ttf')
NOTO_SANS_PATH = os.path.join(ASSETS_DIR, 'NotoSans-Regular.ttf')
NOTO_SANS_BOLD_PATH = os.path.join(ASSETS_DIR, 'NotoSans-Bold.ttf')

# Register fonts for Hindi support - force re-registration each time
def register_fonts():
    """Register custom fonts for Hindi/Devanagari support"""
    try:
        # Check if font is already registered
        try:
            pdfmetrics.getFont('NotoDevanagari')
            logger.debug("NotoDevanagari font already registered")
        except KeyError:
            # Register Noto Sans Devanagari for Hindi text
            if os.path.exists(NOTO_DEVANAGARI_PATH):
                pdfmetrics.registerFont(TTFont('NotoDevanagari', NOTO_DEVANAGARI_PATH))
                logger.info("Registered NotoSansDevanagari font")
            else:
                logger.warning(f"Devanagari font not found at {NOTO_DEVANAGARI_PATH}")
        
        try:
            pdfmetrics.getFont('NotoSans')
        except KeyError:
            if os.path.exists(NOTO_SANS_PATH):
                pdfmetrics.registerFont(TTFont('NotoSans', NOTO_SANS_PATH))
                logger.info("Registered NotoSans font")
        
        try:
            pdfmetrics.getFont('NotoSansBold')
        except KeyError:
            if os.path.exists(NOTO_SANS_BOLD_PATH):
                pdfmetrics.registerFont(TTFont('NotoSansBold', NOTO_SANS_BOLD_PATH))
                logger.info("Registered NotoSansBold font")
        
    except Exception as e:
        logger.error(f"Failed to register fonts: {e}")

def get_font_name(lang: str = "en", bold: bool = False) -> str:
    """Get appropriate font name based on language"""
    if lang == "hi":
        return 'NotoDevanagari'
    return 'NotoSansBold' if bold else 'NotoSans'

# PDF Translation Strings
PDF_TRANSLATIONS = {
    "en": {
        "monthly_statement": "Monthly {user_type} Statement",
        "name": "Name",
        "email": "Email",
        "user_id": "User ID",
        "summary": "Summary",
        "description": "Description",
        "amount": "Amount",
        "total_transactions": "Total Transactions",
        "total_amount": "Total Amount",
        "platform_fees": "Platform Fees",
        "net_payouts": "Net Payouts",
        "transaction_details": "Transaction Details",
        "date": "Date",
        "type": "Type",
        "funding_source": "Funding Source",
        "generated_on": "Generated on {date}",
        "disclaimer": "This document is for informational purposes. Please consult a tax professional.",
        "form_1099": "Form 1099-K Equivalent - Tax Year {year}",
        "payment_card_transactions": "Payment Card and Third Party Network Transactions",
        "annual_payment_summary": "Annual Payment Summary - Tax Year {year}",
        "educational_payments": "Record of Educational Service Payments",
        "payer_info": "PAYER'S Information",
        "platform_name": "Maestro Habitat Inc.",
        "platform_desc": "Platform for Educational Services",
        "payee_info": "PAYEE'S Information",
        "annual_summary": "Annual Summary",
        "box": "Box",
        "gross_amount": "Gross Amount of Payment Card/Third Party Network Transactions",
        "platform_fees_deducted": "Platform Fees Deducted",
        "net_earnings": "Net Earnings (Payouts)",
        "total_paid": "Total Amount Paid",
        "monthly_breakdown": "Monthly Breakdown",
        "month": "Month",
        "transactions": "Transactions",
        "gross": "Gross",
        "fees": "Fees",
        "net": "Net",
        "no_activity": "No activity",
    },
    "hi": {
        "monthly_statement": "मासिक {user_type} विवरण",
        "name": "नाम",
        "email": "ईमेल",
        "user_id": "उपयोगकर्ता आईडी",
        "summary": "सारांश",
        "description": "विवरण",
        "amount": "राशि",
        "total_transactions": "कुल लेनदेन",
        "total_amount": "कुल राशि",
        "platform_fees": "प्लेटफ़ॉर्म शुल्क",
        "net_payouts": "शुद्ध भुगतान",
        "transaction_details": "लेनदेन विवरण",
        "date": "तिथि",
        "type": "प्रकार",
        "funding_source": "धनराशि स्रोत",
        "generated_on": "{date} को जनरेट किया गया",
        "disclaimer": "यह दस्तावेज़ सूचनात्मक उद्देश्यों के लिए है। कृपया कर पेशेवर से परामर्श करें।",
        "form_1099": "फॉर्म 1099-K समकक्ष - कर वर्ष {year}",
        "payment_card_transactions": "भुगतान कार्ड और तृतीय पक्ष नेटवर्क लेनदेन",
        "annual_payment_summary": "वार्षिक भुगतान सारांश - कर वर्ष {year}",
        "educational_payments": "शैक्षिक सेवा भुगतानों का रिकॉर्ड",
        "payer_info": "भुगतानकर्ता की जानकारी",
        "platform_name": "मास्ट्रो हैबिटेट इंक.",
        "platform_desc": "शैक्षिक सेवाओं के लिए प्लेटफ़ॉर्म",
        "payee_info": "प्राप्तकर्ता की जानकारी",
        "annual_summary": "वार्षिक सारांश",
        "box": "बॉक्स",
        "gross_amount": "भुगतान कार्ड/तृतीय पक्ष नेटवर्क लेनदेन की कुल राशि",
        "platform_fees_deducted": "प्लेटफ़ॉर्म शुल्क कटौती",
        "net_earnings": "शुद्ध आय (भुगतान)",
        "total_paid": "कुल भुगतान राशि",
        "monthly_breakdown": "मासिक विवरण",
        "month": "महीना",
        "transactions": "लेनदेन",
        "gross": "कुल",
        "fees": "शुल्क",
        "net": "शुद्ध",
        "no_activity": "कोई गतिविधि नहीं",
    }
}

def get_pdf_text(key: str, lang: str = "en", **kwargs) -> str:
    """Get translated text for PDF generation"""
    translations = PDF_TRANSLATIONS.get(lang, PDF_TRANSLATIONS["en"])
    text = translations.get(key, PDF_TRANSLATIONS["en"].get(key, key))
    return text.format(**kwargs) if kwargs else text


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
        # Get user info - try both ObjectId and user_id field
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        except:
            user = await self.db.users.find_one({"user_id": user_id})
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
        # Get user info - try both ObjectId and user_id field
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        except:
            user = await self.db.users.find_one({"user_id": user_id})
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
                              total_fees: int, total_payouts: int, lang: str = "en") -> str:
        """Generate monthly summary PDF and return as base64"""
        # Register fonts for Hindi support
        register_fonts()
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        # Get the appropriate font based on language
        font_name = get_font_name(lang)
        
        styles = getSampleStyleSheet()
        
        # Create language-aware styles
        heading2_style = ParagraphStyle('Heading2Custom', parent=styles['Heading2'], fontName=font_name, fontSize=14)
        heading3_style = ParagraphStyle('Heading3Custom', parent=styles['Heading3'], fontName=font_name, fontSize=12)
        normal_style = ParagraphStyle('NormalCustom', parent=styles['Normal'], fontName=font_name, fontSize=10)
        
        month_name = datetime(year, month, 1).strftime('%B')
        # Translate month names for Hindi
        if lang == "hi":
            month_names_hi = {
                'January': 'जनवरी', 'February': 'फ़रवरी', 'March': 'मार्च', 'April': 'अप्रैल',
                'May': 'मई', 'June': 'जून', 'July': 'जुलाई', 'August': 'अगस्त',
                'September': 'सितंबर', 'October': 'अक्टूबर', 'November': 'नवंबर', 'December': 'दिसंबर'
            }
            month_name = month_names_hi.get(month_name, month_name)
        
        currency = transactions[0].get("currency", "USD") if transactions else "USD"
        currency_symbol = "$" if currency == "USD" else "₹"
        
        elements = []
        
        # Logo Header
        if os.path.exists(LOGO_PATH):
            try:
                logo = Image(LOGO_PATH, width=0.75*inch, height=1*inch)
                logo.hAlign = 'LEFT'
                elements.append(logo)
                elements.append(Spacer(1, 8))
            except Exception as e:
                logger.warning(f"Failed to add logo to PDF: {e}")
        
        # Header - use Latin font for brand name
        brand_title_style = ParagraphStyle('BrandTitle', parent=styles['Heading1'], fontSize=20,
                                           textColor=colors.HexColor('#2563EB'), fontName='NotoSans')
        elements.append(Paragraph("Maestro Habitat", brand_title_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(get_pdf_text("monthly_statement", lang, user_type=user_type.title()), heading2_style))
        elements.append(Paragraph(f"{month_name} {year}", normal_style))
        elements.append(Spacer(1, 24))
        
        # User info
        elements.append(Paragraph(f"<b>{get_pdf_text('name', lang)}:</b> {user.get('name', 'N/A')}", normal_style))
        elements.append(Paragraph(f"<b>{get_pdf_text('email', lang)}:</b> {user.get('email', 'N/A')}", normal_style))
        elements.append(Paragraph(f"<b>{get_pdf_text('user_id', lang)}:</b> {user.get('user_id', 'N/A')}", normal_style))
        elements.append(Spacer(1, 24))
        
        # Summary
        elements.append(Paragraph(f"<b>{get_pdf_text('summary', lang)}</b>", heading3_style))
        summary_data = [
            [get_pdf_text('description', lang), get_pdf_text('amount', lang)],
            [get_pdf_text('total_transactions', lang), str(len(transactions))],
            [get_pdf_text('total_amount', lang), f"{currency_symbol}{total_amount/100:.2f}"],
        ]
        if user_type == "provider":
            summary_data.append([get_pdf_text('platform_fees', lang), f"{currency_symbol}{total_fees/100:.2f}"])
            summary_data.append([get_pdf_text('net_payouts', lang), f"{currency_symbol}{total_payouts/100:.2f}"])
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 24))
        
        # Transaction list
        elements.append(Paragraph(f"<b>{get_pdf_text('transaction_details', lang)}</b>", heading3_style))
        txn_data = [[get_pdf_text('date', lang), get_pdf_text('type', lang), get_pdf_text('amount', lang), get_pdf_text('funding_source', lang)]]
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
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(txn_table)
        elements.append(Spacer(1, 24))
        
        # Footer
        elements.append(Paragraph(
            f"<i>{get_pdf_text('generated_on', lang, date=datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))}</i>",
            normal_style
        ))
        elements.append(Paragraph(
            f"<i>{get_pdf_text('disclaimer', lang)}</i>",
            normal_style
        ))
        
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return base64.b64encode(pdf_bytes).decode('utf-8')
    
    def _generate_annual_pdf(self, user: Dict, user_type: str, year: int,
                            monthly_breakdown: Dict, total_amount: int,
                            total_fees: int, total_payouts: int,
                            transaction_count: int, lang: str = "en") -> str:
        """Generate annual 1099-style PDF and return as base64"""
        # Register fonts for Hindi support
        register_fonts()
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        # Get the appropriate font based on language
        font_name = get_font_name(lang)
        
        styles = getSampleStyleSheet()
        
        # Create language-aware styles
        heading2_style = ParagraphStyle('Heading2Custom', parent=styles['Heading2'], fontName=font_name, fontSize=14)
        heading3_style = ParagraphStyle('Heading3Custom', parent=styles['Heading3'], fontName=font_name, fontSize=12)
        normal_style = ParagraphStyle('NormalCustom', parent=styles['Normal'], fontName=font_name, fontSize=10)
        
        # Determine currency from user's market
        currency_symbol = "$"
        
        # Hindi month names for localization
        month_names_en = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        month_names_hi = ['', 'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']
        month_names = month_names_hi if lang == "hi" else month_names_en
        
        elements = []
        
        # Logo Header
        if os.path.exists(LOGO_PATH):
            try:
                logo = Image(LOGO_PATH, width=0.75*inch, height=1*inch)
                logo.hAlign = 'LEFT'
                elements.append(logo)
                elements.append(Spacer(1, 8))
            except Exception as e:
                logger.warning(f"Failed to add logo to PDF: {e}")
        
        # Header - use Latin font for brand name
        brand_title_style = ParagraphStyle('BrandTitle', parent=styles['Heading1'], fontSize=20,
                                           textColor=colors.HexColor('#2563EB'), fontName='NotoSans')
        elements.append(Paragraph("Maestro Habitat", brand_title_style))
        elements.append(Spacer(1, 12))
        if user_type == "provider":
            elements.append(Paragraph(get_pdf_text("form_1099", lang, year=year), heading2_style))
            elements.append(Paragraph(get_pdf_text("payment_card_transactions", lang), normal_style))
        else:
            elements.append(Paragraph(get_pdf_text("annual_payment_summary", lang, year=year), heading2_style))
            elements.append(Paragraph(get_pdf_text("educational_payments", lang), normal_style))
        elements.append(Spacer(1, 24))
        
        # Platform info
        elements.append(Paragraph(f"<b>{get_pdf_text('payer_info', lang)}</b>", heading3_style))
        elements.append(Paragraph(get_pdf_text("platform_name", lang), normal_style))
        elements.append(Paragraph(get_pdf_text("platform_desc", lang), normal_style))
        elements.append(Spacer(1, 16))
        
        # Recipient info
        elements.append(Paragraph(f"<b>{get_pdf_text('payee_info', lang)}</b>", heading3_style))
        elements.append(Paragraph(f"{get_pdf_text('name', lang)}: {user.get('name', 'N/A')}", normal_style))
        elements.append(Paragraph(f"{get_pdf_text('email', lang)}: {user.get('email', 'N/A')}", normal_style))
        elements.append(Paragraph(f"{get_pdf_text('user_id', lang)}: {user.get('user_id', 'N/A')}", normal_style))
        elements.append(Spacer(1, 24))
        
        # Annual Summary
        elements.append(Paragraph(f"<b>{get_pdf_text('annual_summary', lang)}</b>", heading3_style))
        summary_data = [
            [get_pdf_text('box', lang), get_pdf_text('description', lang), get_pdf_text('amount', lang)],
            ['1a', get_pdf_text('gross_amount', lang), f"{currency_symbol}{total_amount/100:,.2f}"],
        ]
        if user_type == "provider":
            summary_data.append(['1b', get_pdf_text('platform_fees_deducted', lang), f"{currency_symbol}{total_fees/100:,.2f}"])
            summary_data.append(['', get_pdf_text('net_earnings', lang), f"{currency_symbol}{total_payouts/100:,.2f}"])
        summary_data.append(['5a', get_pdf_text('total_transactions', lang), str(transaction_count)])
        
        summary_table = Table(summary_data, colWidths=[0.6*inch, 3.5*inch, 1.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 24))
        
        # Monthly breakdown
        elements.append(Paragraph(f"<b>{get_pdf_text('monthly_breakdown', lang)}</b>", heading3_style))
        month_data = [[get_pdf_text('month', lang), get_pdf_text('transactions', lang), get_pdf_text('amount', lang), get_pdf_text('fees', lang)]]
        
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
        
        month_table = Table(month_data, colWidths=[1.2*inch, 1.2*inch, 1.5*inch, 1.5*inch])
        month_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        elements.append(month_table)
        elements.append(Spacer(1, 24))
        
        # Important notice - translated
        important_notice_title = "महत्वपूर्ण कर जानकारी" if lang == "hi" else "Important Tax Information"
        important_notice_text1 = ("यह दस्तावेज़ मास्ट्रो हैबिटेट के माध्यम से संसाधित भुगतान लेनदेन का सारांश प्रस्तुत करता है। "
                                  "यह आपके रिकॉर्ड और कर तैयारी में सहायता के लिए प्रदान किया गया है। "
                                  "यह कोई आधिकारिक IRS फॉर्म नहीं है लेकिन इसमें आपकी कर रिपोर्टिंग आवश्यकताओं के लिए समकक्ष जानकारी है।") if lang == "hi" else \
                                 ("This document summarizes payment transactions processed through Maestro Habitat. "
                                  "It is provided for your records and to assist with tax preparation. "
                                  "This is NOT an official IRS form but contains equivalent information for your tax reporting needs.")
        important_notice_text2 = ("कृपया इस दस्तावेज़ को अपने रिकॉर्ड के लिए रखें और अपने कर रिटर्न पर "
                                  "इन राशियों की रिपोर्टिंग के बारे में सलाह के लिए एक योग्य कर पेशेवर से परामर्श करें।") if lang == "hi" else \
                                 ("Please retain this document for your records and consult with a qualified tax professional "
                                  "for advice on reporting these amounts on your tax return.")
        
        elements.append(Paragraph(f"<b>{important_notice_title}</b>", heading3_style))
        elements.append(Paragraph(important_notice_text1, normal_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(important_notice_text2, normal_style))
        elements.append(Spacer(1, 24))
        
        # Footer
        doc_generated = "दस्तावेज़ जनरेट:" if lang == "hi" else "Document generated:"
        elements.append(Paragraph(
            f"<i>{doc_generated} {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
            normal_style
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
    
    async def download_report(self, report_id: str, user_id: str, lang: str = "en") -> Optional[bytes]:
        """Get PDF bytes for download, regenerating with the specified language"""
        report = await self.db.tax_reports.find_one(
            {"report_id": report_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not report:
            return None
        
        # Check if archived
        if report.get("is_archived"):
            return None  # Must request through inbox
        
        # If language is not English, regenerate the PDF with translations
        if lang != "en":
            user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
            if not user:
                return None
            
            user_type = report.get("user_type", "consumer")
            year = report.get("report_year")
            month = report.get("report_month")
            
            # Get transaction data to regenerate PDF
            if month:  # Monthly report
                start_date = datetime(year, month, 1, tzinfo=timezone.utc)
                if month == 12:
                    end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
                else:
                    end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
                
                transactions = await self.db.payment_transactions.find({
                    "user_id": user_id,
                    "user_type": user_type,
                    "payment_date": {"$gte": start_date, "$lt": end_date},
                    "status": "completed"
                }).to_list(1000)
                
                total_amount = sum(t.get("amount_cents", 0) for t in transactions)
                total_fees = sum(t.get("platform_fee_cents", 0) for t in transactions)
                total_payouts = sum(t.get("payout_amount_cents", 0) for t in transactions)
                
                pdf_base64 = self._generate_monthly_pdf(
                    user, user_type, year, month, transactions,
                    total_amount, total_fees, total_payouts, lang=lang
                )
            else:  # Annual report
                start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
                end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
                
                transactions = await self.db.payment_transactions.find({
                    "user_id": user_id,
                    "user_type": user_type,
                    "payment_date": {"$gte": start_date, "$lt": end_date},
                    "status": "completed"
                }).to_list(10000)
                
                total_amount = sum(t.get("amount_cents", 0) for t in transactions)
                total_fees = sum(t.get("platform_fee_cents", 0) for t in transactions)
                total_payouts = sum(t.get("payout_amount_cents", 0) for t in transactions)
                
                # Build monthly breakdown
                monthly_breakdown = {}
                for t in transactions:
                    m = t.get("payment_date").month if hasattr(t.get("payment_date"), "month") else 1
                    if m not in monthly_breakdown:
                        monthly_breakdown[m] = {"amount": 0, "fees": 0, "count": 0}
                    monthly_breakdown[m]["amount"] += t.get("amount_cents", 0)
                    monthly_breakdown[m]["fees"] += t.get("platform_fee_cents", 0)
                    monthly_breakdown[m]["count"] += 1
                
                pdf_base64 = self._generate_annual_pdf(
                    user, user_type, year, monthly_breakdown,
                    total_amount, total_fees, total_payouts,
                    len(transactions), lang=lang
                )
            
            return base64.b64decode(pdf_base64)
        
        # English - use stored PDF
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
