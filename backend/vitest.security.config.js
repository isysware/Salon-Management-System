import { defineConfig } from 'vitest/config';

// No database reset or network services: all persistence is mocked.
export default defineConfig({ test: {
  environment: 'node',
  include: ['tests/security-regression.test.js', 'tests/admin-assignment.unit.test.js', 'tests/sales-access-regression.test.js', 'tests/tax-report-regression.test.js', 'tests/staff-portal-access.test.js'],
  testTimeout: 30000,
} });
