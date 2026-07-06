from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


BASE_DIR = Path(__file__).parent
OUTPUT_PDF = BASE_DIR / "swift-pos-brochure.pdf"


def draw_image_fit(c: canvas.Canvas, image_path: Path, x: float, y: float, max_w: float, max_h: float) -> None:
    image = ImageReader(str(image_path))
    img_w, img_h = image.getSize()
    scale = min(max_w / img_w, max_h / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    c.drawImage(image, x, y + (max_h - draw_h), draw_w, draw_h, mask="auto")


def draw_heading(c: canvas.Canvas, text: str, x: float, y: float) -> None:
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.drawString(x, y, text)


def draw_paragraph(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, leading: float = 14) -> float:
    c.setFont("Helvetica", 10.5)
    c.setFillColor(colors.HexColor("#334155"))
    text_obj = c.beginText(x, y)
    text_obj.setLeading(leading)
    words = text.split()
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if c.stringWidth(candidate, "Helvetica", 10.5) <= max_width:
            line = candidate
        else:
            text_obj.textLine(line)
            line = word
    if line:
        text_obj.textLine(line)
    c.drawText(text_obj)
    return text_obj.getY()


def draw_bullets(c: canvas.Canvas, items: list[str], x: float, y: float, max_width: float) -> float:
    c.setFont("Helvetica", 10.5)
    c.setFillColor(colors.HexColor("#0f172a"))
    bullet_indent = 10
    text_indent = 20
    line_y = y
    for item in items:
        c.circle(x + 4, line_y + 3, 1.6, stroke=0, fill=1)
        line_y = draw_paragraph(c, item, x + text_indent, line_y, max_width - text_indent, leading=14) - 4
    return line_y


def main() -> None:
    hero_image = BASE_DIR / "swift-pos-hero.png"
    inventory_image = BASE_DIR / "swift-pos-inventory.png"
    analytics_image = BASE_DIR / "swift-pos-analytics.png"

    c = canvas.Canvas(str(OUTPUT_PDF), pagesize=letter)
    width, height = letter

    margin = 0.65 * inch
    content_w = width - margin * 2

    # Header band
    c.setFillColor(colors.HexColor("#0ea5a4"))
    c.rect(0, height - 1.15 * inch, width, 1.15 * inch, stroke=0, fill=1)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin, height - 0.75 * inch, "SwiftPOS")
    c.setFont("Helvetica", 12)
    c.drawString(margin, height - 1.05 * inch, "Smart, simple, and fast point-of-sale for modern retail teams")

    # Hero image
    hero_x = margin + content_w * 0.58
    hero_y = height - 3.9 * inch
    draw_image_fit(c, hero_image, hero_x, hero_y, content_w * 0.42, 2.6 * inch)

    # Intro text
    intro_x = margin
    intro_y = height - 1.6 * inch
    draw_heading(c, "What it is", intro_x, intro_y)
    intro_y = draw_paragraph(
        c,
        "SwiftPOS is an all-in-one retail system that helps stores sell faster, track inventory accurately, "
        "and view real-time performance with clean, easy-to-use dashboards. It is designed for day-to-day "
        "operations with a focus on speed at checkout, clear reporting, and dependable inventory control.",
        intro_x,
        intro_y - 16,
        content_w * 0.52,
    )

    draw_heading(c, "Why it matters", intro_x, intro_y - 16)
    draw_paragraph(
        c,
        "Customers move faster, staff stay focused, and owners get clearer insight into what is working. "
        "The result is a smoother checkout experience and better visibility into daily performance.",
        intro_x,
        intro_y - 34,
        content_w * 0.52,
    )

    # Page 1: Features & Value with core benefits
    page1_feature_top = height - 4.6 * inch
    column_gap = 0.4 * inch
    col_w = (content_w - column_gap) / 2

    draw_heading(c, "Features & Value", margin, page1_feature_top)
    draw_paragraph(
        c,
        "SwiftPOS connects sales, inventory, and reporting into one workflow so teams can focus on customers. "
        "Managers get quick visibility into trends, while staff get a simple interface that reduces training time.",
        margin,
        page1_feature_top - 16,
        content_w * 0.95,
    )

    draw_heading(c, "Core benefits", margin, page1_feature_top - 54)
    draw_bullets(
        c,
        [
            "Sell faster with an intuitive checkout flow",
            "Track inventory automatically as you sell",
            "Monitor performance with clear sales dashboards",
            "Reduce errors with categories, variants, and pricing",
            "Stay in control with user access and auditability",
        ],
        margin,
        page1_feature_top - 74,
        content_w * 0.62,
    )

    feature_row_top = height - 7.1 * inch
    left_x = margin
    right_x = margin + col_w + column_gap
    left_y = feature_row_top
    right_y = feature_row_top

    draw_heading(c, "POS & Checkout", left_x, left_y)
    left_y = draw_paragraph(
        c,
        "Process transactions quickly with a clean cart flow and fewer taps at the counter.",
        left_x,
        left_y - 16,
        col_w,
    )
    left_y = draw_bullets(
        c,
        ["Fast item lookup and cart flow", "Variant support (size, color, etc.)", "Multiple payment types"],
        left_x,
        left_y - 10,
        col_w,
    )

    draw_heading(c, "Inventory & Catalog", right_x, right_y)
    right_y = draw_paragraph(
        c,
        "Keep product lists accurate and see stock changes immediately after each sale.",
        right_x,
        right_y - 16,
        col_w,
    )
    right_y = draw_bullets(
        c,
        ["Category management", "Variants and stock tracking", "Low-stock awareness"],
        right_x,
        right_y - 10,
        col_w,
    )

    # Page 1 footer note
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin, 0.5 * inch, "Page 1 of 2")
    c.showPage()

    # Page 2 layout
    c.setFillColor(colors.HexColor("#f1f5f9"))
    c.rect(0, height - 0.7 * inch, width, 0.7 * inch, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, height - 0.42 * inch, "Details & Next Steps")

    # Who it is for
    who_y = height - 1.1 * inch
    draw_heading(c, "Who it is for", margin, who_y)
    draw_bullets(
        c,
        [
            "Retail shops and boutiques",
            "Convenience stores and groceries",
            "Specialty stores and growing teams",
        ],
        margin,
        who_y - 18,
        content_w * 0.9,
    )

    # Section: Key features (page 2)
    feature_top = height - 2.1 * inch
    column_gap = 0.45 * inch
    col_w = (content_w - column_gap) / 2

    draw_heading(c, "Key features", margin, feature_top)
    draw_paragraph(
        c,
        "Everything is organized into simple modules so you can launch quickly and expand over time. "
        "Each feature works together to keep product data, sales, and reporting aligned.",
        margin,
        feature_top - 16,
        content_w * 0.95,
    )

    left_x = margin
    right_x = margin + col_w + column_gap
    left_y = feature_top - 50
    right_y = feature_top - 50

    draw_heading(c, "Sales Analytics", left_x, left_y)
    left_y = draw_paragraph(
        c,
        "Understand performance by time period and identify what products drive revenue.",
        left_x,
        left_y - 16,
        col_w,
    )
    left_y = draw_bullets(
        c,
        ["Sales history by day/week/month/year", "Top-selling products", "Profit insights and exports"],
        left_x,
        left_y - 10,
        col_w,
    )

    draw_heading(c, "Team & Access", right_x, right_y)
    right_y = draw_paragraph(
        c,
        "Give each team member a role and track who handled each transaction for accountability.",
        right_x,
        right_y - 16,
        col_w,
    )
    right_y = draw_bullets(
        c,
        ["User management", "Cashier tracking per transaction"],
        right_x,
        right_y - 10,
        col_w,
    )

    left_y -= 8
    right_y -= 8

    draw_heading(c, "Inventory & Catalog", left_x, left_y)
    left_y = draw_paragraph(
        c,
        "Keep product lists accurate and see stock changes immediately after each sale.",
        left_x,
        left_y - 16,
        col_w,
    )
    left_y = draw_bullets(
        c,
        ["Category management", "Variants and stock tracking", "Low-stock awareness"],
        left_x,
        left_y - 10,
        col_w,
    )

    draw_heading(c, "POS & Checkout", right_x, right_y)
    right_y = draw_paragraph(
        c,
        "Process transactions quickly with a clean cart flow and fewer taps at the counter.",
        right_x,
        right_y - 16,
        col_w,
    )
    right_y = draw_bullets(
        c,
        ["Fast item lookup and cart flow", "Variant support (size, color, etc.)", "Multiple payment types"],
        right_x,
        right_y - 10,
        col_w,
    )

    # Supporting images
    image_row_y = 1.3 * inch
    draw_image_fit(c, inventory_image, margin, image_row_y, content_w * 0.48, 1.6 * inch)
    draw_image_fit(c, analytics_image, margin + content_w * 0.52, image_row_y, content_w * 0.48, 1.6 * inch)

    # Call to action footer
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, 0.95 * inch, "See how SwiftPOS can simplify your sales today.")
    c.setFont("Helvetica", 10.5)
    c.setFillColor(colors.HexColor("#334155"))
    c.drawString(
        margin,
        0.82 * inch,
        "Demo-ready, easy to learn, and built to grow with your store.",
    )
    c.drawString(
        margin,
        0.72 * inch,
        "Contact us for a demo or onboarding:  Name __________________  Email __________________  Phone __________________",
    )

    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin, 0.5 * inch, "Page 2 of 2")

    c.showPage()
    c.save()


if __name__ == "__main__":
    main()
