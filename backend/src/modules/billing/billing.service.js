// src/modules/billing/billing.service.js
// Tenant Billing & Subscription Service (Salon Owner portal)

import prisma from '../../config/prisma.js';
import { AppError } from '../../lib/AppError.js';

export const getTenantBilling = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
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

  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }

  const subscription = tenant.subscriptions?.[0] || null;
  const planVersion = subscription?.planVersion || null;

  // Quota counts
  const [branchCount, staffCount, deviceCount, paymentHistory] = await Promise.all([
    prisma.branch.count({ where: { tenantId, isActive: true } }),
    prisma.staff.count({ where: { tenantId, isActive: true } }),
    prisma.device.count({ where: { tenantId } }),
    prisma.subscriptionPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  // Calculate days remaining
  let daysRemaining = 0;
  let isPastDue = false;
  if (subscription?.currentPeriodEnd) {
    const now = new Date();
    const diffMs = new Date(subscription.currentPeriodEnd).getTime() - now.getTime();
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) {
      isPastDue = true;
    }
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      currency: tenant.currency,
      gracePeriodDays: tenant.gracePeriodDays,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          daysRemaining,
          isPastDue,
          plan: {
            id: planVersion?.plan?.id,
            name: planVersion?.plan?.name,
            code: planVersion?.plan?.code,
            monthlyPrice: planVersion?.monthlyPrice,
            annualPrice: planVersion?.annualPrice,
            allowedModules: planVersion?.allowedModules,
          },
        }
      : null,
    quotas: {
      branches: {
        used: branchCount,
        max: planVersion?.maxBranches ?? 1,
      },
      staff: {
        used: staffCount,
        max: planVersion?.maxStaff ?? 10,
      },
      devices: {
        used: deviceCount,
        max: planVersion?.maxDevices ?? 2,
      },
    },
    paymentInstructions: {
      bankName: 'Meezan Bank Ltd',
      accountTitle: 'SalonOS SaaS Platform',
      iban: 'PK45MEZN0001234567890123',
      accountNumber: '0101-0102938475',
      jazzCash: '+92 300 1234567',
      easyPaisa: '+92 300 1234567',
    },
    paymentHistory,
  };
};

export const submitPaymentSlip = async (tenantId, data, userId) => {
  const { amount, paymentMethod, transactionRef, slipAttachmentUrl } = data;

  if (!amount || !paymentMethod || !transactionRef) {
    throw new AppError(400, 'MISSING_FIELDS', 'amount, paymentMethod, and transactionRef are required');
  }

  // Get active or latest subscription
  const sub = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription found to renew');
  }

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.subscriptionPayment.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        amount,
        currency: 'PKR',
        paymentMethod,
        transactionRef,
        slipAttachmentUrl: slipAttachmentUrl || null,
        status: 'PENDING_VERIFICATION',
      },
    });

    await tx.tenantAuditEvent.create({
      data: {
        tenantId,
        actorId: userId || 'TENANT_USER',
        actorRole: 'TENANT_OWNER',
        action: 'PAYMENT_SLIP_SUBMITTED',
        entity: 'SubscriptionPayment',
        entityId: newPayment.id,
        details: {
          amount,
          paymentMethod,
          transactionRef,
        },
      },
    });

    return newPayment;
  });

  return payment;
};

