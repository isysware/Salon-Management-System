import { it, expect } from 'vitest';
import { incomeExpenseCashFlow, incomeExpenseCashText } from '../../frontend/src/features/reports/incomeExpenseDisplay.ts';
it('shows a booking advance as cash received without recognized income', () => {
  const row = { type: 'SETTLEMENT', source: 'BOOKING', income: 0, expense: 0, paid: 0, cashFlow: 5000 };
  expect(incomeExpenseCashFlow(row)).toBe(5000); expect(incomeExpenseCashText(row)).toBe('+5000.00');
});
it('shows invoice cash refunds as outflows rather than positive collections', () => {
  const row = { type: 'INCOME', income: -1000, expense: 0, paid: -300, collectionAmount: -300 };
  expect(incomeExpenseCashFlow(row)).toBe(-300); expect(incomeExpenseCashText(row)).toBe('-300.00');
});
it('does not repeat cumulative invoice payments when dues have separate receipt rows', () => {
  expect(incomeExpenseCashFlow({ type: 'INCOME', income: 1000, paid: 800, collectionAmount: 300 })).toBe(300);
  expect(incomeExpenseCashFlow({ type: 'OPERATING_EXPENSE', income: 0, expense: 200, paid: 200 })).toBe(-200);
});
