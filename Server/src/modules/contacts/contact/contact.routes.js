import express from "express";

import authenticate from "../../../shared/middlewares/auth.middleware.js";
import validate from "../../../shared/middlewares/validate.middleware.js";
import uploadCsv from "../../../shared/middlewares/multer.js";
import checkSubscription from "../../../shared/middlewares/checkSubscription.middleware.js";
import { checkUsageLimit } from "../../../shared/middlewares/checkUsageLimit.middleware.js";
import { USAGE_RESOURCE } from "../../billing/billing.constants.js";
import * as controller from "./contact.controller.js";
import * as v from "../../../shared/validators/contact.validator.js";

const contactRouter = express.Router();

// Every contact route requires a valid JWT.
contactRouter.use(authenticate);

/**
 * IMPORTANT: static paths (/import, /export) MUST be declared before "/:id",
 * otherwise Express would match "export" as an :id parameter.
 */
contactRouter.post(
  "/import",
  checkSubscription(),
  checkUsageLimit(USAGE_RESOURCE.CONTACT),
  uploadCsv.single("file"),
  controller.importContacts,
);
contactRouter.get("/export", controller.exportContacts);

contactRouter
  .route("/")
  .post(
    checkSubscription(),
    checkUsageLimit(USAGE_RESOURCE.CONTACT),
    v.createContact,
    validate,
    controller.createContact
  )
  .get(v.listContacts, validate, controller.getContacts);

contactRouter
  .route("/:id")
  .get(v.contactIdParam, validate, controller.getContact)
  .patch(v.updateContact, validate, controller.updateContact)
  .delete(v.contactIdParam, validate, controller.deleteContact);

export default contactRouter;
