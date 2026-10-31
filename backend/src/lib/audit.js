// src/lib/audit.js
// Writes an AuditEvent inside the current Prisma transaction.
// Always call this INSIDE the same transaction as the business write.

import { redactSecrets } from './redactSecrets.js';

export const auditLog = async (tx, opts) => {
  let tenantId = opts.tenantId ?? null;
  if (!tenantId && opts.branchId) {
    const branch = await tx.branch.findUnique({
      where: { id: opts.branchId },
      select: { tenantId: true }
    });
    if (branch?.tenantId) tenantId = branch.tenantId;
  }

  await tx.auditEvent.create({
    data: {
      tenantId,
      userId:   opts.userId,
      userName: opts.userName,
      action:   opts.action,
      entity:   opts.entity,
      entityId: opts.entityId ?? null,
      branchId: opts.branchId ?? null,
      before:   redactSecrets(opts.before) ?? undefined,
      after:    redactSecrets(opts.after) ?? undefined,
    },
  });
};
