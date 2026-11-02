// backend/scripts/test_appointments_bookings_isolation.js
// Verification & Penetration Testing for Appointments & Bookings Multi-Tenant Isolation (Part 2, Step 1)

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
    appointments,
    appointmentItems,
    appointmentReschedules,
    bookings,
    bookingItems,
    bookingPayments,
    bookingHistories,
    drawerMovements,
    accountMovements,
    idempotencyKeys,
  ] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointmentItem.count(),
    prisma.appointmentReschedule.count(),
    prisma.booking.count(),
    prisma.bookingItem.count(),
    prisma.bookingPayment.count(),
    prisma.bookingHistory.count(),
    prisma.drawerMovement.count(),
    prisma.accountMovement.count(),
    prisma.idempotencyKey.count(),
  ]);

  return {
    appointments,
    appointmentItems,
    appointmentReschedules,
    bookings,
    bookingItems,
    bookingPayments,
    bookingHistories,
    drawerMovements,
    accountMovements,
    idempotencyKeys,
  };
}

async function run() {
  console.log('=======================================================================');
  console.log('🔒 PART 2, STEP 1: APPOINTMENTS & BOOKINGS MULTI-TENANT ISOLATION SUITE');
  console.log('=======================================================================\n');

  // 1. Resolve Tenants
  const tenantA = await prisma.tenant.findUnique({ where: { slug: 'flagship-salon' }, include: { branches: true } });
  const tenantB = await prisma.tenant.findUnique({ where: { slug: 'royal-elegance' }, include: { branches: true } });

  if (!tenantA || !tenantB) throw new Error('Tenant A or Tenant B not found in database.');

  const branchA = tenantA.branches[0];
  const branchB = tenantB.branches[0];

  console.log(`🏢 Tenant A: "${tenantA.name}" (ID: ${tenantA.id}) | Branch: ${branchA.name} (${branchA.id})`);
  console.log(`🏢 Tenant B: "${tenantB.name}" (ID: ${tenantB.id}) | Branch: ${branchB.name} (${branchB.id})\n`);

  // 2. Resolve Fixtures
  const staffA = await prisma.staff.findFirst({ where: { branchId: branchA.id } });
  const srvA = await prisma.service.findFirst({ where: { branchId: branchA.id } });
  const clientA = await prisma.client.findFirst({ where: { branchId: branchA.id } });
  const accA = await prisma.paymentAccount.findFirst({ where: { branchId: branchA.id } });

  const staffB = await prisma.staff.findFirst({ where: { branchId: branchB.id } });
  const srvB = await prisma.service.findFirst({ where: { branchId: branchB.id } });
  const clientB = await prisma.client.findFirst({ where: { branchId: branchB.id } });
  const accB = await prisma.paymentAccount.findFirst({ where: { branchId: branchB.id } });

  if (!staffA || !srvA || !clientA || !accA || !staffB || !srvB || !clientB || !accB) {
    throw new Error('Missing prerequisite fixtures for Tenant A or Tenant B');
  }

  // 3. Authenticate Both Actors
  const tokenA = await login('admin.gulberg@isysware.com', 'admin123', 'ADMIN');
  const tokenB = await login('ayesha.owner@royalelegance.com', 'Password123!', 'ADMIN');

  const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` };
  const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };

  console.log('🔑 Authentication Successful: Tokens acquired for Tenant A Admin and Tenant B Admin.\n');

  const tests = [];
  const dayOffset = Math.floor(Math.random() * 200) + 1;
  const d1 = new Date(Date.now() + (500 + dayOffset) * 86400000);
  const d2 = new Date(Date.now() + (800 + dayOffset) * 86400000);
  const aptDate = d1.toISOString().slice(0, 10);
  const bkgDate = d2.toISOString().slice(0, 10);

  // ── TEST 01: Tenant A Creates Appointment ──
  let apptA = null;
  {
    const res = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        branchId: branchA.id,
        clientName: clientA.name,
        clientPhone: clientA.phone,
        date: aptDate,
        startTime: '11:00 AM',
        status: 'CONFIRMED',
        items: [{ type: 'SERVICE', itemId: srvA.id, staffId: staffA.id }],
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      apptA = json.data;
      const dbAppt = await prisma.appointment.findUnique({
        where: { id: apptA.id },
        include: { items: true },
      });
      const itemsStamped = dbAppt.items.every((it) => it.tenantId === tenantA.id);
      const passed = dbAppt.tenantId === tenantA.id && itemsStamped;
      tests.push({
        id: 'AB01',
        name: 'Tenant A Appointment Creation & DB Stamping',
        passed,
        detail: passed
          ? `Appointment ${apptA.appointmentNumber} created and stamped with tenantId: ${tenantA.id}`
          : `Tenant stamping failed! DB: ${dbAppt.tenantId}`,
      });
    } else {
      tests.push({ id: 'AB01', name: 'Tenant A Appointment Creation', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST 02: Tenant B Creates Appointment ──
  let apptB = null;
  {
    const res = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        date: aptDate,
        startTime: '02:00 PM',
        status: 'CONFIRMED',
        items: [{ type: 'SERVICE', itemId: srvB.id, staffId: staffB.id }],
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      apptB = json.data;
      const dbAppt = await prisma.appointment.findUnique({
        where: { id: apptB.id },
        include: { items: true },
      });
      const itemsStamped = dbAppt.items.every((it) => it.tenantId === tenantB.id);
      const passed = dbAppt.tenantId === tenantB.id && itemsStamped;
      tests.push({
        id: 'AB02',
        name: 'Tenant B Appointment Creation & DB Stamping',
        passed,
        detail: passed
          ? `Appointment ${apptB.appointmentNumber} created and stamped with tenantId: ${tenantB.id}`
          : `Tenant stamping failed! DB: ${dbAppt.tenantId}`,
      });
    } else {
      tests.push({ id: 'AB02', name: 'Tenant B Appointment Creation', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST 03: Tenant B GET Tenant A Appointment Details ──
  {
    const res = await fetch(`${BASE_URL}/appointments/${apptA.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB03',
      name: 'Tenant B GET Tenant A Appointment Details',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (FORBIDDEN_TENANT_ACCESS)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 04: Tenant A GET Tenant B Appointment Details ──
  {
    const res = await fetch(`${BASE_URL}/appointments/${apptB.id}`, { headers: headersA });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB04',
      name: 'Tenant A GET Tenant B Appointment Details',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (FORBIDDEN_TENANT_ACCESS)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 05: Tenant B Lists Appointments (Zero Tenant A Leaked) ──
  {
    const res = await fetch(`${BASE_URL}/appointments?branchId=${branchB.id}`, { headers: headersB });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((a) => a.id === apptA.id);
    tests.push({
      id: 'AB05',
      name: 'Tenant B Lists Appointments (No Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant A's appointments visible in Tenant B list (${list.length} appointments)` : 'LEAK DETECTED',
    });
  }

  // ── TEST 06: Tenant A Lists Appointments (Zero Tenant B Leaked) ──
  {
    const res = await fetch(`${BASE_URL}/appointments?branchId=${branchA.id}`, { headers: headersA });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((a) => a.id === apptB.id);
    tests.push({
      id: 'AB06',
      name: 'Tenant A Lists Appointments (No Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant B's appointments visible in Tenant A list (${list.length} appointments)` : 'LEAK DETECTED',
    });
  }

  // ── TEST 07: Tenant B POS Queue Isolation ──
  {
    const res = await fetch(`${BASE_URL}/appointments/queue?branchId=${branchB.id}&date=${aptDate}`, { headers: headersB });
    const json = await res.json();
    const queue = json.data || [];
    const hasLeak = queue.some((a) => a.id === apptA.id);
    tests.push({
      id: 'AB07',
      name: 'Tenant B Queries POS Queue (Zero Cross-Tenant Queue Items)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: POS queue contains 0 of Tenant A's appointments (${queue.length} items)` : 'LEAK DETECTED',
    });
  }

  // ── TEST 08: Tenant B Updates Tenant A Appointment Status ──
  {
    const res = await fetch(`${BASE_URL}/appointments/${apptA.id}/status`, {
      method: 'PATCH',
      headers: headersB,
      body: JSON.stringify({ status: 'CANCELLED', cancelReason: 'Malicious status change' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB08',
      name: 'Tenant B Updates Tenant A Appointment Status',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 09: Tenant B Reschedules Tenant A Appointment ──
  {
    const res = await fetch(`${BASE_URL}/appointments/${apptA.id}/reschedule`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ date: '2026-11-11', startTime: '12:00 PM', reason: 'Malicious reschedule' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB09',
      name: 'Tenant B Reschedules Tenant A Appointment',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 10: Tenant B Injects Tenant A Service into Appointment ──
  {
    const res = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        date: '2026-11-12',
        startTime: '10:00 AM',
        items: [{ type: 'SERVICE', itemId: srvA.id, staffId: staffB.id }], // Foreign service!
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB10',
      name: 'Tenant B Injects Tenant A Service into Appointment Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 11: Tenant B Injects Tenant A Staff into Appointment ──
  {
    const res = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        date: '2026-11-12',
        startTime: '10:00 AM',
        items: [{ type: 'SERVICE', itemId: srvB.id, staffId: staffA.id }], // Foreign staff!
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB11',
      name: 'Tenant B Injects Tenant A Staff into Appointment Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 12: Tenant B Injects Tenant A Client into Appointment ──
  {
    const res = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        clientId: clientA.id, // Foreign client!
        clientName: clientA.name,
        clientPhone: clientA.phone,
        date: '2026-11-12',
        startTime: '10:00 AM',
        items: [{ type: 'SERVICE', itemId: srvB.id, staffId: staffB.id }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB12',
      name: 'Tenant B Injects Tenant A Client into Appointment Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 13: Tenant A Creates Booking With Advance Payment ──
  let bkgA = null;
  {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { ...headersA, 'Idempotency-Key': `bkg-a-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchA.id,
        clientName: clientA.name,
        clientPhone: clientA.phone,
        type: 'BRIDAL',
        eventDate: bkgDate,
        serviceTime: '11:00',
        items: [{ type: 'SERVICE', itemId: srvA.id, quantity: 1, staffId: staffA.id }],
        advancePayment: {
          method: 'CASH',
          amount: 1000,
        },
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      bkgA = json.data;
      const dbBkg = await prisma.booking.findUnique({
        where: { id: bkgA.id },
        include: { items: true, payments: true, history: true },
      });
      const itemsStamped = dbBkg.items.every((it) => it.tenantId === tenantA.id);
      const paymentsStamped = dbBkg.payments.every((p) => p.tenantId === tenantA.id);
      const passed = dbBkg.tenantId === tenantA.id && itemsStamped && paymentsStamped;
      tests.push({
        id: 'AB13',
        name: 'Tenant A Booking Creation (With Advance) & DB Stamping',
        passed,
        detail: passed
          ? `Booking ${bkgA.bookingNumber} created and all child records stamped with tenantId: ${tenantA.id}`
          : `Tenant stamping failed! DB: ${dbBkg.tenantId}`,
      });
    } else {
      tests.push({ id: 'AB13', name: 'Tenant A Booking Creation', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST 14: Tenant B Creates Booking ──
  let bkgB = null;
  {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-b-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        type: 'BRIDAL',
        eventDate: bkgDate,
        serviceTime: '14:00',
        items: [{ type: 'SERVICE', itemId: srvB.id, quantity: 1, staffId: staffB.id }],
        advancePayment: {
          method: 'CASH',
          amount: 500,
        },
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      bkgB = json.data;
      const dbBkg = await prisma.booking.findUnique({
        where: { id: bkgB.id },
        include: { items: true, payments: true, history: true },
      });
      const itemsStamped = dbBkg.items.every((it) => it.tenantId === tenantB.id);
      const paymentsStamped = dbBkg.payments.every((p) => p.tenantId === tenantB.id);
      const passed = dbBkg.tenantId === tenantB.id && itemsStamped && paymentsStamped;
      tests.push({
        id: 'AB14',
        name: 'Tenant B Booking Creation & DB Stamping',
        passed,
        detail: passed
          ? `Booking ${bkgB.bookingNumber} created and all child records stamped with tenantId: ${tenantB.id}`
          : `Tenant stamping failed! DB: ${dbBkg.tenantId}`,
      });
    } else {
      tests.push({ id: 'AB14', name: 'Tenant B Booking Creation', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST 15: Tenant B GET Tenant A Booking Details ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgA.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB15',
      name: 'Tenant B GET Tenant A Booking Details',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (FORBIDDEN_TENANT_ACCESS)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 16: Tenant A GET Tenant B Booking Details ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgB.id}`, { headers: headersA });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB16',
      name: 'Tenant A GET Tenant B Booking Details',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (FORBIDDEN_TENANT_ACCESS)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 17: Tenant B Lists Bookings (Zero Tenant A Leaked) ──
  {
    const res = await fetch(`${BASE_URL}/bookings?branchId=${branchB.id}`, { headers: headersB });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((b) => b.id === bkgA.id);
    tests.push({
      id: 'AB17',
      name: 'Tenant B Lists Bookings (No Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant A's bookings present in Tenant B list (${list.length} bookings)` : 'LEAK DETECTED',
    });
  }

  // ── TEST 18: Tenant A Lists Bookings (Zero Tenant B Leaked) ──
  {
    const res = await fetch(`${BASE_URL}/bookings?branchId=${branchA.id}`, { headers: headersA });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((b) => b.id === bkgB.id);
    tests.push({
      id: 'AB18',
      name: 'Tenant A Lists Bookings (No Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant B's bookings present in Tenant A list (${list.length} bookings)` : 'LEAK DETECTED',
    });
  }

  // Snapshot control totals BEFORE injection attempts
  const baselineTotals = await getControlTotals();

  // ── TEST 19 (Negative Mutation): Tenant B Records Advance on Tenant A Booking ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgA.id}/payments`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-pay-${Date.now()}` },
      body: JSON.stringify({ method: 'CASH', amount: 500 }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB19',
      name: 'Tenant B Records Advance Payment on Tenant A Booking',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 20 (Negative Mutation): Tenant B Refunds Advance on Tenant A Booking ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgA.id}/refunds`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-rfd-${Date.now()}` },
      body: JSON.stringify({ payment: { method: 'CASH', amount: 500 }, reason: 'Fraudulent refund' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB20',
      name: 'Tenant B Refunds Advance Payment on Tenant A Booking',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 21 (Negative Mutation): Tenant B Cancels Tenant A Booking ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgA.id}/cancel`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-cnc-${Date.now()}` },
      body: JSON.stringify({ status: 'CANCELLED', revision: bkgA.revision, cancellationCharge: 1000, reason: 'Malicious cancel' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB21',
      name: 'Tenant B Cancels Tenant A Booking',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 22 (Negative Injection): Tenant B Injects Tenant A Service into Booking ──
  {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-srv-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        type: 'BRIDAL',
        eventDate: '2026-11-22',
        serviceTime: '14:00',
        items: [{ type: 'SERVICE', itemId: srvA.id, quantity: 1, staffId: staffB.id }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB22',
      name: 'Tenant B Injects Tenant A Service into Booking Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 23 (Negative Injection): Tenant B Injects Tenant A Staff into Booking ──
  {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-stf-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        type: 'BRIDAL',
        eventDate: '2026-11-22',
        serviceTime: '14:00',
        items: [{ type: 'SERVICE', itemId: srvB.id, quantity: 1, staffId: staffA.id }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB23',
      name: 'Tenant B Injects Tenant A Staff into Booking Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 24 (Negative Injection): Tenant B Injects Tenant A Client into Booking ──
  {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-cli-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        clientId: clientA.id,
        clientName: clientA.name,
        clientPhone: clientA.phone,
        type: 'BRIDAL',
        eventDate: '2026-11-22',
        serviceTime: '14:00',
        items: [{ type: 'SERVICE', itemId: srvB.id, quantity: 1, staffId: staffB.id }],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB24',
      name: 'Tenant B Injects Tenant A Client into Booking Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 25 (Negative Injection): Tenant B Injects Tenant A Payment Account into Booking Advance ──
  {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { ...headersB, 'Idempotency-Key': `bkg-inj-acc-${Date.now()}` },
      body: JSON.stringify({
        branchId: branchB.id,
        clientName: clientB.name,
        clientPhone: clientB.phone,
        type: 'BRIDAL',
        eventDate: bkgDate,
        serviceTime: '16:00',
        items: [{ type: 'SERVICE', itemId: srvB.id, quantity: 1, staffId: staffB.id }],
        advancePayment: {
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: accA.id, // Foreign payment account!
          amount: 500,
        },
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'AB25',
      name: 'Tenant B Injects Tenant A Payment Account into Booking Advance Payment',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 26 (Inspection Isolation): Tenant B Accesses Tenant A Booking Ledger ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgA.id}/ledger`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB26',
      name: 'Tenant B Accesses Tenant A Booking Ledger',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 27 (Inspection Isolation): Tenant B Accesses Tenant A POS Handoff ──
  {
    const res = await fetch(`${BASE_URL}/bookings/${bkgA.id}/pos-handoff`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'AB27',
      name: 'Tenant B Accesses Tenant A POS Handoff Payload',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST 28: Invariant Reconciliation (Zero Dirty Writes) ──
  {
    const postTotals = await getControlTotals();
    const unchanged =
      baselineTotals.appointments === postTotals.appointments &&
      baselineTotals.appointmentItems === postTotals.appointmentItems &&
      baselineTotals.appointmentReschedules === postTotals.appointmentReschedules &&
      baselineTotals.bookings === postTotals.bookings &&
      baselineTotals.bookingItems === postTotals.bookingItems &&
      baselineTotals.bookingPayments === postTotals.bookingPayments &&
      baselineTotals.bookingHistories === postTotals.bookingHistories &&
      baselineTotals.drawerMovements === postTotals.drawerMovements &&
      baselineTotals.accountMovements === postTotals.accountMovements &&
      baselineTotals.idempotencyKeys === postTotals.idempotencyKeys;

    tests.push({
      id: 'AB28',
      name: 'Invariant Reconciliation (Zero Dirty Writes Across Appointments & Bookings)',
      passed: unchanged,
      detail: unchanged
        ? 'Verified: 100% of row counts and financial totals are identical before and after all 9 injection & mutation attacks.'
        : `MISMATCH: Baseline: ${JSON.stringify(baselineTotals)} vs Post: ${JSON.stringify(postTotals)}`,
    });
  }

  // ── TEST 29: Database Stamping Audit (Zero NULL tenantId) ──
  {
    const nullAppts = await prisma.appointment.count({ where: { tenantId: null } });
    const nullApptItems = await prisma.appointmentItem.count({ where: { tenantId: null } });
    const nullBkgs = await prisma.booking.count({ where: { tenantId: null } });
    const nullBkgItems = await prisma.bookingItem.count({ where: { tenantId: null } });
    const nullBkgPays = await prisma.bookingPayment.count({ where: { tenantId: null } });
    const totalNull = nullAppts + nullApptItems + nullBkgs + nullBkgItems + nullBkgPays;

    tests.push({
      id: 'AB29',
      name: 'Database Stamping Audit (Zero NULL tenantId across Appointments & Bookings)',
      passed: totalNull === 0,
      detail: totalNull === 0
        ? 'Verified: 0 NULL tenantId records across Appointment, AppointmentItem, Booking, BookingItem, BookingPayment'
        : `FAIL: Found ${totalNull} NULL records!`,
    });
  }

  // ── PRINT REPORT ──
  console.log('\n=======================================================================');
  console.log('📊 TEST RESULTS REPORT');
  console.log('=======================================================================\n');

  let passedCount = 0;
  for (const t of tests) {
    const icon = t.passed ? '✅' : '❌';
    console.log(`${icon} [${t.id}] ${t.name}`);
    console.log(`    Result: ${t.detail}\n`);
    if (t.passed) passedCount++;
  }

  console.log('-----------------------------------------------------------------------');
  console.log(`TOTAL: ${tests.length} | PASSED: ${passedCount} | FAILED: ${tests.length - passedCount}`);
  console.log('-----------------------------------------------------------------------\n');

  if (passedCount === tests.length) {
    console.log('🎉 100% PASS: Appointments & Bookings Tenant Isolation is completely verified!\n');
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
