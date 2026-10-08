import { body, param, query } from "express-validator";
import {
  CAMPAIGN_STATUS_VALUES,
  CAMPAIGN_LIMITS,
  CAMPAIGN_PAGINATION,
} from "../../modules/campaign/campaign.constants.js";

/**
 * express-validator chains for the Campaign module. Each chain is an array
 * mounted BEFORE the shared `validate` middleware:
 *   router.post('/', createCampaign, validate, controller.createCampaign)
 *
 * NOTE: the existing project keeps its validators under src/middlewares/. This
 * module's spec places the validator inside the module folder, so it lives here
 * — move it to src/middlewares/campaign.validator.js if you prefer the existing
 * convention (only the import path in campaign.routes.js needs to change).
 */

// Reusable: a value that must be a valid ISO 8601 datetime strictly in the future.
const futureIso = (field) =>
  body(field)
    .isISO8601()
    .withMessage(`${field} must be a valid ISO 8601 datetime`)
    .bail()
    .custom((value) => {
      if (new Date(value).getTime() <= Date.now()) {
        throw new Error(`${field} must be a future datetime`);
      }
      return true;
    });

// POST /api/campaigns
const createCampaign = [
  body("name")
    .exists({ checkFalsy: true })
    .withMessage("name is required")
    .bail()
    .isString()
    .trim()
    .isLength({ min: 1, max: CAMPAIGN_LIMITS.NAME_MAX })
    .withMessage(`name must be 1-${CAMPAIGN_LIMITS.NAME_MAX} characters`),

  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: CAMPAIGN_LIMITS.DESCRIPTION_MAX })
    .withMessage(
      `description cannot exceed ${CAMPAIGN_LIMITS.DESCRIPTION_MAX} characters`,
    ),

  body("templateId")
    .exists({ checkFalsy: true })
    .withMessage("templateId is required")
    .bail()
    .isMongoId()
    .withMessage("templateId must be a valid id"),

  body("groupIds")
    .isArray({ min: 1, max: CAMPAIGN_LIMITS.MAX_GROUPS })
    .withMessage(
      `groupIds must be an array of 1-${CAMPAIGN_LIMITS.MAX_GROUPS} ids`,
    ),
  body("groupIds.*")
    .isMongoId()
    .withMessage("each group id must be a valid id"),

  // Optional at create — kept but never promotes out of DRAFT.
  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("scheduledAt must be a valid ISO 8601 datetime")
    .bail()
    .custom((value) => {
      if (new Date(value).getTime() <= Date.now()) {
        throw new Error("scheduledAt must be a future datetime");
      }
      return true;
    }),
];

// GET /api/campaigns  →  pagination + search + status filter
const listCampaigns = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be an integer >= 1")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: CAMPAIGN_PAGINATION.MAX_LIMIT })
    .withMessage(`limit must be between 1 and ${CAMPAIGN_PAGINATION.MAX_LIMIT}`)
    .toInt(),
  query("search")
    .optional()
    .trim()
    .isLength({ max: CAMPAIGN_LIMITS.SEARCH_MAX })
    .withMessage(
      `search cannot exceed ${CAMPAIGN_LIMITS.SEARCH_MAX} characters`,
    ),
  query("status")
    .optional()
    .isIn(CAMPAIGN_STATUS_VALUES)
    .withMessage(`status must be one of: ${CAMPAIGN_STATUS_VALUES.join(", ")}`),
];

// PATCH /api/campaigns/:id  →  all fields optional, but at least the id is valid
const updateCampaign = [
  param("id").isMongoId().withMessage("Invalid campaign id"),

  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: CAMPAIGN_LIMITS.NAME_MAX })
    .withMessage(`name must be 1-${CAMPAIGN_LIMITS.NAME_MAX} characters`),

  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: CAMPAIGN_LIMITS.DESCRIPTION_MAX })
    .withMessage(
      `description cannot exceed ${CAMPAIGN_LIMITS.DESCRIPTION_MAX} characters`,
    ),

  body("templateId")
    .optional()
    .isMongoId()
    .withMessage("templateId must be a valid id"),

  body("groupIds")
    .optional()
    .isArray({ min: 1, max: CAMPAIGN_LIMITS.MAX_GROUPS })
    .withMessage(
      `groupIds must be an array of 1-${CAMPAIGN_LIMITS.MAX_GROUPS} ids`,
    ),
  body("groupIds.*")
    .optional()
    .isMongoId()
    .withMessage("each group id must be a valid id"),

  body("scheduledAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("scheduledAt must be a valid ISO 8601 datetime"),
];

// POST /api/campaigns/:id/schedule
const scheduleCampaign = [
  param("id").isMongoId().withMessage("Invalid campaign id"),
  body("scheduledAt")
    .exists({ checkFalsy: true })
    .withMessage("scheduledAt is required"),
  futureIso("scheduledAt"),
];

// Shared :id param check for GET-by-id, DELETE, launch and cancel.
const campaignIdParam = [
  param("id").isMongoId().withMessage("Invalid campaign id"),
];

export {
  createCampaign,
  listCampaigns,
  updateCampaign,
  scheduleCampaign,
  campaignIdParam,
};
