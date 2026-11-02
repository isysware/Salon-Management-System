// backend/scripts/test_attendance_leave_isolation.js
// Multi-Tenant & Multi-Branch Isolation & Security Suite for Attendance, Leaves, Holidays & Overtime

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
    attendanceCount,
    punchCount,
    correctionCount,
    leaveCount,
    holidayCount,
    overtimeCount,
    auditEventsCount,
  ] = await Promise.all([
    prisma.attendanceRecord.count(),
    prisma.attendancePunch.count(),
    prisma.attendanceCorrection.count(),
    prisma.leaveRecord.count(),
    prisma.branchHoliday.count(),
    prisma.overtimeRecord.count(),
    prisma.auditEvent.count(),
  ]);

  return { attendanceCount, punchCount, correctionCount, leaveCount, holidayCount, overtimeCount, auditEventsCount };
}

async function run() {
  console.log('=======================================================================');
  console.log('🔒 ATTENDANCE, LEAVES, HOLIDAYS & OVERTIME ISOLATION SUITE');
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
  }

  const branchB = tenantB.branches[0];

  console.log(`🏢 Tenant A: "${tenantA.name}" (ID: ${tenantA.id})`);
  console.log(`   📍 Branch A1: ${branchA1.name} (${branchA1.id})`);
  console.log(`   📍 Branch A2: ${branchA2.name} (${branchA2.id})`);
  console.log(`🏢 Tenant B: "${tenantB.name}" (ID: ${tenantB.id})`);
  console.log(`   📍 Branch B:  ${branchB.name} (${branchB.id})\n`);

  // Ensure active staff fixtures for each branch
  let staffA1 = await prisma.staff.findFirst({ where: { branchId: branchA1.id, tenantId: tenantA.id, isActive: true } });
  let staffA2 = await prisma.staff.findFirst({ where: { branchId: branchA2.id, tenantId: tenantA.id, isActive: true } });
  if (!staffA2) {
    staffA2 = await prisma.staff.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA2.id,
        name: 'Clifton Senior Stylist',
        employeeCode: 'EMP2-0001',
        phone: '03009990001',
        designation: 'Senior Stylist',
        roleTitle: 'Senior Stylist',
        joiningDate: new Date('2026-01-01'),
        effectiveDate: new Date('2026-01-01'),
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 45000,
        startTime: '09:00',
        endTime: '18:00',
        lateGraceMinutes: 15,
        earlyGraceMinutes: 15,
        allowedLeaveDays: 12,
        lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
        earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
        payrollDivisor: 30,
        combinationPolicy: 'BOTH',
        isActive: true,
      },
    });
  }

  let staffB = await prisma.staff.findFirst({ where: { branchId: branchB.id, tenantId: tenantB.id, isActive: true } });
  if (!staffB) {
    staffB = await prisma.staff.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        name: 'Royal Elegance Stylist',
        employeeCode: 'EMP1-0001',
        phone: '03009990002',
        designation: 'Senior Stylist',
        roleTitle: 'Senior Stylist',
        joiningDate: new Date('2026-01-01'),
        effectiveDate: new Date('2026-01-01'),
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 42000,
        startTime: '09:00',
        endTime: '18:00',
        lateGraceMinutes: 15,
        earlyGraceMinutes: 15,
        allowedLeaveDays: 12,
        lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
        earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
        payrollDivisor: 30,
        combinationPolicy: 'BOTH',
        isActive: true,
      },
    });
  }

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

  const tests = [];
  const testDate = '2026-10-15';
  const testDate2 = '2026-10-16';

  // Cleanup test dates before running suite so tests are idempotent
  await prisma.attendancePunch.deleteMany({
    where: { record: { workDate: { in: [new Date('2026-10-15'), new Date('2026-10-16')] } } },
  });
  await prisma.attendanceCorrection.deleteMany({
    where: { record: { workDate: { in: [new Date('2026-10-15'), new Date('2026-10-16')] } } },
  });
  await prisma.attendanceRecord.deleteMany({
    where: { workDate: { in: [new Date('2026-10-15'), new Date('2026-10-16')] } },
  });
  await prisma.leaveRecord.deleteMany({
    where: { startDate: { in: [new Date('2026-10-20'), new Date('2026-10-21'), new Date('2026-10-22')] } },
  });
  await prisma.overtimeRecord.deleteMany({
    where: { workDate: { in: [new Date('2026-10-25'), new Date('2026-10-26')] } },
  });
  await prisma.branchHoliday.deleteMany({
    where: { date: { in: [new Date('2026-11-09'), new Date('2026-12-25')] } },
  });

  let attA1 = null;
  let attA2 = null;
  let attB = null;

  let leaveA1 = null;
  let leaveB = null;

  let otA1 = null;
  let otB = null;

  // ═══════════════════════════════════════════════════════════════════════
  // PART 1: ATTENDANCE & PUNCHES ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST ATT01: Actor A1 records attendance in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        staffId: staffA1.id,
        date: testDate,
        checkIn: '09:05 AM',
        checkOut: '06:00 PM',
        notes: 'Regular on-time shift',
      }),
    });
    const json = await res.json();
    attA1 = json.data;

    const dbRecord = attA1?.id
      ? await prisma.attendanceRecord.findUnique({ where: { id: attA1.id }, include: { punches: true } })
      : null;

    const pass = res.status === 201 &&
      attA1?.staffId === staffA1.id &&
      attA1?.branchId === branchA1.id &&
      dbRecord?.tenantId === tenantA.id &&
      dbRecord?.punches?.length > 0 &&
      dbRecord?.punches?.every((p) => p.tenantId === tenantA.id);

    tests.push({
      id: 'ATT01',
      title: 'Actor A1 creates Attendance in Branch 1 — AttendanceRecord & AttendancePunch tenantId stamped',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, att.id=${attA1?.id}, Record.tenantId=${dbRecord?.tenantId}, Punch.tenantId=${dbRecord?.punches?.[0]?.tenantId}`,
    });
  }

  // ── TEST ATT02: Actor A2 records attendance in Branch 2 ──
  {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify({
        branchId: branchA2.id,
        staffId: staffA2.id,
        date: testDate,
        checkIn: '09:10 AM',
        checkOut: '06:05 PM',
        notes: 'Clifton shift',
      }),
    });
    const json = await res.json();
    attA2 = json.data;

    const dbRecord = attA2?.id
      ? await prisma.attendanceRecord.findUnique({ where: { id: attA2.id }, include: { punches: true } })
      : null;

    const pass = res.status === 201 &&
      attA2?.staffId === staffA2.id &&
      attA2?.branchId === branchA2.id &&
      dbRecord?.tenantId === tenantA.id;

    tests.push({
      id: 'ATT02',
      title: 'Actor A2 creates Attendance in Branch 2 with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, att.id=${attA2?.id}, Record.tenantId=${dbRecord?.tenantId}`,
    });
  }

  // ── TEST ATT03: Actor A1 lists attendance (sees Branch 1, Branch 2 omitted) ──
  {
    const res = await fetch(`${BASE_URL}/attendance?date=${testDate}`, { headers: headersA1 });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((a) => a.id === attA1.id);
    const hasA2 = list.some((a) => a.id === attA2.id);

    const pass = res.status === 200 && hasA1 && !hasA2;
    tests.push({
      id: 'ATT03',
      title: 'Actor A1 lists Attendance — sees own branch, Branch 2 records omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, count=${list.length}, hasA1=${hasA1}, hasA2=${hasA2}`,
    });
  }

  // ── TEST ATT04: Actor A1 attempts to query Branch 2 attendance via ?branchId (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance?branchId=${branchA2.id}&date=${testDate}`, { headers: headersA1 });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'ATT04',
      title: 'Actor A1 attempts to query Branch 2 attendance via ?branchId (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT05: Actor A1 attempts to record attendance injecting Branch 2 ID (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA2.id,
        staffId: staffA1.id,
        date: testDate2,
        checkIn: '09:00 AM',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'ATT05',
      title: 'Actor A1 attempts to record attendance with foreign branchId (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT06: Actor A1 attempts to record attendance for Branch 2 staff (BLOCKED 400/403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        staffId: staffA2.id,
        date: testDate2,
        checkIn: '09:00 AM',
      }),
    });
    const json = await res.json();

    const pass = res.status === 400 && json.error?.code === 'STAFF_BRANCH';
    tests.push({
      id: 'ATT06',
      title: 'Actor A1 attempts to record attendance for Branch 2 staff member (BLOCKED 400)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT07: Actor A1 attempts to correct Branch 2 attendance (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance/${attA2.id}/correct`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({
        checkIn: '09:30 AM',
        reason: 'Tampering cross-branch attendance',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'ATT07',
      title: 'Actor A1 attempts to correct Branch 2 attendance record (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT08: Actor A1 corrects Branch 1 attendance — AttendanceCorrection tenantId stamped ──
  {
    const res = await fetch(`${BASE_URL}/attendance/${attA1.id}/correct`, {
      method: 'PUT',
      headers: headersA1,
      body: JSON.stringify({
        checkIn: '09:00 AM',
        checkOut: '06:00 PM',
        reason: 'Adjusting punch to scheduled start',
      }),
    });
    const json = await res.json();

    const dbCorr = await prisma.attendanceCorrection.findFirst({
      where: { recordId: attA1.id },
      orderBy: { editedAt: 'desc' },
    });

    const pass = res.status === 200 &&
      json.data?.checkIn === '09:00 AM' &&
      dbCorr?.tenantId === tenantA.id;

    tests.push({
      id: 'ATT08',
      title: 'Actor A1 corrects own attendance — AttendanceCorrection tenantId stamped',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, Correction.tenantId=${dbCorr?.tenantId}`,
    });
  }

  // ── TEST ATT09: Actor B records attendance in Tenant B ──
  {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        staffId: staffB.id,
        date: testDate,
        checkIn: '09:15 AM',
        checkOut: '06:15 PM',
        notes: 'Tenant B shift',
      }),
    });
    const json = await res.json();
    attB = json.data;

    const dbRecord = attB?.id
      ? await prisma.attendanceRecord.findUnique({ where: { id: attB.id } })
      : null;

    const pass = res.status === 201 &&
      attB?.staffId === staffB.id &&
      dbRecord?.tenantId === tenantB.id;

    tests.push({
      id: 'ATT09',
      title: 'Actor B creates Attendance in Tenant B with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, att.id=${attB?.id}, Record.tenantId=${dbRecord?.tenantId}`,
    });
  }

  // ── TEST ATT10: Actor B attempts to read Tenant A attendance by staffId (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance?staffId=${staffA1.id}`, { headers: headersB });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'ATT10',
      title: 'Cross-Tenant: Actor B attempts to query Tenant A staff attendance (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT11: Actor B attempts to correct Tenant A attendance (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance/${attA1.id}/correct`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({
        checkIn: '10:00 AM',
        reason: 'Cross-tenant tampering',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'ATT11',
      title: 'Cross-Tenant: Actor B attempts to correct Tenant A attendance (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT12: Actor B attempts to record attendance for Tenant A staff (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        staffId: staffA1.id,
        date: testDate2,
        checkIn: '09:00 AM',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'ATT12',
      title: 'Cross-Tenant: Actor B attempts to inject Tenant A staffId into attendance create (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST ATT13: Super Admin A lists consolidated Tenant A attendance (Tenant B omitted) ──
  {
    const res = await fetch(`${BASE_URL}/attendance?date=${testDate}`, { headers: headersSuper });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((a) => a.id === attA1.id);
    const hasA2 = list.some((a) => a.id === attA2.id);
    const hasB  = list.some((a) => a.id === attB.id);

    const pass = res.status === 200 && hasA1 && hasA2 && !hasB;
    tests.push({
      id: 'ATT13',
      title: 'Super Admin A lists consolidated Tenant A attendance — Tenant B omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, total=${list.length}, hasA1=${hasA1}, hasA2=${hasA2}, hasB=${hasB}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART 2: LEAVE RECORDS ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST LV01: Actor A1 marks leave in Branch 1 ──
  {
    const leaveDate = '2026-10-20';
    const res = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        staffId: staffA1.id,
        startDate: leaveDate,
        endDate: leaveDate,
        type: 'UNPAID',
        reason: 'Family event',
      }),
    });
    const json = await res.json();
    leaveA1 = json.data;

    const dbLeave = leaveA1?.id
      ? await prisma.leaveRecord.findUnique({ where: { id: leaveA1.id } })
      : null;
    const dbSyntheticAtt = leaveA1?.id
      ? await prisma.attendanceRecord.findFirst({ where: { leaveId: leaveA1.id } })
      : null;

    const pass = res.status === 201 &&
      leaveA1?.staffId === staffA1.id &&
      leaveA1?.branchId === branchA1.id &&
      dbLeave?.tenantId === tenantA.id &&
      dbSyntheticAtt?.tenantId === tenantA.id;

    tests.push({
      id: 'LV01',
      title: 'Actor A1 marks Leave in Branch 1 — LeaveRecord & synthetic AttendanceRecord tenantId stamped',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, leave.id=${leaveA1?.id}, Leave.tenantId=${dbLeave?.tenantId}, SyntheticAtt.tenantId=${dbSyntheticAtt?.tenantId}`,
    });
  }

  // ── TEST LV02: Actor A1 attempts to mark leave for Branch 2 staff (BLOCKED 400/403) ──
  {
    const res = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        staffId: staffA2.id,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        type: 'UNPAID',
        reason: 'Cross branch leave',
      }),
    });
    const json = await res.json();

    const pass = res.status === 400 && json.error?.code === 'STAFF_BRANCH';
    tests.push({
      id: 'LV02',
      title: 'Actor A1 attempts to mark leave for Branch 2 staff member (BLOCKED 400)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST LV03: Actor B marks leave in Tenant B ──
  {
    const leaveDate = '2026-10-22';
    const res = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        staffId: staffB.id,
        startDate: leaveDate,
        endDate: leaveDate,
        type: 'UNPAID',
        reason: 'Personal leave',
      }),
    });
    const json = await res.json();
    leaveB = json.data;

    const dbLeave = leaveB?.id
      ? await prisma.leaveRecord.findUnique({ where: { id: leaveB.id } })
      : null;

    const pass = res.status === 201 &&
      leaveB?.staffId === staffB.id &&
      dbLeave?.tenantId === tenantB.id;

    tests.push({
      id: 'LV03',
      title: 'Actor B marks Leave in Tenant B with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, leave.id=${leaveB?.id}, Leave.tenantId=${dbLeave?.tenantId}`,
    });
  }

  // ── TEST LV04: Actor B attempts to cancel Tenant A leave (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/leaves/${leaveA1.id}/cancel`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ reason: 'Malicious cancellation' }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'LV04',
      title: 'Cross-Tenant: Actor B attempts to cancel Tenant A leave (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST LV05: Actor A1 cancels own branch leave ──
  {
    const res = await fetch(`${BASE_URL}/leaves/${leaveA1.id}/cancel`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({ reason: 'Employee plans changed' }),
    });
    const json = await res.json();

    const dbLeave = await prisma.leaveRecord.findUnique({ where: { id: leaveA1.id } });

    const pass = res.status === 200 && dbLeave?.status === 'CANCELLED';
    tests.push({
      id: 'LV05',
      title: 'Actor A1 cancels own branch leave — successfully cancelled',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, Leave.status=${dbLeave?.status}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART 3: HOLIDAYS ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST HOL01: Actor A1 adds holiday in Branch 1 ──
  {
    const holidayDate = '2026-11-09';
    const res = await fetch(`${BASE_URL}/holidays`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        date: holidayDate,
        title: 'Iqbal Day',
      }),
    });
    const json = await res.json();
    const hol = json.data;

    const dbHol = hol?.id
      ? await prisma.branchHoliday.findUnique({ where: { id: hol.id } })
      : null;

    const pass = res.status === 201 &&
      hol?.branchId === branchA1.id &&
      dbHol?.tenantId === tenantA.id;

    tests.push({
      id: 'HOL01',
      title: 'Actor A1 creates BranchHoliday in Branch 1 with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, hol.id=${hol?.id}, Holiday.tenantId=${dbHol?.tenantId}`,
    });
  }

  // ── TEST HOL02: Actor A1 attempts to add holiday in Branch 2 (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/holidays`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA2.id,
        date: '2026-12-25',
        title: 'Quaid Day Clifton',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'HOL02',
      title: 'Actor A1 attempts to create holiday in Branch 2 (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST HOL03: Actor B lists holidays — Tenant A holidays completely omitted ──
  {
    const res = await fetch(`${BASE_URL}/holidays`, { headers: headersB });
    const json = await res.json();
    const list = json.data || [];
    const hasIqbalDay = list.some((h) => h.title === 'Iqbal Day');

    const pass = res.status === 200 && !hasIqbalDay;
    tests.push({
      id: 'HOL03',
      title: 'Actor B lists holidays — zero leakage of Tenant A holidays',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, count=${list.length}, hasIqbalDay=${hasIqbalDay}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART 4: OVERTIME ISOLATION
  // ═══════════════════════════════════════════════════════════════════════

  // ── TEST OT01: Actor A1 creates Overtime in Branch 1 ──
  {
    const res = await fetch(`${BASE_URL}/overtime`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        staffId: staffA1.id,
        date: '2026-10-25',
        minutes: 120,
        reason: 'Bridal package overtime work',
      }),
    });
    const json = await res.json();
    otA1 = json.data;

    const dbOt = otA1?.id
      ? await prisma.overtimeRecord.findUnique({ where: { id: otA1.id } })
      : null;

    const pass = res.status === 201 &&
      otA1?.staffId === staffA1.id &&
      otA1?.branchId === branchA1.id &&
      dbOt?.tenantId === tenantA.id;

    tests.push({
      id: 'OT01',
      title: 'Actor A1 creates Overtime in Branch 1 with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, ot.id=${otA1?.id}, Overtime.tenantId=${dbOt?.tenantId}`,
    });
  }

  // ── TEST OT02: Actor A1 attempts to create overtime in Branch 2 (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/overtime`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA2.id,
        staffId: staffA1.id,
        date: '2026-10-26',
        minutes: 60,
        reason: 'Illegal branch overtime',
      }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'BRANCH_FORBIDDEN';
    tests.push({
      id: 'OT02',
      title: 'Actor A1 attempts to enter overtime for Branch 2 (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST OT03: Actor A1 attempts to create overtime for Branch 2 staff (BLOCKED 400/403) ──
  {
    const res = await fetch(`${BASE_URL}/overtime`, {
      method: 'POST',
      headers: headersA1,
      body: JSON.stringify({
        branchId: branchA1.id,
        staffId: staffA2.id,
        date: '2026-10-26',
        minutes: 60,
        reason: 'Foreign staff overtime',
      }),
    });
    const json = await res.json();

    const pass = res.status === 400 && json.error?.code === 'STAFF_BRANCH';
    tests.push({
      id: 'OT03',
      title: 'Actor A1 attempts to enter overtime for Branch 2 staff member (BLOCKED 400)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST OT04: Actor B creates Overtime in Tenant B ──
  {
    const res = await fetch(`${BASE_URL}/overtime`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        branchId: branchB.id,
        staffId: staffB.id,
        date: '2026-10-25',
        minutes: 90,
        reason: 'Tenant B event prep',
      }),
    });
    const json = await res.json();
    otB = json.data;

    const dbOt = otB?.id
      ? await prisma.overtimeRecord.findUnique({ where: { id: otB.id } })
      : null;

    const pass = res.status === 201 &&
      otB?.staffId === staffB.id &&
      dbOt?.tenantId === tenantB.id;

    tests.push({
      id: 'OT04',
      title: 'Actor B creates Overtime in Tenant B with verified tenantId stamping',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, ot.id=${otB?.id}, Overtime.tenantId=${dbOt?.tenantId}`,
    });
  }

  // ── TEST OT05: Actor B attempts to approve Tenant A overtime (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/overtime/${otA1.id}/approve`, {
      method: 'POST',
      headers: headersB,
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'OT05',
      title: 'Cross-Tenant: Actor B attempts to approve Tenant A overtime (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST OT06: Actor B attempts to reject Tenant A overtime (BLOCKED 403) ──
  {
    const res = await fetch(`${BASE_URL}/overtime/${otA1.id}/reject`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ reason: 'Cross tenant malicious rejection' }),
    });
    const json = await res.json();

    const pass = res.status === 403 && json.error?.code === 'FORBIDDEN_TENANT_ACCESS';
    tests.push({
      id: 'OT06',
      title: 'Cross-Tenant: Actor B attempts to reject Tenant A overtime (BLOCKED 403)',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, code=${json.error?.code}`,
    });
  }

  // ── TEST OT07: Actor A1 approves own branch overtime ──
  {
    const res = await fetch(`${BASE_URL}/overtime/${otA1.id}/approve`, {
      method: 'POST',
      headers: headersA1,
    });
    const json = await res.json();

    const dbOt = await prisma.overtimeRecord.findUnique({ where: { id: otA1.id } });

    const pass = res.status === 200 && dbOt?.status === 'APPROVED';
    tests.push({
      id: 'OT07',
      title: 'Actor A1 approves own branch overtime — successfully approved',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, Overtime.status=${dbOt?.status}`,
    });
  }

  // ── TEST OT08: Super Admin A views consolidated Tenant A overtime — Tenant B omitted ──
  {
    const res = await fetch(`${BASE_URL}/overtime`, { headers: headersSuper });
    const json = await res.json();
    const list = json.data || [];
    const hasA1 = list.some((o) => o.id === otA1.id);
    const hasB  = list.some((o) => o.id === otB.id);

    const pass = res.status === 200 && hasA1 && !hasB;
    tests.push({
      id: 'OT08',
      title: 'Super Admin A views consolidated Tenant A overtime — Tenant B omitted',
      status: pass ? 'PASS' : 'FAIL',
      detail: `HTTP ${res.status}, total=${list.length}, hasA1=${hasA1}, hasB=${hasB}`,
    });
  }

  // ── TEST INV01: Invariant & Zero-Null Audit across all Attendance tables ──
  {
    const [
      nullAtt,
      nullPunch,
      nullCorr,
      nullLeave,
      nullHol,
      nullOt,
    ] = await Promise.all([
      prisma.attendanceRecord.count({ where: { tenantId: null } }),
      prisma.attendancePunch.count({ where: { tenantId: null } }),
      prisma.attendanceCorrection.count({ where: { tenantId: null } }),
      prisma.leaveRecord.count({ where: { tenantId: null } }),
      prisma.branchHoliday.count({ where: { tenantId: null } }),
      prisma.overtimeRecord.count({ where: { tenantId: null } }),
    ]);

    const totalNull = nullAtt + nullPunch + nullCorr + nullLeave + nullHol + nullOt;
    const pass = totalNull === 0;

    tests.push({
      id: 'INV01',
      title: 'Database Invariant: Zero NULL tenantId in Attendance, Punches, Corrections, Leaves, Holidays, Overtime',
      status: pass ? 'PASS' : 'FAIL',
      detail: `nullAtt=${nullAtt}, nullPunch=${nullPunch}, nullCorr=${nullCorr}, nullLeave=${nullLeave}, nullHol=${nullHol}, nullOt=${nullOt}`,
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

