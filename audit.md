# SalonOS — Comprehensive A-to-Z Architecture, Security & Product Audit Report

**Document Title:** Comprehensive A-to-Z System, Architecture, Security, Financial & SaaS Feasibility Audit Report  
**System Target:** SalonOS (Salon SAAS Management System)  
**Date of Audit:** 31 October 2026  
**Evaluator Persona:** Senior Product Builder, Software Architect, Security Reviewer & Full-Stack Engineer  
**Governing Standard:** `AGENTS.md` (Principal SaaS Engineering Guidelines) & Single-Company Baseline Context  

---

## 1. Executive Summary

### 1.1 Overall Assessment
The examined repository contains a **mature, operationally extensive single-company multi-branch salon management system**. The product possesses strong financial and domain foundations:
* Strict decimal arithmetic via `decimal.js` and PostgreSQL `@db.Decimal(14,2)` in primary backend transactions.
* Double-entry cash drawer custody and account movement audit trails.
* Explicit tracking and separation of tips and taxes from net revenue and stylist commission.
* Resilient idempotency controls (`IdempotencyKey` with SHA-256 payload hashing) on financial mutations.

However, several critical architectural and security vulnerabilities exist in the code that must be addressed:
1. **Destructive Cascade Deletions:** Despite append-only ledger designs in POS refunds, the administrative endpoints (`deleteBranch` and `resetTestData`) perform non-reversible `deleteMany` operations on invoices, ledger movements, commission runs, and payments without an immutable audit archive.
2. **Silent Failure in POS Package Selection:** The reported issue regarding packages not entering the POS cart was **verified in code**: `POSBillingPage.tsx` performs a silent `return;` without error feedback when component services are omitted from the catalog (such as `PACKAGE_EXCLUSIVE` services filtered out by `catalogue.service.js`).
3. **Cashier Discretionary Discount Risk:** Cashiers (`ACCOUNTANT` role) can apply up to 100% discount on entire sales without mandatory manager override or policy approval.

---

### 1.2 "Current Software Health" vs. "SaaS Readiness"

