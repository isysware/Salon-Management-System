# SalonOS — Independent Audit Verification & Technical Evidence Report

**Document Title:** Independent Source-Level Verification of SalonOS Audit Findings  
**Evaluation Standard:** Zero Speculation, Verified Code Truth, Adversarial Review  
**Date of Verification:** 31 October 2026  
**Auditor Persona:** Senior Software Architect, Security Reviewer & Principal SaaS Systems Engineer  
**Target Repository:** SalonOS (Salon SAAS Management System)  

---

## Executive Summary of Verification

Pichle audit report (`audit.md`) mein identify kiye gaye tamam 8 findings ko **actual current codebase** ke samne independently re-verify kiya gaya hai.

### Summary Verdict
* **Critical Vulnerabilities (SEC-01 & SEC-02):** **100% CONFIRMED IN CODE.** Both are live in production routes with zero environment guards.
* **POS Package Bug (BUG-01):** **100% CONFIRMED IN CODE.** Verified with full trace of seed data, catalogue API exclusions, and frontend silent return.
* **Cashier Discount Vulnerability (FIN-01):** **100% CONFIRMED IN CODE.** Verified across schema, frontend input, and calculation engine.
* **Multi-Tenant Readiness (SAAS-01 & SEC-03):** **100% CONFIRMED IN CODE.** Zero of 75 models contain `tenantId`; JWT lacks company identity.

---

## Section 1: Itemized Source Verification & Excerpt Analysis

---

### Finding SEC-01: Hard Cascade Delete of Financial Transactions in Branch Deletion

