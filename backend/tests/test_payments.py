"""Backend tests for the new Payment Record feature.
Covers:
  - POST /api/invoices/{id}/payments (validation, accumulation, paid derivation)
  - DELETE /api/invoices/{id}/payments/{payment_id}
  - PUT /api/invoices/{id}/payment  {paid:true/false}
  - GET /api/parties/{id}/payments
  - GET /api/parties/{id}/summary  pending_net / paid_net / pending_count
  - GET /api/stats           pending_net / pending_count consistency
  - GET /api/stats/daybook   paid_net / pending_net consistency
  - PUT /api/invoices/{id}   editing items keeps existing payments & re-derives balance
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://drive-sync-billing.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def party(session):
    r = session.post(f"{API}/parties", json={
        "name": "TEST_PaymentParty",
        "location": "Prayagraj",
        "default_commission_percent": 6.0,
    })
    assert r.status_code == 200, r.text
    p = r.json()
    yield p
    session.delete(f"{API}/parties/{p['id']}")


def _make_invoice(session, party_id, net_target=10000, date="2025-01-20"):
    """Create a simple invoice with items_total ~= net_target (no bhada/mazdoori, 0% commission)."""
    payload = {
        "party_id": party_id,
        "date": date,
        "items": [{"sr": 1, "item": "Apple", "qty": 1, "rate": net_target, "total": net_target}],
        "bhada": 0, "mazdoori": 0, "commission_percent": 0, "sr_total": 1,
    }
    r = session.post(f"{API}/invoices", json=payload)
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["net"] == net_target
    assert inv["paid_amount"] == 0
    assert inv["balance"] == net_target
    assert inv["paid"] is False
    assert inv["payments"] == []
    return inv


class TestAddPayment:
    def test_add_partial_payment(self, session, party):
        inv = _make_invoice(session, party["id"], 10000)
        try:
            r = session.post(f"{API}/invoices/{inv['id']}/payments", json={
                "amount": 3000, "date": "2025-01-21", "mode": "upi", "note": "advance",
            })
            assert r.status_code == 200, r.text
            data = r.json()
            assert "_id" not in data
            assert len(data["payments"]) == 1
            p = data["payments"][0]
            assert p["amount"] == 3000
            assert p["mode"] == "upi"
            assert p["note"] == "advance"
            assert p["date"] == "2025-01-21"
            assert "id" in p
            assert data["paid_amount"] == 3000
            assert data["balance"] == 7000
            assert data["paid"] is False
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")

    def test_amount_must_be_positive(self, session, party):
        inv = _make_invoice(session, party["id"], 5000)
        try:
            for bad in (0, -1, -100.5):
                r = session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": bad})
                assert r.status_code == 400, f"{bad} should be rejected got {r.status_code} {r.text}"
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")

    def test_accumulate_multiple_payments(self, session, party):
        inv = _make_invoice(session, party["id"], 10000)
        try:
            r1 = session.post(f"{API}/invoices/{inv['id']}/payments",
                              json={"amount": 3000, "mode": "cash"})
            r2 = session.post(f"{API}/invoices/{inv['id']}/payments",
                              json={"amount": 2500, "mode": "upi"})
            r3 = session.post(f"{API}/invoices/{inv['id']}/payments",
                              json={"amount": 4500, "mode": "bank"})
            for r in (r1, r2, r3):
                assert r.status_code == 200
            final = r3.json()
            assert len(final["payments"]) == 3
            assert final["paid_amount"] == 10000
            assert final["balance"] == 0
            assert final["paid"] is True
            assert final["paid_at"] is not None
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")

    def test_overpayment_marks_paid_balance_nonneg_in_derivation(self, session, party):
        # add more than net; backend stores raw balance (may be negative) but paid=True.
        inv = _make_invoice(session, party["id"], 5000)
        try:
            r = session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 7000})
            assert r.status_code == 200
            d = r.json()
            assert d["paid_amount"] == 7000
            assert d["paid"] is True
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")


class TestDeletePayment:
    def test_delete_recalculates(self, session, party):
        inv = _make_invoice(session, party["id"], 8000)
        try:
            r1 = session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 3000})
            r2 = session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 5000})
            paid_full = r2.json()
            assert paid_full["paid"] is True
            pid_to_remove = r1.json()["payments"][0]["id"]
            d = session.delete(f"{API}/invoices/{inv['id']}/payments/{pid_to_remove}")
            assert d.status_code == 200
            after = d.json()
            assert len(after["payments"]) == 1
            assert after["paid_amount"] == 5000
            assert after["balance"] == 3000
            assert after["paid"] is False
            assert after["paid_at"] is None
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")


class TestToggleFullPayment:
    def test_mark_paid_fills_balance(self, session, party):
        inv = _make_invoice(session, party["id"], 6000)
        try:
            # start with a partial
            session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 2000})
            r = session.put(f"{API}/invoices/{inv['id']}/payment", json={"paid": True})
            assert r.status_code == 200
            d = r.json()
            assert d["paid"] is True
            assert d["balance"] == 0
            # must have 2 payments now (partial + top-up)
            assert len(d["payments"]) == 2
            topup = d["payments"][-1]
            assert topup["amount"] == 4000
            assert topup["note"] == "पूरा Paid"
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")

    def test_mark_unpaid_clears_payments(self, session, party):
        inv = _make_invoice(session, party["id"], 4000)
        try:
            session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 2000})
            r = session.put(f"{API}/invoices/{inv['id']}/payment", json={"paid": False})
            assert r.status_code == 200
            d = r.json()
            assert d["payments"] == []
            assert d["paid_amount"] == 0
            assert d["balance"] == 4000
            assert d["paid"] is False
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")


class TestEditInvoiceKeepsPayments:
    def test_update_items_preserves_payments(self, session, party):
        inv = _make_invoice(session, party["id"], 10000)
        try:
            # add 4000 payment -> balance 6000
            session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 4000, "mode": "cash"})
            # now change items so net becomes 12000
            new_items = [{"sr": 1, "item": "Apple", "qty": 1, "rate": 12000, "total": 12000}]
            r = session.put(f"{API}/invoices/{inv['id']}", json={"items": new_items})
            assert r.status_code == 200
            d = r.json()
            assert d["items_total"] == 12000
            assert d["net"] == 12000
            assert len(d["payments"]) == 1
            assert d["paid_amount"] == 4000
            assert d["balance"] == 8000
            assert d["paid"] is False
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")

    def test_update_items_can_flip_to_paid(self, session, party):
        inv = _make_invoice(session, party["id"], 10000)
        try:
            session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 10000})
            # reduce items so net becomes 5000 while 10000 already paid
            new_items = [{"sr": 1, "item": "Apple", "qty": 1, "rate": 5000, "total": 5000}]
            r = session.put(f"{API}/invoices/{inv['id']}", json={"items": new_items})
            d = r.json()
            assert d["net"] == 5000
            assert d["paid_amount"] == 10000
            # balance in stored form may be negative; derived paid should be True
            assert d["paid"] is True
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")


class TestPartyPayments:
    def test_party_payments_flat_list(self, session, party):
        inv1 = _make_invoice(session, party["id"], 5000, date="2025-01-10")
        inv2 = _make_invoice(session, party["id"], 7000, date="2025-01-12")
        try:
            session.post(f"{API}/invoices/{inv1['id']}/payments",
                         json={"amount": 2000, "date": "2025-01-11", "mode": "cash"})
            session.post(f"{API}/invoices/{inv2['id']}/payments",
                         json={"amount": 3000, "date": "2025-01-13", "mode": "upi"})
            r = session.get(f"{API}/parties/{party['id']}/payments")
            assert r.status_code == 200
            rows = r.json()
            assert isinstance(rows, list)
            # at least these 2 payments
            inv_ids = {row["invoice_id"] for row in rows}
            assert inv1["id"] in inv_ids and inv2["id"] in inv_ids
            # fields present
            sample = rows[0]
            for k in ("amount", "date", "mode", "invoice_id", "invoice_date", "invoice_net", "id"):
                assert k in sample, f"missing {k} in {sample}"
            # sorted newest first
            dates = [row["date"] for row in rows]
            assert dates == sorted(dates, reverse=True)
        finally:
            session.delete(f"{API}/invoices/{inv1['id']}")
            session.delete(f"{API}/invoices/{inv2['id']}")


class TestPartySummaryConsistency:
    def test_summary_fields(self, session, party):
        inv_paid = _make_invoice(session, party["id"], 5000, date="2025-01-05")
        inv_part = _make_invoice(session, party["id"], 10000, date="2025-01-06")
        inv_open = _make_invoice(session, party["id"], 2000, date="2025-01-07")
        try:
            # full payment for first
            session.post(f"{API}/invoices/{inv_paid['id']}/payments", json={"amount": 5000})
            # partial payment for second
            session.post(f"{API}/invoices/{inv_part['id']}/payments", json={"amount": 3000})
            # no payment for third
            r = session.get(f"{API}/parties/{party['id']}/summary")
            assert r.status_code == 200
            s = r.json()
            # paid_net = 5000+3000 = 8000; pending_net = 0 + 7000 + 2000 = 9000
            assert s["paid_net"] == 8000
            assert s["pending_net"] == 9000
            # pending_count: inv_part and inv_open -> 2
            assert s["pending_count"] == 2
            assert s["count"] == 3
            assert s["total_net"] == 17000
        finally:
            for i in (inv_paid, inv_part, inv_open):
                session.delete(f"{API}/invoices/{i['id']}")


class TestStatsConsistency:
    def test_stats_and_daybook_aggregates(self, session, party):
        inv1 = _make_invoice(session, party["id"], 3000, date="2025-01-08")
        inv2 = _make_invoice(session, party["id"], 5000, date="2025-01-08")
        try:
            session.post(f"{API}/invoices/{inv1['id']}/payments", json={"amount": 1000})
            session.post(f"{API}/invoices/{inv2['id']}/payments", json={"amount": 5000})
            # /stats global aggregate — just check keys and non-negative; our contributions:
            # pending contribution = 2000 (inv1), paid contribution = 1000 + 5000 = 6000
            r = session.get(f"{API}/stats")
            assert r.status_code == 200
            s = r.json()
            for k in ("pending_net", "pending_count", "total_net", "total_commission"):
                assert k in s
            assert s["pending_net"] >= 2000
            assert s["pending_count"] >= 1
            # daybook for that date
            r2 = session.get(f"{API}/stats/daybook",
                             params={"period": "day", "frm": "2025-01-08", "to": "2025-01-08"})
            assert r2.status_code == 200
            d2 = r2.json()
            assert "rows" in d2 and "totals" in d2
            # our two invoices total: net=8000, paid=6000, pending=2000
            assert d2["totals"]["paid_net"] >= 6000
            assert d2["totals"]["pending_net"] >= 2000
            assert d2["totals"]["net"] >= 8000
        finally:
            session.delete(f"{API}/invoices/{inv1['id']}")
            session.delete(f"{API}/invoices/{inv2['id']}")


class TestEdgeCases:
    def test_payment_on_missing_invoice(self, session):
        r = session.post(f"{API}/invoices/does-not-exist/payments", json={"amount": 100})
        assert r.status_code == 404

    def test_delete_payment_missing_invoice(self, session):
        r = session.delete(f"{API}/invoices/does-not-exist/payments/no-pid")
        assert r.status_code == 404

    def test_toggle_payment_missing_invoice(self, session):
        r = session.put(f"{API}/invoices/does-not-exist/payment", json={"paid": True})
        assert r.status_code == 404

    def test_delete_nonexistent_payment_is_noop(self, session, party):
        inv = _make_invoice(session, party["id"], 1000)
        try:
            session.post(f"{API}/invoices/{inv['id']}/payments", json={"amount": 400})
            r = session.delete(f"{API}/invoices/{inv['id']}/payments/not-a-real-id")
            # endpoint doesn't 404 on missing payment id — just filters list — still returns 200
            assert r.status_code == 200
            d = r.json()
            assert d["paid_amount"] == 400
        finally:
            session.delete(f"{API}/invoices/{inv['id']}")