```
┌──────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┐
│              CURRENT SOFTWARE HEALTH (7.8 / 10)          │               SAAS READINESS (2.1 / 10)                  │
├──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ ✅ Deep operational coverage: POS, Appointments,         │ ❌ Zero Tenant Isolation: 0 of 75 Prisma models          │
│    Bridal/Groom Bookings, Inventory, Staff & Payroll.    │    contain a `tenantId`. Data is completely unpartitioned.│
│ ✅ High financial precision: Decimal(14,2), no float      │ ❌ Token Structure: JWT payload contains only `sub`.     │
│    rounding in backend ledger entries.                   │    No tenant identity or multi-membership concept.      │
│ ✅ Idempotency protection on checkout and payments.      │ ❌ Monolithic Frontend: Single client bundle mixes salon │
│ ⚠️ Destructive admin cascade delete APIs present.        │    operations with administrative utilities.             │
│ ⚠️ POS package silent failure bug verified.              │ ❌ No SaaS Control Plane: No Subscription, Plan,         │
│ ⚠️ Absence of background workers / scheduled queues.     │    Feature Toggles, or Multi-Tenant Billing models.      │
└──────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 2. Verified System Map

### 2.1 Technology Stack & Runtime Ground Truth

| Component | Technology / Library | Version | Verified Location |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `v24.19.0` | Verified via process runtime |
| **ORM / Data Engine** | Prisma ORM | `5.22.0` | `backend/package.json` |
| **Database** | PostgreSQL Server | `18.6 (x86_64)` | Verified via PostgreSQL connection on `localhost:5432` |
| **Backend Framework**| Express.js | `5.2.1` | `backend/package.json` |
| **Math Engine** | `decimal.js` | `10.6.0` | `backend/src/lib/money.js` |
| **Frontend App** | React + Vite + Tailwind CSS v4 | `React 19.0.1`, `Vite 8.3.0` | `frontend/package.json` |
| **UI Components** | Radix UI Primitives + Lucide | Radix `1.1.x`, `lucide-react 0.546` | `frontend/package.json` |
| **Deployment Adapter**| Vercel Serverless Function | Serverless Node.js Wrapper | `vercel.json`, `api/index.js` |

### 2.2 Roles & Access Matrix

The system defines 4 distinct roles in `backend/prisma/schema.prisma`:

```
Role Enum: [ SUPER_ADMIN, ADMIN, ACCOUNTANT, STAFF ]
```

* **`SUPER_ADMIN` (Company Executive / Owner):**
  * Scope: Cross-branch access (`req.branchId = 'ALL'` or explicit query parameter).
  * Capabilities: Create/manage branches, define system settings, payment accounts, tax rules, and execute global reporting.
* **`ADMIN` (Branch Manager):**
  * Scope: Strict single branch lock (`req.branchId = user.branchId`).
  * Capabilities: Appointments, staff attendance, inventory purchasing/adjustments, catalog management, branch expenses, and daily settlements.
* **`ACCOUNTANT` (Front-Desk Cashier / Sales Representative):**
  * Scope: Assigned branch, self-processed sales isolation.
  * Capabilities: POS billing, client intake, dues collection, personal shift cash drawer opening/settlement. Cannot view branch-wide operating profit or supplier balances.
* **`STAFF` (Employee Personal Portal):**
  * Scope: Individual employee record (`user.staffId`).
  * Capabilities: Read-only personal attendance, assigned tips, commission statements, and performance dashboard.

### 2.3 Database Entity Inventory (75 Models)

All 75 models exist in a **single shared PostgreSQL database** with no tenant identifier. Major operational groups:
* **Branches & Org:** `Branch`, `TaxRule`, `PaymentAccount`, `ExpenseCategory`, `PayrollPolicy`.
* **Personnel & Access:** `User`, `RefreshToken`, `PasswordResetToken`, `Staff`, `StaffCompensationHistory`.
* **Catalog:** `ServiceCategory`, `Service`, `Package`, `PackageComponent`.
* **CRM & Scheduling:** `Client`, `Appointment`, `AppointmentItem`, `AppointmentPackageComponent`, `AppointmentReschedule`, `Booking`, `BookingItem`, `BookingPayment`, `BookingHistory`.
* **POS & Ledger:** `Invoice`, `InvoiceLine`, `InvoiceLineComponent`, `InvoiceLineBatch`, `InvoicePayment`, `InvoiceRefund`, `RefundLine`, `CommissionEvent`.
* **Cash Custody:** `CashDrawer`, `DrawerMovement`, `AccountMovement`, `CashTransfer`, `Settlement`, `CashVarianceAdjustment`.
* **Inventory & Purchasing:** `InventoryItem`, `InventoryBatch`, `StockMovement`, `Supplier`, `SupplierLedger`, `Purchase`, `PurchaseLine`, `SupplierPayment`, `SupplierReturn`, `SupplierReturnLine`, `StockSettlement`.
* **HR & Payroll:** `AttendanceRecord`, `AttendancePunch`, `AttendanceCorrection`, `LeaveRecord`, `BranchHoliday`, `OvertimeRecord`, `PayrollRun`, `Payslip`, `PayrollPayment`, `StaffAllowance`, `PayrollAdjustment`, `SalaryAdvance`, `AdvanceRecovery`, `CommissionRun`, `CommissionStatement`, `CommissionPayment`, `TipReceipt`, `TipAllocation`, `TipPayout`.
* **Hardware & System:** `Device`, `DeviceLog`, `Sequence`, `IdempotencyKey`, `AuditEvent`, `SystemSetting`.

---

## 3. Findings Table

The findings below are categorized by severity and supported by verified code evidence:

| ID | Severity | Area | Finding | Evidence (File + Location) | Impact | Recommended Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Critical** | Database / Ledger | **Hard Cascade Delete of Financial Transactions in Branch Deletion** | `backend/src/modules/branches/branches.service.js#L318-L380` | Executing `deleteBranch` deletes all historical invoices, payments, refunds, and cash drawer movements, destroying the accounting audit trail. | Replace hard deletion with soft deactivation (`isActive: false`, `archivedAt`) and block branch deletion if financial ledger records exist. |
| **SEC-02** | **Critical** | Database / System | **Unrestricted Financial Wipe via `resetTestData`** | `backend/src/modules/settings/settings.routes.js#L66`, `settings.service.js#L376-L400` | An `ADMIN` (branch manager) can call `/api/v1/system/reset-test-data` to wipe all invoices and drawer movements for their branch. | Remove this route from production builds or lock strictly to staging environments behind an explicit non-production environment guard. |
| **BUG-01** | **High** | POS / Frontend | **Packages Fail to Enter POS Cart Due to Silent Component Validation Failure** | `frontend/src/features/pos/POSBillingPage.tsx#L575-L582`, `L770-L773`, `backend/src/modules/catalogue/catalogue.service.js#L73-L81` | Clicking a package whose components are filtered from the general services list (e.g. `PACKAGE_EXCLUSIVE`) fails validation and exits silently with zero user feedback. | Update `getPackageValidity` to validate against package component metadata or ensure the catalog payload includes component services; add `toast.error` on validation failure. |
| **FIN-01** | **High** | POS / Authorization | **Unrestricted Cashier Discretionary Discounting** | `backend/src/modules/pos/pos.service.js#L271-L285` | An `ACCOUNTANT` role (cashier) can apply up to 100% discount on any sale without requiring manager approval or discount limit enforcement. | Implement server-enforced max discount thresholds by role and require a manager PIN/authorization token for discounts exceeding policy limits. |
| **SAAS-01**| **High** | Multi-Tenancy | **Total Absence of Tenant Scoping Across All 75 Models** | `backend/prisma/schema.prisma#L1-L2275` | Database architecture assumes all branches belong to a single company. No tenant data isolation or cross-tenant query boundaries exist. | Follow Phase 1 of `SAASRoadmap.md`: introduce `Tenant` model, add nullable `tenantId`, backfill, and enforce composite keys with RLS. |
| **SEC-03** | **Medium** | Auth / Identity | **JWT Access Token Lacks Company / Tenant Identifier** | `backend/src/middleware/authenticate.js#L18-L41`, `backend/src/modules/auth/auth.service.js#L24-L30` | JWT only encodes `sub: user.id`. The backend queries the database on every request to derive `branchId` and `role`. | Enrich token payload with `tenantId` and active tenant membership to support fast, stateless cross-tenant authorization. |
| **OPS-01** | **Medium** | Architecture / Ops | **Absence of Background Job Queue / Scheduled Worker** | Verified across `backend/src/` | Long-running operations (daily settlement closing, subscription past-due evaluations, payroll batch generation) lack an async job runner. | Introduce BullMQ / Redis or PostgreSQL-backed task worker (`graphile-worker` or Pg-boss) for reliable asynchronous execution. |
| **UX-01**  | **Low** | Frontend / Assets | **Base64 / Raw URL String Handling for Branch Logos** | `backend/src/modules/branches/branches.service.js#L147-L151` | Branch logos are accepted as arbitrary strings without file-type validation, size restrictions, or secure object storage (S3/Cloudinary). | Implement multipart file upload endpoint with MIME validation, dimension limits, and cloud storage persistence. |

