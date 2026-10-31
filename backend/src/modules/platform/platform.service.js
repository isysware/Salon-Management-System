// src/modules/platform/platform.service.js
// SaaS Platform Master Admin Service (Portal 1 Control Plane)

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import { AppError } from '../../lib/AppError.js';

const BCRYPT_ROUNDS = 12;

export const getPlatformStats = async () => {
  const [
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    totalBranches,
    totalUsers,
    pendingPayments,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { status: 'TRIAL' } }),
    prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    prisma.branch.count(),
    prisma.user.count(),
    prisma.subscriptionPayment.count({ where: { status: 'PENDING_VERIFICATION' } }),
    prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { planVersion: true },
    }),
  ]);

  // Calculate estimated Monthly Recurring Revenue (MRR)
  const estimatedMRR = activeSubscriptions.reduce((acc, sub) => {
    const price = Number(sub.planVersion?.monthlyPrice || 0);
    return acc + price;
  }, 0);

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    totalBranches,
    totalUsers,
    pendingPayments,
    estimatedMRR,
  };
};

export const listTenants = async () => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      branches: {
        select: { id: true, name: true, code: true, isActive: true },
      },
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
        },
      },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          planVersion: {
            include: { plan: true },
          },
        },
      },
    },
  });

  return tenants.map((t) => {
    const sub = t.subscriptions?.[0] || null;
    const ownerMembership = t.memberships.find((m) => m.role === 'TENANT_OWNER');
    const owner = ownerMembership?.user || null;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      currency: t.currency,
      timezone: t.timezone,
      contactEmail: t.contactEmail,
      contactPhone: t.contactPhone,
      createdAt: t.createdAt,
      branchCount: t.branches.length,
      userCount: t.memberships.length,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone } : null,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            billingCycle: sub.billingCycle,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            planName: sub.planVersion?.plan?.name || 'Custom',
            planCode: sub.planVersion?.plan?.code || 'CUSTOM',
            monthlyPrice: sub.planVersion?.monthlyPrice,
            allowedModules: sub.planVersion?.allowedModules,
            maxBranches: sub.planVersion?.maxBranches,
            maxStaff: sub.planVersion?.maxStaff,
          }
        : null,
    };
  });
};

export const createTenant = async (data, platformAdminUserId) => {
  const {
    name,
    slug,
    contactEmail,
    contactPhone,
    ownerName,
    ownerEmail,
    ownerPassword,
    planId,
    billingCycle = 'MONTHLY',
    branchName = 'Main Branch',
    branchAddress = 'Main Commercial Area',
    branchCity = 'Karachi',
    branchPhone = '+92 300 0000000',
  } = data;

  if (!name || !slug || !ownerEmail || !ownerPassword) {
    throw new AppError(400, 'MISSING_FIELDS', 'Name, slug, ownerEmail, and ownerPassword are required');
  }

  // Check uniqueness
  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new AppError(409, 'SLUG_IN_USE', `Salon slug '${slug}' is already taken. Please choose another.`);
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existingEmail) {
    throw new AppError(409, 'EMAIL_IN_USE', `User email '${ownerEmail}' is already registered in the system.`);
  }

  // Find plan & version
  let planVersion;
  if (planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { versions: { where: { isActive: true }, orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    planVersion = plan?.versions?.[0];
  }

  if (!planVersion) {
    // Default to Starter plan version
    const defaultPlan = await prisma.plan.findFirst({
      where: { code: 'STARTER' },
      include: { versions: { take: 1 } },
    });
    planVersion = defaultPlan?.versions?.[0];
  }

  if (!planVersion) {
    throw new AppError(500, 'NO_PLANS_CONFIGURED', 'No active SaaS plan versions found in database');
  }

  const passwordHash = await bcrypt.hash(ownerPassword, BCRYPT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const newTenant = await tx.tenant.create({
      data: {
        name,
        slug,
        contactEmail,
        contactPhone,
        status: 'ACTIVE',
      },
    });

    // 2. Generate clean branch code
    const baseCode = slug.substring(0, 4).toUpperCase();
    const branchCode = `${baseCode}-01`;

    // 3. Create default Branch
    const newBranch = await tx.branch.create({
      data: {
        tenantId: newTenant.id,
        name: branchName,
        code: branchCode,
        address: branchAddress,
        city: branchCity,
        phone: branchPhone,
        isActive: true,
      },
    });

    // 4. Create Owner User
    const newUser = await tx.user.create({
      data: {
        name: ownerName || name,
        email: ownerEmail,
        passwordHash,
        plainPassword: null,
        role: 'ADMIN',
        branchId: newBranch.id,
        isActive: true,
      },
    });

    // 5. Create Tenant Membership
    await tx.tenantMembership.create({
      data: {
        tenantId: newTenant.id,
        userId: newUser.id,
        role: 'TENANT_OWNER',
        status: 'ACTIVE',
      },
    });

    // 6. Calculate period end
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 7. Create Subscription
    const newSub = await tx.subscription.create({
      data: {
        tenantId: newTenant.id,
        planVersionId: planVersion.id,
        status: 'ACTIVE',
        billingCycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: true,
      },
    });

    // 8. Create Audit Event
    await tx.tenantAuditEvent.create({
      data: {
        tenantId: newTenant.id,
        actorId: platformAdminUserId || 'PLATFORM_SUPER_ADMIN',
        actorRole: 'SUPER_ADMIN',
        action: 'TENANT_PROVISIONED',
        entity: 'Tenant',
        entityId: newTenant.id,
        details: {
          tenantName: newTenant.name,
          slug: newTenant.slug,
          ownerEmail: newUser.email,
          branchName: newBranch.name,
          planVersionId: planVersion.id,
        },
      },
    });

    return {
      tenant: newTenant,
      branch: newBranch,
      owner: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        plainPassword: ownerPassword,
      },
      subscription: newSub,
    };
  });

  return result;
};

