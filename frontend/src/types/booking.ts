export type BookingType = 'BRIDAL' | 'GROOM';
export type BookingStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export interface BookingItemInput {
  lineInstanceId?: string; type: 'SERVICE' | 'PACKAGE' | 'CUSTOM_SERVICE'; itemId?: string | null;
  name?: string; description?: string | null; unitPrice?: number; quantity: number;
  durationMinutes?: number; staffId?: string | null;
  packageComponents?: { serviceId: string; staffId?: string | null }[];
}
export interface BookingPaymentInput {
  amount: number; date?: string; method: 'CASH' | 'ONLINE_ACCOUNT'; paymentAccountId?: string;
  reference?: string; notes?: string;
}
export interface BookingInput {
  branchId: string; clientId?: string; clientName: string; clientPhone: string;
  type: BookingType; eventDate: string; serviceTime: string; assignedStaffId?: string | null;
  notes?: string | null; specialRequirements?: string | null;
  discountType: 'FIXED' | 'PERCENTAGE'; discountValue: number; items: BookingItemInput[];
  advancePayment?: BookingPaymentInput; revision?: number; reason?: string;
}
export interface BookingItem extends BookingItemInput {
  id: string; code?: string; name: string; unitPrice: number; taxRate: number; taxTreatment: string;
  durationMinutes: number; staffName?: string; startTime: string; endTime: string;
  components: { serviceId: string; serviceCode?: string; serviceName: string; staffId?: string | null; staffName?: string; allocationPercentage: number }[];
}
export interface BookingPayment extends BookingPaymentInput {
  id: string; receiptNumber: string; date: string; time: string; isRefund: boolean;
  processedByName: string; paymentAccountName?: string; drawerId?: string;
}
export interface BookingCollection extends BookingPayment {
  bookingId: string; bookingNumber: string; type: BookingType; clientName: string; clientPhone: string;
}
export interface Booking extends Omit<BookingInput, 'items'> {
  createdAt?: string; updatedAt?: string; cancellationReason?: string;
  id: string; bookingNumber: string; revision: number; status: BookingStatus;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID'; assignedStaffName?: string;
  subtotal: number; discount: number; taxAmount: number; totalAmount: number;
  advancePaid: number; receivedAmount: number; remainingBalance: number; cancellationCharge: number;
  linkedInvoiceId?: string; linkedInvoiceNumber?: string; items: BookingItem[];
  payments: BookingPayment[]; history: { id: string; type: string; reason?: string; userName: string; createdAt: string; before?: Record<string, unknown>; after?: Record<string, unknown> }[];
}
export interface BookingQuery {
  [key: string]: string | undefined;
  branchId?: string; clientId?: string; type?: string; status?: string;
  paymentStatus?: string; startDate?: string; endDate?: string; search?: string;
}
export interface BookingLedger {
  booking: Booking; invoiceReference?: string;
  rows: { id: string; date: string; reference: string; description: string; debit: number; credit: number; balance: number; byName: string; notes?: string }[];
}