---

## 4. Workflow Trace Details

### 4.1 POS Service Flow
* **Screen:** `frontend/src/features/pos/POSBillingPage.tsx` (Lines 690-693)
* **Action:** User clicks a service card in the catalog grid (`handleItemCardClick` ➔ `handleAddServiceToCart`).
* **State Mutation:** Item appended to `cart` array with unique `cartInstanceId`, unit price, and default unassigned/house staff.
* **Staff Assignment:** Staff selected via dropdown, updating `ci.staffId` and `ci.staffName`.
* **Checkout Payload:** Prepared in `handleCompleteSale` (`POSBillingPage.tsx` Lines 1686-1706), posting to `POST /api/v1/pos/invoices`.
* **API & Backend Logic:** `backend/src/modules/pos/pos.service.js` (Lines 170-340):
  * Verifies branch availability and checks canonical database price:  
    `round2(c.item.price).equals(round2(catalogue.price))` (Line 260).
  * Calculates line discount, net sales, and line tax.
  * Writes to database in a single transaction: `Invoice`, `InvoiceLine`, `InvoicePayment`, `CommissionEvent` (`type: 'EARN'`), and `DrawerMovement` (`type: 'CASH_SALE'`).
* **Status:** **Verified in code** — Fully working end-to-end.

---

