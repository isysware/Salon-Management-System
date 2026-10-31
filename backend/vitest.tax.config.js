import { defineConfig } from 'vitest/config';

export default defineConfig({ test: {
  environment: 'node',
  include: ['tests/tax-report-regression.test.js'],
} });
