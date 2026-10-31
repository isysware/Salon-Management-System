// src/middleware/tenantContext.js
// Defensive Multi-Tenant Isolation Middleware (AGENTS.md & PRD Section 5)
// Ensures every request to tenant-scoped routes is verified against the authenticated tenant context.

import prisma from '../config/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const tenantContext = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required for tenant context');
  }

  const clientRequestedTenantId = req.headers['x-tenant-id'];
  let targetTenantId;

  if (req.user.role === 'SUPER_ADMIN') {
    // Platform Super Admin is authorized to inspect any tenant via header, or fallback to default
    targetTenantId = clientRequestedTenantId || req.user.tenantId || req.user.tenantMemberships?.[0]?.tenantId;
    if (!targetTenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'flagship-salon' } });
      targetTenantId = defaultTenant?.id;
    }
  } else {
    // Non-SuperAdmin: NEVER trust client-supplied X-Tenant-Id header unless user is a verified active member!
    const userMemberships = req.user.tenantMemberships || [];
    const validTenantIds = userMemberships.filter(m => m.status === 'ACTIVE').map(m => m.tenantId);

    if (clientRequestedTenantId) {
      if (!validTenantIds.includes(clientRequestedTenantId)) {
        throw new AppError(
          403,
          'FORBIDDEN_TENANT_ACCESS',
          'Access Denied: Cross-tenant access is forbidden. You are not a member of the requested salon.'
        );
      }
      targetTenantId = clientRequestedTenantId;
    } else {
      targetTenantId = req.user.tenantId || validTenantIds[0];
    }
  }

  if (!targetTenantId) {
    throw new AppError(403, 'NO_TENANT_MEMBERSHIP', 'User does not belong to any active salon company');
  }

  // Fetch tenant with active subscription and plan details
  const tenant = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    include: {
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          planVersion: {
            include: { plan: true }
          }
        }
      }
    }
  });

  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'The specified salon tenant was not found');
  }

  // Check tenant suspension for write operations
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (tenant.status === 'SUSPENDED' && isWriteMethod) {
    if (!req.originalUrl.includes('/tenant/billing/submit-payment')) {
      throw new AppError(
        403,
        'TENANT_SUSPENDED',
        'Your salon subscription is suspended. Contact billing to reactivate your account.'
      );
    }
  }

  const activeSub = tenant.subscriptions?.[0] || null;
  const planVersion = activeSub?.planVersion || null;
  const activeMembership = req.user.tenantMemberships?.find(m => m.tenantId === targetTenantId);

  req.tenantId = tenant.id;
  req.tenantRole = activeMembership?.role || (req.user.role === 'SUPER_ADMIN' ? 'TENANT_OWNER' : 'STAFF');
  req.tenant = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    currency: tenant.currency,
    timezone: tenant.timezone,
    subscription: activeSub,
    plan: planVersion?.plan || null,
    allowedModules: planVersion?.allowedModules || ['pos', 'services', 'clients', 'appointments', 'inventory', 'expenses', 'reports'],
    quotas: {
      maxBranches: planVersion?.maxBranches ?? 1,
      maxStaff: planVersion?.maxStaff ?? 10,
      maxDevices: planVersion?.maxDevices ?? 2,
    }
  };

  next();
});
