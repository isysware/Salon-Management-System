// src/lib/scope.js
// Branch-scope helpers shared by every module service.

import { forbidden, badRequest } from './AppError.js';

export const isSuperAdmin = (user) => user.role === 'SUPER_ADMIN';

export const assertInvoiceAccess = (actor, invoice) => {
  assertBranchAccess(actor, invoice.branchId);
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') return;
  if (actor.role !== 'ACCOUNTANT' || !actor.id || invoice.processedByUserId !== actor.id) {
    throw forbidden('INVOICE_FORBIDDEN', 'Access Denied: You can only access your own sales.');
  }
};

/**
 * Resolve which branch a read query should be filtered by.
 * Non-super users are always locked to their own branch.
 * @returns {string|null} branchId, or null meaning "all branches"
 */
export const resolveReadBranch = (user, requested) => {
  if (!isSuperAdmin(user)) {
    if (!user.branchId) throw forbidden('BRANCH_REQUIRED', 'A branch assignment is required to access records.');
    return user.branchId;
  }
  if (!requested || requested === 'ALL') return null;
  return requested;
};

/** Prisma `where` fragment for a branch-scoped read. */
export const branchWhere = (user, requested) => {
  const b = resolveReadBranch(user, requested);
  return b ? { branchId: b } : {};
};

/** Throw 403 if the user may not touch records of `branchId`. */
export const assertBranchAccess = (user, branchId, message = 'Access Denied: Cannot access records from another branch.') => {
  if (isSuperAdmin(user)) return;
  if (!branchId || branchId !== user.branchId) throw forbidden('BRANCH_FORBIDDEN', message);
};

/**
 * Resolve the branch a mutation targets.
 * Non-super users always write to their own branch (naming another branch is a 403);
 * SUPER_ADMIN must name one explicitly.
 */
export const resolveWriteBranch = (user, requested, message = 'Access Denied: Cannot modify records of another branch.') => {
  if (!isSuperAdmin(user)) {
    if (requested && requested !== 'ALL' && requested !== user.branchId) throw forbidden('BRANCH_FORBIDDEN', message);
    return user.branchId;
  }
  if (!requested || requested === 'ALL') {
    throw badRequest('BRANCH_REQUIRED', 'Please select a specific branch for this operation.');
  }
  return requested;
};
