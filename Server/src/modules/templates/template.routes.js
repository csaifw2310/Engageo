import express from "express";

import { protect } from "../../shared/middlewares/auth.middleware.js";
import validate from "../../shared/middlewares/validate.middleware.js";
import { uploadTemplateMedia } from "../../shared/middlewares/multer.js";
import * as controller from "./template.controller.js";
import * as v from "../../shared/validators/template.validator.js";

const templateRouter = express.Router();

// Every template route requires an authenticated tenant.
templateRouter.use(protect);

/**
 * IMPORTANT: static paths (/sync, /header-media) MUST be declared before
 * "/:id", otherwise Express would try to match them as an :id parameter.
 */
templateRouter.post("/sync", controller.syncTemplates);

templateRouter.post(
  "/header-media",
  uploadTemplateMedia.single("file"),
  v.uploadHeaderMedia,
  validate,
  controller.uploadTemplateHeaderMedia
);

templateRouter.get("/", v.listTemplates, validate, controller.getTemplates);
templateRouter.post("/", v.createTemplate, validate, controller.createTemplate);

templateRouter
  .route("/:id")
  .get(v.templateIdParam, validate, controller.getTemplate)
  .delete(v.templateIdParam, validate, controller.deleteTemplate);

export default templateRouter;
