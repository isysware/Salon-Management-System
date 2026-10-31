// src/middleware/quotaGuard.js
// Enforces dynamic plan entitlements and quota limits at the API layer (AGENTS.md Gate 3)

import prisma from '../config/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';

/**
 * Guards routes by checking if the tenant's plan allows this module
 * @param {string} moduleKey - e.g. 'payroll', 'bookings', 'devices', 'inventory'
 */
export const requireModule = (moduleKey) => (req, _res, next) => {
  const allowed = req.tenant?.allowedModules;
  if (Array.isArray(allowed) && !allowed.includes(moduleKey)) {
    throw new AppError(
      403,
      'MODULE_NOT_ENTITLED',
      `The '${moduleKey}' module is not available in your current subscription plan. Please upgrade your plan to access this feature.`
    );
  }
  next();
};

/**
 * Checks branch limit before creating a branch
 */
export const checkBranchQuota = asyncHandler(async (req, _res, next) => {
  const tenantId = req.tenantId;
  const maxBranches = req.tenant?.quotas?.maxBranches ?? 1;

  const currentCount = await prisma.branch.count({
    where: { tenantId, isActive: true }
  });

  if (currentCount >= maxBranches) {
    throw new AppError(
      403,
      'BRANCH_LIMIT_REACHED',
      `You have reached the maximum allowed branches (${maxBranches}) for your plan. Please upgrade to add more branches.`
    );
  }

  next();
});

/**
 * Checks staff limit before creating staff
 */
export const checkStaffQuota = asyncHandler(async (req, _res, next) => {
  const tenantId = req.tenantId;
  const maxStaff = req.tenant?.quotas?.maxStaff ?? 10;

  const currentCount = await prisma.staff.count({
    where: { tenantId, isActive: true }
  });

  if (currentCount >= maxStaff) {
    throw new AppError(
      403,
      'STAFF_LIMIT_REACHED',
      `You have reached the maximum allowed staff (${maxStaff}) for your plan. Please upgrade to add more staff members.`
    );
  }

  next();
});

