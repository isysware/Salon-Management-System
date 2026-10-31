// src/modules/platform/platform.routes.js
// Platform Master Admin Routes (Mounted under /api/v1/platform)

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as platformCtrl from './platform.controller.js';

const router = Router();

// Master Admin protection
router.use(authenticate, authorize('SUPER_ADMIN'));

// Platform Analytics & Stats
router.get('/stats', platformCtrl.getPlatformStats);

// Tenant Onboarding & Management
router.get('/tenants', platformCtrl.listTenants);
router.post('/tenants', platformCtrl.createTenant);
router.patch('/tenants/:id/status', platformCtrl.updateTenantStatus);

// Plans & Dynamic Modules Management
router.get('/plans', platformCtrl.listPlans);
router.post('/plans', platformCtrl.createPlan);
router.patch('/plans/versions/:versionId', platformCtrl.updatePlanVersion);

// Payment Verification Flow
router.get('/payments/pending', platformCtrl.listPendingPayments);
router.post('/payments/:id/verify', platformCtrl.verifyPayment);
router.post('/payments/:id/reject', platformCtrl.rejectPayment);

export default router;