### 4.2 POS Package Flow & Root-Cause Analysis of Reported Issue
* **Screen:** `frontend/src/features/pos/POSBillingPage.tsx` (Lines 693-695)
* **Action:** User clicks a package card (`handleItemCardClick` ➔ `handleAddPackageToCart`).
* **Trace of the Failure:**
  1. `POSBillingPage.tsx` Lines 770-772:
     ```typescript
     const handleAddPackageToCart = (pkg: PackageItem) => {
       const validity = getPackageValidity(pkg);
       if (!validity.isValid) return; // ⚠️ SILENT RETURN WITH ZERO USER FEEDBACK
     ```
  2. `POSBillingPage.tsx` Lines 575-582:
     ```typescript
     const getPackageValidity = (pkg: PackageItem) => {
       for (const comp of pkg.components) {
         const srv = services.find((s) => s.id === comp.serviceId);
         if (!srv || !srv.isActive) {
           return { isValid: false, reason: `Component '${comp.serviceName}' is deactivated` };
         }
       }
       return { isValid: true };
     };
     ```
  3. `backend/src/modules/catalogue/catalogue.service.js` Lines 73-81:
     The backend `listServices` query deliberately excludes services where:
     ```javascript
     { NOT: { description: { startsWith: 'PACKAGE_EXCLUSIVE' } } },
     { NOT: { description: { startsWith: 'Auto-created' } } }
     ```
  4. **The Breakpoint:** If a package contains a component service that was tagged `PACKAGE_EXCLUSIVE` or was auto-created during package import, that service is **never included in the `services` state array** on the frontend. Consequently, `services.find(...)` returns `undefined`, `getPackageValidity` returns `isValid: false`, and `handleAddPackageToCart` exits silently.
* **Status:** **Verified in code** — Confirms the exact reported bug.

---

### 4.3 Bridal / Event Booking Advance & POS Handoff Flow
* **Screen:** `frontend/src/features/bookings/BookingsPage.tsx` ➔ POS Checkout.
* **Booking Creation:** User records a booking with advance deposit. Handled in `backend/src/modules/bookings/bookings.service.js` Lines 112-170. Creates `BookingPayment` and `DrawerMovement` (`type: 'BOOKING_ADVANCE'`).
* **Handoff to POS:** In POS, cashier loads booking via `bookingId`.
* **Deduction & Invariant Enforcement:** In `backend/src/modules/pos/pos.service.js` Lines 185-303:
  * Advance is loaded: `advanceAdjusted = netPayments(booking.payments)`.
  * Overpayment check: `if (advanceAdjusted.plus(billPaid).greaterThan(billTotal)) throw badRequest('BOOKING_OVERPAYMENT', ...);`
  * Net due calculation: `amountDue = round2(billTotal.minus(billPaid).minus(advanceAdjusted))`.
  * Booking status updated: `status: 'COMPLETED'`, `invoiceId: invoice.id`.
* **Double-Counting Verification:** Advance cash entered the drawer during booking creation. When converted to an invoice, the advance is **not re-added to the drawer**; only new incremental payments (`billPaid`) create fresh `DrawerMovement` records.
* **Status:** **Verified in code** — Accounting invariants strictly preserved.

---

### 4.4 Invoices, Refunds & Void Reversals Flow
* **Service:** `backend/src/modules/pos/pos.refund.js` (Lines 44-180)
* **Transaction Locking:** Uses pessimistic lock:
  `SELECT 1 FROM "Invoice" WHERE id = $1 FOR UPDATE` (Line 49).
