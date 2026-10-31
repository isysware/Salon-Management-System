/**
 * SaaS Multi-Tenant Backfill & Seed Script
 * - Ensures Default Tenant exists
 * - Creates SaaS Plans (Starter, Growth, Enterprise)
 * - Provisions Subscription for Default Tenant
 * - Links existing Users into TenantMembership
 * - Backfills tenantId across all existing operational records
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting SaaS Multi-Tenant Backfill...');

  // 1. Create or Find Default Tenant
  const defaultTenantSlug = 'flagship-salon';
  let tenant = await prisma.tenant.findUnique({
    where: { slug: defaultTenantSlug }
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Flagship Luxury Salon',
        slug: defaultTenantSlug,
        status: 'ACTIVE',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        contactEmail: 'owner@flagshipsalon.com',
        contactPhone: '+92 300 1234567',
        gracePeriodDays: 7
      }
    });
    console.log(`✅ Created Default Tenant: ${tenant.name} (${tenant.id})`);
  } else {
    console.log(`ℹ️ Default Tenant already exists: ${tenant.name} (${tenant.id})`);
  }

  const tenantId = tenant.id;

  // 2. Create SaaS Plans and PlanVersions
  const plansData = [
    {
      code: 'STARTER',
      name: 'Starter Plan',
      description: 'Ideal for single branch salons getting started',
      isPublic: true,
      versions: [
        {
          versionNumber: 1,
          currency: 'PKR',
          monthlyPrice: 5000,
          annualPrice: 50000,
          maxBranches: 1,
          maxStaff: 5,
          maxDevices: 1,
          hasBiometrics: false,
          hasPayroll: false,
          hasCustomSms: false,
          hasInventory: true,
          hasBookings: true,
          allowedModules: ['pos', 'services', 'appointments', 'inventory', 'reports'],
          isActive: true
        }
      ]
    },
    {
      code: 'GROWTH',
      name: 'Growth Plan',
      description: 'Perfect for growing salons with multiple staff and payroll',
      isPublic: true,
      versions: [
        {
          versionNumber: 1,
          currency: 'PKR',
          monthlyPrice: 12000,
          annualPrice: 120000,
          maxBranches: 3,
          maxStaff: 20,
          maxDevices: 3,
          hasBiometrics: true,
          hasPayroll: true,
          hasCustomSms: true,
          hasInventory: true,
          hasBookings: true,
          allowedModules: ['pos', 'services', 'appointments', 'bookings', 'inventory', 'expenses', 'payroll', 'reports', 'devices', 'settings'],
          isActive: true
        }
      ]
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise Plan',
      description: 'Uncapped multi-branch power with full automation and audit logs',
      isPublic: true,
      versions: [
        {
          versionNumber: 1,
          currency: 'PKR',
          monthlyPrice: 25000,
          annualPrice: 250000,
          maxBranches: 10,
          maxStaff: 100,
          maxDevices: 10,
          hasBiometrics: true,
          hasPayroll: true,
          hasCustomSms: true,
          hasInventory: true,
          hasBookings: true,
          allowedModules: ['pos', 'services', 'appointments', 'bookings', 'inventory', 'expenses', 'payroll', 'reports', 'devices', 'settings'],
          isActive: true
        }
      ]
    }
  ];

  let enterprisePlanVersionId = null;

  for (const p of plansData) {
    let plan = await prisma.plan.findUnique({
      where: { code: p.code },
      include: { versions: true }
    });

    if (!plan) {
      plan = await prisma.plan.create({
        data: {
          code: p.code,
          name: p.name,
          description: p.description,
          isPublic: p.isPublic,
          versions: {
            create: p.versions
          }
        },
        include: { versions: true }
      });
      console.log(`✅ Created Plan: ${plan.name} with Version 1`);
    }

    if (p.code === 'ENTERPRISE') {
      enterprisePlanVersionId = plan.versions[0].id;
    }
  }

  // 3. Ensure Active Subscription for Default Tenant
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId }
  });

  if (!existingSub) {
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 10); // 10 years active for default tenant

    const sub = await prisma.subscription.create({
      data: {
        tenantId,
        planVersionId: enterprisePlanVersionId,
        status: 'ACTIVE',
        billingCycle: 'LIFETIME',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: true
      }
    });
    console.log(`✅ Created Enterprise Lifetime Subscription (${sub.id}) for Tenant`);
  } else {
    console.log(`ℹ️ Tenant already has an active subscription: ${existingSub.id}`);
  }

  // 4. Map existing Users into TenantMembership
  const allUsers = await prisma.user.findMany();
  for (const u of allUsers) {
    let membershipRole = 'STAFF';
    if (u.role === 'SUPER_ADMIN') {
      membershipRole = 'TENANT_OWNER';
    } else if (u.role === 'ADMIN') {
      membershipRole = 'TENANT_ADMIN';
    }

    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId,
          userId: u.id
        }
      },
      update: {
        role: membershipRole,
        status: 'ACTIVE'
      },
      create: {
        tenantId,
        userId: u.id,
        role: membershipRole,
        status: 'ACTIVE'
      }
    });
  }
  console.log(`✅ Enrolled ${allUsers.length} users into TenantMembership for ${tenant.name}`);

  // 5. Backfill tenantId in all operational tables
  const modelsWithTenant = [
    'branch', 'taxRule', 'paymentAccount', 'expenseCategory', 'payrollPolicy',
    'staff', 'staffCompensationHistory', 'staffAllowance', 'serviceCategory',
    'service', 'package', 'packageComponent', 'client', 'appointment',
    'appointmentItem', 'appointmentPackageComponent', 'appointmentReschedule',
    'booking', 'bookingItem', 'bookingPayment', 'bookingHistory', 'cashDrawer',
    'drawerMovement', 'accountMovement', 'cashTransfer', 'cashVarianceAdjustment',
    'settlement', 'inventoryItem', 'inventoryBatch', 'stockMovement',
    'stockSettlement', 'stockSettlementLine', 'supplier', 'supplierLedger',
    'purchase', 'purchaseLine', 'supplierPayment', 'supplierReturn',
    'supplierReturnLine', 'invoice', 'invoiceLine', 'invoiceLineComponent',
    'invoiceLineBatch', 'invoicePayment', 'invoiceRefund', 'refundLine',
    'commissionEvent', 'commissionRun', 'commissionStatement',
    'commissionPayment', 'tipReceipt', 'tipAllocation', 'tipPayout', 'expense',
    'attendanceRecord', 'attendancePunch', 'attendanceCorrection', 'leaveRecord',
    'branchHoliday', 'overtimeRecord', 'payrollRun', 'payslip', 'payrollPayment',
    'payrollAdjustment', 'salaryAdvance', 'advanceRecovery', 'device', 'deviceLog',
    'sequence', 'auditEvent'
  ];

  let totalUpdated = 0;
  for (const modelName of modelsWithTenant) {
    if (prisma[modelName] && typeof prisma[modelName].updateMany === 'function') {
      try {
        const res = await prisma[modelName].updateMany({
          where: { tenantId: null },
          data: { tenantId }
        });
        if (res.count > 0) {
          console.log(`   - ${modelName}: backfilled ${res.count} records`);
          totalUpdated += res.count;
        }
      } catch (err) {
        console.warn(`   ⚠️ Warning updating ${modelName}:`, err.message);
      }
    }
  }

  console.log(`🎉 Backfill completed! Total records tagged with tenantId: ${totalUpdated}`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
