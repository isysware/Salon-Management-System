import { badRequest } from '../../lib/AppError.js';
import { round2, splitWithRemainder, toDec } from '../../lib/money.js';

export const priceBooking = (items, discountType = 'FIXED', discountValue = 0) => {
  const gross = items.map(i => round2(toDec(i.unitPrice).times(i.quantity)));
  const subtotal = round2(gross.reduce((s, n) => s.plus(n), toDec(0)));
  const value = toDec(discountValue);
  if (value.isNegative() || (discountType === 'PERCENTAGE' && value.greaterThan(100)) || (discountType !== 'PERCENTAGE' && value.greaterThan(subtotal))) {
    throw badRequest('INVALID_DISCOUNT', 'Discount cannot exceed the service subtotal or 100%.');
  }
  const discount = discountType === 'PERCENTAGE' ? round2(subtotal.times(value).div(100)) : round2(value);
  const allocations = subtotal.isZero() ? items.map(() => toDec(0)) : splitWithRemainder(discount, gross);
  const taxAmount = round2(items.reduce((s, i, n) => s.plus(round2(gross[n].minus(allocations[n]).times(i.taxRate))), toDec(0)));
  return { subtotal, discount, taxAmount, totalAmount: round2(subtotal.minus(discount).plus(taxAmount)), discountType, discountValue: value };
};
export const netPayments = payments => round2(payments.reduce((s, p) => p.isRefund ? s.minus(p.amount) : s.plus(p.amount), toDec(0)));
