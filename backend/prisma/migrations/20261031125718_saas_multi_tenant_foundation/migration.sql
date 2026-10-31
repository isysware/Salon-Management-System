-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('TENANT_OWNER', 'TENANT_ADMIN', 'STAFF');

-- AlterTable
ALTER TABLE "AccountMovement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AdvanceRecovery" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AppointmentItem" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AppointmentPackageComponent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AppointmentReschedule" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceCorrection" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AttendancePunch" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BookingHistory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BookingItem" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BookingPayment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BranchHoliday" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CashDrawer" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CashTransfer" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CashVarianceAdjustment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CommissionEvent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CommissionPayment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CommissionRun" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CommissionStatement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DeviceLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DrawerMovement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InventoryBatch" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLineBatch" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLineComponent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvoicePayment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceRefund" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRecord" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OvertimeRecord" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PackageComponent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PaymentAccount" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PayrollAdjustment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PayrollPayment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PayrollPolicy" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RefundLine" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SalaryAdvance" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StaffAllowance" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StaffCompensationHistory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StockSettlement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StockSettlementLine" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SupplierLedger" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SupplierReturn" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SupplierReturnLine" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TaxRule" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TipAllocation" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TipPayout" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TipReceipt" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'STAFF',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "monthlyPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "annualPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "maxStaff" INTEGER NOT NULL DEFAULT 10,
    "maxDevices" INTEGER NOT NULL DEFAULT 1,
    "hasBiometrics" BOOLEAN NOT NULL DEFAULT false,
    "hasPayroll" BOOLEAN NOT NULL DEFAULT true,
    "hasCustomSms" BOOLEAN NOT NULL DEFAULT false,
    "hasInventory" BOOLEAN NOT NULL DEFAULT true,
    "hasBookings" BOOLEAN NOT NULL DEFAULT true,
    "allowedModules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "graceUntil" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "paymentMethod" TEXT NOT NULL,
    "transactionRef" TEXT,
    "slipAttachmentUrl" TEXT,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");

-- CreateIndex
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_versionNumber_key" ON "PlanVersion"("planId", "versionNumber");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- CreateIndex
CREATE INDEX "TenantAuditEvent_tenantId_idx" ON "TenantAuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "TenantAuditEvent_createdAt_idx" ON "TenantAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AccountMovement_tenantId_idx" ON "AccountMovement"("tenantId");

-- CreateIndex
CREATE INDEX "AdvanceRecovery_tenantId_idx" ON "AdvanceRecovery"("tenantId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");

-- CreateIndex
CREATE INDEX "AppointmentItem_tenantId_idx" ON "AppointmentItem"("tenantId");

-- CreateIndex
CREATE INDEX "AppointmentPackageComponent_tenantId_idx" ON "AppointmentPackageComponent"("tenantId");

