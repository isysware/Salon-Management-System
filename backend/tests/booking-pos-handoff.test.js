import { describe, it, expect } from 'vitest';
import { bookingToPOSCart, cartToBookingUpdate, bookingCartChanged, bookingSettlement } from '../../frontend/src/features/pos/bookingPOS.ts';
const booking = {
  id: 'booking', branchId: 'branch-2', clientId: 'client', clientName: 'Bridal Client', clientPhone: '03001234567',
  type: 'BRIDAL', eventDate: '2026-11-10', serviceTime: '10:00 AM', revision: 3, discountType: 'FIXED', discountValue: 0,
  advancePaid: 15000, items: [{ id: 'line', lineInstanceId: 'original-line', type: 'CUSTOM_SERVICE', itemId: null,
    name: 'Custom bridal makeup', description: 'Event makeup', unitPrice: 30000, quantity: 1, durationMinutes: 60, taxRate: 0, taxTreatment: 'EXEMPT', staffId: null, components: [] }],
};
describe('Booking handoff to the ordinary POS cart', () => {
  it('preserves custom snapshots and optional staff without requiring a catalog item', () => {
    const cart = bookingToPOSCart(booking);
    expect(cart[0]).toMatchObject({ cartInstanceId: 'original-line', type: 'SERVICE', bookingItemType: 'CUSTOM_SERVICE', staffId: 'house', bookingTaxRate: 0, item: { name: 'Custom bridal makeup', price: 30000 } });
    expect(bookingCartChanged(booking, cart, 'FIXED', 0)).toBe(false);
    const update = cartToBookingUpdate(booking, cart, 'FIXED', 0, 'Confirmed in POS');
    expect(update).toMatchObject({ branchId: 'branch-2', revision: 3, items: [{ lineInstanceId: 'original-line', type: 'CUSTOM_SERVICE', itemId: null, staffId: null, unitPrice: 30000 }] });
  });
  it('collects only the remaining amount, including tips and fully prepaid sales', () => {
    expect(bookingSettlement(30000, 0, 15000)).toMatchObject({ remainingBillTotal: 15000, amountToCollect: 15000, invoiceTotal: 30000 });
    expect(bookingSettlement(30000, 500, 30000)).toMatchObject({ remainingBillTotal: 0, amountToCollect: 500, invoiceTotal: 30500 });
    expect(bookingSettlement(30000, 0, 30000).amountToCollect).toBe(0);
  });
  it('detects actual cart edits and retains their original booking identity', () => {
    const cart = bookingToPOSCart(booking); cart[0].quantity = 2;
    expect(bookingCartChanged(booking, cart, 'FIXED', 0)).toBe(true);
    expect(cartToBookingUpdate(booking, cart, 'FIXED', 0, 'Extra session').items[0]).toMatchObject({ lineInstanceId: 'original-line', quantity: 2, type: 'CUSTOM_SERVICE' });
  });
  it('retains package component staff assignments through the POS cart', () => {
    const b = { ...booking, items: [{ ...booking.items[0], type: 'PACKAGE', itemId: 'pkg', components: [
      { serviceId: 'service-1', serviceName: 'Makeup', allocationPercentage: 60, staffId: 'staff-1', staffName: 'Stylist' },
      { serviceId: 'service-2', serviceName: 'Hair', allocationPercentage: 40, staffId: null },
    ] }] };
    const cart = bookingToPOSCart(b);
    expect(cart[0].packageComponents.map(c => c.staffId)).toEqual(['staff-1', 'house']);
    expect(bookingCartChanged(b, cart, 'FIXED', 0)).toBe(false);
    expect(cartToBookingUpdate(b, cart, 'FIXED', 0, 'Confirmed').items[0].packageComponents).toEqual([{ serviceId: 'service-1', staffId: 'staff-1' }, { serviceId: 'service-2', staffId: null }]);
  });
});
