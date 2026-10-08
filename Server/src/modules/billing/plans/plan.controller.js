import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import planService from './plan.service.js';
import { BILLING_MESSAGES } from '../billing.constants.js';

/**
 * Plan controllers. Thin HTTP adapters — delegate to the service and wrap the
 * result in the standard ApiResponse envelope. No business logic here.
 */

// GET /api/plans  → active catalogue (any authenticated tenant).
const getPlans = asyncHandler(async (req, res) => {
  const data = await planService.listActivePlans();
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.PLAN_LIST_FETCHED));
});

// GET /api/plans/:id  → single plan.
const getPlan = asyncHandler(async (req, res) => {
  const data = await planService.getPlan(req.params.id);
  res.status(200).json(new ApiResponse(200, data, BILLING_MESSAGES.PLAN_FETCHED));
});

// POST /api/plans  → create (admin).
const createPlan = asyncHandler(async (req, res) => {
  const data = await planService.createPlan(req.body);
  res
    .status(201)
    .json(new ApiResponse(201, data, BILLING_MESSAGES.PLAN_CREATED));
});

// PATCH /api/plans/:id  → update (admin).
const updatePlan = asyncHandler(async (req, res) => {
  const data = await planService.updatePlan(req.params.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.PLAN_UPDATED));
});

// DELETE /api/plans/:id  → delete (admin).
const deletePlan = asyncHandler(async (req, res) => {
  await planService.deletePlan(req.params.id);
  res.status(200).json(new ApiResponse(200, null, BILLING_MESSAGES.PLAN_DELETED));
});

export { getPlans, getPlan, createPlan, updatePlan, deletePlan };
