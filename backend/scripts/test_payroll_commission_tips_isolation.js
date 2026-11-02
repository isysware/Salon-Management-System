// backend/scripts/test_payroll_commission_tips_isolation.js
// Multi-Tenant & Multi-Branch Isolation & Security Suite for Payroll, Commission, Tips & Salary Advances

import prisma from '../src/config/prisma.js';
import { randomUUID } from 'node:crypto';

const BASE_URL = 'http://localhost:5000/api/v1';

async function login(email, password, portal = 'ADMIN') {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password, portal }),
  });
  const json = await res.json();
  if (!res.ok || !json.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  }
  return json.data.token;
}

async function getControlTotals() {
  const [
    payrollRunCount,
    payslipCount,
    payrollPaymentCount,
    staffAllowanceCount,
    payrollAdjustmentCount,
    salaryAdvanceCount,
    advanceRecoveryCount,
    commissionRunCount,
    commissionStatementCount,
    commissionPaymentCount,
    commissionEventCount,
    tipReceiptCount,
    tipAllocationCount,
    tipPayoutCount,
    nullTenantRecords,
  ] = await Promise.all([
    prisma.payrollRun.count(),
    prisma.payslip.count(),
    prisma.payrollPayment.count(),
    prisma.staffAllowance.count(),
    prisma.payrollAdjustment.count(),
    prisma.salaryAdvance.count(),
    prisma.advanceRecovery.count(),
    prisma.commissionRun.count(),
    prisma.commissionStatement.count(),
    prisma.commissionPayment.count(),
    prisma.commissionEvent.count(),
    prisma.tipReceipt.count(),
    prisma.tipAllocation.count(),
    prisma.tipPayout.count(),
    Promise.all([
      prisma.payrollRun.count({ where: { tenantId: null } }),
      prisma.payslip.count({ where: { tenantId: null } }),
      prisma.payrollPayment.count({ where: { tenantId: null } }),
      prisma.staffAllowance.count({ where: { tenantId: null } }),
      prisma.payrollAdjustment.count({ where: { tenantId: null } }),
      prisma.salaryAdvance.count({ where: { tenantId: null } }),
      prisma.advanceRecovery.count({ where: { tenantId: null } }),
      prisma.commissionRun.count({ where: { tenantId: null } }),
      prisma.commissionStatement.count({ where: { tenantId: null } }),
      prisma.commissionPayment.count({ where: { tenantId: null } }),
      prisma.commissionEvent.count({ where: { tenantId: null } }),
      prisma.tipReceipt.count({ where: { tenantId: null } }),
      prisma.tipAllocation.count({ where: { tenantId: null } }),
      prisma.tipPayout.count({ where: { tenantId: null } }),
    ]).then((counts) => counts.reduce((a, b) => a + b, 0)),
  ]);

  return {
    payrollRunCount,
    payslipCount,
    payrollPaymentCount,
    staffAllowanceCount,
    payrollAdjustmentCount,
    salaryAdvanceCount,
    advanceRecoveryCount,
    commissionRunCount,
    commissionStatementCount,
    commissionPaymentCount,
    commissionEventCount,
    tipReceiptCount,
    tipAllocationCount,
    tipPayoutCount,
    nullTenantRecords,
  };
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
  }
}