export const updateTenantStatus = async (tenantId, { status }, platformAdminUserId) => {
  const allowedStatuses = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(400, 'INVALID_STATUS', `Status must be one of: ${allowedStatuses.join(', ')}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id: tenantId },
      data: { status },
    });

    // Sync subscription status if suspending or reactivating
    if (status === 'SUSPENDED') {
      await tx.subscription.updateMany({
        where: { tenantId, status: 'ACTIVE' },
        data: { status: 'SUSPENDED' },
      });
    } else if (status === 'ACTIVE') {
      await tx.subscription.updateMany({
        where: { tenantId, status: 'SUSPENDED' },
        data: { status: 'ACTIVE' },
      });
    }

    await tx.tenantAuditEvent.create({
      data: {
        tenantId,
        actorId: platformAdminUserId || 'PLATFORM_SUPER_ADMIN',
        actorRole: 'SUPER_ADMIN',
        action: 'TENANT_STATUS_UPDATED',
        entity: 'Tenant',
        entityId: tenantId,
        details: { newStatus: status },
      },
    });

    return tenant;
  });

  return updated;
};

export const listPlans = async () => {
  return prisma.plan.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });
};

export const createPlan = async (data) => {
  const {
    code,
    name,
    description,
    isPublic = true,
    monthlyPrice = 0,
    annualPrice = 0,
    maxBranches = 1,
    maxStaff = 10,
    maxDevices = 1,
    hasBiometrics = false,
    hasPayroll = true,
    hasCustomSms = false,
    hasInventory = true,
    hasBookings = true,
    allowedModules = ['pos', 'services', 'clients', 'appointments', 'inventory', 'expenses', 'reports'],
  } = data;

  if (!code || !name) {
    throw new AppError(400, 'MISSING_FIELDS', 'Code and name are required for a plan');
  }

  const existing = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) {
    throw new AppError(409, 'PLAN_EXISTS', `A plan with code '${code}' already exists`);
  }

  return prisma.plan.create({
    data: {
      code: code.toUpperCase(),
      name,
      description,
      isPublic,
      versions: {
        create: {
          versionNumber: 1,
          currency: 'PKR',
          monthlyPrice,
          annualPrice,
          maxBranches,
          maxStaff,
          maxDevices,
          hasBiometrics,
          hasPayroll,
          hasCustomSms,
          hasInventory,
          hasBookings,
          allowedModules,
          isActive: true,
        },
      },
    },
    include: {
      versions: true,
    },
  });
};

export const updatePlanVersion = async (versionId, data) => {
  return prisma.planVersion.update({
    where: { id: versionId },
    data: {
      monthlyPrice: data.monthlyPrice !== undefined ? data.monthlyPrice : undefined,
      annualPrice: data.annualPrice !== undefined ? data.annualPrice : undefined,
      maxBranches: data.maxBranches !== undefined ? data.maxBranches : undefined,
      maxStaff: data.maxStaff !== undefined ? data.maxStaff : undefined,
      maxDevices: data.maxDevices !== undefined ? data.maxDevices : undefined,
      hasBiometrics: data.hasBiometrics !== undefined ? data.hasBiometrics : undefined,
      hasPayroll: data.hasPayroll !== undefined ? data.hasPayroll : undefined,
      hasCustomSms: data.hasCustomSms !== undefined ? data.hasCustomSms : undefined,
      hasInventory: data.hasInventory !== undefined ? data.hasInventory : undefined,
      hasBookings: data.hasBookings !== undefined ? data.hasBookings : undefined,
      allowedModules: data.allowedModules !== undefined ? data.allowedModules : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    },
  });
};

export const listPendingPayments = async () => {
  return prisma.subscriptionPayment.findMany({
    where: { status: 'PENDING_VERIFICATION' },
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, contactEmail: true, contactPhone: true },
      },
      subscription: {
        include: {
          planVersion: {
            include: { plan: true },
          },
        },
      },
    },
  });
};

export const verifyPayment = async (paymentId, platformAdminUserId) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { subscription: true, tenant: true },
  });

  if (!payment) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Subscription payment record not found');
  }

  if (payment.status !== 'PENDING_VERIFICATION') {
    throw new AppError(400, 'ALREADY_PROCESSED', `Payment is already marked as ${payment.status}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark payment verified
    const verifiedPayment = await tx.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: 'VERIFIED',
        verifiedByUserId: platformAdminUserId || 'PLATFORM_SUPER_ADMIN',
        verifiedAt: new Date(),
      },
    });

    // 2. Extend subscription
    const now = new Date();
    const currentEnd = new Date(payment.subscription.currentPeriodEnd);
    const newStart = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(newStart);

    if (payment.subscription.billingCycle === 'ANNUAL') {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    await tx.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: newStart,
        currentPeriodEnd: newEnd,
      },
    });

    // 3. Reactivate tenant if suspended or past due
    await tx.tenant.update({
      where: { id: payment.tenantId },
      data: { status: 'ACTIVE' },
    });

    // 4. Audit
    await tx.tenantAuditEvent.create({
      data: {
        tenantId: payment.tenantId,
        actorId: platformAdminUserId || 'PLATFORM_SUPER_ADMIN',
        actorRole: 'SUPER_ADMIN',
        action: 'PAYMENT_VERIFIED_AND_SUB_EXTENDED',
        entity: 'SubscriptionPayment',
        entityId: paymentId,
        details: {
          amount: payment.amount,
          newPeriodEnd: newEnd.toISOString(),
          transactionRef: payment.transactionRef,
        },
      },
    });

    return verifiedPayment;
  });

  return result;
};

export const rejectPayment = async (paymentId, { rejectionReason }, platformAdminUserId) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Subscription payment record not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rejectedPayment = await tx.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || 'Payment slip verification failed',
        verifiedByUserId: platformAdminUserId || 'PLATFORM_SUPER_ADMIN',
        verifiedAt: new Date(),
      },
    });

    await tx.tenantAuditEvent.create({
      data: {
        tenantId: payment.tenantId,
        actorId: platformAdminUserId || 'PLATFORM_SUPER_ADMIN',
        actorRole: 'SUPER_ADMIN',
        action: 'PAYMENT_REJECTED',
        entity: 'SubscriptionPayment',
        entityId: paymentId,
        details: { rejectionReason },
      },
    });

    return rejectedPayment;
  });

  return updated;
};