-- CreateIndex
CREATE INDEX "AppointmentReschedule_tenantId_idx" ON "AppointmentReschedule"("tenantId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_tenantId_idx" ON "AttendanceCorrection"("tenantId");

-- CreateIndex
CREATE INDEX "AttendancePunch_tenantId_idx" ON "AttendancePunch"("tenantId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_idx" ON "AttendanceRecord"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- CreateIndex
CREATE INDEX "BookingHistory_tenantId_idx" ON "BookingHistory"("tenantId");

-- CreateIndex
CREATE INDEX "BookingItem_tenantId_idx" ON "BookingItem"("tenantId");

-- CreateIndex
CREATE INDEX "BookingPayment_tenantId_idx" ON "BookingPayment"("tenantId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE INDEX "BranchHoliday_tenantId_idx" ON "BranchHoliday"("tenantId");

-- CreateIndex
CREATE INDEX "CashDrawer_tenantId_idx" ON "CashDrawer"("tenantId");

-- CreateIndex
CREATE INDEX "CashTransfer_tenantId_idx" ON "CashTransfer"("tenantId");

-- CreateIndex
CREATE INDEX "CashVarianceAdjustment_tenantId_idx" ON "CashVarianceAdjustment"("tenantId");

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionEvent_tenantId_idx" ON "CommissionEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionPayment_tenantId_idx" ON "CommissionPayment"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionRun_tenantId_idx" ON "CommissionRun"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionStatement_tenantId_idx" ON "CommissionStatement"("tenantId");

-- CreateIndex
CREATE INDEX "Device_tenantId_idx" ON "Device"("tenantId");

-- CreateIndex
CREATE INDEX "DeviceLog_tenantId_idx" ON "DeviceLog"("tenantId");

-- CreateIndex
CREATE INDEX "DrawerMovement_tenantId_idx" ON "DrawerMovement"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryBatch_tenantId_idx" ON "InventoryBatch"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceLine_tenantId_idx" ON "InvoiceLine"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceLineBatch_tenantId_idx" ON "InvoiceLineBatch"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceLineComponent_tenantId_idx" ON "InvoiceLineComponent"("tenantId");

-- CreateIndex
CREATE INDEX "InvoicePayment_tenantId_idx" ON "InvoicePayment"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceRefund_tenantId_idx" ON "InvoiceRefund"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveRecord_tenantId_idx" ON "LeaveRecord"("tenantId");

-- CreateIndex
CREATE INDEX "OvertimeRecord_tenantId_idx" ON "OvertimeRecord"("tenantId");

-- CreateIndex
CREATE INDEX "Package_tenantId_idx" ON "Package"("tenantId");

-- CreateIndex
CREATE INDEX "PackageComponent_tenantId_idx" ON "PackageComponent"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentAccount_tenantId_idx" ON "PaymentAccount"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_tenantId_idx" ON "PayrollAdjustment"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollPayment_tenantId_idx" ON "PayrollPayment"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollPolicy_tenantId_idx" ON "PayrollPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_idx" ON "PayrollRun"("tenantId");

-- CreateIndex
CREATE INDEX "Payslip_tenantId_idx" ON "Payslip"("tenantId");

-- CreateIndex
CREATE INDEX "Purchase_tenantId_idx" ON "Purchase"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseLine_tenantId_idx" ON "PurchaseLine"("tenantId");

-- CreateIndex
CREATE INDEX "RefundLine_tenantId_idx" ON "RefundLine"("tenantId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_tenantId_idx" ON "SalaryAdvance"("tenantId");

-- CreateIndex
CREATE INDEX "Sequence_tenantId_idx" ON "Sequence"("tenantId");

-- CreateIndex
CREATE INDEX "Service_tenantId_idx" ON "Service"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceCategory_tenantId_idx" ON "ServiceCategory"("tenantId");

-- CreateIndex
CREATE INDEX "Settlement_tenantId_idx" ON "Settlement"("tenantId");

-- CreateIndex
CREATE INDEX "Staff_tenantId_idx" ON "Staff"("tenantId");

-- CreateIndex
CREATE INDEX "StaffAllowance_tenantId_idx" ON "StaffAllowance"("tenantId");

-- CreateIndex
CREATE INDEX "StaffCompensationHistory_tenantId_idx" ON "StaffCompensationHistory"("tenantId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_idx" ON "StockMovement"("tenantId");

-- CreateIndex
CREATE INDEX "StockSettlement_tenantId_idx" ON "StockSettlement"("tenantId");

-- CreateIndex
CREATE INDEX "StockSettlementLine_tenantId_idx" ON "StockSettlementLine"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierLedger_tenantId_idx" ON "SupplierLedger"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierPayment_tenantId_idx" ON "SupplierPayment"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierReturn_tenantId_idx" ON "SupplierReturn"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierReturnLine_tenantId_idx" ON "SupplierReturnLine"("tenantId");

-- CreateIndex
CREATE INDEX "TaxRule_tenantId_idx" ON "TaxRule"("tenantId");

-- CreateIndex
CREATE INDEX "TipAllocation_tenantId_idx" ON "TipAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "TipPayout_tenantId_idx" ON "TipPayout"("tenantId");

-- CreateIndex
CREATE INDEX "TipReceipt_tenantId_idx" ON "TipReceipt"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAuditEvent" ADD CONSTRAINT "TenantAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
