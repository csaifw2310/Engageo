import express from 'express';

import { protect, authorize } from '../../../shared/middlewares/auth.middleware.js';
import validate from '../../../shared/middlewares/validate.middleware.js';
import * as controller from './plan.controller.js';
import * as v from '../../../shared/validators/plan.validation.js';

const planRouter = express.Router();

/**
 * Plan routes.
 *
 * Reads (GET) are PUBLIC — the plan catalogue (pricing) needs to be visible
 * to logged-out visitors on the marketing/landing page, not just authenticated
 * tenants. Writes (POST/PATCH/DELETE) remain admin-only and protected.
 *
 * NOTE: there used to be a blanket `planRouter.use(protect)` here which made
 * every route — including reads — require auth. That's been removed in favour
 * of applying `protect` only to the write routes below.
 */

planRouter
  .route('/')
  .get(controller.getPlans)
  .post(protect, authorize('admin'), v.createPlan, validate, controller.createPlan);

planRouter
  .route('/:id')
  .get(v.planIdParam, validate, controller.getPlan)
  .patch(protect, authorize('admin'), v.updatePlan, validate, controller.updatePlan)
  .delete(protect, authorize('admin'), v.planIdParam, validate, controller.deletePlan);

export default planRouter;