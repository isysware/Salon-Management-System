-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('BRIDAL', 'GROOM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DrawerMovementType" ADD VALUE 'BOOKING_ADVANCE';
ALTER TYPE "DrawerMovementType" ADD VALUE 'BOOKING_REFUND';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountMovementType" ADD VALUE 'BOOKING_ADVANCE';
ALTER TYPE "AccountMovementType" ADD VALUE 'BOOKING_REFUND';

-- AlterEnum
ALTER TYPE "LineType" ADD VALUE 'CUSTOM_SERVICE';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "advanceAdjusted" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bookingId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLine" ALTER COLUMN "itemId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "type" "BookingType" NOT NULL,
    "eventDate" DATE NOT NULL,
    "serviceTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "assignedStaffId" TEXT,
    "assignedStaffName" TEXT,
    "notes" TEXT,
    "specialRequirements" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'FIXED',
    "discountValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "cancellationCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cancellationReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "lineInstanceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "type" "LineType" NOT NULL,
    "itemId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'BRANCH_DEFAULT',
    "taxRate" DECIMAL(6,5) NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "components" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPayment" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "paymentAccountId" TEXT,
    "paymentAccountName" TEXT,
    "drawerId" TEXT,
    "movementId" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "processedByUserId" TEXT NOT NULL,
    "processedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_branchId_eventDate_idx" ON "Booking"("branchId", "eventDate");

-- CreateIndex
CREATE INDEX "Booking_branchId_status_idx" ON "Booking"("branchId", "status");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingItem_staffId_idx" ON "BookingItem"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingItem_bookingId_lineInstanceId_key" ON "BookingItem"("bookingId", "lineInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPayment_receiptNumber_key" ON "BookingPayment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPayment_movementId_key" ON "BookingPayment"("movementId");

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_idx" ON "BookingPayment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPayment_branchId_date_idx" ON "BookingPayment"("branchId", "date");

-- CreateIndex
CREATE INDEX "BookingHistory_bookingId_createdAt_idx" ON "BookingHistory"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_key" ON "Invoice"("bookingId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHistory" ADD CONSTRAINT "BookingHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