async function run() {
  console.log('=======================================================================');
  console.log('🔒 PAYROLL, COMMISSION, TIPS & SALARY ADVANCES ISOLATION SUITE');
  console.log('=======================================================================\n');

  // 1. Resolve Both Tenants & Branches
  const tenantA = await prisma.tenant.findUnique({
    where: { slug: 'flagship-salon' },
    include: { branches: true },
  });
  const tenantB = await prisma.tenant.findUnique({
    where: { slug: 'royal-elegance' },
    include: { branches: true },
  });

  if (!tenantA || !tenantB) throw new Error('Tenant A or Tenant B not found in database.');

  const b1 = tenantA.branches.find((b) => b.code === 'B1' || b.id === 'branch-1') || tenantA.branches[0];
  const b2 = tenantA.branches.find((b) => b.code === 'B2' || b.id === 'branch-2') || tenantA.branches[1];
  const bB = tenantB.branches[0];

  console.log(`Tenant A (${tenantA.slug}): Branch 1=${b1.id}, Branch 2=${b2.id}`);
  console.log(`Tenant B (${tenantB.slug}): Branch B=${bB.id}\n`);

  // 2. Resolve Staff
  const staffB1 = await prisma.staff.findFirst({ where: { branchId: b1.id, isActive: true } });
  const staffB2 = await prisma.staff.findFirst({ where: { branchId: b2.id, isActive: true } });
  const staffBB = await prisma.staff.findFirst({ where: { branchId: bB.id, isActive: true } });

  if (!staffB1 || !staffB2 || !staffBB) {
    throw new Error('Staff members for B1, B2, or Tenant B missing in database.');
  }

  console.log(`Staff resolved: B1=${staffB1.name} (${staffB1.id}), B2=${staffB2.name} (${staffB2.id}), BB=${staffBB.name} (${staffBB.id})\n`);

  // 3. Login Users
  console.log('Authenticating actors...');
  const tokenSuperAdmin = await login('superadmin@isysware.com', 'admin123');
  const tokenB1Admin = await login('admin.gulberg@isysware.com', 'admin123');
  const tokenB2Admin = await login('admin.clifton@isysware.com', 'admin123');
  const tokenTenantBAdmin = await login('ayesha.owner@royalelegance.com', 'Password123!');
  console.log('All tokens acquired.\n');

  const headersB1 = { Authorization: `Bearer ${tokenB1Admin}`, 'Content-Type': 'application/json' };
  const headersB2 = { Authorization: `Bearer ${tokenB2Admin}`, 'Content-Type': 'application/json' };
  const headersBB = { Authorization: `Bearer ${tokenTenantBAdmin}`, 'Content-Type': 'application/json' };
  const headersSuper = { Authorization: `Bearer ${tokenSuperAdmin}`, 'Content-Type': 'application/json' };

  const initialTotals = await getControlTotals();
  console.log('Initial Control Totals:', initialTotals);
  assert(initialTotals.nullTenantRecords === 0, 'Initial Database Integrity: 0 NULL tenantId records');

  // =========================================================================
  // SECTION 1: STAFF ALLOWANCES ISOLATION
  // =========================================================================
  console.log('\n--- SECTION 1: Staff Allowances Isolation ---');

  // 1.1 B1 Admin creates allowance for B1 staff
  const resAllowB1 = await fetch(`${BASE_URL}/payroll/allowances`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ staffId: staffB1.id, name: 'Transport Allowance', amount: 3500 }),
  });
  const jsonAllowB1 = await resAllowB1.json();
  assert(resAllowB1.status === 201 && jsonAllowB1.data?.id, 'B1 Admin creates allowance for B1 staff', JSON.stringify(jsonAllowB1));
  const createdAllowanceB1 = jsonAllowB1.data;

  // Verify DB stamp
  if (createdAllowanceB1?.id) {
    const dbAllow = await prisma.staffAllowance.findUnique({ where: { id: createdAllowanceB1.id } });
    assert(dbAllow?.tenantId === tenantA.id && dbAllow?.branchId === b1.id, 'DB Stamp: Allowance stamped with Tenant A & Branch 1');
  }

  // 1.2 B1 Admin tries to create allowance for B2 staff -> BLOCKED (403)
  const resCrossBranchAllow = await fetch(`${BASE_URL}/payroll/allowances`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ staffId: staffB2.id, name: 'Cross Branch Allowance', amount: 2000 }),
  });
  assert(resCrossBranchAllow.status === 403, 'Cross-Branch Block: B1 Admin cannot create allowance for B2 staff (403)');

  // 1.3 B1 Admin tries to create allowance for Tenant B staff -> BLOCKED (403/404)
  const resCrossTenantAllow = await fetch(`${BASE_URL}/payroll/allowances`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ staffId: staffBB.id, name: 'Cross Tenant Allowance', amount: 2000 }),
  });
  assert([403, 404].includes(resCrossTenantAllow.status), 'Cross-Tenant Block: B1 Admin cannot create allowance for Tenant B staff');

  // 1.4 Tenant B Admin tries to create allowance for Tenant A staff -> BLOCKED (403/404)
  const resTenantBToAAllow = await fetch(`${BASE_URL}/payroll/allowances`, {
    method: 'POST',
    headers: headersBB,
    body: JSON.stringify({ staffId: staffB1.id, name: 'Foreign Injection Allowance', amount: 2000 }),
  });
  assert([403, 404].includes(resTenantBToAAllow.status), 'Cross-Tenant Block: Tenant B Admin cannot create allowance for Tenant A staff');

  // 1.5 B2 Admin tries to update B1 allowance -> BLOCKED (403)
  const resB2UpdateB1Allow = await fetch(`${BASE_URL}/payroll/allowances/${createdAllowanceB1.id}`, {
    method: 'PUT',
    headers: headersB2,
    body: JSON.stringify({ amount: 5000 }),
  });
  assert(resB2UpdateB1Allow.status === 403, 'Cross-Branch Block: B2 Admin cannot update B1 allowance (403)');

  // 1.6 Tenant B Admin tries to update B1 allowance -> BLOCKED (403)
  const resTenantBUpdateB1Allow = await fetch(`${BASE_URL}/payroll/allowances/${createdAllowanceB1.id}`, {
    method: 'PUT',
    headers: headersBB,
    body: JSON.stringify({ amount: 9999 }),
  });
  assert([403, 404].includes(resTenantBUpdateB1Allow.status), 'Cross-Tenant Block: Tenant B Admin cannot update Tenant A allowance');

  // 1.7 B1 Admin lists allowances -> sees B1 allowance
  const resB1ListAllow = await fetch(`${BASE_URL}/payroll/allowances`, { headers: headersB1 });
  const jsonB1ListAllow = await resB1ListAllow.json();
  assert(
    resB1ListAllow.status === 200 && jsonB1ListAllow.data?.some((a) => a.id === createdAllowanceB1.id),
    'B1 Admin lists allowances and sees own branch allowance'
  );

  // 1.8 B2 Admin lists allowances -> does NOT see B1 allowance
  const resB2ListAllow = await fetch(`${BASE_URL}/payroll/allowances`, { headers: headersB2 });
  const jsonB2ListAllow = await resB2ListAllow.json();
  assert(
    resB2ListAllow.status === 200 && !jsonB2ListAllow.data?.some((a) => a.id === createdAllowanceB1.id),
    'B2 Admin lists allowances and does NOT see B1 allowance'
  );

  // 1.9 B1 Admin updates own allowance -> PASS (200)
  const resB1UpdateOwnAllow = await fetch(`${BASE_URL}/payroll/allowances/${createdAllowanceB1.id}`, {
    method: 'PUT',
    headers: headersB1,
    body: JSON.stringify({ amount: 4000 }),
  });
  assert(resB1UpdateOwnAllow.status === 200, 'B1 Admin successfully updates own branch allowance (200)');

  // =========================================================================
  // SECTION 2: ONE-OFF ADJUSTMENTS ISOLATION
  // =========================================================================
  console.log('\n--- SECTION 2: Payroll Adjustments Isolation ---');

  const testMonth = '2026-05';

  // 2.1 B1 Admin creates adjustment for B1 staff
  const resAdjB1 = await fetch(`${BASE_URL}/payroll/adjustments`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ staffId: staffB1.id, month: testMonth, type: 'BONUS', title: 'Eid Bonus', amount: 5000 }),
  });
  const jsonAdjB1 = await resAdjB1.json();
  assert(resAdjB1.status === 201 && jsonAdjB1.data?.id, 'B1 Admin creates adjustment for B1 staff', JSON.stringify(jsonAdjB1));
  const createdAdjB1 = jsonAdjB1.data;

  // Verify DB stamp
  if (createdAdjB1?.id) {
    const dbAdj = await prisma.payrollAdjustment.findUnique({ where: { id: createdAdjB1.id } });
    assert(dbAdj?.tenantId === tenantA.id && dbAdj?.branchId === b1.id, 'DB Stamp: Adjustment stamped with Tenant A & Branch 1');
  }

  // 2.2 B1 Admin tries to create adjustment for B2 staff -> BLOCKED (403)
  const resCrossBranchAdj = await fetch(`${BASE_URL}/payroll/adjustments`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ staffId: staffB2.id, month: testMonth, type: 'BONUS', title: 'Cross Branch Bonus', amount: 5000 }),
  });
  assert(resCrossBranchAdj.status === 403, 'Cross-Branch Block: B1 Admin cannot create adjustment for B2 staff (403)');

  // 2.3 B1 Admin tries to create adjustment for Tenant B staff -> BLOCKED (403/404)
  const resCrossTenantAdj = await fetch(`${BASE_URL}/payroll/adjustments`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ staffId: staffBB.id, month: testMonth, type: 'BONUS', title: 'Cross Tenant Bonus', amount: 5000 }),
  });
  assert([403, 404].includes(resCrossTenantAdj.status), 'Cross-Tenant Block: B1 Admin cannot create adjustment for Tenant B staff');

  // 2.4 B2 Admin tries to cancel B1 adjustment -> BLOCKED (403)
  const resB2CancelB1Adj = await fetch(`${BASE_URL}/payroll/adjustments/${createdAdjB1.id}/cancel`, {
    method: 'POST',
    headers: headersB2,
  });
  assert(resB2CancelB1Adj.status === 403, 'Cross-Branch Block: B2 Admin cannot cancel B1 adjustment (403)');

  // 2.5 Tenant B Admin tries to cancel B1 adjustment -> BLOCKED (403)
  const resTenantBCancelB1Adj = await fetch(`${BASE_URL}/payroll/adjustments/${createdAdjB1.id}/cancel`, {
    method: 'POST',
    headers: headersBB,
  });
  assert([403, 404].includes(resTenantBCancelB1Adj.status), 'Cross-Tenant Block: Tenant B Admin cannot cancel Tenant A adjustment');

  // 2.6 B1 Admin cancels own adjustment -> PASS (200)
  const resB1CancelOwnAdj = await fetch(`${BASE_URL}/payroll/adjustments/${createdAdjB1.id}/cancel`, {
    method: 'POST',
    headers: headersB1,
  });
  assert(resB1CancelOwnAdj.status === 200, 'B1 Admin successfully cancels own branch adjustment (200)');

  // =========================================================================
  // SECTION 3: SALARY ADVANCES ISOLATION
  // =========================================================================
  console.log('\n--- SECTION 3: Salary Advances Isolation ---');

  // Ensure an online payment account exists for Branch 1
  let accountB1 = await prisma.paymentAccount.findFirst({ where: { branchId: b1.id, isActive: true } });
  if (!accountB1) {
    accountB1 = await prisma.paymentAccount.create({
      data: { tenantId: tenantA.id, branchId: b1.id, name: 'Bank Al Habib Main', type: 'BANK', balance: 500000 },
    });
  }

  // 3.1 B1 Admin issues salary advance for B1 staff
  const resAdvB1 = await fetch(`${BASE_URL}/payroll/advances`, {
    method: 'POST',
    headers: { ...headersB1, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      staffId: staffB1.id,
      amount: 10000,
      recoveryPerMonth: 2500,
      startMonth: testMonth,
      method: 'ONLINE',
      onlineAccountId: accountB1.id,
      reason: 'Medical emergency advance',
    }),
  });
  const jsonAdvB1 = await resAdvB1.json();
  assert(resAdvB1.status === 201 && jsonAdvB1.data?.id, 'B1 Admin issues advance for B1 staff', JSON.stringify(jsonAdvB1));
  const createdAdvB1 = jsonAdvB1.data;

  // Verify DB stamp
  if (createdAdvB1?.id) {
    const dbAdv = await prisma.salaryAdvance.findUnique({ where: { id: createdAdvB1.id } });
    assert(dbAdv?.tenantId === tenantA.id && dbAdv?.branchId === b1.id, 'DB Stamp: SalaryAdvance stamped with Tenant A & Branch 1');
  }

  // 3.2 B1 Admin tries to issue advance for B2 staff -> BLOCKED (403)
  const resCrossBranchAdv = await fetch(`${BASE_URL}/payroll/advances`, {
    method: 'POST',
    headers: { ...headersB1, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      staffId: staffB2.id,
      amount: 5000,
      method: 'ONLINE',
      onlineAccountId: accountB1.id,
      reason: 'Cross branch advance attempt',
    }),
  });
  assert(resCrossBranchAdv.status === 403, 'Cross-Branch Block: B1 Admin cannot issue advance for B2 staff (403)');

  // 3.3 B1 Admin tries to issue advance for Tenant B staff -> BLOCKED (403/404)
  const resCrossTenantAdv = await fetch(`${BASE_URL}/payroll/advances`, {
    method: 'POST',
    headers: { ...headersB1, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      staffId: staffBB.id,
      amount: 5000,
      method: 'ONLINE',
      onlineAccountId: accountB1.id,
      reason: 'Cross tenant advance attempt',
    }),
  });
  assert([403, 404].includes(resCrossTenantAdv.status), 'Cross-Tenant Block: B1 Admin cannot issue advance for Tenant B staff');

  // 3.4 B2 Admin tries to reverse B1 advance -> BLOCKED (403)
  const resB2RevB1Adv = await fetch(`${BASE_URL}/payroll/advances/${createdAdvB1.id}/reverse`, {
    method: 'POST',
    headers: headersB2,
    body: JSON.stringify({ reason: 'Unauthorized reversal attempt' }),
  });
  assert(resB2RevB1Adv.status === 403, 'Cross-Branch Block: B2 Admin cannot reverse B1 advance (403)');

  // 3.5 Tenant B Admin tries to reverse B1 advance -> BLOCKED (403)
  const resTenantBRevB1Adv = await fetch(`${BASE_URL}/payroll/advances/${createdAdvB1.id}/reverse`, {
    method: 'POST',
    headers: headersBB,
    body: JSON.stringify({ reason: 'Cross tenant reversal attempt' }),
  });
  assert([403, 404].includes(resTenantBRevB1Adv.status), 'Cross-Tenant Block: Tenant B Admin cannot reverse Tenant A advance');

  // 3.6 B1 Admin reverses own advance -> PASS (200)
  const resB1RevOwnAdv = await fetch(`${BASE_URL}/payroll/advances/${createdAdvB1.id}/reverse`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ reason: 'Cancelled by employee request' }),
  });
  assert(resB1RevOwnAdv.status === 200, 'B1 Admin successfully reverses own branch advance (200)');

  // =========================================================================
  // SECTION 4: TIPS ALLOCATION, PAYOUT & REVERSAL ISOLATION
  // =========================================================================
  console.log('\n--- SECTION 4: Tips Allocation & Payout Isolation ---');

  // Ensure fresh TipReceipts exist for testing
  const tipReceiptB1 = await prisma.tipReceipt.create({
    data: {
      tenantId: tenantA.id,
      branchId: b1.id,
      receiptNumber: `TR-TEST-B1-${Date.now()}`,
      invoiceId: `inv-test-mock-b1-${Date.now()}`,
      invoiceNumber: `INV-TEST-B1-${Date.now()}`,
      paymentId: `pay-test-mock-b1-${Date.now()}`,
      collectionDate: new Date('2026-04-15'),
      collectionTime: '14:30',
      clientName: 'Walk-in Client',
      method: 'ONLINE_ACCOUNT',
      paymentAccountId: accountB1.id,
      paymentAccountName: accountB1.name,
      collectedByUserId: 'usr-admin-b1',
      collectedByName: 'Admin Gulberg',
      collectedAmount: 2000,
      allocatedAmount: 0,
      unallocatedAmount: 2000,
      status: 'UNALLOCATED',
    },
  });

  const tipReceiptB2 = await prisma.tipReceipt.create({
    data: {
      tenantId: tenantA.id,
      branchId: b2.id,
      receiptNumber: `TR-TEST-B2-${Date.now()}`,
      invoiceId: `inv-test-mock-b2-${Date.now()}`,
      invoiceNumber: `INV-TEST-B2-${Date.now()}`,
      paymentId: `pay-test-mock-b2-${Date.now()}`,
      collectionDate: new Date('2026-04-15'),
      collectionTime: '15:00',
      clientName: 'Walk-in Client 2',
      method: 'CASH',
      collectedByUserId: 'usr-admin-b2',
      collectedByName: 'Admin Clifton',
      collectedAmount: 1500,
      allocatedAmount: 0,
      unallocatedAmount: 1500,
      status: 'UNALLOCATED',
    },
  });

  const tipReceiptBB = await prisma.tipReceipt.create({
    data: {
      tenantId: tenantB.id,
      branchId: bB.id,
      receiptNumber: `TR-TEST-BB-${Date.now()}`,
      invoiceId: `inv-test-mock-bb-${Date.now()}`,
      invoiceNumber: `INV-TEST-BB-${Date.now()}`,
      paymentId: `pay-test-mock-bb-${Date.now()}`,
      collectionDate: new Date('2026-04-15'),
      collectionTime: '16:00',
      clientName: 'Tenant B Client',
      method: 'CASH',
      collectedByUserId: 'usr-admin-bb',
      collectedByName: 'Ayesha Owner',
      collectedAmount: 1000,
      allocatedAmount: 0,
      unallocatedAmount: 1000,
      status: 'UNALLOCATED',
    },
  });

  // 4.1 B1 Admin allocates tip on B1 receipt for B1 staff
  const resAllocB1 = await fetch(`${BASE_URL}/tips/allocate`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({
      tipReceiptId: tipReceiptB1.id,
      allocationType: 'DIRECT',
      recipients: [{ staffId: staffB1.id, amount: 500 }],
      notes: 'Excellent styling tip',
    }),
  });
  const jsonAllocB1 = await resAllocB1.json();
  assert(resAllocB1.status === 201 && jsonAllocB1.data?.allocations?.length > 0, 'B1 Admin allocates tip on B1 receipt', JSON.stringify(jsonAllocB1));
  const createdAllocB1 = jsonAllocB1.data?.allocations?.[0];

  // Verify DB stamp on tip allocation
  if (createdAllocB1?.id) {
    const dbAlloc = await prisma.tipAllocation.findUnique({ where: { id: createdAllocB1.id } });
    assert(dbAlloc?.tenantId === tenantA.id && dbAlloc?.branchId === b1.id, 'DB Stamp: TipAllocation stamped with Tenant A & Branch 1');
  }

  // 4.2 B1 Admin tries to allocate on B2 receipt -> BLOCKED (403)
  const resAllocB2ByB1 = await fetch(`${BASE_URL}/tips/allocate`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({
      tipReceiptId: tipReceiptB2.id,
      allocationType: 'DIRECT',
      recipients: [{ staffId: staffB1.id, amount: 200 }],
    }),
  });
  assert(resAllocB2ByB1.status === 403, 'Cross-Branch Block: B1 Admin cannot allocate on B2 receipt (403)');

  // 4.3 B1 Admin tries to allocate on Tenant B receipt -> BLOCKED (403)
  const resAllocBBByB1 = await fetch(`${BASE_URL}/tips/allocate`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({
      tipReceiptId: tipReceiptBB.id,
      allocationType: 'DIRECT',
      recipients: [{ staffId: staffB1.id, amount: 200 }],
    }),
  });
  assert(resAllocBBByB1.status === 403, 'Cross-Tenant Block: B1 Admin cannot allocate on Tenant B receipt (403)');

  // 4.4 B1 Admin tries to allocate to foreign staff (B2 staff or Tenant B staff) on B1 receipt -> BLOCKED (400)
  const resAllocForeignStaff = await fetch(`${BASE_URL}/tips/allocate`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({
      tipReceiptId: tipReceiptB1.id,
      allocationType: 'DIRECT',
      recipients: [{ staffId: staffB2.id, amount: 200 }],
    }),
  });
  assert(resAllocForeignStaff.status === 400, 'Cross-Branch Recipient Block: Cannot allocate B1 tips to B2 staff (400)');

  // 4.5 B2 Admin tries to cancel B1 allocation -> BLOCKED (403)
  const resB2CancelB1Alloc = await fetch(`${BASE_URL}/tips/allocations/${createdAllocB1.id}/cancel`, {
    method: 'POST',
    headers: headersB2,
    body: JSON.stringify({ reason: 'Cross-branch cancel attempt' }),
  });
  assert(resB2CancelB1Alloc.status === 403, 'Cross-Branch Block: B2 Admin cannot cancel B1 allocation (403)');

  // 4.6 Tenant B Admin tries to cancel B1 allocation -> BLOCKED (403)
  const resTenantBCancelB1Alloc = await fetch(`${BASE_URL}/tips/allocations/${createdAllocB1.id}/cancel`, {
    method: 'POST',
    headers: headersBB,
    body: JSON.stringify({ reason: 'Cross-tenant cancel attempt' }),
  });
  assert([403, 404].includes(resTenantBCancelB1Alloc.status), 'Cross-Tenant Block: Tenant B Admin cannot cancel Tenant A allocation');

  // 4.7 B1 Admin pays out tip allocation -> PASS (201)
  const resPayoutB1 = await fetch(`${BASE_URL}/tips/payouts`, {
    method: 'POST',
    headers: { ...headersB1, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      allocationId: createdAllocB1.id,
      amount: 500,
      method: 'ONLINE',
      onlineAccountId: accountB1.id,
      notes: 'Weekly tip payout',
    }),
  });
  const jsonPayoutB1 = await resPayoutB1.json();
  assert(resPayoutB1.status === 201 && jsonPayoutB1.data?.payout?.id, 'B1 Admin records tip payout', JSON.stringify(jsonPayoutB1));
  const createdPayoutB1 = jsonPayoutB1.data?.payout;

  // Verify DB stamp on payout
  if (createdPayoutB1?.id) {
    const dbPayout = await prisma.tipPayout.findUnique({ where: { id: createdPayoutB1.id } });
    assert(dbPayout?.tenantId === tenantA.id && dbPayout?.branchId === b1.id, 'DB Stamp: TipPayout stamped with Tenant A & Branch 1');
  }

  // 4.8 B2 Admin tries to reverse B1 tip payout -> BLOCKED (403)
  const resB2RevB1Payout = await fetch(`${BASE_URL}/tips/payouts/${createdPayoutB1.id}/reverse`, {
    method: 'POST',
    headers: headersB2,
    body: JSON.stringify({ reversalReason: 'Cross-branch reversal attempt' }),
  });
  assert(resB2RevB1Payout.status === 403, 'Cross-Branch Block: B2 Admin cannot reverse B1 tip payout (403)');

  // 4.9 Tenant B Admin tries to reverse B1 tip payout -> BLOCKED (403)
  const resTenantBRevB1Payout = await fetch(`${BASE_URL}/tips/payouts/${createdPayoutB1.id}/reverse`, {
    method: 'POST',
    headers: headersBB,
    body: JSON.stringify({ reversalReason: 'Cross-tenant reversal attempt' }),
  });
  assert([403, 404].includes(resTenantBRevB1Payout.status), 'Cross-Tenant Block: Tenant B Admin cannot reverse Tenant A tip payout');

  // 4.10 B1 Admin reverses own tip payout -> PASS (200)
  const resB1RevOwnPayout = await fetch(`${BASE_URL}/tips/payouts/${createdPayoutB1.id}/reverse`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ reversalReason: 'Correction of payout account' }),
  });
  assert(resB1RevOwnPayout.status === 200, 'B1 Admin reverses own tip payout (200)');

  // 4.11 B1 Admin cancels allocation now that payout is reversed -> PASS (200)
  const resB1CancelOwnAlloc = await fetch(`${BASE_URL}/tips/allocations/${createdAllocB1.id}/cancel`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ reason: 'Allocation correction' }),
  });
  assert(resB1CancelOwnAlloc.status === 200, 'B1 Admin cancels own tip allocation (200)');

  // 4.12 Tip Statement Scoping: B1 Admin sees B1 data, B2 Admin sees B2 data
  const resB1TipStmt = await fetch(`${BASE_URL}/tips/statement`, { headers: headersB1 });
  const jsonB1TipStmt = await resB1TipStmt.json();
  const resB2TipStmt = await fetch(`${BASE_URL}/tips/statement`, { headers: headersB2 });
  const jsonB2TipStmt = await resB2TipStmt.json();
  assert(
    resB1TipStmt.status === 200 && resB2TipStmt.status === 200 &&
    jsonB1TipStmt.data?.receipts?.every((r) => r.branchId === b1.id) &&
    jsonB2TipStmt.data?.receipts?.every((r) => r.branchId === b2.id),
    'Tip Statement: B1 and B2 administrators receive strictly branch-isolated statements'
  );

  // =========================================================================
  // SECTION 5: COMMISSION RUNS & PAYMENTS ISOLATION
  // =========================================================================
  console.log('\n--- SECTION 5: Commission Runs & Payments Isolation ---');

  const comStart = '2026-04-01';
  const comEnd = '2026-04-30';

  // 5.1 B1 Admin generates commission preview
  const resComPreviewB1 = await fetch(`${BASE_URL}/commission/preview`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ startDate: comStart, endDate: comEnd }),
  });
  const jsonComPreviewB1 = await resComPreviewB1.json();
  assert(resComPreviewB1.status === 201 && jsonComPreviewB1.data?.id, 'B1 Admin generates commission preview', JSON.stringify(jsonComPreviewB1));
  const createdComRunB1 = jsonComPreviewB1.data;

  // Verify DB stamp
  if (createdComRunB1?.id) {
    const dbComRun = await prisma.commissionRun.findUnique({ where: { id: createdComRunB1.id }, include: { statements: true } });
    assert(
      dbComRun?.tenantId === tenantA.id && dbComRun?.branchId === b1.id &&
      dbComRun?.statements?.every((st) => st.tenantId === tenantA.id),
      'DB Stamp: CommissionRun and CommissionStatements stamped with Tenant A'
    );
  }

  // 5.2 B1 Admin tries to generate preview for B2 -> BLOCKED (403)
  const resComPreviewB2ByB1 = await fetch(`${BASE_URL}/commission/preview`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ branchId: b2.id, startDate: comStart, endDate: comEnd }),
  });
  assert(resComPreviewB2ByB1.status === 403, 'Cross-Branch Block: B1 Admin cannot generate commission preview for B2 (403)');

  // 5.3 B1 Admin tries to generate preview for Tenant B -> BLOCKED (403)
  const resComPreviewBBByB1 = await fetch(`${BASE_URL}/commission/preview`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ branchId: bB.id, startDate: comStart, endDate: comEnd }),
  });
  assert(resComPreviewBBByB1.status === 403, 'Cross-Tenant Block: B1 Admin cannot generate commission preview for Tenant B (403)');

  // 5.4 B2 Admin tries to finalize B1 commission run -> BLOCKED (403)
  const resB2FinalizeComRun = await fetch(`${BASE_URL}/commission/runs/${createdComRunB1.id}/finalize`, {
    method: 'POST',
    headers: headersB2,
  });
  assert(resB2FinalizeComRun.status === 403, 'Cross-Branch Block: B2 Admin cannot finalize B1 commission run (403)');

  // 5.5 Tenant B Admin tries to finalize B1 commission run -> BLOCKED (403)
  const resTenantBFinalizeComRun = await fetch(`${BASE_URL}/commission/runs/${createdComRunB1.id}/finalize`, {
    method: 'POST',
    headers: headersBB,
  });
  assert([403, 404].includes(resTenantBFinalizeComRun.status), 'Cross-Tenant Block: Tenant B Admin cannot finalize Tenant A commission run');

  // 5.6 B1 Admin cancels own commission run -> PASS (200)
  const resB1CancelComRun = await fetch(`${BASE_URL}/commission/runs/${createdComRunB1.id}/cancel`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ reason: 'Testing preview cleanup' }),
  });
  assert(resB1CancelComRun.status === 200, 'B1 Admin successfully cancels own commission run (200)');

  // =========================================================================
  // SECTION 6: PAYROLL RUNS, PAYSLIPS & PAYMENTS ISOLATION
  // =========================================================================
  console.log('\n--- SECTION 6: Payroll Runs & Payslips Isolation ---');

  // 6.1 B1 Admin generates payroll preview for B1
  const resPayPreviewB1 = await fetch(`${BASE_URL}/payroll/preview`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ month: testMonth }),
  });
  const jsonPayPreviewB1 = await resPayPreviewB1.json();
  assert(resPayPreviewB1.status === 201 && jsonPayPreviewB1.data?.id, 'B1 Admin generates payroll preview for B1', JSON.stringify(jsonPayPreviewB1));
  const createdPayRunB1 = jsonPayPreviewB1.data;

  // Verify DB stamp on PayrollRun and Payslips
  if (createdPayRunB1?.id) {
    const dbPayRun = await prisma.payrollRun.findUnique({ where: { id: createdPayRunB1.id }, include: { payslips: true } });
    assert(
      dbPayRun?.tenantId === tenantA.id && dbPayRun?.branchId === b1.id &&
      dbPayRun?.payslips?.every((ps) => ps.tenantId === tenantA.id),
      'DB Stamp: PayrollRun and Payslips stamped with Tenant A & Branch 1'
    );
  }

  // 6.2 B1 Admin tries to generate payroll preview for B2 -> BLOCKED (403)
  const resPayPreviewB2ByB1 = await fetch(`${BASE_URL}/payroll/preview`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ branchId: b2.id, month: testMonth }),
  });
  assert(resPayPreviewB2ByB1.status === 403, 'Cross-Branch Block: B1 Admin cannot generate payroll preview for B2 (403)');

  // 6.3 B1 Admin tries to generate payroll preview for Tenant B -> BLOCKED (403)
  const resPayPreviewBBByB1 = await fetch(`${BASE_URL}/payroll/preview`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ branchId: bB.id, month: testMonth }),
  });
  assert(resPayPreviewBBByB1.status === 403, 'Cross-Tenant Block: B1 Admin cannot generate payroll preview for Tenant B (403)');

  // 6.4 B2 Admin tries to finalize B1 payroll run -> BLOCKED (403)
  const resB2FinalizePayRun = await fetch(`${BASE_URL}/payroll/runs/${createdPayRunB1.id}/finalize`, {
    method: 'POST',
    headers: headersB2,
  });
  assert(resB2FinalizePayRun.status === 403, 'Cross-Branch Block: B2 Admin cannot finalize B1 payroll run (403)');

  // 6.5 Tenant B Admin tries to finalize B1 payroll run -> BLOCKED (403)
  const resTenantBFinalizePayRun = await fetch(`${BASE_URL}/payroll/runs/${createdPayRunB1.id}/finalize`, {
    method: 'POST',
    headers: headersBB,
  });
  assert([403, 404].includes(resTenantBFinalizePayRun.status), 'Cross-Tenant Block: Tenant B Admin cannot finalize Tenant A payroll run');

  // 6.6 Manual Deduction Isolation:
  const firstSlipB1 = createdPayRunB1.payslips?.[0];
  if (firstSlipB1) {
    // B2 Admin tries to add manual deduction to B1 payslip -> BLOCKED (403)
    const resB2DeductB1 = await fetch(`${BASE_URL}/payroll/payslips/${firstSlipB1.id}/deductions`, {
      method: 'POST',
      headers: headersB2,
      body: JSON.stringify({ amount: 500, title: 'Unauthorized Deduction' }),
    });
    assert(resB2DeductB1.status === 403, 'Cross-Branch Block: B2 Admin cannot deduct from B1 payslip (403)');

    // Tenant B Admin tries to add manual deduction to B1 payslip -> BLOCKED (403)
    const resTenantBDeductB1 = await fetch(`${BASE_URL}/payroll/payslips/${firstSlipB1.id}/deductions`, {
      method: 'POST',
      headers: headersBB,
      body: JSON.stringify({ amount: 500, title: 'Cross-Tenant Deduction' }),
    });
    assert([403, 404].includes(resTenantBDeductB1.status), 'Cross-Tenant Block: Tenant B Admin cannot deduct from Tenant A payslip');

    // B1 Admin applies manual deduction to B1 payslip -> PASS (201)
    const resB1DeductB1 = await fetch(`${BASE_URL}/payroll/payslips/${firstSlipB1.id}/deductions`, {
      method: 'POST',
      headers: headersB1,
      body: JSON.stringify({ amount: 250, title: 'Late fine adjustment', notes: 'Agreed with staff' }),
    });
    const jsonB1DeductB1 = await resB1DeductB1.json();
    assert(resB1DeductB1.status === 201 && jsonB1DeductB1.data?.adjustment?.id, 'B1 Admin applies manual deduction to B1 payslip', JSON.stringify(jsonB1DeductB1));

    // Verify DB stamp on manual deduction adjustment
    if (jsonB1DeductB1.data?.adjustment?.id) {
      const dbAdj = await prisma.payrollAdjustment.findUnique({ where: { id: jsonB1DeductB1.data.adjustment.id } });
      assert(dbAdj?.tenantId === tenantA.id && dbAdj?.branchId === b1.id, 'DB Stamp: Manual deduction adjustment stamped with Tenant A & Branch 1');
    }
  }

  // 6.7 B1 Admin finalizes payroll run -> PASS (200)
  const resB1FinalizePayRun = await fetch(`${BASE_URL}/payroll/runs/${createdPayRunB1.id}/finalize`, {
    method: 'POST',
    headers: headersB1,
  });
  const jsonB1FinalizePayRun = await resB1FinalizePayRun.json();
  assert(resB1FinalizePayRun.status === 200 && jsonB1FinalizePayRun.data?.status === 'FINALIZED', 'B1 Admin finalizes payroll run', JSON.stringify(jsonB1FinalizePayRun));

  // 6.8 Payments & Reversals Isolation:
  const finalizedSlipB1 = jsonB1FinalizePayRun.data?.payslips?.[0];
  if (finalizedSlipB1) {
    // B2 Admin tries to record payment on B1 payslip -> BLOCKED (403)
    const resB2PaySlipB1 = await fetch(`${BASE_URL}/payroll/payments`, {
      method: 'POST',
      headers: { ...headersB2, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        payrollRunId: createdPayRunB1.id,
        payslipId: finalizedSlipB1.id,
        amount: 1000,
        method: 'ONLINE',
        onlineAccountId: accountB1.id,
      }),
    });
    assert(resB2PaySlipB1.status === 403, 'Cross-Branch Block: B2 Admin cannot record payment on B1 payslip (403)');

    // Tenant B Admin tries to record payment on B1 payslip -> BLOCKED (403)
    const resTenantBPaySlipB1 = await fetch(`${BASE_URL}/payroll/payments`, {
      method: 'POST',
      headers: { ...headersBB, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        payrollRunId: createdPayRunB1.id,
        payslipId: finalizedSlipB1.id,
        amount: 1000,
        method: 'ONLINE',
        onlineAccountId: accountB1.id,
      }),
    });
    assert([403, 404].includes(resTenantBPaySlipB1.status), 'Cross-Tenant Block: Tenant B Admin cannot record payment on Tenant A payslip');

    // B1 Admin records valid payment on B1 payslip -> PASS (201)
    const resB1PaySlipB1 = await fetch(`${BASE_URL}/payroll/payments`, {
      method: 'POST',
      headers: { ...headersB1, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        payrollRunId: createdPayRunB1.id,
        payslipId: finalizedSlipB1.id,
        amount: 1000,
        method: 'ONLINE',
        onlineAccountId: accountB1.id,
        notes: 'Partial salary payout test',
      }),
    });
    const jsonB1PaySlipB1 = await resB1PaySlipB1.json();
    assert(resB1PaySlipB1.status === 201 && jsonB1PaySlipB1.data?.payment?.id, 'B1 Admin records payment on B1 payslip', JSON.stringify(jsonB1PaySlipB1));
    const createdPaymentB1 = jsonB1PaySlipB1.data?.payment;

    // Verify DB stamp on PayrollPayment
    if (createdPaymentB1?.id) {
      const dbPaymt = await prisma.payrollPayment.findUnique({ where: { id: createdPaymentB1.id } });
      assert(dbPaymt?.tenantId === tenantA.id && dbPaymt?.branchId === b1.id, 'DB Stamp: PayrollPayment stamped with Tenant A & Branch 1');
    }

    // B2 Admin tries to reverse B1 payroll payment -> BLOCKED (403)
    const resB2RevB1Paymt = await fetch(`${BASE_URL}/payroll/payments/${createdPaymentB1.id}/reverse`, {
      method: 'POST',
      headers: headersB2,
      body: JSON.stringify({ reason: 'Cross branch payment reversal attempt' }),
    });
    assert(resB2RevB1Paymt.status === 403, 'Cross-Branch Block: B2 Admin cannot reverse B1 payment (403)');

    // Tenant B Admin tries to reverse B1 payroll payment -> BLOCKED (403)
    const resTenantBRevB1Paymt = await fetch(`${BASE_URL}/payroll/payments/${createdPaymentB1.id}/reverse`, {
      method: 'POST',
      headers: headersBB,
      body: JSON.stringify({ reason: 'Cross tenant payment reversal attempt' }),
    });
    assert([403, 404].includes(resTenantBRevB1Paymt.status), 'Cross-Tenant Block: Tenant B Admin cannot reverse Tenant A payment');

    // B1 Admin reverses own payroll payment -> PASS (200)
    const resB1RevOwnPaymt = await fetch(`${BASE_URL}/payroll/payments/${createdPaymentB1.id}/reverse`, {
      method: 'POST',
      headers: headersB1,
      body: JSON.stringify({ reason: 'Cancelled for testing cleanup' }),
    });
    assert(resB1RevOwnPaymt.status === 200, 'B1 Admin reverses own payroll payment (200)');
  }

  // 6.9 B1 Admin cancels payroll run (now that payment is reversed) -> PASS (200)
  const resB1CancelPayRun = await fetch(`${BASE_URL}/payroll/runs/${createdPayRunB1.id}/cancel`, {
    method: 'POST',
    headers: headersB1,
    body: JSON.stringify({ reason: 'Testing cleanup' }),
  });
  assert(resB1CancelPayRun.status === 200, 'B1 Admin cancels own payroll run after payment reversal (200)');

  // =========================================================================
  // SECTION 7: SALON SUPER ADMIN AUTHORIZED CROSS-BRANCH & BOUNDARY
  // =========================================================================
  console.log('\n--- SECTION 7: Salon SUPER_ADMIN Cross-Branch Scoping & Boundary ---');

  // 7.1 Super Admin lists runs across all branches of Tenant A
  const resSuperAllRuns = await fetch(`${BASE_URL}/payroll/runs`, { headers: headersSuper });
  const jsonSuperAllRuns = await resSuperAllRuns.json();
  assert(resSuperAllRuns.status === 200 && Array.isArray(jsonSuperAllRuns.data), 'Super Admin lists payroll runs across all salon branches');

  // 7.2 Super Admin explicitly targets Branch 1
  const resSuperB1Runs = await fetch(`${BASE_URL}/payroll/runs?branchId=${b1.id}`, { headers: headersSuper });
  const jsonSuperB1Runs = await resSuperB1Runs.json();
  assert(
    resSuperB1Runs.status === 200 && jsonSuperB1Runs.data?.every((r) => r.branchId === b1.id),
    'Super Admin can explicitly view Branch 1 payroll runs'
  );

  // 7.3 Super Admin explicitly targets Branch 2
  const resSuperB2Runs = await fetch(`${BASE_URL}/payroll/runs?branchId=${b2.id}`, { headers: headersSuper });
  const jsonSuperB2Runs = await resSuperB2Runs.json();
  assert(
    resSuperB2Runs.status === 200 && jsonSuperB2Runs.data?.every((r) => r.branchId === b2.id),
    'Super Admin can explicitly view Branch 2 payroll runs'
  );

  // 7.4 Super Admin CANNOT access Tenant B's branch runs -> BLOCKED (403/404)
  const resSuperTenantBRuns = await fetch(`${BASE_URL}/payroll/runs?branchId=${bB.id}`, { headers: headersSuper });
  assert([403, 404].includes(resSuperTenantBRuns.status), 'Cross-Tenant Boundary: Salon Super Admin cannot access Tenant B branch (403/404)');

  // 7.5 Monthly Summary Scoping: Super Admin can query B1 and B2, but blocked from Tenant B branch
  const resSuperSummaryB1 = await fetch(`${BASE_URL}/payroll/monthly-summary?branchId=${b1.id}&month=${testMonth}`, { headers: headersSuper });
  assert(resSuperSummaryB1.status === 200, 'Super Admin can view B1 monthly summary');
  const resSuperSummaryTenantB = await fetch(`${BASE_URL}/payroll/monthly-summary?branchId=${bB.id}&month=${testMonth}`, { headers: headersSuper });
  assert([403, 404].includes(resSuperSummaryTenantB.status), 'Cross-Tenant Boundary: Salon Super Admin blocked from Tenant B monthly summary');

  // =========================================================================
  // SECTION 8: INVARIANT RECONCILIATION & INTEGRITY VERIFICATION
  // =========================================================================
  console.log('\n--- SECTION 8: Control Totals & Financial Integrity Reconciliation ---');

  const finalTotals = await getControlTotals();
  console.log('Final Control Totals:', finalTotals);

  assert(finalTotals.nullTenantRecords === 0, 'Zero NULL tenantId across all 14 Payroll/Commission/Tips tables');

  console.log('\n=======================================================================');
  console.log(`SUMMARY: Total Passed: ${passed} | Total Failed: ${failed}`);
  console.log('=======================================================================\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(async (e) => {
  console.error('Test suite uncaught error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
