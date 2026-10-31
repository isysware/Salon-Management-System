import type { Booking, BookingInput, BookingItemInput } from '../../types/booking';
import type { POSCartItem, ServiceItem, PackageItem, TaxTreatment } from '../../types/salon';

export function bookingToPOSCart(booking: Booking): POSCartItem[] {
  return booking.items.map(line => {
    const common = { id: line.itemId || line.lineInstanceId || line.id, branchId: booking.branchId,
      code: line.code || 'CUSTOM', name: line.name, price: line.unitPrice,
      taxTreatment: line.taxTreatment as TaxTreatment, isActive: true };
    const item: ServiceItem | PackageItem = line.type === 'PACKAGE'
      ? { ...common, components: line.components.map(c => ({ serviceId: c.serviceId, serviceCode: c.serviceCode || '', serviceName: c.serviceName,
          quantity: 1, allocationPercentage: c.allocationPercentage, unitPrice: 0 })) }
      : { ...common, category: line.type === 'CUSTOM_SERVICE' ? 'Custom Service' : 'Booking Service', durationMinutes: line.durationMinutes, description: line.description || undefined };
    return { cartInstanceId: line.lineInstanceId || line.id, type: line.type === 'PACKAGE' ? 'PACKAGE' : 'SERVICE',
      item, quantity: line.quantity, staffId: line.staffId || 'house', staffName: line.staffName || 'House / Salon', staffCommissionRate: 0,
      bookingItemType: line.type, bookingTaxRate: line.taxRate, bookingDurationMinutes: line.durationMinutes, bookingDescription: line.description || undefined,
      packageComponents: line.components.map(c => ({ serviceId: c.serviceId, serviceCode: c.serviceCode || '', serviceName: c.serviceName,
        quantity: 1, allocationPercentage: c.allocationPercentage, allocatedAmount: line.unitPrice * line.quantity * c.allocationPercentage / 100,
        staffId: c.staffId || 'house', staffName: c.staffName || 'House / Salon', staffCommissionRate: 0 })) };
  });
}

const realStaff = (id?: string | null) => !id || ['house', 'unassigned', 'none'].includes(id) ? null : id;
export function cartToBookingUpdate(booking: Booking, cart: POSCartItem[], discountType: 'FIXED' | 'PERCENTAGE', discountValue: number, reason: string): BookingInput {
  const items: BookingItemInput[] = cart.filter(c => c.type !== 'PRODUCT').map(c => ({
    lineInstanceId: c.cartInstanceId, type: c.bookingItemType || (c.type === 'PACKAGE' ? 'PACKAGE' : 'SERVICE'),
    itemId: c.bookingItemType === 'CUSTOM_SERVICE' ? null : c.item.id, name: c.item.name,
    unitPrice: 'sellingPrice' in c.item ? c.item.sellingPrice : c.item.price, quantity: c.quantity,
    durationMinutes: c.bookingDurationMinutes ?? ('durationMinutes' in c.item ? c.item.durationMinutes : undefined),
    description: c.bookingDescription, staffId: realStaff(c.staffId),
    packageComponents: c.packageComponents?.map(p => ({ serviceId: p.serviceId, staffId: realStaff(p.staffId) })),
  }));
  return { branchId: booking.branchId, clientId: booking.clientId, clientName: booking.clientName, clientPhone: booking.clientPhone,
    type: booking.type, eventDate: booking.eventDate, serviceTime: booking.serviceTime, assignedStaffId: booking.assignedStaffId,
    notes: booking.notes, specialRequirements: booking.specialRequirements, revision: booking.revision,
    discountType, discountValue, reason, items };
}
export function bookingCartChanged(booking: Booking, cart: POSCartItem[], discountType: 'FIXED' | 'PERCENTAGE', discountValue: number): boolean {
  const normalize = (items: BookingItemInput[]) => items.map(i => ({ id: i.lineInstanceId, type: i.type, itemId: i.itemId || null, name: i.name,
    price: i.unitPrice, quantity: i.quantity, staffId: realStaff(i.staffId), components: (i.packageComponents || []).map(c => [c.serviceId, realStaff(c.staffId)]) }));
  const original = cartToBookingUpdate(booking, bookingToPOSCart(booking), booking.discountType, booking.discountValue, '');
  const current = cartToBookingUpdate(booking, cart, discountType, discountValue, '');
  return cart.some(c => c.type === 'PRODUCT') || discountType !== booking.discountType || discountValue !== booking.discountValue
    || JSON.stringify(normalize(original.items)) !== JSON.stringify(normalize(current.items));
}
export function bookingSettlement(billTotal: number, tip: number, advance: number) {
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const remainingBillTotal = round(billTotal - advance);
  return { advanceAdjusted: advance, remainingBillTotal, invoiceTotal: round(billTotal + tip), amountToCollect: round(Math.max(0, remainingBillTotal) + tip) };
}
