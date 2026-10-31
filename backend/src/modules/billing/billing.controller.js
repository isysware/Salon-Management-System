// src/modules/billing/billing.controller.js
// Tenant Billing Controller

import * as billingService from './billing.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const getBillingOverview = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const overview = await billingService.getTenantBilling(tenantId);
  res.status(200).json({ data: overview });
});

export const submitPaymentSlip = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const payment = await billingService.submitPaymentSlip(tenantId, req.body, req.user?.id);
  res.status(201).json({
    data: payment,
    message: 'Payment slip submitted successfully. Platform administrators will review and verify your payment.',
  });
});

