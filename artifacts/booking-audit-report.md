# Booking audit — 2026-10-25

Result: passed after fixing ledger/reporting edge cases. Working salon records were read only.

## Actual working data

| Check | Result |
|---|---|
| Bookings / clients | 4 / 4 |
| Booking items / advance receipts | 4 / 4 |
| Linked final invoices | 3 |
| Cash booking movements | 4 |
| Bank booking movements | 0 |
| Net booking receipts | PKR 14,000 |
| Cash custody net | PKR 14,000 |
| Income & Expense deposit cash flow | PKR 14,000 |
| Deposit recognized as service revenue | PKR 0 |
| Client ledger balances | All 4 matched database balances |
| Sales report booking invoice rows | 3, matching the database |

The frontend uses the live API. The browser opened all four actual client ledgers and the
actual Income & Expense report. No booking, client or report response was mocked. Non-GET
API calls were blocked in the browser, and no test transaction was created in the working
salon database. The short-lived audit access token was kept in memory and not saved.

## Fixes verified

- Client ledger advance credit is matched to its own booking/invoice, rather than suppressed
  by an unrelated booking payment.
- Client cancellation charges, invoice refunds/voids and collection reversals reconcile.
  Tips remain separate from invoiced bill dues; unapplied advances remain customer credits.
- Invoice API responses now contain normalized refund history for the client ledger.
- Invoice revenue and void/refund reversals retain their respective business dates. A void
  no longer removes the original invoice and subtracts its reversal a second time.
- Booking ledger dates use transaction/business dates for invoice payments and reversals.
- Report cash columns and exports preserve refund signs and do not repeat cumulative
  invoice payments already represented by separate dues-collection rows.
- Fixed the missing booking-details modal import, obsolete print references and hidden
  client-ledger loading failures found during frontend verification.

## Automated results

79/79 tests passed across appointments, cash, inventory, POS, booking lifecycle, client
ledger and report display. TypeScript and the production frontend build passed.

The working records contain no bank booking receipts or refunds. Those paths, concurrency,
idempotency, cancellation, fully prepaid checkout, voids and dated reversals were tested
against an isolated PostgreSQL database, not the working salon database.

Machine-readable evidence: `artifacts/booking-data-audit.json`.

Re-run read-only audit from `backend`:

```powershell
node scripts/audit-bookings.js
# Optional actual browser walkthrough; supply the installed playwright-core module directory:
node scripts/audit-bookings.js --browser <playwright-core-directory>
```

Re-run isolated regressions from `backend`:

```powershell
node scripts/run-isolated-tests.js --config vitest.bookings-regression.config.js
```
