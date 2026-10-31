import { z } from 'zod';

const money = z.number().finite().min(0).max(999999999);
export const bookingDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'Invalid calendar date');
const time = z.string().trim().regex(/^(?:(?:[01]?\d|2[0-3]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d\s?[APap][Mm])$/);
const optionalStaff = z.string().min(1).nullable().optional();
export const itemSchema = z.object({
  lineInstanceId: z.string().min(1).optional(),
  type: z.enum(['SERVICE', 'PACKAGE', 'CUSTOM_SERVICE']),
  itemId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  unitPrice: money.optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  staffId: optionalStaff,
  packageComponents: z.array(z.object({ serviceId: z.string().min(1), staffId: optionalStaff })).optional(),
}).superRefine((v, ctx) => {
  if (v.type === 'CUSTOM_SERVICE' && (!v.name || v.unitPrice === undefined)) ctx.addIssue({ code: 'custom', message: 'Custom service needs a name and price' });
  if (v.type !== 'CUSTOM_SERVICE' && !v.itemId) ctx.addIssue({ code: 'custom', message: 'Select a catalog item' });
});
export const paymentSchema = z.object({
  amount: money.positive(), date: bookingDate.optional(),
  method: z.enum(['CASH', 'ONLINE_ACCOUNT']), paymentAccountId: z.string().optional(),
  reference: z.string().trim().max(200).optional(), notes: z.string().trim().max(2000).optional(),
}).refine(v => v.method !== 'ONLINE_ACCOUNT' || !!v.paymentAccountId, 'Select a payment account');
const fields = {
  branchId: z.string().optional(), clientId: z.string().optional(),
  clientName: z.string().trim().min(1).max(200),
  clientPhone: z.string().trim().min(10).max(40),
  type: z.enum(['BRIDAL', 'GROOM']), eventDate: bookingDate, serviceTime: time,
  assignedStaffId: optionalStaff,
  notes: z.string().trim().max(4000).nullable().optional(),
  specialRequirements: z.string().trim().max(4000).nullable().optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).default('FIXED'),
  discountValue: money.default(0), items: z.array(itemSchema).min(1).max(100),
};
export const createSchema = z.object({ ...fields, advancePayment: paymentSchema.optional() });
export const updateSchema = z.object({ ...fields, revision: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) });
export const statusSchema = z.object({ status: z.literal('IN_PROGRESS'), revision: z.number().int().positive() });
export const refundSchema = z.object({ payment: paymentSchema, reason: z.string().trim().min(3).max(2000) });
export const cancelSchema = z.object({
  status: z.enum(['CANCELLED', 'NO_SHOW']).default('CANCELLED'),
  revision: z.number().int().positive(), reason: z.string().trim().min(3).max(2000),
  cancellationCharge: money.default(0), refundPayment: paymentSchema.optional(),
});
export const listQuery = z.object({
  branchId: z.string().optional(), clientId: z.string().optional(),
  type: z.enum(['BRIDAL', 'GROOM']).optional(),
  status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID']).optional(),
  startDate: bookingDate.optional(), endDate: bookingDate.optional(), search: z.string().max(200).optional(),
});
