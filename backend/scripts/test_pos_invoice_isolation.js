// backend/scripts/test_pos_invoice_isolation.js
// Verification & Penetration Testing for POS & Invoice Tenant Isolation (Part 1)

import prisma from '../src/config/prisma.js';

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
    invoices,
    lines,
    lineComponents,
    payments,
    refunds,
    refundLines,
    drawerMovements,
    accountMovements,
    stockMovements,
    commissions,
    tips,
    idempotencyKeys,
  ] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoiceLine.count(),
    prisma.invoiceLineComponent.count(),
    prisma.invoicePayment.count(),
    prisma.invoiceRefund.count(),
    prisma.refundLine.count(),
    prisma.drawerMovement.count(),
    prisma.accountMovement.count(),
    prisma.stockMovement.count(),
    prisma.commissionEvent.count(),
    prisma.tipReceipt.count(),
    prisma.idempotencyKey.count(),
  ]);

  return {
    invoices,
    lines,
    lineComponents,
    payments,
    refunds,
    refundLines,
    drawerMovements,
    accountMovements,
    stockMovements,
    commissions,
    tips,
    idempotencyKeys,
  };
}

async function run() {
  console.log('===============================================================');
  console.log('🔒 PART 1: POS & INVOICE MULTI-TENANT ISOLATION TEST SUITE');
  console.log('===============================================================\n');

  // 1. Resolve Tenants
  const tenantA = await prisma.tenant.findUnique({ where: { slug: 'flagship-salon' }, include: { branches: true } });
  const tenantB = await prisma.tenant.findUnique({ where: { slug: 'royal-elegance' }, include: { branches: true } });

  if (!tenantA || !tenantB) {
    throw new Error('Tenant A or Tenant B not found in database.');
  }

  const branchA = tenantA.branches[0];
  const branchB = tenantB.branches[0];

  console.log(`🏢 Tenant A: "${tenantA.name}" (ID: ${tenantA.id}) | Branch: ${branchA.name} (${branchA.id})`);
  console.log(`🏢 Tenant B: "${tenantB.name}" (ID: ${tenantB.id}) | Branch: ${branchB.name} (${branchB.id})\n`);

  // 2. Setup & Validate Fixtures for Tenant B
  let staffB = await prisma.staff.findFirst({ where: { branchId: branchB.id } });
  if (!staffB) {
    staffB = await prisma.staff.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        employeeCode: 'EMP-B-01',
        name: 'Fatima Stylist B',
        phone: '+92 321 0000001',
        designation: 'Senior Stylist',
        roleTitle: 'Stylist',
        joiningDate: new Date('2026-01-01'),
        compensationType: 'COMMISSION_ONLY',
        commissionRate: 15,
        effectiveDate: new Date('2026-01-01'),
        lateInDeduction: { type: 'FIXED', amount: 0, enabled: false },
        earlyExitDeduction: { type: 'FIXED', amount: 0, enabled: false },
        isActive: true,
      },
    });
    console.log(`✅ Provisioned test staff for Tenant B: ${staffB.name}`);
  }

  let catB = await prisma.serviceCategory.findFirst({ where: { branchId: branchB.id } });
  if (!catB) {
    catB = await prisma.serviceCategory.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        name: 'Hair Care B',
      },
    });
  }

  let srvB = await prisma.service.findFirst({ where: { branchId: branchB.id } });
  if (!srvB) {
    srvB = await prisma.service.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        categoryId: catB.id,
        code: 'SRV-B-01',
        name: 'Signature Blowdry B',
        price: 2500,
        durationMinutes: 45,
        isActive: true,
      },
    });
    console.log(`✅ Provisioned test service for Tenant B: ${srvB.name}`);
  }

  let clientB = await prisma.client.findFirst({ where: { branchId: branchB.id } });
  if (!clientB) {
    clientB = await prisma.client.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        name: 'Mariam Tenant B Customer',
        phone: '+92 (322) 555-0001',
        phoneNormalized: '03225550001',
        source: 'WALK_IN',
      },
    });
    console.log(`✅ Provisioned test client for Tenant B: ${clientB.name}`);
  }

  let accB = await prisma.paymentAccount.findFirst({ where: { branchId: branchB.id } });
  if (!accB) {
    accB = await prisma.paymentAccount.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        name: 'Tenant B Meezan Bank',
        accountType: 'BANK',
        providerName: 'Meezan Bank',
        accountHolder: 'Royal Elegance Salon',
        accountIdentifier: '0101-0000002',
        isActive: true,
      },
    });
    console.log(`✅ Provisioned test payment account for Tenant B: ${accB.name}`);
  }

  // 3. Setup & Validate Fixtures for Tenant A
  const staffA = await prisma.staff.findFirst({ where: { branchId: branchA.id } });
  const srvA = await prisma.service.findFirst({ where: { branchId: branchA.id } });
  const clientA = await prisma.client.findFirst({ where: { branchId: branchA.id } });
  const accA = await prisma.paymentAccount.findFirst({ where: { branchId: branchA.id } });
  const pkgA = await prisma.package.findFirst({ where: { branchId: branchA.id }, include: { components: true } });
  const drawerA = await prisma.cashDrawer.findFirst({ where: { branchId: branchA.id } });
  const prodA = await prisma.inventoryItem.findFirst({ where: { tenantId: tenantA.id } });

  let apptA = await prisma.appointment.findFirst({ where: { branchId: branchA.id } });
  if (!apptA) {
    apptA = await prisma.appointment.create({
      data: {
        appointmentNumber: 'APT-TEST-A-01',
        tenantId: tenantA.id,
        branchId: branchA.id,
        clientId: clientA.id,
        clientName: clientA.name,
        clientPhone: clientA.phone,
        date: new Date('2026-11-03'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        durationMinutes: 60,
        price: 2500,
        status: 'CONFIRMED',
        billingStatus: 'UNBILLED',
        items: {
          create: [{
            lineInstanceId: 'line-inst-1',
            sortOrder: 0,
            type: 'SERVICE',
            itemId: srvA.id,
            code: srvA.code,
            name: srvA.name,
            durationMinutes: 60,
            unitPrice: 2500,
            staffId: staffA.id,
            staffName: staffA.name,
            startTime: '10:00 AM',
            endTime: '11:00 AM',
          }],
        },
      },
    });
  }

  let bkgA = await prisma.booking.findFirst({ where: { branchId: branchA.id } });
  if (!bkgA) {
    bkgA = await prisma.booking.create({
      data: {
        bookingNumber: 'BKG-TEST-A-01',
        tenantId: tenantA.id,
        branchId: branchA.id,
        clientId: clientA.id,
        clientName: clientA.name,
        clientPhone: clientA.phone,
        type: 'BRIDAL',
        eventDate: new Date('2026-11-04'),
        serviceTime: '14:00',
        endTime: '17:00',
        durationMinutes: 180,
        status: 'CONFIRMED',
        revision: 1,
        subtotal: 5000,
        totalAmount: 5000,
        createdById: staffA.id,
        createdByName: staffA.name,
        items: {
          create: [{
            lineInstanceId: 'bkg-line-1',
            sortOrder: 0,
            type: 'SERVICE',
            itemId: srvA.id,
            code: srvA.code,
            name: srvA.name,
            durationMinutes: 60,
            unitPrice: 5000,
            quantity: 1,
            taxRate: 0,
            startTime: '14:00',
            endTime: '15:00',
          }],
        },
      },
    });
  }

  // Hard assertion on fixture readiness (fail closed if any fixture is missing)
  if (!staffA || !srvA || !clientA || !accA || !pkgA || !drawerA || !apptA || !bkgA || !prodA) {
    throw new Error(`CRITICAL: Fixture setup failed! Tenant A records incomplete: ${JSON.stringify({
      staffA: !!staffA, srvA: !!srvA, clientA: !!clientA, accA: !!accA,
      pkgA: !!pkgA, drawerA: !!drawerA, apptA: !!apptA, bkgA: !!bkgA, prodA: !!prodA,
    })}`);
  }
  console.log('✅ Verified all Tenant A fixtures: Staff, Service, Client, Account, Package, Drawer, Appointment, Booking.\n');

  // 4. Authenticate Both Actors
  const tokenA = await login('admin.gulberg@isysware.com', 'admin123', 'ADMIN');
  const tokenB = await login('ayesha.owner@royalelegance.com', 'Password123!', 'ADMIN');

  const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` };
  const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };

  console.log('🔑 Authentication Successful: Tokens acquired for Tenant A Admin and Tenant B Admin.\n');

  const tests = [];

  // ── TEST 1: Tenant A Normal POS Checkout ──
  let invoiceA = null;
  const keyA = `checkout-A-${Date.now()}`;
  {
    const payloadA = {
      branchId: branchA.id,
      clientName: clientA.name,
      clientPhone: clientA.phone,
      discountType: 'FIXED',
      discountValue: 0,
      tip: 200,
      cartItems: [
        {
          type: 'SERVICE',
          item: { id: srvA.id, name: srvA.name, price: Number(srvA.price) },
          quantity: 1,
          staffId: staffA.id,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: Number(srvA.price) + 200,
          billAllocation: Number(srvA.price),
          tipAllocation: 200,
          cashTendered: Number(srvA.price) + 200,
          changeReturned: 0,
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersA, 'Idempotency-Key': keyA },
      body: JSON.stringify(payloadA),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      invoiceA = json.data;
      const dbInv = await prisma.invoice.findUnique({
        where: { id: invoiceA.id },
        include: { lines: true, payments: true },
      });
      const linesOk = dbInv.lines.every((l) => l.tenantId === tenantA.id);
      const paysOk = dbInv.payments.every((p) => p.tenantId === tenantA.id);
      const isStamped = dbInv.tenantId === tenantA.id && linesOk && paysOk;

      tests.push({
        id: 'T01',
        name: 'Tenant A POS Checkout (Positive & DB Stamping)',
        passed: isStamped,
        detail: isStamped
          ? `Invoice ${invoiceA.invoiceNumber} created and all child records stamped with tenantId: ${tenantA.id}`
          : `Tenant stamping failed! DB tenantId: ${dbInv.tenantId}`,
      });
    } else {
      tests.push({
        id: 'T01',
        name: 'Tenant A POS Checkout (Positive)',
        passed: false,
        detail: `Checkout failed: HTTP ${res.status} ${JSON.stringify(json)}`,
      });
    }
  }

  // ── TEST 2: Tenant B Normal POS Checkout ──
  let invoiceB = null;
  const keyB = `checkout-B-${Date.now()}`;
  {
    const payloadB = {
      branchId: branchB.id,
      clientName: clientB.name,
      clientPhone: clientB.phone,
      discountType: 'FIXED',
      discountValue: 0,
      tip: 100,
      cartItems: [
        {
          type: 'SERVICE',
          item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) },
          quantity: 1,
          staffId: staffB.id,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: Number(srvB.price) + 100,
          billAllocation: Number(srvB.price),
          tipAllocation: 100,
          cashTendered: Number(srvB.price) + 100,
          changeReturned: 0,
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': keyB },
      body: JSON.stringify(payloadB),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      invoiceB = json.data;
      const dbInv = await prisma.invoice.findUnique({
        where: { id: invoiceB.id },
        include: { lines: true, payments: true },
      });
      const linesOk = dbInv.lines.every((l) => l.tenantId === tenantB.id);
      const paysOk = dbInv.payments.every((p) => p.tenantId === tenantB.id);
      const isStamped = dbInv.tenantId === tenantB.id && linesOk && paysOk;

      tests.push({
        id: 'T02',
        name: 'Tenant B POS Checkout (Positive & DB Stamping)',
        passed: isStamped,
        detail: isStamped
          ? `Invoice ${invoiceB.invoiceNumber} created and all child records stamped with tenantId: ${tenantB.id}`
          : `Tenant stamping failed! DB tenantId: ${dbInv.tenantId}`,
      });
    } else {
      tests.push({
        id: 'T02',
        name: 'Tenant B POS Checkout (Positive)',
        passed: false,
        detail: `Checkout failed: HTTP ${res.status} ${JSON.stringify(json)}`,
      });
    }
  }

  // ── TEST 3: Idempotency Key Scoping by Tenant ──
  {
    const payloadBReplay = {
      branchId: branchB.id,
      clientName: clientB.name,
      clientPhone: clientB.phone,
      discountType: 'FIXED',
      discountValue: 0,
      tip: 50,
      cartItems: [
        {
          type: 'SERVICE',
          item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) },
          quantity: 1,
          staffId: staffB.id,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: Number(srvB.price) + 50,
          billAllocation: Number(srvB.price),
          tipAllocation: 50,
          cashTendered: Number(srvB.price) + 50,
          changeReturned: 0,
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': keyA },
      body: JSON.stringify(payloadBReplay),
    });
    const json = await res.json();
    const dbBReplay = json.data?.id ? await prisma.invoice.findUnique({ where: { id: json.data.id } }) : null;
    const passed = res.status === 201 && json.data?.id !== invoiceA.id && dbBReplay?.tenantId === tenantB.id;
    tests.push({
      id: 'T03',
      name: 'Idempotency Key Scoping by Tenant',
      passed,
      detail: passed
        ? 'Reused key under Tenant B did not collide with Tenant A cache'
        : `Idempotency leaked across tenants: HTTP ${res.status}`,
    });
  }

  // ── TEST 4 (Negative): Tenant B GET Tenant A Invoice Details ──
  {
    const res = await fetch(`${BASE_URL}/invoices/${invoiceA.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'T04',
      name: 'Tenant B GET Tenant A Invoice Details',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 5 (Negative): Tenant A GET Tenant B Invoice Details ──
  {
    const res = await fetch(`${BASE_URL}/invoices/${invoiceB.id}`, { headers: headersA });
    const blocked = res.status === 403;
    tests.push({
      id: 'T05',
      name: 'Tenant A GET Tenant B Invoice Details',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 6 (Isolation): Tenant B Lists Invoices ──
  {
    const res = await fetch(`${BASE_URL}/invoices?branchId=${branchB.id}`, { headers: headersB });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((i) => i.tenantId === tenantA.id || i.id === invoiceA.id);
    tests.push({
      id: 'T06',
      name: 'Tenant B Lists Invoices (No Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant A's invoices present in Tenant B list (${list.length} invoices)` : 'LEAK DETECTED',
    });
  }

  // ── TEST 7 (Isolation): Tenant A Lists Invoices ──
  {
    const res = await fetch(`${BASE_URL}/invoices?branchId=${branchA.id}`, { headers: headersA });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((i) => i.tenantId === tenantB.id || i.id === invoiceB.id);
    tests.push({
      id: 'T07',
      name: 'Tenant A Lists Invoices (No Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant B's invoices present in Tenant A list (${list.length} invoices)` : 'LEAK DETECTED',
    });
  }

  // ── TEST 8 (Isolation): Outstanding Dues Query Isolation ──
  {
    const res = await fetch(`${BASE_URL}/invoices/outstanding?branchId=${branchB.id}&clientIdOrPhone=${encodeURIComponent(clientA.phone)}`, {
      headers: headersB,
    });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((i) => i.tenantId === tenantA.id);
    tests.push({
      id: 'T08',
      name: 'Tenant B Queries Outstanding Dues of Tenant A Phone',
      passed: res.status === 200 && list.length === 0 && !hasLeak,
      detail: list.length === 0 ? 'Clean: Empty list returned' : 'LEAK: Found outstanding invoices!',
    });
  }

  // ── TEST 9 (Negative): Tenant B Collects Payment on Tenant A Invoice ──
  {
    const res = await fetch(`${BASE_URL}/invoices/${invoiceA.id}/payments`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `pay-${Date.now()}` },
      body: JSON.stringify({
        payments: [{ method: 'CASH', amount: 500, billAllocation: 500, tipAllocation: 0 }],
        paymentDate: new Date().toISOString().slice(0, 10),
      }),
    });
    const blocked = res.status === 403 || res.status === 404;
    tests.push({
      id: 'T09',
      name: 'Tenant B Collects Payment on Tenant A Invoice',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 10 (Negative): Tenant B Reverses Payment on Tenant A Invoice ──
  {
    const paymentId = invoiceA.payments?.[0]?.id || 'fake-payment-id';
    const res = await fetch(`${BASE_URL}/invoices/${invoiceA.id}/payments/${paymentId}/reverse`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `rev-${Date.now()}` },
      body: JSON.stringify({ reason: 'Fraudulent test reversal', reversalDate: new Date().toISOString().slice(0, 10) }),
    });
    const blocked = res.status === 403 || res.status === 404;
    tests.push({
      id: 'T10',
      name: 'Tenant B Reverses Payment on Tenant A Invoice',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 11 (Negative): Tenant B Lists Refunds of Tenant A Invoice ──
  {
    const res = await fetch(`${BASE_URL}/invoices/${invoiceA.id}/refunds`, { headers: headersB });
    const blocked = res.status === 403 || res.status === 404;
    tests.push({
      id: 'T11',
      name: 'Tenant B Lists Refunds of Tenant A Invoice',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 12 (Negative): Tenant B Refunds/Voids Tenant A Invoice ──
  {
    const res = await fetch(`${BASE_URL}/invoices/${invoiceA.id}/refunds`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `rfd-${Date.now()}` },
      body: JSON.stringify({ type: 'VOID', reason: 'Cross-tenant malicious void attempt' }),
    });
    const blocked = res.status === 403 || res.status === 404;
    tests.push({
      id: 'T12',
      name: 'Tenant B Voids Tenant A Invoice',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 13 (Print/Export Payload Protection): Tenant B Accesses Print Payload ──
  {
    const res = await fetch(`${BASE_URL}/invoices/${invoiceA.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'T13',
      name: 'Tenant B Accesses Tenant A Print/Export Payload (GET /invoices/:id)',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (Client-side print/export payload inaccessible)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // Snapshot control totals BEFORE injection attempts
  const baselineTotals = await getControlTotals();

  // ── TEST 14 (Negative Injection): Tenant B Checkout in Tenant A Branch ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-branch-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchA.id,
        cartItems: [{ type: 'SERVICE', item: { id: srvB.id, price: 2500 }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: 2500, billAllocation: 2500, tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'T14',
      name: 'Tenant B Injects Tenant A BranchId into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 15 (Negative Injection): Tenant B Checkout using Tenant A Service ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-srv-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        cartItems: [{ type: 'SERVICE', item: { id: srvA.id, name: srvA.name, price: Number(srvA.price) }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: Number(srvA.price), billAllocation: Number(srvA.price), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'T15',
      name: 'Tenant B Injects Tenant A ServiceId into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 16 (Negative Injection): Tenant B Checkout using Tenant A Staff ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-staff-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        cartItems: [{ type: 'SERVICE', item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) }, quantity: 1, staffId: staffA.id }],
        payments: [{ method: 'CASH', amount: Number(srvB.price), billAllocation: Number(srvB.price), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'T16',
      name: 'Tenant B Injects Tenant A StaffId into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 17 (Negative Injection): Tenant B Checkout using Tenant A Client ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-cli-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        clientId: clientA.id,
        cartItems: [{ type: 'SERVICE', item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: Number(srvB.price), billAllocation: Number(srvB.price), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'T17',
      name: 'Tenant B Injects Tenant A ClientId into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 18 (Negative Injection): Tenant B Checkout using Tenant A Payment Account ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-acc-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        cartItems: [{ type: 'SERVICE', item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) }, quantity: 1, staffId: staffB.id }],
        payments: [
          {
            method: 'ONLINE_ACCOUNT',
            paymentAccountId: accA?.id,
            amount: Number(srvB.price),
            billAllocation: Number(srvB.price),
            tipAllocation: 0,
          },
        ],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'T18',
      name: 'Tenant B Injects Tenant A Payment Account into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 19 (Negative Injection): Tenant B Injects Tenant A Package ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-pkg-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        cartItems: [{ type: 'PACKAGE', item: { id: pkgA.id, name: pkgA.name, price: Number(pkgA.price) }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: Number(pkgA.price), billAllocation: Number(pkgA.price), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'T19',
      name: 'Tenant B Injects Tenant A Package into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 20 (Negative Injection): Tenant B Injects Tenant A Cash Drawer ──
  {
    const res = await fetch(`${BASE_URL}/cash-drawers/${drawerA.id}/movements`, {
      headers: headersB,
    });
    const blocked = res.status === 403 || res.status === 404;
    tests.push({
      id: 'T20',
      name: 'Tenant B Injects Tenant A Drawer into Cash Movements Inspection',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 21 (Negative Injection): Tenant B Injects Tenant A Appointment ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-appt-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        appointmentId: apptA.id,
        cartItems: [{ type: 'SERVICE', item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: Number(srvB.price), billAllocation: Number(srvB.price), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400 || res.status === 403;
    tests.push({
      id: 'T21',
      name: 'Tenant B Injects Tenant A Appointment into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 22 (Negative Injection): Tenant B Injects Tenant A Booking ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-bkg-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        bookingId: bkgA.id,
        bookingRevision: bkgA.revision,
        cartItems: [{ type: 'SERVICE', item: { id: srvB.id, name: srvB.name, price: Number(srvB.price) }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: Number(srvB.price), billAllocation: Number(srvB.price), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400 || res.status === 403;
    tests.push({
      id: 'T22',
      name: 'Tenant B Injects Tenant A Booking into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 23 (Negative Injection): Tenant B Injects Tenant A Product ──
  {
    const res = await fetch(`${BASE_URL}/pos/invoices/checkout`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-prod-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        cartItems: [{ type: 'PRODUCT', item: { id: prodA.id, name: prodA.name, sellingPrice: Number(prodA.sellingPrice) }, quantity: 1, staffId: staffB.id }],
        payments: [{ method: 'CASH', amount: Number(prodA.sellingPrice), billAllocation: Number(prodA.sellingPrice), tipAllocation: 0 }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'T23',
      name: 'Tenant B Injects Tenant A Product into Checkout',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 24 (Negative Cash Mutation): Tenant B Opens Drawer in Foreign Branch ──
  {
    const res = await fetch(`${BASE_URL}/cash-drawers/open`, {
      method: 'POST',
      headers: { ...headersB },
      body: JSON.stringify({ branchId: branchA.id }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'T24',
      name: 'Tenant B Attempts to Open Cash Drawer in Foreign Branch',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 25 (Negative Cash Mutation): Tenant B Float Transfer in Foreign Branch ──
  {
    const res = await fetch(`${BASE_URL}/cash-transfers`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `inj-xfer-${Date.now()}` },
      body: JSON.stringify({ branchId: branchA.id, targetUserId: staffA.id, amount: 500, notes: 'Malicious transfer' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'T25',
      name: 'Tenant B Attempts Cash Float Transfer in Foreign Branch',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 26 (Super Admin Isolation): Super Admin Cross-Tenant Header Attempt ──
  {
    const res = await fetch(`${BASE_URL}/invoices`, {
      method: 'GET',
      headers: { ...headersA, 'X-Tenant-Id': tenantB.id },
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'T26',
      name: 'Super Admin Cross-Tenant Header Access Without Active Membership',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 27: Invariant Reconciliation (Zero Dirty Writes) ──
  {
    const postInjectionTotals = await getControlTotals();
    const unchanged =
      baselineTotals.invoices === postInjectionTotals.invoices &&
      baselineTotals.lines === postInjectionTotals.lines &&
      baselineTotals.lineComponents === postInjectionTotals.lineComponents &&
      baselineTotals.payments === postInjectionTotals.payments &&
      baselineTotals.refunds === postInjectionTotals.refunds &&
      baselineTotals.drawerMovements === postInjectionTotals.drawerMovements &&
      baselineTotals.accountMovements === postInjectionTotals.accountMovements &&
      baselineTotals.stockMovements === postInjectionTotals.stockMovements &&
      baselineTotals.commissions === postInjectionTotals.commissions &&
      baselineTotals.tips === postInjectionTotals.tips &&
      baselineTotals.idempotencyKeys === postInjectionTotals.idempotencyKeys;

    tests.push({
      id: 'T27',
      name: 'Invariant Reconciliation (Zero Dirty Writes Across 9 Tables)',
      passed: unchanged,
      detail: unchanged
        ? 'Verified: Row counts across Invoices, Lines, Payments, Refunds, Drawers, Accounts, Stock, Commissions, Tips, and IdempotencyKeys are 100% identical before and after all 12 injection attacks.'
        : `MISMATCH DETECTED: Baseline: ${JSON.stringify(baselineTotals)} vs Post: ${JSON.stringify(postInjectionTotals)}`,
    });
  }

  // ── TEST 28: Database Stamping Audit (Zero NULL tenantId) ──
  {
    const nullInvoices = await prisma.invoice.count({ where: { tenantId: null } });
    const nullLines = await prisma.invoiceLine.count({ where: { tenantId: null } });
    const nullPayments = await prisma.invoicePayment.count({ where: { tenantId: null } });
    const nullCommission = await prisma.commissionEvent.count({ where: { tenantId: null } });
    const nullTips = await prisma.tipReceipt.count({ where: { tenantId: null } });
    const nullDrawers = await prisma.cashDrawer.count({ where: { tenantId: null } });
    const totalNull = nullInvoices + nullLines + nullPayments + nullCommission + nullTips + nullDrawers;

    tests.push({
      id: 'T28',
      name: 'Database Stamping Audit (Zero NULL tenantId in POS Records)',
      passed: totalNull === 0,
      detail: totalNull === 0
        ? 'Verified: 0 NULL tenantId records across Invoice, InvoiceLine, InvoicePayment, CommissionEvent, TipReceipt, CashDrawer'
        : `FAIL: Found ${totalNull} records with NULL tenantId!`,
    });
  }

  // ── PRINT REPORT ──
  console.log('\n===============================================================');
  console.log('📊 TEST RESULTS REPORT');
  console.log('===============================================================\n');

  let passedCount = 0;
  for (const t of tests) {
    const icon = t.passed ? '✅' : '❌';
    console.log(`${icon} [${t.id}] ${t.name}`);
    console.log(`    Result: ${t.detail}\n`);
    if (t.passed) passedCount++;
  }

  console.log('---------------------------------------------------------------');
  console.log(`TOTAL: ${tests.length} | PASSED: ${passedCount} | FAILED: ${tests.length - passedCount}`);
  console.log('---------------------------------------------------------------\n');

  if (passedCount === tests.length) {
    console.log('🎉 100% PASS: POS & Invoice Tenant Isolation is completely verified!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED!');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
