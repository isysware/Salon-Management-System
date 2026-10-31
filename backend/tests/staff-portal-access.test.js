import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, state } = vi.hoisted(() => ({
  state: { staff: null, user: null },
  db: {
    staff: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    branch: { findUnique: vi.fn() }, refreshToken: { updateMany: vi.fn(), create: vi.fn() },
    staffCompensationHistory: { create: vi.fn() }, auditEvent: { create: vi.fn() }, $transaction: vi.fn(),
  },
}));
vi.mock('../src/config/prisma.js', () => ({ default: db }));
vi.mock('../src/config/env.js', () => ({ env: { jwtAccessSecret: 'test-access-secret', jwtRefreshSecret: 'test-refresh-secret', jwtAccessExpires: '15m', jwtRefreshExpires: '7d', nodeEnv: 'test' } }));
import { setPortalAccess, updateStaff } from '../src/modules/staff/staff.service.js';
import { login, sessionBlockReason } from '../src/modules/auth/auth.service.js';
import { updateStaffSchema } from '../src/modules/staff/staff.schema.js';
import { canAccessRoute, getDefaultRouteForRole } from '../../frontend/src/lib/permissions.ts';

const actor = { id: 'admin', role: 'ADMIN', branchId: 'b1' };
const sessionUser = () => state.user && ({ ...state.user, branch: { name: 'Salon', isActive: true }, staff: state.staff });
beforeEach(async () => {
  vi.resetAllMocks();
  state.staff = { id: 'staff1', branchId: 'b1', name: 'Stylist', designation: 'Stylist', email: 'profile@example.com',
    isActive: true, hasPortalAccess: false, compensationType: 'MONTHLY_SALARY', baseSalary: 10000,
    dailySalaryRate: 0, commissionRate: 0, overtimeHourlyRate: 0, payrollDivisor: 30,
    lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 }, earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    effectiveDate: new Date('2026-10-01'),
  };
  state.user = null;
  db.$transaction.mockImplementation(async fn => {
    const snapshot = structuredClone(state);
    try { return await fn(db); } catch (err) { Object.assign(state, snapshot); throw err; }
  });
  db.branch.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
  db.staff.findUnique.mockImplementation(async () => ({ ...state.staff, user: state.user }));
  db.staff.update.mockImplementation(async ({ data }) => { Object.assign(state.staff, data); return { ...state.staff, user: state.user }; });
  db.user.findUnique.mockImplementation(async ({ where }) => state.user?.email === where.email ? state.user : null);
  db.user.findFirst.mockImplementation(async ({ where }) => where.OR.some(filter => filter.email === state.user?.email) ? sessionUser() : null);
  db.user.create.mockImplementation(async ({ data }) => (state.user = { id: 'login1', isActive: true, ...data }));
  db.user.update.mockImplementation(async ({ data }) => (state.user = { ...state.user, ...data }));
});

describe('staff portal provisioning and login', () => {
  it('enables access from Edit Profile and the new credentials can log in', async () => {
    const input = updateStaffSchema.parse({ enablePortalAccess: true, portalIdentifier: ' Stylist@Example.com ', portalPassword: 'StaffPass123' });
    const result = await updateStaff('staff1', input, actor);
    expect(result).toMatchObject({ hasPortalAccess: true, linkedUserEmail: 'stylist@example.com' });
    const signedIn = await login({ identifier: 'stylist@example.com', password: 'StaffPass123', portal: 'STAFF' }, { cookie: vi.fn() });
    expect(signedIn.user).toMatchObject({ role: 'STAFF', staffId: 'staff1', branchId: 'b1' });
    expect(signedIn.accessToken).toBeTruthy();
    expect(db.$transaction).toHaveBeenCalledTimes(2); // profile + access together, then login
  });

  it('preserves the existing custom login and password on re-enable', async () => {
    await setPortalAccess('staff1', { enable: true, identifier: 'custom-login', password: 'StaffPass123' }, actor);
    const hash = state.user.passwordHash;
    await setPortalAccess('staff1', { enable: false }, actor);
    await setPortalAccess('staff1', { enable: true }, actor);
    expect(state.user).toMatchObject({ email: 'custom-login', passwordHash: hash, isActive: true });
    expect(sessionBlockReason(sessionUser())).toBeNull();
    expect(db.user.create).toHaveBeenCalledTimes(1);
  });

  it('revokes access when switched off in Edit Profile', async () => {
    await setPortalAccess('staff1', { enable: true, identifier: 'stylist', password: 'StaffPass123' }, actor);
    const result = await updateStaff('staff1', { enablePortalAccess: false }, actor);
    expect(result.hasPortalAccess).toBe(false);
    expect(state.user.isActive).toBe(false);
    expect(db.refreshToken.updateMany).toHaveBeenCalled();
    await expect(login({ identifier: 'stylist', password: 'StaffPass123', portal: 'STAFF' }, { cookie: vi.fn() })).rejects.toMatchObject({ status: 403 });
  });

  it('rolls back the profile update if portal login creation fails', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'other', email: 'taken' });
    await expect(updateStaff('staff1', { name: 'Changed', enablePortalAccess: true, portalIdentifier: 'taken' }, actor)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(state.staff.name).toBe('Stylist');
    expect(state.staff.hasPortalAccess).toBe(false);
    expect(state.user).toBeNull();
  });

  it('keeps inactive employees and branches blocked', async () => {
    state.staff.isActive = false;
    await expect(setPortalAccess('staff1', { enable: true }, actor)).rejects.toMatchObject({ code: 'STAFF_INACTIVE' });
    state.staff.isActive = true;
    db.branch.findUnique.mockResolvedValue({ isActive: false });
    await expect(setPortalAccess('staff1', { enable: true }, actor)).rejects.toMatchObject({ code: 'BRANCH_INACTIVE' });
  });

  it('does not grant access across branches', async () => {
    await expect(setPortalAccess('staff1', { enable: true }, { ...actor, branchId: 'b2' })).rejects.toMatchObject({ status: 403 });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('validates portal input before saving', () => {
    expect(updateStaffSchema.safeParse({ enablePortalAccess: 'yes' }).success).toBe(false);
    expect(updateStaffSchema.safeParse({ portalPassword: '123' }).success).toBe(false);
  });
});

describe('staff portal navigation', () => {
  const staff = { id: 'staff-user', role: 'STAFF', staffId: 'staff1', branchId: 'b1' };
  it.each(['/dashboard', '/my-performance', '/my-attendance', '/my-reports'])('allows the personal route %s', path => {
    expect(canAccessRoute(staff, path)).toBe(true);
  });
  it.each(['/admin/users', '/reports/sales-invoices', '/reports/operating-profit', '/pos'])('keeps privileged route %s blocked', path => {
    expect(canAccessRoute(staff, path)).toBe(false);
  });
  it('uses the staff workspace as the home destination', () => {
    expect(getDefaultRouteForRole('STAFF')).toBe('/my-performance');
  });
});
