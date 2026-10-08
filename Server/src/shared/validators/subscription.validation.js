import { body } from "express-validator";

import { BILLING_CYCLE_VALUES } from "../../modules/billing/billing.constants.js";

/**
 * express-validator chains for the Subscriptions sub-module. Mounted before the
 * shared `validate` middleware on each route.
 */

// POST /api/subscriptions  and  POST /api/subscriptions/upgrade
// Both take a target plan plus an optional billing cycle / auto-renew flag.
const selectPlan = [
  body("planId").isMongoId().withMessage("A valid planId is required"),
  body("billingCycle")
    .optional()
    .isIn(BILLING_CYCLE_VALUES)
    .withMessage(
      `billingCycle must be one of: ${BILLING_CYCLE_VALUES.join(", ")}`,
    ),
  body("autoRenew")
    .optional()
    .isBoolean()
    .withMessage("autoRenew must be a boolean")
    .toBoolean(),
];

export { selectPlan };
