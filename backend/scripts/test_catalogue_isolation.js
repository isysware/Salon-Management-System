// backend/scripts/test_catalogue_isolation.js
// Multi-Tenant & Multi-Branch Isolation & Security Suite for Catalogue Module
// (Services, Categories, Packages, Nested Components)

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
    services,
    categories,
    packages,
    components,
    invoices,
    appointments,
    bookings,
    auditEvents,
  ] = await Promise.all([
    prisma.service.count(),
    prisma.serviceCategory.count(),
    prisma.package.count(),
    prisma.packageComponent.count(),
    prisma.invoice.count(),
    prisma.appointment.count(),
    prisma.booking.count(),
    prisma.auditEvent.count(),
  ]);

  return { services, categories, packages, components, invoices, appointments, bookings, auditEvents };
}

async function run() {
  console.log('=======================================================================');
  console.log('🔒 CATALOGUE (SERVICES, PACKAGES, CATEGORIES) TENANT & BRANCH ISOLATION SUITE');
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

  if (!tenantA || !tenantB) {
    throw new Error('Tenant A or Tenant B not found in database.');
  }

  // Ensure Tenant A has Branch 1 and Branch 2
  const branchA1 = tenantA.branches.find((b) => b.id === 'branch-1') || tenantA.branches[0];
  let branchA2 = await prisma.branch.findUnique({ where: { id: 'branch-2' } });
  if (!branchA2) {
    branchA2 = await prisma.branch.create({
      data: {
        id: 'branch-2',
        tenantId: tenantA.id,
        name: 'Clifton Beach Branch',
        code: 'KHI-01',
        address: 'Block 4 Clifton',
        city: 'Karachi',
        phone: '02135890000',
        isActive: true,
      },
    });
  } else if (branchA2.tenantId !== tenantA.id || !branchA2.isActive) {
    branchA2 = await prisma.branch.update({
      where: { id: 'branch-2' },
      data: { tenantId: tenantA.id, isActive: true },
    });
  }

  // Ensure admin.clifton has branchId: 'branch-2'
  await prisma.user.update({
    where: { email: 'admin.clifton@isysware.com' },
    data: { branchId: 'branch-2' },
  });

  const branchB = tenantB.branches[0];

  console.log(`🏢 Tenant A: "${tenantA.name}" (ID: ${tenantA.id})`);
  console.log(`   📍 Branch A1: ${branchA1.name} (${branchA1.id})`);
  console.log(`   📍 Branch A2: ${branchA2.name} (${branchA2.id})`);
  console.log(`🏢 Tenant B: "${tenantB.name}" (ID: ${tenantB.id})`);
  console.log(`   📍 Branch B:  ${branchB.name} (${branchB.id})\n`);

  // 2. Authenticate Actors
  const tokenA1 = await login('admin.gulberg@isysware.com', 'admin123', 'ADMIN');
  const tokenA2 = await login('admin.clifton@isysware.com', 'admin123', 'ADMIN');
  const tokenB  = await login('ayesha.owner@royalelegance.com', 'Password123!', 'ADMIN');

  const headersA1 = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA1}` };
  const headersA2 = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA2}` };
  const headersB  = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };

  console.log('🔑 Authentication Successful: Tokens acquired for Actor A1, Actor A2, and Actor B.\n');

  const baselineTotals = await getControlTotals();
  const tests = [];

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const sharedServiceCode = `SRV-VIP-${randSuffix}`;
  const sharedPackageCode = `PKG-GLAM-${randSuffix}`;
  const sharedCategoryName = `Luxury Facials ${randSuffix}`;

  let serviceA1 = null;
  let serviceA2 = null;
  let serviceB  = null;

  let packageA1 = null;
  let packageA2 = null;

  // ═══════════════════════════════════════════════════════════════════════
  // PART A: SERVICES ISOLATION & PENETRATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST CAT01: Actor A1 creates Service in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        code: sharedServiceCode,
        name: `Service Branch 1 (${randSuffix})`,
        price: 3500,
        durationMinutes: 45,
        category: 'Skin Care',
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      serviceA1 = json.data;
      const dbS = await prisma.service.findUnique({ where: { id: serviceA1.id } });
      const passed = dbS && dbS.tenantId === tenantA.id && dbS.branchId === branchA1.id;
      tests.push({
        id: 'CAT01',
        name: 'Branch A1 Service Creation & Stamping',
        passed,
        detail: passed
          ? `Created '${serviceA1.name}' (Code: ${serviceA1.code}) stamped with tenantId: ${dbS.tenantId}, branchId: ${dbS.branchId}`
          : `FAILED: DB record mismatch: ${JSON.stringify(dbS)}`,
      });
    } else {
      tests.push({ id: 'CAT01', name: 'Branch A1 Service Creation & Stamping', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT02: Actor A2 creates Service in Branch 2 with the SAME CODE ──
  // Business rule: Branch 1 & Branch 2 have separate independent catalogues; same code is valid across branches
  {
    const res = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify({
        branchId: branchA2.id,
        code: sharedServiceCode, // SAME CODE as Branch 1!
        name: `Service Branch 2 (${randSuffix})`,
        price: 4000,
        durationMinutes: 60,
        category: 'Skin Care',
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      serviceA2 = json.data;
      const dbS = await prisma.service.findUnique({ where: { id: serviceA2.id } });
      const passed = dbS && dbS.tenantId === tenantA.id && dbS.branchId === branchA2.id;
      tests.push({
        id: 'CAT02',
        name: 'Branch A2 Service Creation with Identical Code (Branch Scoping)',
        passed,
        detail: passed
          ? `Created '${serviceA2.name}' with SAME code '${sharedServiceCode}' in branch-2 without collision. Stamped branchId: ${dbS.branchId}`
          : `FAILED: DB record mismatch: ${JSON.stringify(dbS)}`,
      });
    } else {
      tests.push({ id: 'CAT02', name: 'Branch A2 Service Creation with Identical Code (Branch Scoping)', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT03: Actor B creates Service in Tenant B with the SAME CODE ──
  {
    const res = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        code: sharedServiceCode, // SAME CODE in Tenant B!
        name: `Tenant B Service (${randSuffix})`,
        price: 4500,
        durationMinutes: 45,
        category: 'Skin Care',
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      serviceB = json.data;
      const dbS = await prisma.service.findUnique({ where: { id: serviceB.id } });
      const passed = dbS && dbS.tenantId === tenantB.id && dbS.branchId === branchB.id;
      tests.push({
        id: 'CAT03',
        name: 'Tenant B Service Creation with Identical Code (Multi-Tenancy Scoping)',
        passed,
        detail: passed
          ? `Created '${serviceB.name}' with SAME code '${sharedServiceCode}' in Tenant B without collision. Stamped tenantId: ${dbS.tenantId}`
          : `FAILED: DB record mismatch: ${JSON.stringify(dbS)}`,
      });
    } else {
      tests.push({ id: 'CAT03', name: 'Tenant B Service Creation with Identical Code (Multi-Tenancy Scoping)', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT04: Actor A1 Lists Services (Branch A1 Scope) ──
  {
    const res = await fetch(`${BASE_URL}/services`, { headers: headersA1 });
    const json = await res.json();
    const items = json.data || [];
    const hasA2 = items.some((s) => s.id === serviceA2?.id);
    const hasB  = items.some((s) => s.id === serviceB?.id);
    const passed = res.status === 200 && !hasA2 && !hasB;
    tests.push({
      id: 'CAT04',
      name: 'Branch A1 Service List (Zero Cross-Branch & Zero Cross-Tenant Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Branch A2 services and 0 Tenant B services present in Branch A1 list (${items.length} items)`
        : `LEAK DETECTED: hasA2=${hasA2}, hasB=${hasB}`,
    });
  }

  // ── TEST CAT05: Actor A2 Lists Services (Branch A2 Scope) ──
  {
    const res = await fetch(`${BASE_URL}/services`, { headers: headersA2 });
    const json = await res.json();
    const items = json.data || [];
    const hasA1 = items.some((s) => s.id === serviceA1?.id);
    const hasB  = items.some((s) => s.id === serviceB?.id);
    const passed = res.status === 200 && !hasA1 && !hasB;
    tests.push({
      id: 'CAT05',
      name: 'Branch A2 Service List (Zero Cross-Branch & Zero Cross-Tenant Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Branch A1 services and 0 Tenant B services present in Branch A2 list (${items.length} items)`
        : `LEAK DETECTED: hasA1=${hasA1}, hasB=${hasB}`,
    });
  }

  // ── TEST CAT06: Actor B Lists Services (Tenant B Scope) ──
  {
    const res = await fetch(`${BASE_URL}/services`, { headers: headersB });
    const json = await res.json();
    const items = json.data || [];
    const hasA1 = items.some((s) => s.id === serviceA1?.id);
    const hasA2 = items.some((s) => s.id === serviceA2?.id);
    const passed = res.status === 200 && !hasA1 && !hasA2;
    tests.push({
      id: 'CAT06',
      name: 'Tenant B Service List (Zero Tenant A Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Tenant A services present in Tenant B list (${items.length} items)`
        : `LEAK DETECTED: hasA1=${hasA1}, hasA2=${hasA2}`,
    });
  }

  // ── TEST CAT07: Actor A1 GET Service A2 by ID (Cross-Branch Read) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA2.id}`, { headers: headersA1 });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT07',
      name: 'Cross-Branch Service Detail Read Blocked (Same Tenant, Foreign Branch)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT08: Actor A2 GET Service A1 by ID (Cross-Branch Read) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA1.id}`, { headers: headersA2 });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT08',
      name: 'Cross-Branch Service Detail Read Blocked (Branch A2 -> Branch A1)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT09: Actor B GET Service A1 by ID (Cross-Tenant Read) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA1.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT09',
      name: 'Cross-Tenant Service Detail Read Blocked (Tenant B -> Tenant A)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT10: Actor A1 Updates Service A2 (Cross-Branch Mutation) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA2.id}`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({ name: 'Tampered Service Name' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT10',
      name: 'Cross-Branch Service Mutation Blocked (Same Tenant, Foreign Branch)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT11: Actor B Updates Service A1 (Cross-Tenant Mutation) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA1.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Cross Tenant Tampered Service' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT11',
      name: 'Cross-Tenant Service Mutation Blocked (Tenant B -> Tenant A)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT12: Actor A1 Toggles Service A2 (Cross-Branch Toggle) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA2.id}/toggle`, {
      method: 'POST',
      headers: headersA1,
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT12',
      name: 'Cross-Branch Service Toggle Blocked (Same Tenant, Foreign Branch)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT13: Actor B Toggles Service A1 (Cross-Tenant Toggle) ──
  {
    const res = await fetch(`${BASE_URL}/services/${serviceA1.id}/toggle`, {
      method: 'POST',
      headers: headersB,
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT13',
      name: 'Cross-Tenant Service Toggle Blocked (Tenant B -> Tenant A)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT14: Actor A1 Injects Foreign BranchId into Create Service ──
  {
    const res = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA2.id, // Foreign branch!
        name: 'Injected Branch Service',
        price: 2500,
      }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT14',
      name: 'Foreign BranchId Injection in Service Creation Blocked',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT15: Actor A1 Injects Foreign TenantId in Body ──
  {
    const res = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        tenantId: tenantB.id, // Malicious spoof!
        code: `SRV-SPOOF-${randSuffix}`,
        name: 'Spoof Test Service',
        price: 2000,
      }),
    });
    const json = await res.json();
    let passed = false;
    let detail = '';
    if (res.status === 201 && json.data?.id) {
      const dbS = await prisma.service.findUnique({ where: { id: json.data.id } });
      passed = dbS.tenantId === tenantA.id;
      detail = passed
        ? `Protected: Client-supplied tenantId ignored; stamped with verified actor tenantId (${tenantA.id})`
        : `VULNERABILITY: Stamped with spoofed tenantId (${dbS.tenantId})`;
    } else {
      detail = `HTTP ${res.status}: ${JSON.stringify(json)}`;
    }
    tests.push({ id: 'CAT15', name: 'Client-Supplied tenantId Spoofing Dropped & Verified', passed, detail });
  }

  // ── TEST CAT16: Actor A1 Duplicate Code in Same Branch Rejected ──
  {
    const res = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        code: sharedServiceCode, // Duplicate in Branch 1!
        name: 'Duplicate Code Service',
        price: 3000,
      }),
    });
    const passed = res.status === 409;
    tests.push({
      id: 'CAT16',
      name: 'Same-Branch Duplicate Service Code Rejected (409 Conflict)',
      passed,
      detail: passed ? 'Properly rejected duplicate service code in same branch with HTTP 409' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART B: CATEGORIES ISOLATION & PENETRATION
  // ═══════════════════════════════════════════════════════════════════════

  let categoryA1 = null;
  let categoryA2 = null;

  // ── TEST CAT17: Actor A1 creates Category in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/service-categories`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        name: sharedCategoryName,
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      categoryA1 = json.data;
      const dbC = await prisma.serviceCategory.findUnique({ where: { id: categoryA1.id } });
      const passed = dbC && dbC.tenantId === tenantA.id && dbC.branchId === branchA1.id;
      tests.push({
        id: 'CAT17',
        name: 'Branch A1 Category Creation & Stamping',
        passed,
        detail: passed
          ? `Created '${categoryA1.name}' stamped with tenantId: ${dbC.tenantId}, branchId: ${dbC.branchId}`
          : `FAILED: DB record mismatch: ${JSON.stringify(dbC)}`,
      });
    } else {
      tests.push({ id: 'CAT17', name: 'Branch A1 Category Creation & Stamping', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT18: Actor A2 creates Category in Branch 2 with SAME NAME ──
  {
    const res = await fetch(`${BASE_URL}/service-categories`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify({
        branchId: branchA2.id,
        name: sharedCategoryName, // SAME NAME in Branch 2!
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      categoryA2 = json.data;
      const dbC = await prisma.serviceCategory.findUnique({ where: { id: categoryA2.id } });
      const passed = dbC && dbC.tenantId === tenantA.id && dbC.branchId === branchA2.id;
      tests.push({
        id: 'CAT18',
        name: 'Branch A2 Category Creation with Identical Name (Branch Scoping)',
        passed,
        detail: passed
          ? `Created '${categoryA2.name}' with SAME name in branch-2 without collision. Stamped branchId: ${dbC.branchId}`
          : `FAILED: DB record mismatch: ${JSON.stringify(dbC)}`,
      });
    } else {
      tests.push({ id: 'CAT18', name: 'Branch A2 Category Creation with Identical Name (Branch Scoping)', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT19: Actor A1 Lists Categories (Branch A1 Scope) ──
  {
    const res = await fetch(`${BASE_URL}/service-categories`, { headers: headersA1 });
    const json = await res.json();
    const items = json.data || [];
    const hasA2 = items.some((c) => c.id === categoryA2?.id);
    const passed = res.status === 200 && !hasA2;
    tests.push({
      id: 'CAT19',
      name: 'Branch A1 Category List (Zero Branch A2 Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Branch A2 categories present in Branch A1 list (${items.length} items)`
        : `LEAK DETECTED: hasA2=${hasA2}`,
    });
  }

  // ── TEST CAT20: Actor A2 Lists Categories (Branch A2 Scope) ──
  {
    const res = await fetch(`${BASE_URL}/service-categories`, { headers: headersA2 });
    const json = await res.json();
    const items = json.data || [];
    const hasA1 = items.some((c) => c.id === categoryA1?.id);
    const passed = res.status === 200 && !hasA1;
    tests.push({
      id: 'CAT20',
      name: 'Branch A2 Category List (Zero Branch A1 Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Branch A1 categories present in Branch A2 list (${items.length} items)`
        : `LEAK DETECTED: hasA1=${hasA1}`,
    });
  }

  // ── TEST CAT21: Actor A1 Injects Foreign BranchId into Create Category ──
  {
    const res = await fetch(`${BASE_URL}/service-categories`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA2.id,
        name: 'Injected Branch Category',
      }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT21',
      name: 'Foreign BranchId Injection in Category Creation Blocked',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART C: PACKAGES & NESTED PACKAGE COMPONENTS ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST CAT22: Actor A1 Creates Package in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        code: sharedPackageCode,
        name: `Package Branch 1 (${randSuffix})`,
        price: 8000,
        components: [
          { serviceId: serviceA1.id, quantity: 1, allocationPercentage: 100 },
        ],
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      packageA1 = json.data;
      const dbP = await prisma.package.findUnique({
        where: { id: packageA1.id },
        include: { components: true },
      });
      const pStamped = dbP && dbP.tenantId === tenantA.id && dbP.branchId === branchA1.id;
      const compStamped = dbP.components.every((c) => c.tenantId === tenantA.id);
      const passed = pStamped && compStamped;
      tests.push({
        id: 'CAT22',
        name: 'Branch A1 Package & Nested Components Creation & Stamping',
        passed,
        detail: passed
          ? `Created '${packageA1.name}' (Code: ${packageA1.code}) with ${dbP.components.length} components stamped with tenantId: ${dbP.tenantId}`
          : `FAILED: DB stamping mismatch: pStamped=${pStamped}, compStamped=${compStamped}`,
      });
    } else {
      tests.push({ id: 'CAT22', name: 'Branch A1 Package & Nested Components Creation & Stamping', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT23: Actor A2 Creates Package in Branch 2 with SAME CODE ──
  {
    const res = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify({
        branchId: branchA2.id,
        code: sharedPackageCode, // SAME CODE in Branch 2!
        name: `Package Branch 2 (${randSuffix})`,
        price: 9000,
        components: [
          { serviceId: serviceA2.id, quantity: 1, allocationPercentage: 100 },
        ],
      }),
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.id) {
      packageA2 = json.data;
      const dbP = await prisma.package.findUnique({
        where: { id: packageA2.id },
        include: { components: true },
      });
      const passed = dbP && dbP.tenantId === tenantA.id && dbP.branchId === branchA2.id;
      tests.push({
        id: 'CAT23',
        name: 'Branch A2 Package Creation with Identical Code (Branch Scoping)',
        passed,
        detail: passed
          ? `Created '${packageA2.name}' with SAME code '${sharedPackageCode}' in branch-2 without collision. Stamped branchId: ${dbP.branchId}`
          : `FAILED: DB record mismatch: ${JSON.stringify(dbP)}`,
      });
    } else {
      tests.push({ id: 'CAT23', name: 'Branch A2 Package Creation with Identical Code (Branch Scoping)', passed: false, detail: `HTTP ${res.status}: ${JSON.stringify(json)}` });
    }
  }

  // ── TEST CAT24: Actor A1 Lists Packages (Branch A1 Scope) ──
  {
    const res = await fetch(`${BASE_URL}/packages`, { headers: headersA1 });
    const json = await res.json();
    const items = json.data || [];
    const hasA2 = items.some((p) => p.id === packageA2?.id);
    const passed = res.status === 200 && !hasA2;
    tests.push({
      id: 'CAT24',
      name: 'Branch A1 Package List (Zero Branch A2 Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Branch A2 packages present in Branch A1 list (${items.length} items)`
        : `LEAK DETECTED: hasA2=${hasA2}`,
    });
  }

  // ── TEST CAT25: Actor A2 Lists Packages (Branch A2 Scope) ──
  {
    const res = await fetch(`${BASE_URL}/packages`, { headers: headersA2 });
    const json = await res.json();
    const items = json.data || [];
    const hasA1 = items.some((p) => p.id === packageA1?.id);
    const passed = res.status === 200 && !hasA1;
    tests.push({
      id: 'CAT25',
      name: 'Branch A2 Package List (Zero Branch A1 Leakage)',
      passed,
      detail: passed
        ? `Clean: 0 Branch A1 packages present in Branch A2 list (${items.length} items)`
        : `LEAK DETECTED: hasA1=${hasA1}`,
    });
  }

  // ── TEST CAT26: Actor A1 GET Package A2 by ID (Cross-Branch Read) ──
  {
    const res = await fetch(`${BASE_URL}/packages/${packageA2.id}`, { headers: headersA1 });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT26',
      name: 'Cross-Branch Package Detail Read Blocked (Branch A1 -> Branch A2)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT27: Actor B GET Package A1 by ID (Cross-Tenant Read) ──
  {
    const res = await fetch(`${BASE_URL}/packages/${packageA1.id}`, { headers: headersB });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT27',
      name: 'Cross-Tenant Package Detail Read Blocked (Tenant B -> Tenant A)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT28: Actor A1 Creates Package Injecting Branch A2's Service Component ──
  // Business rule: Cross-branch component injection within same tenant must be rejected
  {
    const res = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        code: `PKG-INJ-${randSuffix}`,
        name: 'Cross-Branch Component Injection Package',
        price: 7500,
        components: [
          { serviceId: serviceA2.id, quantity: 1, allocationPercentage: 100 }, // From Branch A2!
        ],
      }),
    });
    const blocked = res.status === 400;
    tests.push({
      id: 'CAT28',
      name: 'Cross-Branch Component Service Injection Blocked (400 COMPONENT_BRANCH)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (COMPONENT_BRANCH: service belongs to another branch)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT29: Actor A1 Creates Package Injecting Tenant B's Service Component ──
  {
    const res = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        code: `PKG-CROSS-${randSuffix}`,
        name: 'Cross-Tenant Component Injection Package',
        price: 8500,
        components: [
          { serviceId: serviceB.id, quantity: 1, allocationPercentage: 100 }, // From Tenant B!
        ],
      }),
    });
    const blocked = res.status === 403 || res.status === 400;
    tests.push({
      id: 'CAT29',
      name: 'Cross-Tenant Component Service Injection Blocked (FORBIDDEN_TENANT_ACCESS)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status}` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT30: Actor A1 Updates Package A2 (Cross-Branch Mutation) ──
  {
    const res = await fetch(`${BASE_URL}/packages/${packageA2.id}`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({ name: 'Tampered Package Name' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT30',
      name: 'Cross-Branch Package Mutation Blocked (Branch A1 -> Branch A2)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT31: Actor B Updates Package A1 (Cross-Tenant Mutation) ──
  {
    const res = await fetch(`${BASE_URL}/packages/${packageA1.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Cross Tenant Tampered Package' }),
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT31',
      name: 'Cross-Tenant Package Mutation Blocked (Tenant B -> Tenant A)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT32: Actor A1 Toggles Package A2 (Cross-Branch Toggle) ──
  {
    const res = await fetch(`${BASE_URL}/packages/${packageA2.id}/toggle`, {
      method: 'POST',
      headers: headersA1,
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT32',
      name: 'Cross-Branch Package Toggle Blocked (Branch A1 -> Branch A2)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (BRANCH_FORBIDDEN)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT33: Actor B Toggles Package A1 (Cross-Tenant Toggle) ──
  {
    const res = await fetch(`${BASE_URL}/packages/${packageA1.id}/toggle`, {
      method: 'POST',
      headers: headersB,
    });
    const blocked = res.status === 403;
    tests.push({
      id: 'CAT33',
      name: 'Cross-Tenant Package Toggle Blocked (Tenant B -> Tenant A)',
      passed: blocked,
      detail: blocked ? `Blocked with HTTP ${res.status} (FORBIDDEN_TENANT_ACCESS)` : `FAILED: HTTP ${res.status}`,
    });
  }

  // ── TEST CAT34: Actor A1 Duplicate Package Code in Same Branch Rejected ──
  {
    const res = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        code: sharedPackageCode, // Duplicate in Branch 1!
        name: 'Duplicate Code Package',
        price: 9900,
        components: [
          { serviceId: serviceA1.id, quantity: 1, allocationPercentage: 100 },
        ],
      }),
    });
    const passed = res.status === 409;
    tests.push({
      id: 'CAT34',
      name: 'Same-Branch Duplicate Package Code Rejected (409 Conflict)',
      passed,
      detail: passed ? 'Properly rejected duplicate package code in same branch with HTTP 409' : `FAILED: HTTP ${res.status}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART D: INVARIANT RECONCILIATION & AUDIT
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST CAT35: Invariant Reconciliation ──
  {
    const postTotals = await getControlTotals();
    const invoicesSame = baselineTotals.invoices === postTotals.invoices;
    const appointmentsSame = baselineTotals.appointments === postTotals.appointments;
    const bookingsSame = baselineTotals.bookings === postTotals.bookings;
    const passed = invoicesSame && appointmentsSame && bookingsSame;

    tests.push({
      id: 'CAT35',
      name: 'Invariant Reconciliation (Zero Financial or Operational Side Effects)',
      passed,
      detail: passed
        ? 'Verified: Invoices, Appointments, and Bookings counts are 100% untouched after all Catalogue attacks.'
        : `MISMATCH: Invoices: ${invoicesSame}, Appts: ${appointmentsSame}, Bkgs: ${bookingsSame}`,
    });
  }

  // ── TEST CAT36: Database Stamping Audit (Zero NULL tenantId) ──
  {
    const [nullServices, nullCategories, nullPackages, nullComponents] = await Promise.all([
      prisma.service.count({ where: { tenantId: null } }),
      prisma.serviceCategory.count({ where: { tenantId: null } }),
      prisma.package.count({ where: { tenantId: null } }),
      prisma.packageComponent.count({ where: { tenantId: null } }),
    ]);

    const passed = nullServices === 0 && nullCategories === 0 && nullPackages === 0 && nullComponents === 0;
    tests.push({
      id: 'CAT36',
      name: 'Database Stamping Audit (Zero NULL tenantId across Catalogue records)',
      passed,
      detail: passed
        ? 'Verified: 0 NULL tenantId records across Service, ServiceCategory, Package, PackageComponent'
        : `FOUND NULLs: Services: ${nullServices}, Categories: ${nullCategories}, Packages: ${nullPackages}, Components: ${nullComponents}`,
    });
  }

  // ── TEST RESULTS DISPLAY ──
  console.log('=======================================================================');
  console.log('📊 TEST RESULTS REPORT');
  console.log('=======================================================================\n');

  let passedCount = 0;
  for (const t of tests) {
    if (t.passed) {
      passedCount++;
      console.log(`✅ [${t.id}] ${t.name}`);
      console.log(`    Result: ${t.detail}\n`);
    } else {
      console.log(`❌ [${t.id}] ${t.name}`);
      console.log(`    Result: ${t.detail}\n`);
    }
  }

  console.log('-----------------------------------------------------------------------');
  console.log(`TOTAL: ${tests.length} | PASSED: ${passedCount} | FAILED: ${tests.length - passedCount}`);
  console.log('-----------------------------------------------------------------------\n');

  if (passedCount === tests.length) {
    console.log('🎉 100% PASS: Catalogue Tenant & Branch Isolation is completely verified!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

