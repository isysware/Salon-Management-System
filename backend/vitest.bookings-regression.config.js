import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';
class Ordered extends BaseSequencer {
  async sort(files) { return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId)); }
}
export default defineConfig({ test: {
  environment: 'node', include: ['tests/05-clients-appointments.test.js', 'tests/06-cash.test.js', 'tests/07-inventory.test.js', 'tests/08-pos.test.js', 'tests/bookings.test.js', 'tests/booking-pos-handoff.test.js', 'tests/client-booking-ledger.test.js', 'tests/booking-report-display.test.js'],
  globalSetup: ['./tests/globalSetup.js'], setupFiles: ['./tests/setupEnv.js'],
  fileParallelism: false, sequence: { sequencer: Ordered }, testTimeout: 30000, hookTimeout: 120000,
} });
