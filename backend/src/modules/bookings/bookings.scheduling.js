import { badRequest, conflict } from '../../lib/AppError.js';
import { dateOnly } from '../../lib/dates.js';
import { parseTimeToMinutes as minutes } from '../../lib/calculations/attendanceCalculations.js';

export const lockScheduleDay = (tx, branchId, date) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`apt:${branchId}:${date}`}::text))`;
export const bookingIntervals = items => items.flatMap(i => i.type === 'PACKAGE' ? i.components : [i])
  .filter(i => i.staffId && i.staffId !== 'house')
  .map(i => {
    const start = minutes(i.startTime), end = minutes(i.endTime);
    return { staffId: i.staffId, start, end: end <= start ? end + 1440 : end };
  });
export const assertNoOverlap = (mine, busy) => {
  for (const a of mine) for (const b of busy) {
    if (a.staffId === b.staffId && a.start < b.end && a.end > b.start) throw conflict('STAFF_SLOT_CONFLICT', 'Assigned staff already has an appointment or booking in this time slot.');
  }
};
export const assertBookingConflicts = async (tx, branchId, date, intervals, excludeId) => {
  const bookings = await tx.booking.findMany({ where: { branchId, eventDate: dateOnly(date), status: { notIn: ['CANCELLED', 'NO_SHOW'] }, ...(excludeId ? { id: { not: excludeId } } : {}) }, include: { items: true } });
  assertNoOverlap(intervals, bookings.flatMap(b => bookingIntervals(b.items)));
};
export const validateBookingSchedule = async (tx, branchId, date, items, staffRows, excludeId) => {
  const mine = bookingIntervals(items);
  const leaves = await tx.leaveRecord.findMany({ where: { staffId: { in: mine.map(i => i.staffId) }, status: 'APPROVED', startDate: { lte: dateOnly(date) }, endDate: { gte: dateOnly(date) } } });
  for (const i of mine) {
    const s = staffRows.find(s => s.id === i.staffId && s.isActive && s.branchId === branchId);
    if (!s) throw badRequest('STAFF_INVALID', 'Select active staff from this branch.');
    if (leaves.some(l => l.staffId === s.id)) throw conflict('STAFF_ON_LEAVE', `${s.name} is on approved leave.`);
    const begin = minutes(s.startTime), finish = minutes(s.endTime);
    const overnight = s.isOvernightShift || finish < begin;
    const fits = overnight ? ((i.start >= begin && i.end <= finish + 1440) || (i.start < finish && i.end <= finish)) : i.start >= begin && i.end <= finish;
    if (!fits) throw badRequest('OUTSIDE_SHIFT', `${s.name}'s booking falls outside their working shift.`);
  }
  const appointments = await tx.appointment.findMany({ where: { branchId, date: dateOnly(date), status: { notIn: ['CANCELLED', 'NO_SHOW'] } }, include: { items: { include: { components: true } } } });
  assertNoOverlap(mine, appointments.flatMap(a => bookingIntervals(a.items)));
  await assertBookingConflicts(tx, branchId, date, mine, excludeId);
};
