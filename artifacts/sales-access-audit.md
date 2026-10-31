# Sales reporting access audit — 2026-10-27

Sales users use the `ACCOUNTANT` role. `STAFF` is the separate employee portal role.

## Access policy

- SUPER_ADMIN retains cross-branch reporting; ADMIN retains all sellers within the assigned branch.
- Sales users retain their own sales/invoice, detailed income, income/expense, tax, expense and cash custody reports. Seller/custodian query parameters cannot expand this scope.
- Operating profit, shared bank-account statements and inventory reports are administrator-only: these expose shared financial data and cannot truthfully represent one seller's accounts.

## Findings fixed

1. Branch-wide operating profit, payment-account and inventory reports accepted sales users. Both route and service guards now deny access; navigation and report views follow the policy.
2. Invoice detail and refund history only checked branch membership. They now check seller ownership as well. Payment collection/reversal enforce the same ownership check before mutations.
3. Customer outstanding invoice lookup and sales-dashboard unpaid totals included other sellers. They now filter by the authenticated seller.
4. Customer financial summaries exposed other sellers' dues and booking balances. Sales summaries now use the seller's invoices and bookings; general appointment history no longer contributes to their personal visit summary.
5. Payment-account options and legacy online-account listings exposed shared balances. Sales users retain account selection metadata without balances; balance aggregation is skipped.
6. A missing non-superadmin branch assignment could resolve to an unrestricted read. Branch resolution now fails closed.

Existing seller filters in sales, detailed income, income/expense, tax, cash and expense reports were audited and covered by regression tests, including malicious user and branch filters.

## Verification

- `node node_modules/vitest/vitest.mjs run --config vitest.security.config.js`: 61 tests passed, including 32 sales-access regressions. Uses deterministic, nonempty seller/admin/cross-branch fixtures and mocked persistence, plus HTTP route checks.
- Frontend `npm.cmd run lint`: passed (TypeScript).
- Operating-profit regression suite: 6 passed, 2 existing failures (`PARTIAL` versus expected `PAID` after dues collection). Reproduced the identical failures against the original HEAD report service in temporary test files, then removed those files.
- Real database integration tests could not run: `.env.test` does not provide the required test database. Existing integration expectations were updated for the administrator-only reports.

Changes are local source changes; no deployment or live production database changes were performed.
