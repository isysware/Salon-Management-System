// src/modules/billing/billing.routes.js
// Tenant Billing & Subscription Routes (Mounted under /api/v1/tenant/billing)

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantContext } from '../../middleware/tenantContext.js';
import * as billingCtrl from './billing.controller.js';

const router = Router();

// Requires authenticated user and tenant context
router.use(authenticate, tenantContext);

// View billing & subscription status
router.get('/', billingCtrl.getBillingOverview);

// Submit manual payment slip for verification & renewal
router.post('/submit-payment', billingCtrl.submitPaymentSlip);

export default router;

