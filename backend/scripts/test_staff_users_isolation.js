// backend/scripts/test_staff_users_isolation.js
// Multi-Tenant & Multi-Branch Isolation & Security Suite for Staff & Users Modules

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
    staffCount,
    usersCount,
    membershipsCount,
    compensationHistoryCount,
    auditEventsCount,
  ] = await Promise.all([
    prisma.staff.count(),
    prisma.user.count(),
    prisma.tenantMembership.count(),
    prisma.staffCompensationHistory.count(),
    prisma.auditEvent.count(),
  ]);

  return { staffCount, usersCount, membershipsCount, compensationHistoryCount, auditEventsCount };
}

async function run() {
  console.log('=======================================================================');
  console.log('🔒 STAFF PROFILES & USER ACCESS TENANT & BRANCH ISOLATION SUITE');
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

  const branchB = tenantB.branches[0];

  console.log(`🏢 Tenant A: "${tenantA.name}" (ID: ${tenantA.id})`);
  console.log(`   📍 Branch A1: ${branchA1.name} (${branchA1.id})`);
  console.log(`   📍 Branch A2: ${branchA2.name} (${branchA2.id})`);
  console.log(`🏢 Tenant B: "${tenantB.name}" (ID: ${tenantB.id})`);
  console.log(`   📍 Branch B:  ${branchB.name} (${branchB.id})\n`);

  // 2. Authenticate Actors
  const tokenA1    = await login('admin.gulberg@isysware.com', 'admin123', 'ADMIN');
  const tokenA2    = await login('admin.clifton@isysware.com', 'admin123', 'ADMIN');
  const tokenB     = await login('ayesha.owner@royalelegance.com', 'Password123!', 'ADMIN');
  const tokenSuper = await login('superadmin@isysware.com', 'admin123', 'ADMIN');

  const headersA1    = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA1}` };
  const headersA2    = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA2}` };
  const headersB     = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };
  const headersSuper = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuper}` };

  console.log('🔑 Authentication Successful: Tokens acquired for Actor A1, Actor A2, Actor B, and Super Admin A.\n');

  const baselineTotals = await getControlTotals();
  const tests = [];

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  let staffA1 = null;
  let staffA2 = null;
  let staffB = null;

  let userA1 = null;
  let userA2 = null;
  let userB = null;

  // ═══════════════════════════════════════════════════════════════════════
  // PART 1: STAFF PROFILES ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST STF01: Actor A1 creates Staff in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        name: `Stylist A1 (${randSuffix})`,
        phone: `0300111${randSuffix}`,
        designation: 'Senior Stylist',
        joiningDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 45000,
        enablePortalAccess: true,
        portalIdentifier: `stylist.a1.${randSuffix}@isysware.com`,
        portalPassword: 'StaffPassword123!',
      }),
    });
    const json = await res.json();
    staffA1 = json.data?.staff;
    const userA1Linked = json.data?.user;

    const dbStaff = staffA1?.id ? await prisma.staff.findUnique({ where: { id: staffA1.id } }) : null;
    const dbMembership = userA1Linked?.id
      ? await prisma.tenantMembership.findFirst({ where: { userId: userA1Linked.id, tenantId: tenantA.id } })
      : null;

    const pass = res.status === 201 &&
      staffA1?.name === `Stylist A1 (${randSuffix})` &&
      staffA1?.branchId === branchA1.id &&
      dbStaff?.tenantId === tenantA.id &&
      dbMembership?.role === 'STAFF' &&
      dbMembership?.status === 'ACTIVE';

    tests.push({
      id: 'STF01',
      title: 'Actor A1 creates Staff in Branch 1 with portal user and verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, staff.id=${staffA1?.id}, Staff.tenantId=${dbStaff?.tenantId}, Membership.role=${dbMembership?.role}`,
    });
  }

  // ── TEST STF02: Actor A2 creates Staff in Branch 2 with same designation ──
  {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify({
        branchId: branchA2.id,
        name: `Stylist A2 (${randSuffix})`,
        phone: `0300222${randSuffix}`,
        designation: 'Senior Stylist',
        joiningDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 48000,
      }),
    });
    const json = await res.json();
    staffA2 = json.data?.staff;

    const dbStaff = staffA2?.id ? await prisma.staff.findUnique({ where: { id: staffA2.id } }) : null;

    const pass = res.status === 201 &&
      staffA2?.name === `Stylist A2 (${randSuffix})` &&
      staffA2?.branchId === branchA2.id &&
      dbStaff?.tenantId === tenantA.id;

    tests.push({
      id: 'STF02',
      title: 'Actor A2 creates Staff in Branch 2 with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, staff.id=${staffA2?.id}, Staff.tenantId=${dbStaff?.tenantId}`,
    });
  }

  // ── TEST STF03: Actor A1 lists Staff (cannot see Branch 2 staff) ──
  {
    const res = await fetch(`${BASE_URL}/staff`, { headers: headersA1 });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((s) => s.id === staffA1.id);
    const hasA2 = list.some((s) => s.id === staffA2.id);

    const pass = res.status === 200 && hasA1 && !hasA2;
    tests.push({
      id: 'STF03',
      title: 'Actor A1 lists Staff — sees own branch staff, Branch 2 staff omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, count=${list.length}, hasA1=${hasA1}, hasA2=${hasA2}`,
    });
  }

  // ── TEST STF04: Actor A1 attempts to list staff specifying Branch 2 (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff?branchId=${branchA2.id}`, { headers: headersA1 });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'STF04',
      title: 'Actor A1 attempts to query Branch 2 staff via ?branchId (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF05: Actor A1 attempts to read Branch 2 staff by direct ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffA2.id}`, { headers: headersA1 });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'STF05',
      title: 'Actor A1 attempts to read Branch 2 staff profile by direct ID (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF06: Actor A1 attempts to create staff specifying Branch 2 (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA2.id,
        name: `Illegal Staff (${randSuffix})`,
        phone: `0300999${randSuffix}`,
        designation: 'Stylist',
        joiningDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 40000,
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'STF06',
      title: 'Actor A1 attempts to inject foreign branchId in staff creation (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF07: Actor A1 attempts to update Branch 2 staff (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffA2.id}`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({ name: 'Tampered Name' }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'STF07',
      title: 'Actor A1 attempts to update Branch 2 staff record (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF08: Actor A1 updates Branch 1 staff salary (verifies StaffCompensationHistory stamping) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffA1.id}`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({ baseSalary: 55000 }),
    });
    const json = await res.json();

    const history = await prisma.staffCompensationHistory.findFirst({
      where: { staffId: staffA1.id },
      orderBy: { createdAt: 'desc' },
    });

    const pass = res.status === 200 &&
      json.data?.baseSalary === 55000 &&
      history?.tenantId === tenantA.id;

    tests.push({
      id: 'STF08',
      title: 'Actor A1 updates Staff compensation — StaffCompensationHistory tenantId stamped',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, baseSalary=${json.data?.baseSalary}, History.tenantId=${history?.tenantId}`,
    });
  }

  // ── TEST STF09: Actor A1 deactivates Branch 1 staff (verifies portal access revoked) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffA1.id}/deactivate`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({ exitDate: '2026-11-02' }),
    });
    const json = await res.json();

    const dbStaff = await prisma.staff.findUnique({
      where: { id: staffA1.id },
      include: { user: { include: { tenantMemberships: true } } },
    });

    const pass = res.status === 200 &&
      dbStaff?.isActive === false &&
      dbStaff?.hasPortalAccess === false &&
      dbStaff?.user?.isActive === false &&
      dbStaff?.user?.tenantMemberships?.some((m) => m.status === 'SUSPENDED');

    tests.push({
      id: 'STF09',
      title: 'Actor A1 deactivates Staff — user and TenantMembership suspended',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, Staff.isActive=${dbStaff?.isActive}, User.isActive=${dbStaff?.user?.isActive}`,
    });
  }

  // ── TEST STF10: Actor B creates Staff in Tenant B ──
  {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        name: `Stylist B (${randSuffix})`,
        phone: `0300333${randSuffix}`,
        designation: 'Senior Stylist',
        joiningDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 50000,
      }),
    });
    const json = await res.json();
    staffB = json.data?.staff;

    const dbStaff = staffB?.id ? await prisma.staff.findUnique({ where: { id: staffB.id } }) : null;

    const pass = res.status === 201 &&
      staffB?.name === `Stylist B (${randSuffix})` &&
      dbStaff?.tenantId === tenantB.id;

    tests.push({
      id: 'STF10',
      title: 'Actor B creates Staff in Tenant B with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, staff.id=${staffB?.id}, Staff.tenantId=${dbStaff?.tenantId}`,
    });
  }

  // ── TEST STF11: Actor B attempts to read Tenant A staff by direct ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffA1.id}`, { headers: headersB });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'STF11',
      title: 'Cross-Tenant: Actor B attempts to read Tenant A staff by direct ID (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF12: Actor B attempts to update Tenant A staff (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffA1.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Cross-Tenant Tamper' }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'STF12',
      title: 'Cross-Tenant: Actor B attempts to update Tenant A staff (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF13: Actor B attempts to create staff specifying Tenant A Branch 1 (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchA1.id,
        name: `Illegal Cross-Tenant Staff (${randSuffix})`,
        phone: `0300888${randSuffix}`,
        designation: 'Stylist',
        joiningDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 40000,
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 &&
      (json.error?.code === 'BRANCH_FORBIDDEN' || json.error?.code === 'FORBIDDEN_TENANT_ACCESS');
    tests.push({
      id: 'STF13',
      title: 'Cross-Tenant: Actor B attempts to create staff in Tenant A Branch 1 (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST STF14: Super Admin A views consolidated Tenant A staff, but Tenant B staff is omitted ──
  {
    const res = await fetch(`${BASE_URL}/staff`, { headers: headersSuper });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((s) => s.id === staffA1.id);
    const hasA2 = list.some((s) => s.id === staffA2.id);
    const hasB  = list.some((s) => s.id === staffB.id);

    const pass = res.status === 200 && hasA1 && hasA2 && !hasB;
    tests.push({
      id: 'STF14',
      title: 'Super Admin A views consolidated Tenant A staff — Tenant B staff omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, total=${list.length}, hasA1=${hasA1}, hasA2=${hasA2}, hasB=${hasB}`,
    });
  }

  // ── TEST STF15: Super Admin A attempts to read Tenant B staff by direct ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/staff/${staffB.id}`, { headers: headersSuper });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'STF15',
      title: 'Super Admin A attempts to read Tenant B staff by direct ID (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART 2: USER ACCESS MANAGEMENT ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST USR01: Actor A1 creates Accountant User in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        name: `Accountant A1 (${randSuffix})`,
        email: `acc.a1.${randSuffix}@isysware.com`,
        role: 'ACCOUNTANT',
        branchId: branchA1.id,
        phone: `0300444${randSuffix}`,
        password: 'Password123!',
      }),
    });
    const json = await res.json();
    userA1 = json.data;

    const dbMembership = userA1?.id
      ? await prisma.tenantMembership.findFirst({ where: { userId: userA1.id, tenantId: tenantA.id } })
      : null;

    const pass = res.status === 201 &&
      userA1?.email === `acc.a1.${randSuffix}@isysware.com` &&
      userA1?.branchId === branchA1.id &&
      dbMembership?.role === 'STAFF' &&
      dbMembership?.status === 'ACTIVE';

    tests.push({
      id: 'USR01',
      title: 'Actor A1 creates Accountant User in Branch 1 with TenantMembership stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, user.id=${userA1?.id}, Membership.tenantId=${dbMembership?.tenantId}`,
    });
  }

  // ── TEST USR02: Actor A1 attempts role escalation to SUPER_ADMIN (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        name: `Hacker SuperAdmin (${randSuffix})`,
        email: `hacker.super.${randSuffix}@isysware.com`,
        role: 'SUPER_ADMIN',
        branchId: branchA1.id,
        password: 'Password123!',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN';
    tests.push({
      id: 'USR02',
      title: 'Privilege Escalation: Actor A1 attempts to create SUPER_ADMIN user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR03: Actor A1 attempts role escalation to ADMIN (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        name: `Hacker Admin (${randSuffix})`,
        email: `hacker.admin.${randSuffix}@isysware.com`,
        role: 'ADMIN',
        branchId: branchA1.id,
        password: 'Password123!',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN';
    tests.push({
      id: 'USR03',
      title: 'Privilege Escalation: Actor A1 attempts to create ADMIN user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR04: Super Admin A creates Branch Admin user for Branch 2 ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersSuper,
      body: JSON.stringify({
        name: `Admin Clifton 2 (${randSuffix})`,
        email: `admin2.clifton.${randSuffix}@isysware.com`,
        role: 'ADMIN',
        branchId: branchA2.id,
        password: 'Password123!',
      }),
    });
    const json = await res.json();
    userA2 = json.data;

    const dbMembership = userA2?.id
      ? await prisma.tenantMembership.findFirst({ where: { userId: userA2.id, tenantId: tenantA.id } })
      : null;

    const pass = res.status === 201 &&
      userA2?.branchId === branchA2.id &&
      dbMembership?.role === 'TENANT_ADMIN' &&
      dbMembership?.status === 'ACTIVE';

    tests.push({
      id: 'USR04',
      title: 'Super Admin A creates Branch Admin for Branch 2 (TenantMembership role: TENANT_ADMIN)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, user.id=${userA2?.id}, Membership.role=${dbMembership?.role}`,
    });
  }

  // ── TEST USR05: Actor A1 lists users (sees own branch, Branch 2 user omitted) ──
  {
    const res = await fetch(`${BASE_URL}/users`, { headers: headersA1 });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((u) => u.id === userA1.id);
    const hasA2 = list.some((u) => u.id === userA2.id);

    const pass = res.status === 200 && hasA1 && !hasA2;
    tests.push({
      id: 'USR05',
      title: 'Actor A1 lists Users — sees own branch users, Branch 2 user omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, count=${list.length}, hasA1=${hasA1}, hasA2=${hasA2}`,
    });
  }

  // ── TEST USR06: Actor A1 attempts to read Branch 2 user by direct ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA2.id}`, { headers: headersA1 });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'USR06',
      title: 'Actor A1 attempts to view Branch 2 user by direct ID (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR07: Actor A1 attempts to edit Branch 2 user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA2.id}`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({ name: 'Tampered Clifton Admin' }),
    });
    const json = await res.json();

    const pass = res.status === 403 &&
      (json.error?.code === 'BRANCH_FORBIDDEN' || json.error?.code === 'FORBIDDEN');
    tests.push({
      id: 'USR07',
      title: 'Actor A1 attempts to edit Branch 2 user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR08: Actor A1 attempts to deactivate Branch 2 user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA2.id}/deactivate`, {
      method: 'POST',
      headers: headersA1,
    });
    const json = await res.json();

    const pass = res.status === 403 &&
      (json.error?.code === 'BRANCH_FORBIDDEN' || json.error?.code === 'FORBIDDEN');
    tests.push({
      id: 'USR08',
      title: 'Actor A1 attempts to deactivate Branch 2 user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR09: Actor A1 attempts to delete Branch 2 user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA2.id}`, {
      method: 'DELETE',
      headers: headersA1,
    });
    const json = await res.json();

    const pass = res.status === 403 &&
      (json.error?.code === 'BRANCH_FORBIDDEN' || json.error?.code === 'FORBIDDEN');
    tests.push({
      id: 'USR09',
      title: 'Actor A1 attempts to delete Branch 2 user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR10: Actor A1 attempts to reset password of Branch 2 user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA2.id}/reset-password`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({ password: 'HackedPassword123!' }),
    });
    const json = await res.json();

    const pass = res.status === 403 &&
      (json.error?.code === 'BRANCH_FORBIDDEN' || json.error?.code === 'FORBIDDEN');
    tests.push({
      id: 'USR10',
      title: 'Actor A1 attempts to reset password of Branch 2 user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR11: Actor A1 attempts to link Branch 2 staff profile to a new user (BLOCKED 400/403) ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        name: `Illegal Staff User (${randSuffix})`,
        email: `illegal.staff.${randSuffix}@isysware.com`,
        role: 'STAFF',
        branchId: branchA1.id,
        staffId: staffA2.id, // staff from branch 2!
        password: 'Password123!',
      }),
    });
    const json = await res.json();

    const pass = (res.status === 400 && json.error?.code === 'BRANCH_MISMATCH') ||
                 (res.status === 403);
    tests.push({
      id: 'USR11',
      title: 'Actor A1 attempts to link Branch 2 staff profile to Branch 1 user (BLOCKED 400/403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR12: Actor A1 deactivates and reactivates own branch user (USR01) ──
  {
    const deactRes = await fetch(`${BASE_URL}/users/${userA1.id}/deactivate`, {
      method: 'POST',
      headers: headersA1,
    });
    const deactJson = await deactRes.json();

    const dbMemberDeact = await prisma.tenantMembership.findFirst({
      where: { userId: userA1.id, tenantId: tenantA.id },
    });

    const reactRes = await fetch(`${BASE_URL}/users/${userA1.id}/reactivate`, {
      method: 'POST',
      headers: headersA1,
    });
    const reactJson = await reactRes.json();

    const dbMemberReact = await prisma.tenantMembership.findFirst({
      where: { userId: userA1.id, tenantId: tenantA.id },
    });

    const pass = deactRes.status === 200 &&
      reactRes.status === 200 &&
      dbMemberDeact?.status === 'SUSPENDED' &&
      dbMemberReact?.status === 'ACTIVE';

    tests.push({
      id: 'USR12',
      title: 'Actor A1 deactivates and reactivates own user — TenantMembership status synced',
      status: pass ? 'PASS' : 'FAIL',
      detail: `Deact HTTP ${deactRes.status} (status: ${dbMemberDeact?.status}), React HTTP ${reactRes.status} (status: ${dbMemberReact?.status})`,
    });
  }

  // ── TEST USR13: Actor B creates User in Tenant B ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        name: `Accountant B (${randSuffix})`,
        email: `acc.b.${randSuffix}@royalelegance.com`,
        role: 'ACCOUNTANT',
        branchId: branchB.id,
        phone: `0300555${randSuffix}`,
        password: 'Password123!',
      }),
    });
    const json = await res.json();
    userB = json.data;

    const dbMembership = userB?.id
      ? await prisma.tenantMembership.findFirst({ where: { userId: userB.id, tenantId: tenantB.id } })
      : null;

    const pass = res.status === 201 &&
      userB?.email === `acc.b.${randSuffix}@royalelegance.com` &&
      dbMembership?.tenantId === tenantB.id;

    tests.push({
      id: 'USR13',
      title: 'Actor B creates Accountant User in Tenant B with TenantMembership stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, user.id=${userB?.id}, Membership.tenantId=${dbMembership?.tenantId}`,
    });
  }

  // ── TEST USR14: Actor B attempts to read Tenant A user by direct ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA1.id}`, { headers: headersB });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR14',
      title: 'Cross-Tenant: Actor B attempts to read Tenant A user by direct ID (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR15: Actor B attempts to edit Tenant A user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA1.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Cross-Tenant Tamper' }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR15',
      title: 'Cross-Tenant: Actor B attempts to edit Tenant A user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR16: Actor B attempts to deactivate Tenant A user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA1.id}/deactivate`, {
      method: 'POST',
      headers: headersB,
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR16',
      title: 'Cross-Tenant: Actor B attempts to deactivate Tenant A user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR17: Actor B attempts to delete Tenant A user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA1.id}`, {
      method: 'DELETE',
      headers: headersB,
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR17',
      title: 'Cross-Tenant: Actor B attempts to delete Tenant A user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR18: Actor B attempts to create user in Tenant A Branch 1 (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        name: `Illegal User (${randSuffix})`,
        email: `illegal.tenant.user.${randSuffix}@royalelegance.com`,
        role: 'ACCOUNTANT',
        branchId: branchA1.id,
        password: 'Password123!',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 &&
      (json.error?.code === 'BRANCH_FORBIDDEN' || json.error?.code === 'FORBIDDEN_TENANT_ACCESS');
    tests.push({
      id: 'USR18',
      title: 'Cross-Tenant: Actor B attempts to create user in Tenant A Branch 1 (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR19: Super Admin A views consolidated Tenant A users — Tenant B user omitted ──
  {
    const res = await fetch(`${BASE_URL}/users`, { headers: headersSuper });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((u) => u.id === userA1.id);
    const hasA2 = list.some((u) => u.id === userA2.id);
    const hasB  = list.some((u) => u.id === userB.id);

    const pass = res.status === 200 && hasA1 && hasA2 && !hasB;
    tests.push({
      id: 'USR19',
      title: 'Super Admin A views consolidated Tenant A users — Tenant B user omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, total=${list.length}, hasA1=${hasA1}, hasA2=${hasA2}, hasB=${hasB}`,
    });
  }

  // ── TEST USR20: Super Admin A attempts to read Tenant B user by direct ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userB.id}`, { headers: headersSuper });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR20',
      title: 'Super Admin A attempts to read Tenant B user by direct ID (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR21: Super Admin A attempts to edit Tenant B user (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users/${userB.id}`, {
      method: 'PUT',
      headers: headersSuper,
      body: JSON.stringify({ name: 'Tampered B User' }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR21',
      title: 'Super Admin A attempts to edit Tenant B user (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR22: Super Admin A attempts to create user in Tenant B branch (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersSuper,
      body: JSON.stringify({
        name: `Illegal Super Admin User (${randSuffix})`,
        email: `illegal.super.user.${randSuffix}@isysware.com`,
        role: 'ADMIN',
        branchId: branchB.id,
        password: 'Password123!',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'USR22',
      title: 'Super Admin A attempts to create user in Tenant B branch (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST USR23: Actor A1 deletes own branch user (USR01) — TenantMembership and user cleanly removed ──
  {
    const res = await fetch(`${BASE_URL}/users/${userA1.id}`, {
      method: 'DELETE',
      headers: headersA1,
    });
    const json = await res.json();

    const dbUser = await prisma.user.findUnique({ where: { id: userA1.id } });
    const dbMember = await prisma.tenantMembership.findFirst({ where: { userId: userA1.id } });

    const pass = res.status === 200 && dbUser === null && dbMember === null;
    tests.push({
      id: 'USR23',
      title: 'Actor A1 deletes own branch user — User and TenantMembership cleanly removed',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, dbUser=${dbUser}, dbMember=${dbMember}`,
    });
  }

  // ── TEST USR24: Invariant Check — No dirty writes, correct tenantId & branchId stamps ──
  {
    const invalidStaffTenant = await prisma.staff.count({
      where: {
        OR: [
          { tenantId: null },
          { tenantId: { notIn: [tenantA.id, tenantB.id] } },
        ],
      },
    });

    const invalidCompTenant = await prisma.staffCompensationHistory.count({
      where: {
        OR: [
          { tenantId: null },
          { tenantId: { notIn: [tenantA.id, tenantB.id] } },
        ],
      },
    });

    const pass = invalidStaffTenant === 0 && invalidCompTenant === 0;
    tests.push({
      id: 'USR24',
      title: 'Database Invariant: All Staff and StaffCompensationHistory rows have valid tenantId stamps',
      status: pass ? 'PASS' : 'FAIL',
      detail: `invalidStaffTenant=${invalidStaffTenant}, invalidCompTenant=${invalidCompTenant}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n=======================================================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=======================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const icon = t.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${t.id}] ${t.title}`);
    console.log(`   └─ Detail: ${t.detail}`);
    if (t.status === 'PASS') passed++;
    else failed++;
  }

  console.log('\n-----------------------------------------------------------------------');
  console.log(`Total Tests: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-----------------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal execution error in test suite:', err);
  process.exit(1);
});

