from datetime import datetime
from io import BytesIO

from openpyxl import Workbook

from excel_import import parse_commission_workbook


def _workbook_bytes(missing_rate_header=False):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Munna Phulpur"
    sheet["C5"] = "जय माँ शारदा फ्रूट सेंटर"
    sheet["C6"] = "मुन्ना भाई फूलपुर"
    sheet["E6"] = "Date:"
    sheet["F6"] = datetime(2026, 5, 18)
    sheet.append([])
    sheet.append(
        ["", "SR", "ITEM", "QTY", "" if missing_rate_header else "RATE", "TOTAL"]
    )
    sheet.append(["", 40, "केला", 40, 550, 22000])
    sheet.append(["", 5, "केला", 5, 500, 2500])
    sheet.append(["", 30, "बादाम M", 630, 35, 22050])
    sheet.append(["", 75, "", "", "TOTAL", 46550])
    sheet.append([])
    sheet.append(["", "भाड़ा", 1700])
    sheet.append(["", "मजदूरी", 225])
    sheet.append(["", "कमीशन (6%)", 2793])
    sheet.append(["", "खर्च टोटल", 4718, "नेट", "", 41832])
    sheet["C18"] = "जय माँ शारदा फ्रूट सेंटर"
    sheet["B19"] = "फ्रूट के थोक विक्रेता एवं कमीशन एजेंट"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_parse_commission_invoice_workbook():
    invoices, warnings = parse_commission_workbook(_workbook_bytes())

    assert warnings == []
    assert len(invoices) == 1
    invoice = invoices[0]
    assert invoice["party_name"] == "मुन्ना भाई फूलपुर"
    assert invoice["date"] == "2026-05-18"
    assert invoice["sr_total"] == 75
    assert invoice["items"] == [
        {"sr": 40, "item": "केला", "qty": 40, "rate": 550, "total": 22000},
        {"sr": 5, "item": "केला", "qty": 5, "rate": 500, "total": 2500},
        {"sr": 30, "item": "बादाम M", "qty": 630, "rate": 35, "total": 22050},
    ]
    assert invoice["bhada"] == 1700
    assert invoice["mazdoori"] == 225
    assert invoice["commission_percent"] == 6


def test_skip_repeat_imports_can_be_keyed_by_source_row():
    invoices, _ = parse_commission_workbook(_workbook_bytes())
    assert invoices[0]["sheet_name"] == "Munna Phulpur"
    assert invoices[0]["source_row"] == 6


def test_import_recovers_when_rate_heading_is_blank():
    invoices, warnings = parse_commission_workbook(
        _workbook_bytes(missing_rate_header=True)
    )

    assert warnings == []
    assert len(invoices) == 1
    assert invoices[0]["items"][0]["rate"] == 550


def test_warn_when_sheet_net_does_not_match_app_math():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Munna Phulpur"
    sheet["C5"] = "मुन्ना भाई फूलपुर"
    sheet["E5"] = "Date:"
    sheet["F5"] = "18/05/26"
    sheet.append([])
    sheet.append(["", "SR", "ITEM", "QTY", "RATE", "TOTAL"])
    sheet.append(["", 1, "केला", 10, 100, 1000])
    sheet.append(["", "", "", "", "TOTAL", 1000])
    sheet.append([])
    sheet.append(["", "भाड़ा", 10])
    sheet.append(["", "मजदूरी", 5])
    sheet.append(["", "कमीशन (6%)", 60])
    sheet.append(["", "खर्च टोटल", 75, "नेट", "", 900])
    output = BytesIO()
    workbook.save(output)

    invoices, warnings = parse_commission_workbook(output.getvalue())

    assert len(invoices) == 1
    assert any("net amount differs" in warning for warning in warnings)