#### 1. Exact Source Excerpt
* **Route:** [`backend/src/modules/branches/branches.routes.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/branches/branches.routes.js#L22) (Line 22)
* **Service:** [`backend/src/modules/branches/branches.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/branches/branches.service.js#L302-L341) (Lines 302–341, 376–410)

```javascript
// branches.routes.js:22
router.delete('/:id', authorize('SUPER_ADMIN'), c.remove);
```

```javascript
// branches.service.js:302-341
export const deleteBranch = async (id, actor) => {
  if (actor.role !== 'SUPER_ADMIN') {
    throw forbidden('FORBIDDEN', 'Access Denied: Only Super Administrators can delete salon branches.');
  }

  return prisma.$transaction(async (tx) => {
    const totalBranches = await tx.branch.count();
    if (totalBranches <= 1) {
      throw badRequest('CANNOT_DELETE_LAST_BRANCH', 'Cannot delete the only remaining branch in the system.');
    }

    const branch = await getOrThrow(tx, id);

    // 1. Unassign users linked to this branch
    await tx.user.updateMany({ where: { branchId: id }, data: { branchId: null } });

    // 2. Refunds & Invoices
    await tx.refundLine.deleteMany({ where: { refund: { invoice: { branchId: id } } } }).catch(() => {});
    await tx.invoiceRefund.deleteMany({ where: { invoice: { branchId: id } } }).catch(() => {});
    await tx.invoiceLineBatch.deleteMany({ where: { line: { invoice: { branchId: id } } } }).catch(() => {});
    await tx.invoiceLineComponent.deleteMany({ where: { line: { invoice: { branchId: id } } } }).catch(() => {});
    await tx.invoiceLine.deleteMany({ where: { invoice: { branchId: id } } }).catch(() => {});
    await tx.invoicePayment.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.commissionEvent.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.invoice.deleteMany({ where: { branchId: id } }).catch(() => {});
...
    // 8. Expenses, Cash Drawers & Accounts
    await tx.drawerMovement.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.cashDrawer.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.accountMovement.deleteMany({ where: { branchId: id } }).catch(() => {});
...
    // 11. Clients & Sequences
    await tx.auditEvent.deleteMany({ where: { branchId: id } }).catch(() => {});
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.**
2. **Completeness of Explanation:** The previous audit missed that `deactivateBranch` (Line 290) has a `checkDeactivationBlockers` safety guard, but `deleteBranch` **completely skips blocker checks**. It only checks `totalBranches <= 1`.
3. **Severity & Real Trigger:** **CRITICAL.** Triggered whenever Super Admin executes `DELETE /api/v1/branches/:id`. All historical invoices, cash custody movements, commission statements, and audit events are permanently deleted with `.catch(() => {})` swallowing errors.
4. **Environment Reachability:** **REACHABLE IN PRODUCTION.** The route is active without any environment check.

---

### Finding SEC-02: Unrestricted Financial Wipe via `resetTestData`

#### 1. Exact Source Excerpt
* **Route:** [`backend/src/modules/settings/settings.routes.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/settings/settings.routes.js#L11-L66) (Lines 11 & 66)
* **Service:** [`backend/src/modules/settings/settings.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/settings/settings.service.js#L356-L386) (Lines 356–386)

```javascript
// settings.routes.js:11, 66
const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
...
systemRoutes.post('/reset-test-data', authorize(...ADMINS), validate(v.resetTestDataSchema), c.resetTestData);
```

```javascript
// settings.service.js:356-386
export const resetTestData = async (input = {}, actor) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) {
    throw forbidden('FORBIDDEN', 'Access Denied: Only administrators can reset system test data.');
  }

  const {
    branchId: requestedBranchId,
    wipeCatalogue = false,
    wipeInventory = false,
    wipeClients = true,
    wipeStaff = false,
    wipeSuppliers = true,
  } = input;

  const targetBranchId = actor.role === 'SUPER_ADMIN'
    ? (requestedBranchId && requestedBranchId !== 'ALL' ? requestedBranchId : actor.branchId)
    : actor.branchId;

  const bFilter = targetBranchId && targetBranchId !== 'ALL' ? { branchId: targetBranchId } : {};

  // 1. Refunds, Payments & Invoices
  if (targetBranchId && targetBranchId !== 'ALL') {
    await prisma.refundLine.deleteMany({ where: { refund: { invoice: { branchId: targetBranchId } } } });
    await prisma.invoiceRefund.deleteMany({ where: { invoice: { branchId: targetBranchId } } });
    await prisma.invoiceLineBatch.deleteMany({ where: { line: { invoice: { branchId: targetBranchId } } } });
    await prisma.invoiceLineComponent.deleteMany({ where: { line: { invoice: { branchId: targetBranchId } } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { branchId: targetBranchId } } });
    await prisma.invoicePayment.deleteMany({ where: { branchId: targetBranchId } });
    await prisma.commissionEvent.deleteMany({ where: { branchId: targetBranchId } });
    await prisma.invoice.deleteMany({ where: { branchId: targetBranchId } });
  } else {
    await prisma.invoice.deleteMany({});
  }
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.**
2. **Completeness of Explanation:** Additional critical findings:
   * **No DB Transaction:** Queries run un-transactionally. A failure midway leaves a corrupted database.
   * **Global Super Admin Wipe:** If Super Admin omits `branchId`, `targetBranchId` is `undefined`, wiping the entire company across all branches.
   * **Audit Log Self-Destruction:** Line 499 deletes `AuditEvent`, hiding the wipe from audit logs.
3. **Severity & Real Trigger:** **CRITICAL.** Any branch manager (`ADMIN` role) can send `POST /api/v1/system/reset-test-data` and wipe their branch's accounting records.
4. **Environment Reachability:** **REACHABLE IN PRODUCTION.** Zero `NODE_ENV` check exists.

---

### Finding BUG-01: Packages Fail to Enter POS Cart Due to Silent Component Validation Failure

#### 1. Exact Source Excerpt
* **Frontend Validation & Silent Return:** [`frontend/src/features/pos/POSBillingPage.tsx`](file:///E:/Salon%20SAAS%20Management%20System/frontend/src/features/pos/POSBillingPage.tsx#L575-L582) (Lines 575–582, 770–773)
* **Backend Filter:** [`backend/src/modules/catalogue/catalogue.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/catalogue/catalogue.service.js#L73-L81) (Lines 73–81)

```typescript
// POSBillingPage.tsx:575-582, 770-773
const getPackageValidity = (pkg: PackageItem) => {
  for (const comp of pkg.components) {
    const srv = services.find((s) => s.id === comp.serviceId);
    if (!srv || !srv.isActive) {
      return { isValid: false, reason: `Component '${comp.serviceName}' is deactivated` };
    }
  }
  return { isValid: true };
};

const handleAddPackageToCart = (pkg: PackageItem) => {
  const validity = getPackageValidity(pkg);
  if (!validity.isValid) return; // ⚠️ SILENT RETURN — ZERO UI FEEDBACK
  setCart((prev) => { ... });
};
```

```javascript
// catalogue.service.js:73-81
const services = await prisma.service.findMany({
  where: {
    ...(b ? { branchId: b } : {}),
    OR: [
      { description: null },
      {
        AND: [
          { NOT: { description: { startsWith: 'PACKAGE_EXCLUSIVE' } } },
          { NOT: { description: { startsWith: 'Auto-created' } } },
        ],
      },
    ],
  },
  ...
});
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.**
2. **Completeness of Explanation:** The failure is caused by three concurrent conditions:
   * **Condition A:** Services created with description starting with `PACKAGE_EXCLUSIVE` or `Auto-created` are excluded by `listServices`.
   * **Condition B:** Component services with `isActive: false` are excluded from the frontend `services` state by `srvList.filter(s => s.isActive)` in `loadBranchData` (Line 260).
   * **Condition C:** In `handleAddPackageToCart`, `if (!validity.isValid) return;` executes without `toast.error`, modal, or card disabled state.
3. **Severity & Real Trigger:** **HIGH.** Cashier clicks a package card on the POS screen; the click appears completely dead.
4. **Environment Reachability:** **REACHABLE IN PRODUCTION.**

---

### Finding FIN-01: Unrestricted Cashier Discretionary Discounting

#### 1. Exact Source Excerpt
* **Schema:** [`backend/src/modules/pos/pos.schema.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/pos/pos.schema.js#L43-L44) (Lines 43–44)
* **Service:** [`backend/src/modules/pos/pos.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/pos/pos.service.js#L273-L277) (Lines 273–277)
* **Frontend UI Input:** [`frontend/src/features/pos/POSBillingPage.tsx`](file:///E:/Salon%20SAAS%20Management%20System/frontend/src/features/pos/POSBillingPage.tsx#L2255-L2262) (Lines 2255–2262)

```javascript
// pos.schema.js:43-44
discountType:  z.enum(['FIXED', 'PERCENTAGE']).default('FIXED'),
discountValue: money.min(0).default(0), // ⚠️ No max limit, accepts up to 100%
```

```javascript
// pos.service.js:273-277
const discountValue = toDec(input.discountValue || 0);
const totalDiscount = input.discountType === 'PERCENTAGE'
  ? round2(subtotal.times(Decimal.max(0, Decimal.min(100, discountValue))).dividedBy(100))
  : round2(Decimal.max(0, Decimal.min(subtotal, discountValue)));
```

```tsx
// POSBillingPage.tsx:2255-2262
<input
  type="number"
  min="0"
  placeholder="0"
  value={discountValue || ''}
  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
  className="w-full h-full text-right px-2.5 text-xs font-mono font-bold text-[#18191B] bg-transparent focus:outline-none"
/>
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.**
2. **Completeness of Explanation:** Backend clamps discount to 100% or subtotal, but does **not check actor role** or require manager override. A 100% discount reduces `billTotal` to 0 and completes the invoice as `PAID`.
3. **Severity & Real Trigger:** **HIGH.** Front-desk cashier (`ACCOUNTANT` role) inputs 100% discount, zeroing out the bill without managerial authorization.
4. **Environment Reachability:** **REACHABLE IN PRODUCTION.**

---

### Finding SAAS-01: Total Absence of Tenant Scoping Across All 75 Models

#### 1. Exact Source Excerpt
* **File:** [`backend/prisma/schema.prisma`](file:///E:/Salon%20SAAS%20Management%20System/backend/prisma/schema.prisma) (Lines 1–2275)

```prisma
// schema.prisma contains 75 models; zero models have tenantId
model Branch {
  id              String   @id @default(uuid())
  code            String   @unique
  name            String
  ...
}

model Invoice {
  id              String   @id @default(uuid())
  branchId        String
  invoiceNumber   String   @unique
  ...
}
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.** Word `tenant` appears 0 times in `schema.prisma`.
2. **Completeness of Explanation:** Complete.
3. **Severity & Real Trigger:** **HIGH (for SaaS Conversion) / INFO (for current single-company use).**
4. **Environment Reachability:** Entire active schema.

---

### Finding SEC-03: JWT Access Token Lacks Company / Tenant Identifier

#### 1. Exact Source Excerpt
* **File:** [`backend/src/modules/auth/auth.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/auth/auth.service.js#L24-L29) (Lines 24–29)
* **File:** [`backend/src/middleware/authenticate.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/middleware/authenticate.js#L26-L41) (Lines 26–41)

```javascript
// auth.service.js:24-29
const signAccessToken = (user) =>
  jwt.sign(
    { sub: user.id },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpires }
  );
```

```javascript
// authenticate.js:26-41
const user = await prisma.user.findUnique({
  where:   { id: payload.sub },
  include: { branch: { select: { name: true, isActive: true } }, staff: { ... } },
});
req.user = { id: user.id, name: user.name, role: user.role, branchId: user.branchId, ... };
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.**
2. **Completeness of Explanation:** Token payload contains only `{ sub: user.id }`.
3. **Severity & Real Trigger:** **MEDIUM.** Redundant DB query on every request; cannot perform stateless tenant scoping.
4. **Environment Reachability:** All authenticated traffic.

---

### Finding OPS-01: Absence of Background Job Queue / Scheduled Worker

#### 1. Exact Source Excerpt
* **File:** [`backend/package.json`](file:///E:/Salon%20SAAS%20Management%20System/backend/package.json#L33-L47) (Lines 33–47)

```json
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcrypt": "^6.0.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "decimal.js": "^10.6.0",
    "dotenv": "^18.0.5",
    "express": "^5.2.1",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.3",
    "morgan": "^1.12.1",
    "prisma": "^5.22.0",
    "uuid": "^14.0.2",
    "zod": "^4.6.5"
  }
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.** Zero async queue or cron libraries installed.
2. **Completeness of Explanation:** Complete.
3. **Severity & Real Trigger:** **MEDIUM.** Prevents automated async workflows (e.g. night-time drawer closing, subscription status checks).
4. **Environment Reachability:** Production deployment.

---

### Finding UX-01: Base64 / Raw URL String Handling for Branch Logos

#### 1. Exact Source Excerpt
* **File:** [`backend/src/modules/branches/branches.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/branches/branches.service.js#L147-L151) (Lines 147–151)

```javascript
if (input.logoUrl !== undefined) {
  data.logoUrl = (input.logoUrl && typeof input.logoUrl === 'string' && input.logoUrl.trim().length > 0)
    ? input.logoUrl.trim()
    : null;
}
```

#### 2. Verification Questions
1. **Actual Code Confirmation:** **CONFIRMED IN CODE.**
2. **Completeness of Explanation:** Complete. No S3/Cloud storage pipeline.
3. **Severity & Real Trigger:** **LOW.** Database row bloat if large base64 strings are saved.
4. **Environment Reachability:** Branch creation/updates.

---

## Section 2: Detailed Deep-Dive Traces

---

### 1. POS Package Selection Failure Deep-Dive

#### Package Definition in Seed Data:
[`backend/prisma/seed-data.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/prisma/seed-data.js#L75-L85):
```javascript
export const PACKAGES = [
  {
    id: 'pkg-lhe-01',
    branchId: 'branch-1',
    code: 'PKG-LHE-001',
    name: 'Bridal Glamour & Hair Transformation',
    price: 42000,
    components: [
      { serviceId: 'srv-lhe-03', quantity: 1, allocationPercentage: 45 },
      { serviceId: 'srv-lhe-04', quantity: 1, allocationPercentage: 45 },
      { serviceId: 'srv-lhe-05', quantity: 1, allocationPercentage: 10 },
    ],
  },
];
```

#### Catalogue API Exclusions:
[`backend/src/modules/catalogue/catalogue.service.js`](file:///E:/Salon%20SAAS%20Management%20System/backend/src/modules/catalogue/catalogue.service.js#L73-L81):
```javascript
OR: [
  { description: null },
  {
    AND: [
      { NOT: { description: { startsWith: 'PACKAGE_EXCLUSIVE' } } },
      { NOT: { description: { startsWith: 'Auto-created' } } },
    ],
  },
]
```
If a service description starts with `PACKAGE_EXCLUSIVE` or `Auto-created`, `listServices` omits it from the API payload.

#### Frontend Loading & Filter:
[`frontend/src/features/pos/POSBillingPage.tsx`](file:///E:/Salon%20SAAS%20Management%20System/frontend/src/features/pos/POSBillingPage.tsx#L244-L261):
* `setPackages(pkgList.filter(p => p.isActive))` ➔ Contains package with component service IDs.
* `setServices(srvList.filter(s => s.isActive))` ➔ Omits inactive services and `PACKAGE_EXCLUSIVE` services.

#### Card Click Execution:
1. User clicks package card ➔ `handleItemCardClick` (Line 693) ➔ `handleAddPackageToCart` (Line 770).
2. `getPackageValidity` (Line 575):
   ```typescript
   for (const comp of pkg.components) {
     const srv = services.find((s) => s.id === comp.serviceId);
     if (!srv || !srv.isActive) {
       return { isValid: false, reason: `Component '${comp.serviceName}' is deactivated` };
     }
   }
   ```
3. When `!srv` is true ➔ Returns `{ isValid: false }`.
4. Line 772: `if (!validity.isValid) return;` ➔ **Silent exit without notification.**

---

### 2. Branch Deletion & `resetTestData` Execution Trace

#### Route Authorization & Environment Guards:

| Endpoint | Route File | Method | Authorization Middleware | Environment Guard | DB Transaction? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`deleteBranch`** | `branches.routes.js:22` | `DELETE /:id` | `authorize('SUPER_ADMIN')` | **NONE** | Yes (`prisma.$transaction`) |
| **`resetTestData`**| `settings.routes.js:66` | `POST /reset-test-data` | `authorize('SUPER_ADMIN', 'ADMIN')` | **NONE** | **NO** (Sequential `deleteMany`) |

#### Models Hard-Deleted by `deleteBranch` (40+ Models):
1. **Sales & Billing:** `RefundLine`, `InvoiceRefund`, `InvoiceLineBatch`, `InvoiceLineComponent`, `InvoiceLine`, `InvoicePayment`, `CommissionEvent`, `Invoice`.
2. **Scheduling:** `AppointmentPackageComponent`, `AppointmentItem`, `AppointmentReschedule`, `Appointment`.
3. **Tips & Commissions:** `TipPayout`, `TipAllocation`, `TipReceipt`, `CommissionPayment`, `CommissionStatement`, `CommissionRun`.
4. **Payroll & Loans:** `AdvanceRecovery`, `SalaryAdvance`, `PayrollAdjustment`, `PayrollPayment`, `Payslip`, `PayrollRun`.
5. **Attendance:** `AttendanceCorrection`, `AttendancePunch`, `AttendanceRecord`, `LeaveRecord`, `OvertimeRecord`.
6. **Inventory:** `StockSettlementLine`, `StockSettlement`, `SupplierReturnLine`, `SupplierReturn`, `PurchaseLine`, `Purchase`, `SupplierPayment`, `SupplierLedger`, `Supplier`, `StockMovement`, `InventoryBatch`.
7. **Cash Custody:** `Expense`, `ExpenseCategory`, `CashVarianceAdjustment`, `Settlement`, `CashTransfer`, `DrawerMovement`, `CashDrawer`, `AccountMovement`, `PaymentAccount`, `TaxRule`.
8. **Catalog & Org:** `PackageComponent`, `Package`, `Service`, `ServiceCategory`, `StaffCompensationHistory`, `StaffAllowance`, `Staff`, `Client`, `AuditEvent`, `Sequence`, `Branch`.

#### Models Hard-Deleted by `resetTestData`:
Deletes all rows across identical business models listed above, plus `IdempotencyKey`. If called by Super Admin without `branchId`, it deletes records for **all branches globally**.

---

### 3. Cashier Discretionary Discount Trace

```
[ Frontend: POSBillingPage.tsx ]
Cashier enters "100" in Discount Input (Lines 2255-2262)
No maximum limit constraint | No role check | No manager PIN prompt
                         │
                         ▼
[ HTTP Request Payload ]
POST /api/v1/pos/invoices
{
  "discountType": "PERCENTAGE",
  "discountValue": 100,
  "cartItems": [...]
}
                         │
                         ▼
[ Schema Validation: pos.schema.js ]
checkoutSchema validates:
discountValue: money.min(0).default(0) ──► Validates 100 as valid number (Line 44)
                         │
                         ▼
[ Business Logic: pos.service.js ]
totalDiscount = round2(subtotal * 100 / 100) = subtotal (Line 275)
d.net = 0, d.tax = 0, billTotal = 0 (Lines 281-286)
amountDue = 0 ──► Invoice marked PAID with zero rupees collected (Line 303)
```

---

## Section 3: SaaS Tenant Migration Model Partitioning (75 Models)

---

### Group 1: Global / Platform-Level Entities
* **Definition:** SaaS control plane records and global user credentials.
* **Scoping Rule:** Do NOT contain `tenantId`.
* **Models:**
  1. `SystemSetting` — Global system configurations.
  2. `User` — Authentication identity (`email`, `passwordHash`).
  3. `RefreshToken` — Linked to `User(id)`.
  4. `PasswordResetToken` — Linked to `User(id)`.
  5. *(New SaaS Models)*: `Tenant`, `TenantMembership`, `Plan`, `PlanVersion`, `Subscription`, `SubscriptionPayment`, `TenantAuditEvent`.

---

### Group 2: Tenant-Owned Entities (Master Catalog & Org)
* **Definition:** Salon company master data shared across all branches of a single tenant.
* **Scoping Rule:** `tenantId String` (Mandatory FK `Tenant(id)`).
* **Models (15 models):**
  1. `Branch` (`tenantId`, composite unique `@@unique([tenantId, code])`)
  2. `Client` (`tenantId`, composite unique `@@unique([tenantId, phone])`)
  3. `ServiceCategory` (`tenantId`, composite unique `@@unique([tenantId, name])`)
  4. `Service` (`tenantId`, composite unique `@@unique([tenantId, code])`)
  5. `Package` (`tenantId`, composite unique `@@unique([tenantId, code])`)
  6. `PackageComponent` (child of `Package`)
  7. `TaxRule` (`tenantId`)
  8. `PaymentAccount` (`tenantId`)
  9. `ExpenseCategory` (`tenantId`)
  10. `PayrollPolicy` (`tenantId`)
  11. `Supplier` (`tenantId`, composite unique `@@unique([tenantId, name])`)
  12. `Staff` (`tenantId`, composite unique `@@unique([tenantId, employeeCode])`)
  13. `StaffCompensationHistory` (child of `Staff`)
  14. `Device` (`tenantId`)
  15. `DeviceLog` (child of `Device`)

---

### Group 3: Branch-Owned Operational Entities (Transactions & Ledgers)
* **Definition:** Location-specific physical, financial, and operational records.
* **Scoping Rule:** Composite keys `[tenantId, branchId]`. Composite foreign key: `FOREIGN KEY (tenantId, branchId) REFERENCES Branch(tenantId, id)`.
* **Models (56 models):**
  1. **Cash Custody (6):** `CashDrawer`, `DrawerMovement`, `AccountMovement`, `CashTransfer`, `Settlement`, `CashVarianceAdjustment`.
  2. **Sales & POS Ledger (8):** `Invoice`, `InvoiceLine`, `InvoiceLineComponent`, `InvoiceLineBatch`, `InvoicePayment`, `InvoiceRefund`, `RefundLine`, `CommissionEvent`.
  3. **Scheduling & CRM (8):** `Appointment`, `AppointmentItem`, `AppointmentPackageComponent`, `AppointmentReschedule`, `Booking`, `BookingItem`, `BookingPayment`, `BookingHistory`.
  4. **Inventory & Purchasing (11):** `InventoryItem`, `InventoryBatch`, `StockMovement`, `SupplierLedger`, `Purchase`, `PurchaseLine`, `SupplierPayment`, `SupplierReturn`, `SupplierReturnLine`, `StockSettlement`, `StockSettlementLine`.
  5. **Attendance & Leave (6):** `AttendanceRecord`, `AttendancePunch`, `AttendanceCorrection`, `LeaveRecord`, `BranchHoliday`, `OvertimeRecord`.
  6. **Payroll & Compensation (11):** `PayrollRun`, `Payslip`, `PayrollPayment`, `StaffAllowance`, `PayrollAdjustment`, `SalaryAdvance`, `AdvanceRecovery`, `CommissionRun`, `CommissionStatement`, `CommissionPayment`, `TipReceipt`, `TipAllocation`, `TipPayout`.
  7. **Operations & Audit (4):** `Expense`, `Sequence` (`@@unique([tenantId, branchCode, prefix, year])`), `IdempotencyKey` (`[tenantId, userId, key]`), `AuditEvent`.

---

## Section 4: Corrected Findings Table & Action Priorities

```
┌────────────────────────────────────────────────────────────────────────┐
│  P0 (BLOCKERS): Production Safety & Revenue Integrity (Before Pilot)   │
├─────────┬──────────┬───────────────────────────────────────────────────┤
│ SEC-01  │ CRITICAL │ Block Branch Hard-Deletion; Require Deactivation  │
│ SEC-02  │ CRITICAL │ Disable / Guard reset-test-data in Production     │
│ BUG-01  │ HIGH     │ Fix Package POS Silent Failure & Component Mapping│
│ FIN-01  │ HIGH     │ Enforce Max Discount Limits & Manager Override    │
├─────────┴──────────┴───────────────────────────────────────────────────┤
│  P1 (FOUNDATIONS): SaaS Multi-Tenant Architecture & Data Isolation     │
├─────────┬──────────┬───────────────────────────────────────────────────┤
│ SAAS-01 │ HIGH     │ Schema Expansion (Tenant, Plan, Subscriptions)    │
│ SEC-03  │ MEDIUM   │ Enrich JWT Access Token with tenantId & Role      │
│ P1-MIG  │ HIGH     │ Additive Backfill & Composite FK Constraints      │
├─────────┴──────────┴───────────────────────────────────────────────────┤
│  P2 (OPERATIONS): Operational Scalability & Hardening                  │
├─────────┬──────────┬───────────────────────────────────────────────────┤
│ OPS-01  │ MEDIUM   │ Implement Redis / BullMQ Background Job Worker    │
│ UX-01   │ LOW      │ Secure S3/Cloud Storage Pipeline for Logos        │
└────────────────────────────────────────────────────────────────────────┘
```

### Action Items
1. **P0-1 (SEC-01):** Convert `deleteBranch` to soft deactivation (`isActive: false`, `archivedAt`) and block deletion if any financial transaction exists.
2. **P0-2 (SEC-02):** Wrap `/reset-test-data` in a strict non-production environment guard (`if (env.isProd) throw forbidden(...)`).
3. **P0-3 (BUG-01):** Fix `getPackageValidity` in `POSBillingPage.tsx` to validate against package component metadata and trigger `toast.error(validity.reason)` when invalid.
4. **P0-4 (FIN-01):** Add server-enforced discount thresholds in `pos.service.js` and require an `ADMIN` PIN authorization token for discounts exceeding 10%.

