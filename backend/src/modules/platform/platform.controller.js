// src/modules/platform/platform.controller.js
// Platform Controller for Master Super Admin

import * as platformService from './platform.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const getPlatformStats = asyncHandler(async (_req, res) => {
  const stats = await platformService.getPlatformStats();
  res.status(200).json({ data: stats });
});

export const listTenants = asyncHandler(async (_req, res) => {
  const tenants = await platformService.listTenants();
  res.status(200).json({ data: tenants });
});

export const createTenant = asyncHandler(async (req, res) => {
  const result = await platformService.createTenant(req.body, req.user?.id);
  res.status(201).json({ data: result, message: 'Salon tenant provisioned successfully' });
});

export const updateTenantStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await platformService.updateTenantStatus(id, req.body, req.user?.id);
  res.status(200).json({ data: result, message: 'Tenant status updated' });
});

export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await platformService.listPlans();
  res.status(200).json({ data: plans });
});

export const createPlan = asyncHandler(async (req, res) => {
  const plan = await platformService.createPlan(req.body);
  res.status(201).json({ data: plan, message: 'SaaS plan created successfully' });
});

export const updatePlanVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const updated = await platformService.updatePlanVersion(versionId, req.body);
  res.status(200).json({ data: updated, message: 'Plan version updated successfully' });
});

export const listPendingPayments = asyncHandler(async (_req, res) => {
  const payments = await platformService.listPendingPayments();
  res.status(200).json({ data: payments });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await platformService.verifyPayment(id, req.user?.id);
  res.status(200).json({ data: result, message: 'Payment verified and subscription extended' });
});

export const rejectPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await platformService.rejectPayment(id, req.body, req.user?.id);
  res.status(200).json({ data: result, message: 'Payment slip rejected' });
});

