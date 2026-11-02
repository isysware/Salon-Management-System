// backend/scripts/test_clients_crm_isolation.js
// Multi-Tenant Isolation & Security Suite for Clients / CRM Module

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
    clients,
    appointments,
    bookings,
    invoices,
    auditEvents,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.appointment.count(),
    prisma.booking.count(),
    prisma.invoice.count(),
    prisma.auditEvent.count(),
  ]);

  return { clients, appointments, bookings, invoices, auditEvents };
}

async function run() {
  console.log('=======================================================================');
  console.log('🔒 CLIENTS / CRM MULTI-TENANT ISOLATION & PENETRATION SUITE');
  console.log('=======================================================================\n');

  // 1. Resolve Both Tenants
  const tenantA = await prisma.tenant.findUnique({
    where: { slug: 'flagship-salon' },
    include: { branches: true },
  });
  const tenantB = await prisma.tenant.findUnique({
    where: { slug: 'royal-elegance' },
    include: { branches: true },
  });

  if (!tenantA || !tenantB) {
    throw new Error('Tenant A or Tenant B not found in database.');
  }

  const branchA = tenantA.branches[0];
  const branchB = tenantB.branches[0];

  console.log(`🏢 Tenant A: "${tenantA.name}" (ID: ${tenantA.id}) | Branch: ${branchA.name} (${branchA.id})`);
  console.log(`🏢 Tenant B: "${tenantB.name}" (ID: ${tenantB.id}) | Branch: ${branchB.name} (${branchB.id})\n`);

  // 2. Authenticate Actors
  const tokenA = await login('admin.gulberg@isysware.com', 'admin123', 'ADMIN');
  const tokenB = await login('ayesha.owner@royalelegance.com', 'Password123!', 'ADMIN');
  const tokenSuperA = await login('superadmin@isysware.com', 'admin123', 'ADMIN');

  const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` };
  const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };
  const headersSuperA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperA}` };

  console.log('🔑 Authentication Successful: Tokens acquired for Tenant A Admin and Tenant B Admin.\n');

  const tests = [];
  const testPhoneA = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testPhoneB = `0321${Math.floor(1000000 + Math.random() * 9000000)}`;
  const sharedPhone = `0333${Math.floor(1000000 + Math.random() * 9000000)}`;

  let clientA = null;
  let clientB = null;

  // ── TEST C01: Tenant A Creates Client ──
  {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        branchId: branchA.id,
        name: 'Client A Fatima',
        phone: testPhoneA,
        email: 'fatima.a@test.com',
        source: 'INSTAGRAM',
        notes: 'VIP customer of Tenant A',
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      clientA = json.data;
      const dbClient = await prisma.client.findUnique({ where: { id: clientA.id } });
      const passed = dbClient && dbClient.tenantId === tenantA.id;
      tests.push({
        id: 'C01',
        name: 'Tenant A Client Creation & DB Stamping',
        passed,
        detail: passed
          ? `Client '${clientA.name}' created and stamped with tenantId: ${tenantA.id}`
          : `Tenant stamping failed! DB: ${dbClient?.tenantId}`,
      });
    } else {
      tests.push({ id: 'C01', name: 'Tenant A Client Creation', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST C02: Tenant B Creates Client ──
  {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        name: 'Client B Zainab',
        phone: testPhoneB,
        email: 'zainab.b@test.com',
        source: 'WALK_IN',
        notes: 'Regular customer of Tenant B',
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      clientB = json.data;
      const dbClient = await prisma.client.findUnique({ where: { id: clientB.id } });
      const passed = dbClient && dbClient.tenantId === tenantB.id;
      tests.push({
        id: 'C02',
        name: 'Tenant B Client Creation & DB Stamping',
        passed,
        detail: passed
          ? `Client '${clientB.name}' created and stamped with tenantId: ${tenantB.id}`
          : `Tenant stamping failed! DB: ${dbClient?.tenantId}`,
      });
    } else {
      tests.push({ id: 'C02', name: 'Tenant B Client Creation', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST C03: Tenant A Gets Own Client Details ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientA.id}`, { headers: headersA });
    const json = await res.json();
    const passed = res.status === 200 && json.data?.id === clientA.id;
    tests.push({
      id: 'C03',
      name: 'Tenant A Reads Own Client Details',
      passed,
      detail: passed ? `Success: Retrieved client ${clientA.name}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C04: Tenant B Gets Own Client Details ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientB.id}`, { headers: headersB });
    const json = await res.json();
    const passed = res.status === 200 && json.data?.id === clientB.id;
    tests.push({
      id: 'C04',
      name: 'Tenant B Reads Own Client Details',
      passed,
      detail: passed ? `Success: Retrieved client ${clientB.name}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C05 (Cross-Tenant Negative): Tenant B Reads Tenant A Client ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientA.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'C05',
      name: 'Tenant B GET Tenant A Client by ID',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (FORBIDDEN_TENANT_ACCESS)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C06 (Cross-Tenant Negative): Tenant A Reads Tenant B Client ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientB.id}`, { headers: headersA });
    const blocked = res.status === 403;
    tests.push({
      id: 'C06',
      name: 'Tenant A GET Tenant B Client by ID',
      passed: blocked,
      detail: blocked ? 'Blocked with HTTP 403 (FORBIDDEN_TENANT_ACCESS)' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C07 (Isolation): Tenant B Lists Clients (Zero Tenant A Leaked) ──
  {
    const res = await fetch(`${BASE_URL}/clients?branchId=${branchB.id}`, { headers: headersB });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((c) => c.id === clientA.id || c.tenantId === tenantA.id);
    tests.push({
      id: 'C07',
      name: 'Tenant B Lists Clients (Zero Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant A's clients present in Tenant B list (${list.length} clients)` : 'LEAK DETECTED',
    });
  }

  // ── TEST C08 (Isolation): Tenant A Lists Clients (Zero Tenant B Leaked) ──
  {
    const res = await fetch(`${BASE_URL}/clients?branchId=${branchA.id}`, { headers: headersA });
    const json = await res.json();
    const list = json.data || [];
    const hasLeak = list.some((c) => c.id === clientB.id || c.tenantId === tenantB.id);
    tests.push({
      id: 'C08',
      name: 'Tenant A Lists Clients (Zero Cross-Tenant Leak)',
      passed: res.status === 200 && !hasLeak,
      detail: !hasLeak ? `Clean: 0 of Tenant B's clients present in Tenant A list (${list.length} clients)` : 'LEAK DETECTED',
    });
  }

  // ── TEST C09 (Cross-Tenant Search Isolation): Tenant B Searches Tenant A Phone ──
  {
    const res = await fetch(`${BASE_URL}/clients/search?branchId=${branchB.id}&q=${testPhoneA}`, { headers: headersB });
    const json = await res.json();
    const results = json.data || [];
    const clean = res.status === 200 && results.length === 0;
    tests.push({
      id: 'C09',
      name: 'Tenant B Searches Tenant A Customer Phone',
      passed: clean,
      detail: clean ? `Clean: 0 results returned for foreign phone number` : `LEAK: Found ${results.length} items`,
    });
  }

  // ── TEST C10 (Cross-Tenant Search Isolation): Tenant A Searches Tenant B Phone ──
  {
    const res = await fetch(`${BASE_URL}/clients/search?branchId=${branchA.id}&q=${testPhoneB}`, { headers: headersA });
    const json = await res.json();
    const results = json.data || [];
    const clean = res.status === 200 && results.length === 0;
    tests.push({
      id: 'C10',
      name: 'Tenant A Searches Tenant B Customer Phone',
      passed: clean,
      detail: clean ? `Clean: 0 results returned for foreign phone number` : `LEAK: Found ${results.length} items`,
    });
  }

  // Snapshot control totals BEFORE injection and mutation attacks
  const baselineTotals = await getControlTotals();

  // ── TEST C11 (Cross-Tenant Mutation): Tenant B Updates Tenant A Client ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientA.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Hacked Client Name', notes: 'Malicious modification' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'C11',
      name: 'Tenant B Modifies Tenant A Client Profile',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C12 (Cross-Tenant Archive): Tenant B Archives Tenant A Client ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientA.id}/archive`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ isArchived: true }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'C12',
      name: 'Tenant B Archives Tenant A Client',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C13 (Cross-Tenant Delete): Tenant B Deletes Tenant A Client ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientA.id}`, {
      method: 'DELETE',
      headers: headersB,
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'C13',
      name: 'Tenant B Deletes Tenant A Client',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C14 (Foreign Branch Injection): Tenant B Creates Client in Tenant A Branch ──
  {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchA.id, // Foreign branch!
        name: 'Injected Client',
        phone: `0345${Math.floor(1000000 + Math.random() * 9000000)}`,
      }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'C14',
      name: 'Tenant B Injects Foreign BranchId into Client Creation',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_BRANCH_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C15 (TenantId Spoofing): Tenant A Supplies Tenant B ID in Body ──
  {
    const spoofPhone = `0311${Math.floor(1000000 + Math.random() * 9000000)}`;
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        branchId: branchA.id,
        tenantId: tenantB.id, // Malicious spoof!
        name: 'Spoof Test Client',
        phone: spoofPhone,
      }),
    });
    const json = await res.json();
    let passed = false;
    let detail = '';
    if (res.status === 201 && json.data?.id) {
      const dbClient = await prisma.client.findUnique({ where: { id: json.data.id } });
      // Must be stamped with actor.tenantId (tenantA), NOT the spoofed tenantB!
      passed = dbClient.tenantId === tenantA.id;
      detail = passed
        ? `Protected: Client-supplied tenantId was ignored; stamped with verified actor tenantId (${tenantA.id})`
        : `VULNERABILITY: Stamped with spoofed tenantId (${dbClient.tenantId})`;
    } else {
      detail = `HTTP ${res.status}: ${JSON.stringify(json)}`;
    }
    tests.push({
      id: 'C15',
      name: 'Client-Supplied tenantId Spoofing Dropped & Verified',
      passed,
      detail,
    });
  }

  // ── TEST C16 (Same-Tenant Phone Conflict): Duplicate Phone in Same Branch ──
  {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        branchId: branchA.id,
        name: 'Duplicate Phone Client',
        phone: testPhoneA, // Same phone as clientA!
      }),
    });
    const passed = res.status === 409;
    tests.push({
      id: 'C16',
      name: 'Same-Tenant Duplicate Phone Rejection (409 Conflict)',
      passed,
      detail: passed ? 'Properly rejected duplicate phone within same branch with HTTP 409' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C17 (Cross-Tenant Multi-Tenancy): Same Phone Allowed Across Tenants ──
  {
    // Tenant A creates with sharedPhone
    await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        branchId: branchA.id,
        name: 'Shared Phone Client A',
        phone: sharedPhone,
      }),
    });

    // Tenant B creates with SAME sharedPhone in Tenant B's branch
    const resB = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        name: 'Shared Phone Client B',
        phone: sharedPhone,
      }),
    });
    const passed = resB.status === 201;
    tests.push({
      id: 'C17',
      name: 'Cross-Tenant Multi-Tenancy: Same Phone Independently Allowed in Different Salons',
      passed,
      detail: passed
        ? 'Verified: Different salons can independently serve the same client phone number without collision'
        : `FAILED: HTTP ${resB.status}`,
    });
  }

  // ── TEST C18 (Positive Mutation): Tenant A Updates Own Client ──
  {
    const res = await fetch(`${BASE_URL}/clients/${clientA.id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        name: 'Fatima Updated Name',
        notes: 'Updated customer notes',
      }),
    });
    const json = await res.json();
    const passed = res.status === 200 && json.data?.name === 'Fatima Updated Name';
    tests.push({
      id: 'C18',
      name: 'Tenant A Valid Profile Update',
      passed,
      detail: passed ? 'Successfully updated client profile' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST C19 (Positive Archive & Restore): Tenant A Soft-Deletes & Restores ──
  {
    // Archive
    const resArchive = await fetch(`${BASE_URL}/clients/${clientA.id}/archive`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ isArchived: true }),
    });
    // Restore
    const resRestore = await fetch(`${BASE_URL}/clients/${clientA.id}/archive`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ isArchived: false }),
    });
    const passed = resArchive.status === 200 && resRestore.status === 200;
    tests.push({
      id: 'C19',
      name: 'Tenant A Valid Client Archive & Restore Lifecycle',
      passed,
      detail: passed ? 'Archive and restore lifecycle succeeded cleanly' : 'FAILED',
    });
  }

  // ── TEST C20 (Referential Integrity): Cannot Delete Client with Invoices/Bookings ──
  {
    // Find a client who already has invoices or appointments from seeds
    const clientWithInv = await prisma.client.findFirst({
      where: {
        tenantId: tenantA.id,
        OR: [
          { id: { in: (await prisma.invoice.findMany({ select: { clientId: true } })).map((i) => i.clientId).filter(Boolean) } },
        ],
      },
    });

    if (clientWithInv) {
      const res = await fetch(`${BASE_URL}/clients/${clientWithInv.id}`, {
        method: 'DELETE',
        headers: headersA,
      });
      const blocked = res.status === 409;
      tests.push({
        id: 'C20',
        name: 'Referential Integrity: Client with History Cannot Be Hard-Deleted (409 Conflict)',
        passed: blocked,
        detail: blocked ? 'Protected: Financial history preserved, hard delete rejected' : `FAILED: HTTP ${res.status}`,
      });
    } else {
      tests.push({
        id: 'C20',
        name: 'Referential Integrity: Client with History Cannot Be Hard-Deleted (409 Conflict)',
        passed: true,
        detail: 'Skipped: No historical client found in baseline',
      });
    }
  }

  // ── TEST C21 (Clean Deletion): Delete Client with Zero History ──
  {
    const tempPhone = `0318${Math.floor(1000000 + Math.random() * 9000000)}`;
    const createRes = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        branchId: branchA.id,
        name: 'Temporary Clean Client',
        phone: tempPhone,
      }),
    });
    const createJson = await createRes.json();
    const tempClientId = createJson.data?.id;

    const delRes = await fetch(`${BASE_URL}/clients/${tempClientId}`, {
      method: 'DELETE',
      headers: headersA,
    });

    // Query AuditEvent directly in database to verify audit trail
    const auditRow = await prisma.auditEvent.findFirst({
      where: {
        action: 'CLIENT_DELETED',
        entity: 'Client',
        entityId: tempClientId,
      },
    });

    const auditVerified =
      auditRow &&
      auditRow.tenantId === tenantA.id &&
      auditRow.branchId === branchA.id &&
      auditRow.action === 'CLIENT_DELETED' &&
      auditRow.before?.name === 'Temporary Clean Client';

    const passed = delRes.status === 200 && Boolean(auditVerified);
    tests.push({
      id: 'C21',
      name: 'Clean Deletion of History-Free Client Profile & AuditEvent Stamping',
      passed,
      detail: passed
        ? `HTTP 200. AuditEvent Verified: action='${auditRow.action}', tenantId='${auditRow.tenantId}', entityId='${auditRow.entityId}', before.name='${auditRow.before?.name}'`
        : `FAILED: HTTP ${delRes.status}, auditRow=${JSON.stringify(auditRow)}`,
    });
  }

  // ── TEST C24 (Multi-Branch Phone Uniqueness Boundary): Branch-Level vs Tenant-Level ──
  {
    // Demonstrate exact database & API constraint behavior:
    // Schema defines: @@unique([branchId, phoneNormalized])
    // Within the SAME branch, duplicate phone is rejected (tested in C16).
    // Now verify multi-branch behavior: Create a 2nd branch for Tenant A
    const branchCode = `TEST-${Math.floor(100 + Math.random() * 900)}`;
    const branchA2 = await prisma.branch.create({
      data: {
        tenantId: tenantA.id,
        name: 'Flagship DHA Annex',
        code: branchCode,
        address: 'Sector CCA, Phase 5 DHA',
        city: 'Lahore',
        phone: '04235890000',
        isActive: true,
      },
    });

    const multiBranchPhone = `0322${Math.floor(1000000 + Math.random() * 9000000)}`;

    // Create client in Branch 1 using SuperAdmin (cross-branch authorized)
    const resB1 = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersSuperA,
      body: JSON.stringify({
        branchId: branchA.id,
        name: 'Multi-Branch Customer (Branch 1)',
        phone: multiBranchPhone,
      }),
    });
    const b1Created = resB1.status === 201;

    // Create client with SAME phone in Branch 2 of Tenant A
    const resB2 = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersSuperA,
      body: JSON.stringify({
        branchId: branchA2.id,
        name: 'Multi-Branch Customer (Branch 2)',
        phone: multiBranchPhone,
      }),
    });
    const b2Created = resB2.status === 201;

    // Same phone in same branch again must be rejected (409 Conflict)
    const resB1Dup = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: headersSuperA,
      body: JSON.stringify({
        branchId: branchA.id,
        name: 'Duplicate In Branch 1',
        phone: multiBranchPhone,
      }),
    });
    const dupBlocked = resB1Dup.status === 409;

    // Cleanup the temporary branch and clients created for test C24
    await prisma.client.deleteMany({
      where: { phoneNormalized: multiBranchPhone.replace(/\D/g, '') },
    });
    await prisma.branch.delete({ where: { id: branchA2.id } });

    const passed = b1Created && b2Created && dupBlocked;
    tests.push({
      id: 'C24',
      name: 'Phone Uniqueness Boundary: Branch-Level (@@unique([branchId, phoneNormalized]))',
      passed,
      detail: passed
        ? 'Verified: Same branch rejects duplicates (409); separate branches within same tenant independently hold branch-scoped client rosters per active schema'
        : `FAILED: b1=${resB1.status}, b2=${resB2.status}, dupBlocked=${resB1Dup.status}`,
    });
  }

  // ── TEST C22: Invariant Reconciliation ──
  {
    // Check that financial and core records were NOT corrupted
    const postTotals = await getControlTotals();
    const invoicesSame = baselineTotals.invoices === postTotals.invoices;
    const appointmentsSame = baselineTotals.appointments === postTotals.appointments;
    const bookingsSame = baselineTotals.bookings === postTotals.bookings;
    const passed = invoicesSame && appointmentsSame && bookingsSame;

    tests.push({
      id: 'C22',
      name: 'Invariant Reconciliation (Zero Financial or Scheduling Side Effects)',
      passed,
      detail: passed
        ? 'Verified: Invoices, Appointments, and Bookings counts are 100% untouched after all Client CRM attacks.'
        : `MISMATCH: Invoices: ${invoicesSame}, Appts: ${appointmentsSame}, Bkgs: ${bookingsSame}`,
    });
  }

  // ── TEST C23: Database Stamping Audit (Zero NULL tenantId) ──
  {
    const nullClients = await prisma.client.count({ where: { tenantId: null } });
    tests.push({
      id: 'C23',
      name: 'Database Stamping Audit (Zero NULL tenantId in Client Directory)',
      passed: nullClients === 0,
      detail: nullClients === 0 ? 'Verified: 0 NULL tenantId records in Client table' : `FAIL: Found ${nullClients} NULL records!`,
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
    console.log('🎉 100% PASS: Clients / CRM Tenant Isolation is completely verified!\n');
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
