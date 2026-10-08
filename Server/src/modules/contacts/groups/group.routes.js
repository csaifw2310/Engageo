import express from "express";

import authenticate from "../../../shared/middlewares/auth.middleware.js";
import validate from "../../../shared/middlewares/validate.middleware.js";
import * as controller from "./group.controller.js";
import * as v from "../../../shared/validators/group.validator.js";

const router = express.Router();

router.use(authenticate);

router
  .route("/")
  .post(v.createGroup, validate, controller.createGroup)
  .get(v.listGroups, validate, controller.getGroups);

router
  .route("/:id")
  .get(v.groupIdParam, validate, controller.getGroup)
  .patch(v.updateGroup, validate, controller.updateGroup)
  .delete(v.groupIdParam, validate, controller.deleteGroup);

// Bulk membership management. Declared before the single-contact routes so
// "/:id/members" can never be swallowed by "/:groupId/contacts/:contactId".
router.get(
  "/:id/members",
  v.groupContactsQuery,
  validate,
  controller.getMembers,
);
router.get(
  "/:id/available-contacts",
  v.groupContactsQuery,
  validate,
  controller.getAvailableContacts,
);
router.post("/:id/members", v.bulkMembers, validate, controller.addMembers);
router.delete(
  "/:id/members",
  v.bulkMembers,
  validate,
  controller.removeMembers,
);

// Membership management (many-to-many), single contact
router.post(
  "/:groupId/contacts/:contactId",
  v.membershipParams,
  validate,
  controller.assignContact,
);
router.delete(
  "/:groupId/contacts/:contactId",
  v.membershipParams,
  validate,
  controller.removeContact,
);

export default router;