* **Immutability:** Original `Invoice` and `InvoiceLine` rows are **never deleted or updated**. An append-only `InvoiceRefund` record is created.
* **Reversals:**
  * Commission: Emits `CommissionEvent` with `type: 'REVERSAL'`.
  * Inventory: If product, posts `StockMovement` with `type: 'RETURN_IN'` at original cost layer.
  * Cash: Emits `DrawerMovement` with `type: 'CASH_REFUND'` and `direction: 'OUT'`.
  * Tips: Full void verifies tips are unallocated before reversing (Line 75).
* **Status:** **Verified in code** — Append-only financial reversal.

---

### 4.5 Payroll & Stylist Commission Flow
* **Service:** `backend/src/modules/commission/commission.service.js` (Lines 80-160), `backend/src/modules/payroll/payroll.service.js`
* **Attributed Sales Base:** Commission is calculated strictly from `CommissionEvent` records linked to `InvoiceLine.net` (discounted subtotal, **excluding tax and excluding tip**).
* **Commission Run:** `CommissionRun` groups eligible events in the date range, calculates `netCommissionPayable = round2(earned.minus(reversed))`, and creates `CommissionStatement` per stylist.
* **Payroll Integration:** When payroll runs for the month, `CommissionStatement` balances are pulled in as variable pay, combined with base salary, attendance overtime/deductions, and advance salary recoveries.
* **Status:** **Verified in code** — Clean separation of salary, commission, tip, and tax.

---

## 5. Financial Correctness & Decimal Precision Review

### 5.1 Decimal Precision Implementation

```
Database Schema: Decimal(14, 2) on all monetary columns
Backend Arithmetic: Decimal.js (precision: 20, rounding: ROUND_HALF_UP)
Rounding Function: round2(v) => toDec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
```

Verified in `backend/src/lib/money.js` (Lines 5-25):
* Zero native JavaScript IEEE-754 floating-point operations (`+`, `-`, `*`, `/`) are used on monetary values in backend services.
* Proportional splits (discounts, multi-staff package splits) use `splitWithRemainder`:
  `backend/src/lib/money.js` Lines 47-60 guarantees that the sum of distributed parts matches the original total to the penny, placing the 1-cent rounding remainder on the largest weight item.

### 5.2 Concrete Example: Discount Remainder Allocation Test Case

Suppose a client purchases three services:
* Service A: PKR 10,000.00
* Service B: PKR 10,000.00
* Service C: PKR 10,000.00  
* Subtotal = PKR 30,000.00  
* Fixed Discount applied = PKR 100.00  

In floating-point math: `100 / 3 = 33.333333...`. Three lines of `33.33` would sum to `99.99` (a 1-cent discrepancy).
In this codebase, `splitWithRemainder(100, [10000, 10000, 10000])`:
* Line A receives: PKR 33.34 (absorbs remainder)
* Line B receives: PKR 33.33
* Line C receives: PKR 33.33  
* **Sum of Discounts:** `33.34 + 33.33 + 33.33 = PKR 100.00` (Exact match, zero drift).

---

## 6. Security, Roles & Access Control Review

### 6.1 Authentication & Session Handling
* **Tokens:** Access token (JWT, short-lived or 7d dev setting) + Refresh token (stored in HttpOnly secure cookie with SHA-256 hash in DB table `RefreshToken`).
* **Session Block:** On every request, `authenticate.js` Lines 31-32 re-validates that user and their assigned branch are active. Inactive staff or revoked portal access results in immediate HTTP 401.

### 6.2 Branch Scoping & Isolation
* Handled in `backend/src/middleware/branchScope.js` and `backend/src/lib/scope.js`.
* Non-`SUPER_ADMIN` users have `req.branchId` pinned strictly to their authenticated `user.branchId`. Any attempt by an `ADMIN` or `ACCOUNTANT` to query or mutate another branch's ID throws HTTP 403 `BRANCH_FORBIDDEN`.
* `SUPER_ADMIN` is permitted cross-branch read (`'ALL'`), but must specify an explicit branch ID for mutations (`requireExplicitBranch`).

---

## 7. SaaS Readiness Gap Assessment

