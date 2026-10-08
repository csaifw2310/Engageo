import express from "express";

import { protect } from "../../../shared/middlewares/auth.middleware.js";
import validate from "../../../shared/middlewares/validate.middleware.js";
import * as controller from "./subscription.controller.js";
import * as v from "../../../shared/validators/subscription.validation.js";

const subscriptionRouter = express.Router();

/**
 * Subscription routes — every route requires an authenticated tenant, and the
 * service scopes all reads/writes to that tenant. The static action routes
 * (/current, /upgrade, /cancel) carry distinct leading segments so they never
 * collide with one another.
 */
subscriptionRouter.use(protect);

subscriptionRouter.get("/current", controller.getCurrentSubscription);

subscriptionRouter.post(
  "/",
  v.selectPlan,
  validate,
  controller.createSubscription,
);

subscriptionRouter.post(
  "/upgrade",
  v.selectPlan,
  validate,
  controller.upgradeSubscription,
);

subscriptionRouter.post("/cancel", controller.cancelSubscription);

export default subscriptionRouter;
