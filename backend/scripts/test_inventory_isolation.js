// backend/scripts/test_inventory_isolation.js
// Multi-Tenant & Multi-Branch Isolation & Security Suite for Inventory, Purchases, and Suppliers

import prisma from '../src/config/prisma.js';
import { randomUUID } from 'node:crypto';

const BASE_URL = 'http://localhost:5000/api/v1';

async function login(email, password, portal = 'ADMIN') {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, portal }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.data.token, user: data.data.user };
}

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
    results.push({ testName, status: 'PASS', details });
  } else {
    failed++;
    console.error(`  [FAIL] ${testName} - ${details}`);
    results.push({ testName, status: 'FAIL', details });
  }
}

async function request(token, path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   INVENTORY, PURCHASES & SUPPLIERS ISOLATION TEST SUITE');
  console.log('================================================================\n');

  // Baseline database snapshot
  const initialBatches = await prisma.inventoryBatch.findMany();
  const initialMovements = await prisma.stockMovement.findMany();
  const initialLedgers = await prisma.supplierLedger.findMany();

  const baselineStock = initialBatches.reduce((s, b) => s + Number(b.remainingQuantity), 0);
  const baselineValuation = initialBatches.reduce((s, b) => s + Number(b.remainingQuantity) * Number(b.unitCost), 0);
  const baselineSupplierDebit = initialLedgers.reduce((s, l) => s + Number(l.debit), 0);
  const baselineSupplierCredit = initialLedgers.reduce((s, l) => s + Number(l.credit), 0);

  console.log(`Baseline Batches Remaining Stock: ${baselineStock}`);
  console.log(`Baseline Batch Valuation: ${baselineValuation}`);
  console.log(`Baseline Supplier Ledger (Debit: ${baselineSupplierDebit}, Credit: ${baselineSupplierCredit})\n`);

  // Logins
  const tenantA_Super = await login('superadmin@isysware.com', 'admin123');
  const tenantA_Branch1_Admin = await login('admin.gulberg@isysware.com', 'admin123');
  const tenantA_Branch2_Admin = await login('admin.clifton@isysware.com', 'admin123');
  const tenantB_Admin = await login('ayesha.owner@royalelegance.com', 'Password123!');

  const tenantA_Id = 'f2e3cd13-66e6-4763-8c19-cb0edfdbdb7e';
  const tenantB_Id = 'ee5ae42b-dbe8-434b-8d7b-99345339679c';
  const branch1_Id = 'branch-1';
  const branch2_Id = 'branch-2';
  const branchB_Id = 'bcf918ab-cedf-4a4e-ac63-5334bb78ee08';

  console.log('--- 1. TENANT A VS TENANT B ISOLATION TESTS ---');

  // Test 1: Tenant B cannot see Tenant A items in list
  {
    const res = await request(tenantB_Admin.token, '/inventory/items');
    assert(res.status === 200, 'Tenant B items list returns 200');
    const items = res.body?.data || [];
    const hasTenantAItem = items.some(i => i.id.startsWith('item-'));
    assert(!hasTenantAItem, 'Tenant B items list does NOT contain any Tenant A items', `Found: ${items.map(i => i.id).join(', ')}`);
  }

  // Test 2: Tenant B direct lookup of Tenant A item blocked with 403
  {
    const res = await request(tenantB_Admin.token, '/inventory/items/item-1');
    assert(res.status === 403, 'Tenant B direct GET of Tenant A item is 403 Forbidden', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 3: Tenant B update of Tenant A item blocked with 403
  {
    const res = await request(tenantB_Admin.token, '/inventory/items/item-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert(res.status === 403, 'Tenant B PUT of Tenant A item is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 4: Tenant B archive of Tenant A item blocked with 403
  {
    const res = await request(tenantB_Admin.token, '/inventory/items/item-1/archive', {
      method: 'POST',
      body: JSON.stringify({ isActive: false }),
    });
    assert(res.status === 403, 'Tenant B POST archive of Tenant A item is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 5: Tenant B stock query of Tenant A item blocked with 403
  {
    const res = await request(tenantB_Admin.token, `/inventory/items/item-1/stock?branchId=${branchB_Id}`);
    assert(res.status === 403, 'Tenant B item stock query of Tenant A item is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 6: Tenant B batches list does not contain Tenant A batches
  {
    const res = await request(tenantB_Admin.token, '/inventory/batches');
    assert(res.status === 200, 'Tenant B batches list returns 200');
    const batches = res.body?.data || [];
    const hasTenantABatch = batches.some(b => b.id.startsWith('batch-'));
    assert(!hasTenantABatch, 'Tenant B batches list does NOT contain any Tenant A batches', `Count: ${batches.length}`);
  }

  // Test 7: Tenant B quarantine of Tenant A batch blocked with 403
  {
    const res = await request(tenantB_Admin.token, '/inventory/batches/batch-1/quarantine', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Malicious quarantine' }),
    });
    assert(res.status === 403, 'Tenant B quarantine of Tenant A batch is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 8: Tenant B suppliers list does not contain Tenant A suppliers
  {
    const res = await request(tenantB_Admin.token, '/suppliers');
    assert(res.status === 200, 'Tenant B suppliers list returns 200');
    const suppliers = res.body?.data || [];
    const hasTenantASupplier = suppliers.some(s => s.id.startsWith('sup-'));
    assert(!hasTenantASupplier, 'Tenant B suppliers list does NOT contain Tenant A suppliers', `Count: ${suppliers.length}`);
  }

  // Test 9: Tenant B direct lookup of Tenant A supplier is 403
  {
    const res = await request(tenantB_Admin.token, '/suppliers/sup-1');
    assert(res.status === 403, 'Tenant B direct GET of Tenant A supplier is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 10: Tenant B lookup of Tenant A supplier ledger is 403
  {
    const res = await request(tenantB_Admin.token, '/suppliers/sup-1/ledger');
    assert(res.status === 403, 'Tenant B GET of Tenant A supplier ledger is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 11: Tenant B payment to Tenant A supplier is 403
  {
    const res = await request(tenantB_Admin.token, '/suppliers/sup-1/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        amount: 500,
        paymentDate: '2026-11-02',
        method: 'CASH',
        branchId: branchB_Id,
      }),
    });
    assert(res.status === 403, 'Tenant B payment to Tenant A supplier is 403 Forbidden', `Status: ${res.status}`);
  }

  // Test 12: Tenant B purchase referencing Tenant A supplier is 403
  {
    const res = await request(tenantB_Admin.token, '/purchases', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branchB_Id,
        supplierId: 'sup-1',
        lines: [{ itemId: 'item-1', quantity: 5, unitCost: 100 }],
        paymentMethod: 'UNPAID',
      }),
    });
    assert(res.status === 403 || res.status === 400, 'Tenant B purchase with Tenant A supplier is 403/400 rejected', `Status: ${res.status}`);
  }

  // Test 13: Tenant B manual stock-out referencing Tenant A item is 400
  {
    const res = await request(tenantB_Admin.token, '/stock-movements/manual-out', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branchB_Id,
        itemId: 'item-1',
        quantity: 1,
        reasonType: 'SALON_CONSUMPTION',
      }),
    });
    assert(res.status === 400, 'Tenant B manual stock-out of Tenant A item is 400 rejected', `Status: ${res.status}`);
  }

  // Test 14: Tenant B physical stock count referencing Tenant A item is 400
  {
    const res = await request(tenantB_Admin.token, '/stock-settlements', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branchB_Id,
        lines: [{ itemId: 'item-1', countedQuantity: 10 }],
      }),
    });
    assert(res.status === 400, 'Tenant B stock count with Tenant A item is 400 rejected', `Status: ${res.status}`);
  }

  console.log('\n--- 2. BRANCH 1 VS BRANCH 2 ISOLATION WITHIN TENANT A ---');

  // Test 15: Branch 2 Admin cannot see Branch 1 specific suppliers (sup-2, sup-3)
  {
    const res = await request(tenantA_Branch2_Admin.token, '/suppliers');
    assert(res.status === 200, 'Branch 2 suppliers list returns 200');
    const suppliers = res.body?.data || [];
    const hasBranch1Supplier = suppliers.some(s => s.id === 'sup-2' || s.id === 'sup-3');
    const hasGlobalSupplier = suppliers.some(s => s.id === 'sup-1');
    assert(!hasBranch1Supplier, 'Branch 2 Admin does NOT see Branch 1 suppliers (sup-2, sup-3)', `Found: ${suppliers.map(s => s.id).join(', ')}`);
    assert(hasGlobalSupplier, 'Branch 2 Admin DOES see company-wide supplier (sup-1)');
  }

  // Test 16: Branch 2 Admin direct GET of Branch 1 specific supplier is 403 BRANCH_FORBIDDEN
  {
    const res = await request(tenantA_Branch2_Admin.token, '/suppliers/sup-2');
    assert(res.status === 403, 'Branch 2 direct GET of Branch 1 supplier is 403 BRANCH_FORBIDDEN', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 17: Branch 2 Admin quarantine of Branch 1 batch is 403 BRANCH_FORBIDDEN
  {
    const res = await request(tenantA_Branch2_Admin.token, '/inventory/batches/batch-1/quarantine', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cross-branch test' }),
    });
    assert(res.status === 403, 'Branch 2 quarantine of Branch 1 batch is 403 BRANCH_FORBIDDEN', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 18: Branch 2 Admin creating purchase with branchId=branch-1 is 403 BRANCH_FORBIDDEN
  {
    const res = await request(tenantA_Branch2_Admin.token, '/purchases', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch1_Id,
        supplierId: 'sup-1',
        lines: [{ itemId: 'item-1', quantity: 2, unitCost: 1000 }],
        paymentMethod: 'CREDIT',
      }),
    });
    assert(res.status === 403, 'Branch 2 creating purchase for branch-1 is 403 BRANCH_FORBIDDEN', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 19: Branch 2 Admin creating purchase with Branch 1 supplier (sup-2) is rejected
  {
    const res = await request(tenantA_Branch2_Admin.token, '/purchases', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch2_Id,
        supplierId: 'sup-2',
        lines: [{ itemId: 'item-1', quantity: 2, unitCost: 1000 }],
        paymentMethod: 'CREDIT',
      }),
    });
    assert(res.status === 403 || res.status === 400, 'Branch 2 purchase with Branch 1 supplier is 403/400 rejected', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 20: Branch 2 Admin manual stock-out targeting branch-1 is 403 BRANCH_FORBIDDEN
  {
    const res = await request(tenantA_Branch2_Admin.token, '/stock-movements/manual-out', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch1_Id,
        itemId: 'item-1',
        quantity: 1,
        reasonType: 'SALON_CONSUMPTION',
        reason: 'In-salon tester',
      }),
    });
    assert(res.status === 403, 'Branch 2 manual stock-out targeting branch-1 is 403 BRANCH_FORBIDDEN', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 21: Branch 2 Admin stock count targeting branch-1 is 403 BRANCH_FORBIDDEN
  {
    const res = await request(tenantA_Branch2_Admin.token, '/stock-settlements', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch1_Id,
        lines: [{ itemId: 'item-1', countedQuantity: 5 }],
      }),
    });
    assert(res.status === 403, 'Branch 2 stock count targeting branch-1 is 403 BRANCH_FORBIDDEN', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  console.log('\n--- 3. SUPER ADMIN AUTHORIZED CROSS-BRANCH VS CROSS-TENANT ---');

  // Test 22: Tenant A Super Admin can view all Branch 1 and Branch 2 stock levels
  {
    const res = await request(tenantA_Super.token, '/inventory/stock-levels');
    assert(res.status === 200, 'Tenant A Super Admin can query stock-levels across branches');
    const levels = res.body?.data || [];
    const hasBranch1 = levels.some(l => l.branchId === branch1_Id);
    const hasBranch2 = levels.some(l => l.branchId === branch2_Id);
    assert(hasBranch1 && hasBranch2, 'Stock levels include both Branch 1 and Branch 2');
  }

  // Test 23: Tenant A Super Admin CANNOT access Tenant B item
  {
    const res = await request(tenantA_Super.token, '/inventory/items/aa43b37a-b660-44f6-b5c2-d8fa78f6af1e');
    assert(res.status === 403, 'Tenant A Super Admin CANNOT access Tenant B item (403 FORBIDDEN_TENANT_ACCESS)', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  // Test 24: Tenant A Super Admin must specify branchId for write operations
  {
    const res = await request(tenantA_Super.token, '/purchases', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: 'ALL',
        supplierId: 'sup-1',
        lines: [{ itemId: 'item-1', quantity: 1, unitCost: 100 }],
        paymentMethod: 'UNPAID',
      }),
    });
    assert(res.status === 400, 'Super Admin must specify a single concrete branch for purchase creation', `Status: ${res.status}, Error: ${res.body?.error?.code}`);
  }

  console.log('\n--- 4. SAME-BRANCH VALID WORKFLOW & DB TENANTID STAMPING ---');

  let testItemId = null;
  let testSupplierId = null;
  let testPurchaseId = null;
  let testSettlementId = null;

  // Test 25: Create item by Branch 1 Admin stamps tenantId server-side
  {
    const res = await request(tenantA_Branch1_Admin.token, '/inventory/items', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Shampoo Isolation LHE',
        category: 'Hair Care',
        itemType: 'RETAIL_PRODUCT',
        defaultPurchaseCost: 1200,
        sellingPrice: 1800,
        minStockLevel: 5,
      }),
    });
    assert(res.status === 201, 'Create item succeeds (201)', `Status: ${res.status}`);
    testItemId = res.body?.data?.id;
    if (testItemId) {
      const dbItem = await prisma.inventoryItem.findUnique({ where: { id: testItemId } });
      assert(dbItem?.tenantId === tenantA_Id, 'Created item has correct tenantId stamped in DB', `DB tenantId: ${dbItem?.tenantId}`);
    }
  }

  // Test 26: Create supplier by Branch 1 Admin stamps tenantId and branchId
  {
    const res = await request(tenantA_Branch1_Admin.token, '/suppliers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Lahore Vendor 01',
        phone: '03001234567',
      }),
    });
    assert(res.status === 201, 'Create supplier succeeds (201)', `Status: ${res.status}`);
    testSupplierId = res.body?.data?.id;
    if (testSupplierId) {
      const dbSup = await prisma.supplier.findUnique({ where: { id: testSupplierId } });
      assert(dbSup?.tenantId === tenantA_Id, 'Created supplier has correct tenantId in DB', `DB tenantId: ${dbSup?.tenantId}`);
      assert(dbSup?.branchId === branch1_Id, 'Created supplier scoped to branch-1 in DB', `DB branchId: ${dbSup?.branchId}`);
    }
  }

  // Test 27: Create purchase in Branch 1 stamps tenantId on Purchase, PurchaseLine, Batch, StockMovement, SupplierLedger
  {
    const res = await request(tenantA_Branch1_Admin.token, '/purchases', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch1_Id,
        supplierId: testSupplierId,
        lines: [{ itemId: testItemId, quantity: 10, unitCost: 1200 }],
        paymentMethod: 'CREDIT',
      }),
    });
    assert(res.status === 201, 'Create purchase succeeds (201)', `Status: ${res.status}, Error: ${res.body?.error?.message}`);
    testPurchaseId = res.body?.data?.id;
    if (testPurchaseId) {
      const dbPO = await prisma.purchase.findUnique({
        where: { id: testPurchaseId },
        include: { lines: true },
      });
      assert(dbPO?.tenantId === tenantA_Id, 'Purchase has correct tenantId in DB');
      assert(dbPO?.branchId === branch1_Id, 'Purchase has correct branchId in DB');
      assert(dbPO?.lines?.[0]?.tenantId === tenantA_Id, 'PurchaseLine has correct tenantId in DB');

      const batch = await prisma.inventoryBatch.findFirst({ where: { purchaseId: testPurchaseId } });
      assert(batch?.tenantId === tenantA_Id, 'Created InventoryBatch has correct tenantId in DB');
      assert(batch?.branchId === branch1_Id, 'Created InventoryBatch has correct branchId in DB');

      const movement = await prisma.stockMovement.findFirst({ where: { sourceReferenceId: testPurchaseId } });
      assert(movement?.tenantId === tenantA_Id, 'StockMovement has correct tenantId in DB');
      assert(movement?.branchId === branch1_Id, 'StockMovement has correct branchId in DB');

      const ledger = await prisma.supplierLedger.findFirst({ where: { referenceId: testPurchaseId } });
      assert(ledger?.tenantId === tenantA_Id, 'SupplierLedger entry has correct tenantId in DB');
      assert(ledger?.branchId === branch1_Id, 'SupplierLedger entry has correct branchId in DB');
    }
  }

  // Test 28: Manual stock-out in Branch 1 stamps tenantId
  {
    const res = await request(tenantA_Branch1_Admin.token, '/stock-movements/manual-out', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch1_Id,
        itemId: testItemId,
        quantity: 2,
        reasonType: 'SALON_CONSUMPTION',
        reason: 'In-salon tester consumption',
        notes: 'In-salon tester',
      }),
    });
    assert(res.status === 201, 'Manual stock-out succeeds (201)', `Status: ${res.status}, Error: ${res.body?.error?.message}`);
    const movementId = res.body?.data?.id;
    if (movementId) {
      const dbMov = await prisma.stockMovement.findUnique({ where: { id: movementId } });
      assert(dbMov?.tenantId === tenantA_Id, 'Manual stock-out StockMovement has correct tenantId in DB');
      assert(dbMov?.branchId === branch1_Id, 'Manual stock-out StockMovement has correct branchId in DB');
    }
  }

  // Test 29: Physical stock count (settlement) in Branch 1 stamps tenantId
  {
    const res = await request(tenantA_Branch1_Admin.token, '/stock-settlements', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        branchId: branch1_Id,
        notes: 'Month-end test audit',
        lines: [{
          itemId: testItemId,
          countedQuantity: 8, // exactly matches remaining 8 (10 - 2)
        }],
      }),
    });
    assert(res.status === 201, 'Stock settlement succeeds (201)', `Status: ${res.status}, Error: ${res.body?.error?.message}`);
    testSettlementId = res.body?.data?.id;
    if (testSettlementId) {
      const dbSettlement = await prisma.stockSettlement.findUnique({
        where: { id: testSettlementId },
        include: { lines: true },
      });
      assert(dbSettlement?.tenantId === tenantA_Id, 'StockSettlement has correct tenantId in DB');
      assert(dbSettlement?.branchId === branch1_Id, 'StockSettlement has correct branchId in DB');
      assert(dbSettlement?.lines?.[0]?.tenantId === tenantA_Id, 'StockSettlementLine has correct tenantId in DB');
    }
  }

  console.log('\n--- 5. CLEANUP & FINANCIAL RECONCILIATION ---');

  // Idempotent cleanup of test fixtures
  if (testSettlementId) {
    await prisma.stockSettlementLine.deleteMany({ where: { settlementId: testSettlementId } });
    await prisma.stockSettlement.deleteMany({ where: { id: testSettlementId } });
  }
  if (testPurchaseId) {
    await prisma.stockMovement.deleteMany({ where: { sourceReferenceId: testPurchaseId } });
    await prisma.stockMovement.deleteMany({ where: { itemId: testItemId } });
    await prisma.purchaseLine.deleteMany({ where: { purchaseId: testPurchaseId } });
    await prisma.supplierLedger.deleteMany({ where: { referenceId: testPurchaseId } });
    await prisma.inventoryBatch.deleteMany({ where: { purchaseId: testPurchaseId } });
    await prisma.purchase.deleteMany({ where: { id: testPurchaseId } });
  }
  if (testItemId) {
    await prisma.stockMovement.deleteMany({ where: { itemId: testItemId } });
    await prisma.inventoryBatch.deleteMany({ where: { itemId: testItemId } });
    await prisma.inventoryItem.deleteMany({ where: { id: testItemId } });
  }
  if (testSupplierId) {
    await prisma.supplierLedger.deleteMany({ where: { supplierId: testSupplierId } });
    await prisma.supplier.deleteMany({ where: { id: testSupplierId } });
  }

  // Verify Post-Test Invariants and Reconcile Control Totals
  const finalBatches = await prisma.inventoryBatch.findMany();
  const finalLedgers = await prisma.supplierLedger.findMany();

  const finalStock = finalBatches.reduce((s, b) => s + Number(b.remainingQuantity), 0);
  const finalValuation = finalBatches.reduce((s, b) => s + Number(b.remainingQuantity) * Number(b.unitCost), 0);
  const finalSupplierDebit = finalLedgers.reduce((s, l) => s + Number(l.debit), 0);
  const finalSupplierCredit = finalLedgers.reduce((s, l) => s + Number(l.credit), 0);

  console.log(`Final Batches Remaining Stock: ${finalStock} (Baseline: ${baselineStock})`);
  console.log(`Final Batch Valuation: ${finalValuation} (Baseline: ${baselineValuation})`);
  console.log(`Final Supplier Ledger Debit: ${finalSupplierDebit} (Baseline: ${baselineSupplierDebit})`);
  console.log(`Final Supplier Ledger Credit: ${finalSupplierCredit} (Baseline: ${baselineSupplierCredit})`);

  assert(finalStock === baselineStock, 'Stock quantities perfectly match baseline control totals');
  assert(finalValuation === baselineValuation, 'Batch inventory valuation perfectly matches baseline control totals');
  assert(finalSupplierDebit === baselineSupplierDebit && finalSupplierCredit === baselineSupplierCredit, 'Supplier ledger debits & credits perfectly match baseline control totals');

  // Verify Zero NULL tenantId in all 12 inventory tables
  const models = ['inventoryItem', 'inventoryBatch', 'stockMovement', 'supplier', 'supplierLedger', 'purchase', 'purchaseLine', 'supplierPayment', 'supplierReturn', 'supplierReturnLine', 'stockSettlement', 'stockSettlementLine'];
  let totalNullTenants = 0;
  for (const m of models) {
    const count = await prisma[m].count({ where: { tenantId: null } });
    totalNullTenants += count;
  }
  assert(totalNullTenants === 0, 'Zero NULL tenantId across all 12 inventory tables', `Found: ${totalNullTenants}`);

  console.log('\n================================================================');
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});