### 7.1 The Architectural Reality
The software currently operates on a **Single-Tenant Shared Schema**. There is no platform administration portal, no subscription lifecycle, and no tenant isolation boundary in the database.

```
CURRENT ARCHITECTURE (Single-Tenant):
Database (salon_saas_db)
  └── Branch 1 (Gulberg)
  └── Branch 2 (Clifton)
        └── Shared tables: User, Client, Invoice, CashDrawer...

REQUIRED SAAS ARCHITECTURE (Multi-Tenant):
Platform Admin Portal (:3002) ──────────┐
                                        ▼
Salon Client App (:3001) ──────► Unified API Engine (:5000)
                                        │
                                        ▼
Database (salon_saas_db)
  ├── Tenant 1 ("Company A") ──► Branch 1, Branch 2 ──► Invoices, Staff
  └── Tenant 2 ("Company B") ──► Branch 1          ──► Invoices, Staff
        └── Defense-in-Depth: Application Scoping + PostgreSQL RLS
```

### 7.2 Core Blockers for Multi-Tenant SaaS
1. **Schema Deficit:** None of the 75 business tables possess a `tenantId` foreign key.
2. **Global Uniqueness Collisions:** 
   * `Branch.code` is currently globally unique (`@unique`). In SaaS, two different salon tenants could both legitimately have a branch coded `MAIN-01` or `DHA-01`. Uniqueness must become composite: `@@unique([tenantId, code])`.
   * `Client.phone` is unique per branch; in SaaS, client records must be scoped by `[tenantId, phone]`.
   * `Sequence` table codes must be scoped by `[tenantId, branchCode, prefix, year]`.
3. **Identity Ambiguity:** The `User` model currently has a direct `branchId` column. In multi-tenant SaaS, users belong to a tenant via a `TenantMembership` junction table with distinct roles (`TENANT_OWNER`, `TENANT_ADMIN`, `STAFF`).
4. **SaaS Governance & Commercials:** No models exist for `Tenant`, `Plan`, `PlanVersion`, `Subscription`, or manual bank/JazzCash `SubscriptionPayment` verification.

---

## 8. Test & Operations Coverage

### 8.1 Automated Test Suite Inventory
The repository contains **38 test suites** under `backend/tests/`:
* Core functional tests: `01-auth.test.js` through `14-audit-ledger.test.js`.
* Payroll & HR tests: `15-payroll-engine.test.js`, `16-payroll-extras.test.js`, `20-payroll-combined-commission.test.js`.
* Security & Branch isolation: `branch-isolation.test.js`, `security-regression.test.js`, `31-accountant-sales-isolation.test.js`.
* Financial reconciliation: `30-financial-reports-suite.test.js`, `operating-profit-regression.test.js`, `booking-pos-handoff.test.js`.

### 8.2 Operational & Test Gaps
* **Mocked Fixture Bias:** As documented in `artifacts/sales-access-audit.md`, existing Vitest test runs rely on mocked persistence fixtures rather than live database transactions against PostgreSQL.
* **Absence of Concurrency & Race Tests:** No automated concurrency tests exist to verify cash drawer movements under simultaneous POS checkouts.
* **Zero Multi-Tenant Isolation Tests:** Because multi-tenancy does not yet exist, there are zero negative security tests proving that Tenant A cannot query Tenant B.

---

## 9. Prioritized Action Plan

### Phase P0: Core Integrity & Bug Fixes (Mandatory Before Live Pilot)
* **P0-1: Resolve POS Package Selection Silent Failure**
  * *Reason:* Stylists and cashiers cannot sell package deals through the POS.
  * *Areas:* `frontend/src/features/pos/POSBillingPage.tsx` (Lines 575-582), `backend/src/modules/catalogue/catalogue.service.js` (Lines 73-81).
  * *Acceptance Criteria:* Clicking any active package card successfully computes revenue allocation, adds the package line to the cart, and displays a descriptive toast if any component service is truly inactive.
