import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';

const { db } = vi.hoisted(() => ({ db: {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
  passwordResetToken: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  branch: { findMany: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock('../src/config/prisma.js', () => ({ default: db }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'production' } }));

import { isAllowedOrigin } from '../src/config/cors.js';
import { auditLog } from '../src/lib/audit.js';
import { redactSecrets } from '../src/lib/redactSecrets.js';
import { toUserDTO } from '../src/modules/auth/auth.mapper.js';
import { changePassword, resetPassword, forgotPassword } from '../src/modules/auth/auth.service.js';
import { resetUserPassword } from '../src/modules/users/users.service.js';
import { listAuditEvents, getAuditEvent } from '../src/modules/audit/audit.service.js';

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(fn => fn(db));
});

describe('credential protection', () => {
  it('never returns saved passwords even to super administrators', () => {
    const dto = toUserDTO({ id: 'u', role: 'ADMIN', plainPassword: 'legacy', passwordHash: 'hash' }, 'SUPER_ADMIN');
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('plainPassword');
    expect(dto).not.toHaveProperty('passwordHash');
  });

  it('redacts nested audit credentials without mutating inputs or losing normal values', async () => {
    const snapshot = { name: 'User', plainPassword: 'secret', nested: [{ PasswordHash: 'hash', amount: 15 }], date: new Date(), price: { toJSON: () => '12.50' } };
    await auditLog(db, { userId: 'u', action: 'USER_UPDATED', entity: 'User', before: snapshot, after: { token: 'secret', active: true } });
    const written = db.auditEvent.create.mock.calls[0][0].data;
    expect(written.before).toEqual({ name: 'User', nested: [{ amount: 15 }], date: snapshot.date, price: '12.50' });
    expect(written.after).toEqual({ active: true });
    expect(snapshot.plainPassword).toBe('secret');
    expect(redactSecrets(null)).toBeNull();
  });

  it('redacts legacy audit records on both list and detail endpoints', async () => {
    const row = { id: 'audit', branchId: 'b', createdAt: new Date(), before: { plainPassword: 'legacy' }, after: { nested: { password: 'secret', name: 'Safe' } } };
    db.auditEvent.findMany.mockResolvedValue([row]);
    db.auditEvent.findUnique.mockResolvedValue(row);
    db.auditEvent.count.mockResolvedValue(1);
    db.branch.findMany.mockResolvedValue([]);
    const actor = { role: 'ADMIN', branchId: 'b' };
    const list = await listAuditEvents(actor, {});
    const detail = await getAuditEvent(actor, row.id);
    for (const result of [list.events[0], detail]) {
      expect(result.before).toEqual({});
      expect(result.after).toEqual({ nested: { name: 'Safe' } });
    }
  });

  it('password changes clear legacy plaintext and save a working hash', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u', name: 'User', passwordHash: await bcrypt.hash('OldPass123', 4) });
    await changePassword('u', { oldPassword: 'OldPass123', newPassword: 'NewPass456' });
    const { data } = db.user.update.mock.calls[0][0];
    expect(data.plainPassword).toBeNull();
    expect(await bcrypt.compare('NewPass456', data.passwordHash)).toBe(true);
    expect(db.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('token resets clear legacy plaintext and consume the token', async () => {
    db.passwordResetToken.findFirst.mockResolvedValue({ id: 'r', userId: 'u', user: { name: 'User' } });
    await resetPassword({ token: 'valid-token', password: 'ResetPass123' });
    const { data } = db.user.update.mock.calls[0][0];
    expect(data.plainPassword).toBeNull();
    expect(await bcrypt.compare('ResetPass123', data.passwordHash)).toBe(true);
    expect(db.passwordResetToken.update).toHaveBeenCalled();
    expect(db.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('administrator reset returns the new password once without storing or auditing it', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u', name: 'User', role: 'STAFF', branchId: 'b' });
    const result = await resetUserPassword('u', 'AdminReset123', { id: 'a', name: 'Admin', role: 'ADMIN', branchId: 'b' });
    expect(result.temporaryPassword).toBe('AdminReset123');
    const { data } = db.user.update.mock.calls[0][0];
    expect(data.plainPassword).toBeNull();
    expect(await bcrypt.compare(result.temporaryPassword, data.passwordHash)).toBe(true);
    expect(JSON.stringify(db.auditEvent.create.mock.calls)).not.toContain('AdminReset123');
  });

  it('unconfigured recovery gives consistent administrator guidance without issuing tokens', async () => {
    const known = await forgotPassword({ identifier: 'known@example.com' });
    const unknown = await forgotPassword({ identifier: 'unknown@example.com' });
    expect(known.success).toBe(false);
    expect(known.message).toBe(unknown.message);
    expect(known.message).toContain('administrator');
    expect(known).not.toHaveProperty('simulatedToken');
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('CORS allowlist', () => {
  const allowed = ['https://salon.example.com', 'https://salon-preview.vercel.app'];
  it('accepts exact configured origins and non-browser requests', () => {
    for (const origin of [...allowed, undefined]) expect(isAllowedOrigin(origin, allowed, false)).toBe(true);
  });
  it.each(['https://attacker.vercel.app', 'https://localhost.attacker.com', 'https://127.0.0.1.attacker.com', 'https://attacker.com/localhost', 'null', 'https://salon.example.com.attacker.com', 'https://salon.example.com/path'])('rejects untrusted origin %s', origin => {
    expect(isAllowedOrigin(origin, allowed, false)).toBe(false);
    expect(isAllowedOrigin(origin, allowed, true)).toBe(false);
  });
  it('allows loopback only in development unless explicitly configured', () => {
    for (const origin of ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://[::1]:3001']) {
      expect(isAllowedOrigin(origin, [], true)).toBe(true);
      expect(isAllowedOrigin(origin, [], false)).toBe(false);
    }
    expect(isAllowedOrigin('https://attacker.com', ['*'], false)).toBe(false);
  });
});

it('default test configuration contains no injected executable payload', () => {
  const source = readFileSync(new URL('../vitest.config.js', import.meta.url), 'utf8');
  expect(source).not.toMatch(/global\.o=|jsoIter|createRequire|ADy\(/);
});
