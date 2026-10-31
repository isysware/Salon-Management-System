// backend/scripts/init-meerub-salon.js
import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma.js';

const MEERUB_BRANCH_ID = 'b0000000-0000-0000-0000-000000000001';

async function initMeerubSalon() {
  console.log('🚀 Initializing fresh database for Meerub Salon in meerub_salon_software...');

  // 1. Wipe all transactional, operational, catalogue, and personnel data
  console.log('1. Clearing refunds & invoices...');
  await prisma.refundLine.deleteMany({});
  await prisma.invoiceRefund.deleteMany({});
  await prisma.invoiceLineBatch.deleteMany({});
  await prisma.invoiceLineComponent.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoicePayment.deleteMany({});
  await prisma.commissionEvent.deleteMany({});
  await prisma.invoice.deleteMany({});

  console.log('2. Clearing appointments...');
  await prisma.appointmentPackageComponent.deleteMany({});
  await prisma.appointmentItem.deleteMany({});
  await prisma.appointmentReschedule.deleteMany({});
  await prisma.appointment.deleteMany({});

  console.log('3. Clearing tips & commission...');
  await prisma.tipPayout.deleteMany({});
  await prisma.tipAllocation.deleteMany({});
  await prisma.tipReceipt.deleteMany({});
  await prisma.commissionPayment.deleteMany({});
  await prisma.commissionStatement.deleteMany({});
  await prisma.commissionRun.deleteMany({});

  console.log('4. Clearing payroll, advances & allowances...');
  if (prisma.advanceRecovery) await prisma.advanceRecovery.deleteMany({});
  if (prisma.salaryAdvance) await prisma.salaryAdvance.deleteMany({});
  if (prisma.staffAllowance) await prisma.staffAllowance.deleteMany({});
  if (prisma.payrollAdjustment) await prisma.payrollAdjustment.deleteMany({});
  await prisma.payslip.deleteMany({});
  await prisma.payrollPayment.deleteMany({});
  await prisma.payrollRun.deleteMany({});

  console.log('5. Clearing attendance & overtime...');
  await prisma.attendanceCorrection.deleteMany({});
  await prisma.attendancePunch.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.leaveRecord.deleteMany({});
  await prisma.branchHoliday.deleteMany({});
  await prisma.overtimeRecord.deleteMany({});

  console.log('6. Clearing inventory, stock, purchases, suppliers...');
  await prisma.stockSettlementLine.deleteMany({});
  await prisma.stockSettlement.deleteMany({});
  await prisma.supplierReturnLine.deleteMany({});
  await prisma.supplierReturn.deleteMany({});
  await prisma.purchaseLine.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplierLedger.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.inventoryBatch.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.supplier.deleteMany({});

  console.log('7. Clearing expenses, settlements, cash custody...');
  await prisma.expense.deleteMany({});
  await prisma.cashVarianceAdjustment.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.cashTransfer.deleteMany({});
  await prisma.drawerMovement.deleteMany({});
  await prisma.accountMovement.deleteMany({});
  await prisma.cashDrawer.deleteMany({});

  console.log('8. Clearing catalogue (services & packages)...');
  await prisma.packageComponent.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.serviceCategory.deleteMany({});

  console.log('9. Clearing clients and staff...');
  await prisma.client.deleteMany({});
  await prisma.user.updateMany({ data: { staffId: null } });
  await prisma.staffCompensationHistory.deleteMany({});
  await prisma.staff.deleteMany({});

  console.log('10. Clearing tax rules, payment accounts, expense categories...');
  await prisma.branch.updateMany({ data: { defaultTaxRuleId: null, assignedAdminId: null } });
  await prisma.taxRule.deleteMany({});
  await prisma.paymentAccount.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  await prisma.payrollPolicy.deleteMany({});

  console.log('11. Clearing audit events, idempotency keys, sequences, tokens...');
  await prisma.auditEvent.deleteMany({});
  await prisma.idempotencyKey.deleteMany({});
  await prisma.sequence.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});

  console.log('12. Clearing old branches & users...');
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});

  console.log('13. Creating Meerub Salon branch...');
  const meerubBranch = await prisma.branch.create({
    data: {
      id: MEERUB_BRANCH_ID,
      name: 'Meerub Salon',
      code: 'MEERUB-01',
      address: 'Main Commercial Area, Karachi',
      city: 'Karachi',
      phone: '+92 (21) 3000-0000',
      email: 'info@meerubsalon.com',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      taxEnabled: false,
      taxRate: 0,
      openingCashFloat: 0,
      isActive: true,
    },
  });

  console.log('14. Creating fresh Administrator accounts (password: admin123)...');
  const passwordHash = await bcrypt.hash('admin123', 12);

  // Super Admin
  const superadmin = await prisma.user.create({
    data: {
      id: 'usr-super-01',
      name: 'Super Administrator',
      email: 'superadmin@meerubsalon.com',
      plainPassword: null,
      role: 'SUPER_ADMIN',
      branchId: null,
      passwordHash,
      phone: '+92 (300) 000-0001',
      title: 'Global Operations Director',
      isActive: true,
    },
  });

  // Also support superadmin@isysware.com for convenience
  await prisma.user.create({
    data: {
      id: 'usr-super-02',
      name: 'Super Administrator',
      email: 'superadmin@isysware.com',
      plainPassword: null,
      role: 'SUPER_ADMIN',
      branchId: null,
      passwordHash,
      phone: '+92 (300) 000-0001',
      title: 'Global Operations Director',
      isActive: true,
    },
  });

  // Branch Admin for Meerub Salon
  const meerubAdmin = await prisma.user.create({
    data: {
      id: 'usr-admin-meerub',
      name: 'Meerub Admin',
      email: 'admin@meerubsalon.com',
      plainPassword: null,
      role: 'ADMIN',
      branchId: MEERUB_BRANCH_ID,
      passwordHash,
      phone: '+92 (300) 000-0002',
      title: 'Branch Manager',
      isActive: true,
    },
  });

  // Link admin to branch
  await prisma.branch.update({
    where: { id: MEERUB_BRANCH_ID },
    data: { assignedAdminId: meerubAdmin.id },
  });

  // 15. Create Branch Main Vault (Admin safe, Opening float 0)
  console.log('15. Creating Main Vault for Meerub Salon...');
  await prisma.cashDrawer.create({
    data: {
      kind: 'VAULT',
      branchId: MEERUB_BRANCH_ID,
      custodianName: 'Branch Vault (Admin Safe)',
      date: new Date(),
      status: 'OPEN',
      lastCountedCash: 0,
    },
  });

  // 16. Essential clean expense categories
  console.log('16. Setting up clean default expense categories...');
  const defaultExpenseCategories = [
    { name: 'Salon Supplies & Products', description: 'Cosmetics, dyes, shampoos, and supplies' },
    { name: 'Utilities & Bills', description: 'Electricity, water, gas, and internet' },
    { name: 'Refreshments & Tea', description: 'Client and staff refreshments' },
    { name: 'Maintenance & Repairs', description: 'Equipment, chairs, and salon repair' },
    { name: 'Rent', description: 'Premises monthly rent' },
    { name: 'General & Miscellaneous', description: 'Day-to-day general salon expenses' },
  ];
  for (const cat of defaultExpenseCategories) {
    await prisma.expenseCategory.create({
      data: {
        branchId: MEERUB_BRANCH_ID,
        name: cat.name,
        description: cat.description,
        isActive: true,
      },
    });
  }

  // 17. Default Payment Account (Bank / Online)
  console.log('17. Setting up standard Payment Accounts...');
  await prisma.paymentAccount.create({
    data: {
      branchId: MEERUB_BRANCH_ID,
      name: 'Bank Checking Account',
      accountType: 'BANK',
      providerName: 'Meezan Bank Ltd',
      accountHolder: 'Meerub Salon',
      accountIdentifier: 'PK-MEERUB-01',
      openingBalance: 0,
      isActive: true,
    },
  });

  await prisma.paymentAccount.create({
    data: {
      branchId: MEERUB_BRANCH_ID,
      name: 'JazzCash Merchant Account',
      accountType: 'JAZZCASH',
      providerName: 'JazzCash',
      accountHolder: 'Meerub Salon',
      accountIdentifier: 'JC-MEERUB-01',
      openingBalance: 0,
      isActive: true,
    },
  });

  // 18. Default Tax Rule (0% default, ready to configure)
  const defaultTax = await prisma.taxRule.create({
    data: {
      branchId: MEERUB_BRANCH_ID,
      name: 'No Tax (Standard)',
      rate: 0,
      isBranchDefault: true,
      isActive: true,
    },
  });

  await prisma.branch.update({
    where: { id: MEERUB_BRANCH_ID },
    data: { defaultTaxRuleId: defaultTax.id },
  });

  // 19. Set business date to today
  const todayYmd = new Date().toISOString().slice(0, 10);
  await prisma.systemSetting.upsert({
    where: { key: 'BUSINESS_DATE' },
    update: { value: todayYmd },
    create: { key: 'BUSINESS_DATE', value: todayYmd },
  });

  console.log('\n📊 DATABASE STATS FOR MEERUB SALON:');
  const [bCount, uCount, branches, users, invCount, aptCount, clCount, stCount] = await Promise.all([
    prisma.branch.count(),
    prisma.user.count(),
    prisma.branch.findMany({ select: { id: true, name: true, code: true, assignedAdminId: true } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } }),
    prisma.invoice.count(),
    prisma.appointment.count(),
    prisma.client.count(),
    prisma.staff.count(),
  ]);

  console.log(`- Branches (${bCount}):`, branches);
  console.log(`- Users (${uCount}):`, users);
  console.log(`- Invoices: ${invCount}`);
  console.log(`- Appointments: ${aptCount}`);
  console.log(`- Clients: ${clCount}`);
  console.log(`- Staff: ${stCount}`);
  console.log('\n🎉 Meerub Salon database initialized cleanly with 0 data!');
}

initMeerubSalon()
  .catch((err) => {
    console.error('❌ Error initializing Meerub Salon:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
