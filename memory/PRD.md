# Commission Invoice App — PRD

## Problem
A fruit market commission agent needs a mobile app to recreate the hand-written
invoice format shown by the user (जय माँ शारदा फ्रूट सेंटर). Each invoice
contains: shop header, party name & date, item rows (SR, item, qty, rate,
total), SR total, items total, bhada, mazdoori, commission (default 6% of items
total), kharch total (bhada + mazdoori + commission), and net (items total −
kharch total). The user wants to add new parties, search existing ones, keep
each party's invoices together (folder-like), edit them, and export a clean
Excel version — Google Drive/Sheets sync is a planned follow-up (needs OAuth).

## Stack
- Expo React Native (expo-router tabs)
- FastAPI backend
- MongoDB (motor)
- openpyxl for Excel export
- Theme: warm Indian bazaar palette (amber brand, cream canvas), invoice renders
  with the exact orange/green/dark/table-blue bands from the reference photo.

## Backend (`/app/backend/server.py`)
- Models: `Settings`, `Party`, `Invoice`, `InvoiceItem`
- Endpoints (all under `/api`):
  - `GET /settings`, `PUT /settings`
  - `GET /parties?q=`, `POST /parties`, `GET /parties/{id}`, `PUT /parties/{id}`, `DELETE /parties/{id}`
  - `GET /invoices?party_id=`, `POST /invoices`, `GET /invoices/{id}`, `PUT /invoices/{id}`, `DELETE /invoices/{id}`
  - `GET /stats`
  - `GET /invoices/{id}/export` — single-sheet styled .xlsx
  - `GET /parties/{id}/export` — one sheet per invoice (party "folder" as workbook)
- Server computes `items_total`, `commission`, `kharch_total`, `net` so the UI
  and Excel always agree.
- Content-Disposition filenames are ASCII-sanitized to avoid latin-1 encode
  errors on Hindi party names.

## Frontend
- Tabs: Home (stats + recent invoices), Parties (search + add), New Bill
  (party picker), Settings
- `/party/[id]` — party detail with its invoice list, "+ नयी इनवॉइस" and
  per-party Excel export
- `/invoice/new?partyId=` — opens the invoice form in create mode
- `/invoice/[id]` — opens the same form in edit mode (update / Excel / delete)
- Settings can import the party-wise `.xlsx` workbook; party sheets and invoice
  blocks are parsed into the account, repeated source rows are skipped, and
  calculation mismatches are returned as warnings. Imported bills can be
  pushed to Drive/Sheets afterward with Settings → Sync All.
- The in-app invoice form renders the exact paper layout: orange shop band,
  green tagline band, dark address band, boxed SR/ITEM/QTY/RATE/TOTAL table
  (TOTAL column tinted blue), orange SR+TOTAL summary row, blue expense block,
  yellow NET row.

## Payment Record (built)
- Invoice has `payments[]` ({id, amount, date, mode cash/upi/bank/cheque, note}); server
  derives `paid_amount`, `balance`, `paid` (balance ≤ 0). Legacy paid flags migrated on startup.
- Endpoints: `POST /invoices/{id}/payments`, `DELETE /invoices/{id}/payments/{pid}`,
  `PUT /invoices/{id}/payment` (quick full-paid / clear), `GET /parties/{id}/payments`.
- Summary/stats/daybook use received (`paid_net`) and balance (`pending_net`).
- UI: `src/components/payment-section.tsx` inside the invoice edit screen; party cards show
  Paid / Partial / बाकी chips; WhatsApp message includes मिला/बाकी.

## Not yet built (next steps)
- Google OAuth → push invoices to a Google Sheet per party and folders in
  Google Drive (requires user to provide Google Cloud OAuth credentials)
- Native share for the exported Excel on Android/iOS
- Multi-user authentication
