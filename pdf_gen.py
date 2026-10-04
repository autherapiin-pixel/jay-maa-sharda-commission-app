"""Invoice PDF that mirrors the paper/Excel layout (fpdf2 + Noto Sans Devanagari)."""
from pathlib import Path

from fpdf import FPDF

FONT_DIR = Path(__file__).parent / "fonts"


def _hex(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _money(v) -> str:
    try:
        v = float(v or 0)
    except (TypeError, ValueError):
        return ""
    if v == int(v):
        return f"{int(v):,}"
    return f"{v:,.2f}"


def build_invoice_pdf(inv: dict, settings: dict, photo: bytes | None = None) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.add_font("deva", "", str(FONT_DIR / "LiberationSans-Regular.ttf"))
    pdf.add_font("deva", "B", str(FONT_DIR / "LiberationSans-Bold.ttf"))
    pdf.add_font("hin", "", str(FONT_DIR / "NotoSansDevanagari-Regular.ttf"))
    pdf.add_font("hin", "B", str(FONT_DIR / "NotoSansDevanagari-Bold.ttf"))
    pdf.set_fallback_fonts(["hin"])
    pdf.set_text_shaping(True)

    W = pdf.w - pdf.l_margin - pdf.r_margin
    x0 = pdf.l_margin

    def hcell(w, h, text, **kw):
        fam, style, size = pdf.font_family, pdf.font_style, pdf.font_size_pt
        pdf.set_font("hin", style, size)
        pdf.cell(w, h, text, **kw)
        pdf.set_font(fam, style, size)

    def band(text, bg, fg, size, h):
        pdf.set_fill_color(*_hex(bg))
        pdf.set_text_color(*_hex(fg))
        pdf.set_font("deva", "B", size)
        pdf.cell(W, h, text, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

    band(settings.get("shop_name", ""), "F59E0B", "000000", 18, 14)
    band(settings.get("shop_tagline", ""), "86C33B", "000000", 11, 9)
    band(settings.get("shop_address", ""), "1F1F1F", "FFFFFF", 10, 8)

    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.3)
    # party / date row
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("deva", "B", 11)
    hcell(W * 0.18, 9, " पार्टी नाम:", border=1)
    pdf.cell(W * 0.47, 9, " " + (inv.get("party_name") or ""), border=1)
    pdf.cell(W * 0.13, 9, " Date:", border=1)
    pdf.cell(W * 0.22, 9, " " + (inv.get("date") or ""), border=1, new_x="LMARGIN", new_y="NEXT")

    # table head
    cols = [("SR", 0.12), ("ITEM", 0.40), ("QTY", 0.14), ("RATE", 0.14), ("TOTAL", 0.20)]
    pdf.set_fill_color(*_hex("111111"))
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("deva", "B", 10)
    for label, frac in cols:
        pdf.cell(W * frac, 8, label, border=1, align="C", fill=True)
    pdf.ln(8)

    pdf.set_text_color(0, 0, 0)
    pdf.set_font("deva", "", 10)
    items = inv.get("items") or []
    rows = max(8, len(items))
    for i in range(rows):
        it = items[i] if i < len(items) else {}
        vals = [
            str(it.get("sr") or "") if it else "",
            (it.get("item") or "") if it else "",
            _money(it.get("qty")) if it and it.get("qty") else "",
            _money(it.get("rate")) if it and it.get("rate") else "",
            _money(it.get("total")) if it and it.get("total") is not None else "",
        ]
        for (label, frac), v in zip(cols, vals):
            fill = label == "TOTAL"
            if fill:
                pdf.set_fill_color(*_hex("CFE7F6"))
            pdf.cell(W * frac, 7.5, (" " + v) if label == "ITEM" else v,
                     border=1, align="L" if label == "ITEM" else "C", fill=fill)
        pdf.ln(7.5)

    # SR total + TOTAL row
    pdf.set_font("deva", "B", 10)
    pdf.set_fill_color(*_hex("F4B678"))
    pdf.cell(W * 0.12, 8, _money(inv.get("sr_total")) if inv.get("sr_total") else "", border=1, align="C", fill=True)
    pdf.cell(W * 0.54, 8, "", border=1, fill=True)
    pdf.cell(W * 0.14, 8, "TOTAL", border=1, align="C", fill=True)
    pdf.set_fill_color(*_hex("CFE7F6"))
    pdf.cell(W * 0.20, 8, _money(inv.get("items_total")), border=1, align="C", fill=True)
    pdf.ln(12)

    # expense block
    pct = inv.get("commission_percent", 6.0) or 0
    pct_txt = f"{pct:g}"
    exp_rows = [
        ("भाड़ा", inv.get("bhada", 0)),
        ("मजदूरी", inv.get("mazdoori", 0)),
        (f"कमीशन ({pct_txt}%)", inv.get("commission", 0)),
        ("खर्च टोटल", inv.get("kharch_total", 0)),
    ]
    for label, val in exp_rows:
        pdf.set_fill_color(*_hex("DCE9F7"))
        pdf.set_font("deva", "B", 10)
        hcell(W * 0.52, 8, " " + label, border=1, fill=True)
        pdf.set_font("deva", "", 10)
        pdf.cell(W * 0.14, 8, _money(val), border=1, align="C")
        pdf.cell(W * 0.34, 8, "", border=1)
        pdf.ln(8)

    # NET
    pdf.set_font("deva", "B", 12)
    pdf.cell(W * 0.66, 9, "", border=1)
    pdf.set_fill_color(*_hex("FFEF00"))
    hcell(W * 0.14, 9, "नेट", border=1, align="C", fill=True)
    pdf.cell(W * 0.20, 9, _money(inv.get("net")), border=1, align="C", fill=True)
    pdf.ln(9)

    # Payment status
    paid_amount = inv.get("paid_amount") or 0
    balance = inv.get("balance")
    if balance is None:
        balance = (inv.get("net") or 0) - paid_amount
    if paid_amount or (inv.get("payments") or []):
        pdf.ln(2)
        pdf.set_font("deva", "B", 10)
        pdf.cell(W * 0.66, 8, "", border=0)
        pdf.set_fill_color(*_hex("DCFCE7"))
        hcell(W * 0.14, 8, "दिया", border=1, align="C", fill=True)
        pdf.cell(W * 0.20, 8, _money(paid_amount), border=1, align="C", fill=True)
        pdf.ln(8)
        pdf.cell(W * 0.66, 8, "", border=0)
        pdf.set_fill_color(*_hex("FEE2E2" if balance > 0.005 else "DCFCE7"))
        hcell(W * 0.14, 8, "बाकी", border=1, align="C", fill=True)
        pdf.cell(W * 0.20, 8, _money(max(balance, 0)), border=1, align="C", fill=True)
        pdf.ln(8)

    desc = (inv.get("description") or inv.get("note") or "").strip()
    if desc:
        pdf.ln(3)
        pdf.set_font("deva", "B", 10)
        hcell(W, 6, "विवरण:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("deva", "", 10)
        pdf.multi_cell(W, 6, desc)

    if photo:
        try:
            from io import BytesIO
            pdf.ln(4)
            y = pdf.get_y()
            max_h = pdf.h - pdf.b_margin - y
            if max_h < 50:
                pdf.add_page()
                max_h = pdf.h - pdf.b_margin - pdf.get_y()
            pdf.image(BytesIO(photo), x=x0, w=min(W, 120), h=min(max_h, 110), keep_aspect_ratio=True)
        except Exception:
            pass

    return bytes(pdf.output())