* **P0-2: Eliminate Destructive Cascade Deletions**
  * *Reason:* Calling `deleteBranch` or `resetTestData` destroys accounting records.
  * *Areas:* `backend/src/modules/branches/branches.service.js` (Lines 302-350), `backend/src/modules/settings/settings.routes.js` (Line 66).
  * *Acceptance Criteria:* `deleteBranch` converted to soft deactivation; `resetTestData` disabled in production.
* **P0-3: Restrict Cashier Discount Authority**
  * *Reason:* Prevents unauthorized revenue leakage.
  * *Areas:* `backend/src/modules/pos/pos.service.js` (Line 271), `backend/src/modules/pos/pos.schema.js`.
  * *Acceptance Criteria:* Server rejects discounts exceeding branch policy limits unless authorized by an `ADMIN` credential.

---

### Phase P1: SaaS Schema Expansion & Multi-Tenant Data Layer
* **P1-1: Additive Schema Migration (Expand Phase)**
  * *Reason:* Establish multi-tenant foundations without breaking single-tenant operations.
  * *Areas:* `backend/prisma/schema.prisma`.
  * *Deliverable:* Add `Tenant`, `TenantMembership`, `Plan`, `PlanVersion`, `Subscription`, `SubscriptionPayment` models; add nullable `tenantId` to all business tables.
* **P1-2: Data Backfill & Reconciliation Gate**
  * *Reason:* Map all existing branches and records to a default legacy tenant.
  * *Acceptance Criteria:* Automated backfill script assigns `tenantId` to 100% of rows; financial control totals match before and after to the penny.
* **P1-3: Tenant Context Middleware & Scoped Data Layer**
  * *Reason:* Enforce tenant boundaries on every HTTP request.
  * *Areas:* Express middleware (`tenantContextMiddleware`), Prisma Client query extensions.
  * *Acceptance Criteria:* Token without valid tenant context fails closed (HTTP 401/403); cross-tenant read attempt returns empty set.

---

### Phase P2: Decoupled Portals & Pakistan SaaS Commercials
* **P2-1: Scaffold Platform Master Admin Portal (`platform-portal`)**
  * *Reason:* Independent administrative application on port `3002` for client onboarding, plan limits, and manual bank slip approvals.
  * *Boundary:* Zero platform administration logic in the salon client bundle.
* **P2-2: Implement Salon Owner Billing & Verification Screen (`/settings/billing`)**
  * *Reason:* Salon owner can view active plan quota meters and upload manual bank/JazzCash payment slips for subscription renewal.
* **P2-3: PostgreSQL Row-Level Security (RLS)**
  * *Reason:* Defense-in-depth database-level isolation using `SET LOCAL app.current_tenant_id`.

---

## 10. Unknowns & Access Needed

The following items could not be verified from static code audit alone:
1. **High-Concurrency Cash Drawer Contention:** Behavior of simultaneous drawer settlements on the same cash drawer under heavy network load (requires live stress testing).
2. **Third-Party SMS/WhatsApp Gateway Configuration:** SMS notifications in appointment and invoice modules are stubbed/mocked; live gateway API credentials and delivery webhook behavior could not be evaluated.
3. **Biometric Hardware Connectivity:** `Device` integration endpoints exist for attendance machine syncing, but real hardware polling latency over local network requires physical device testing.

---

## 11. Final Conclusion

### Is the current software safe to extend toward SaaS yet?
**Conditionally YES, subject to resolving the P0 security and functional defects first.**

The core salon engine possesses outstanding architectural qualities: strictly typed decimal mathematics, immutable invoice refund events, detailed shift custody ledgers, and clean separation between revenue, taxes, tips, and stylist commissions.

However, **do not attempt to onboard external multi-tenant clients on the current code as-is**:
1. The POS package selection bug must be fixed so commercial packages can be sold reliably.
2. Destructive cascade deletion routines must be removed to prevent permanent loss of ledger entries.
3. The multi-tenant database migration must follow the strict **Expand ➔ Backfill ➔ Validate ➔ Enforce** methodology documented in `AGENTS.md` and `SAASRoadmap.md` to guarantee zero data loss and flawless financial reconciliation.

