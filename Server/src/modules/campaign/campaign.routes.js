import express from "express";

import { protect } from "../../shared/middlewares/auth.middleware.js";
import validate from "../../shared/middlewares/validate.middleware.js";
import checkSubscription from "../../shared/middlewares/checkSubscription.middleware.js";
import { checkUsageLimit } from "../../shared/middlewares/checkUsageLimit.middleware.js";
import { USAGE_RESOURCE } from "../billing/billing.constants.js";
import * as controller from "./campaign.controller.js";
import * as v from "../../shared/validators/campaign.validator.js";

const campaignRouter = express.Router();

// Every campaign route requires an authenticated tenant.
campaignRouter.use(protect);

// Collection routes.
campaignRouter
  .route("/")
  .post(
    checkSubscription(),
    checkUsageLimit(USAGE_RESOURCE.CAMPAIGN),
    v.createCampaign,
    validate,
    controller.createCampaign
  )
  .get(v.listCampaigns, validate, controller.getCampaigns);

// Lifecycle action routes. These carry an :id but a distinct trailing segment,
// so they never collide with the bare "/:id" routes below.
campaignRouter.post(
  "/:id/schedule",
  v.scheduleCampaign,
  validate,
  controller.scheduleCampaign,
);
campaignRouter.post(
  "/:id/launch",
  v.campaignIdParam,
  validate,
  controller.launchCampaign,
);
campaignRouter.post(
  "/:id/cancel",
  v.campaignIdParam,
  validate,
  controller.cancelCampaign,
);

// Single-resource routes.
campaignRouter
  .route("/:id")
  .get(v.campaignIdParam, validate, controller.getCampaign)
  .patch(v.updateCampaign, validate, controller.updateCampaign)
  .delete(v.campaignIdParam, validate, controller.deleteCampaign);

export default campaignRouter;
