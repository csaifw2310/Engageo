import { body, param, query } from "express-validator";
import {
  TEMPLATE_STATUS_VALUES,
  TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_HEADER_TYPE_VALUES,
  TEMPLATE_BUTTON_TYPE_VALUES,
  TEMPLATE_BUTTON_LIMITS,
  TEMPLATE_NAME_REGEX,
  TEMPLATE_NAME_MAX_LENGTH,
  TEMPLATE_CHAR_LIMITS,
  TEMPLATE_VARIABLE_PATTERN,
  TEMPLATE_UPLOADABLE_HEADER_TYPES,
  TEMPLATE_MESSAGES,
} from "../../modules/templates/template.constants.js";

/**
 * express-validator chains for the Template module. Each chain is an array
 * mounted BEFORE the shared `validate` middleware:
 *   router.get('/', listTemplates, validate, controller.getTemplates)
 *
 * listTemplates / templateIdParam are unchanged from before — templates are
 * still only ever authored through POST /templates (createTemplate, added
 * below), never mutated in place.
 */

// GET /api/templates  →  pagination + search + status/category filters
const listTemplates = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be an integer >= 1")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100")
    .toInt(),
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("search cannot exceed 100 characters"),
  query("status")
    .optional()
    .isIn(TEMPLATE_STATUS_VALUES)
    .withMessage(`status must be one of: ${TEMPLATE_STATUS_VALUES.join(", ")}`),
  query("category")
    .optional()
    .isIn(TEMPLATE_CATEGORY_VALUES)
    .withMessage(
      `category must be one of: ${TEMPLATE_CATEGORY_VALUES.join(", ")}`,
    ),
];

// Shared :id param check for GET-by-id and DELETE.
const templateIdParam = [
  param("id").isMongoId().withMessage("Invalid template id"),
];

/**
 * Extracts {{n}} tokens from body text (in appearance order) and reports:
 *   - variables: unique indices found, sorted ascending, as { index, token }
 *   - count: number of unique variables
 *   - isSequential: whether the unique indices form 1..n with no gaps
 *   - firstGapAt: the first missing index in the sequence, if any
 *   - hasZeroIndex: whether a {{0}} token was found (always invalid — Meta
 *     variables are 1-indexed)
 *   - duplicateIndices: indices (other than 0) that appear more than once —
 *     each variable placeholder must appear exactly once in a Meta template
 *
 * Mirrors Client/src/types/template.ts#detectTemplateVariables (the
 * isSequential / firstGapAt shape matches exactly) so the same body text is
 * judged identically on both sides. Exported so template.service.js can reuse
 * it without duplicating the regex/parsing logic.
 */
function parseTemplateVariables(bodyText = "") {
  const matches = Array.from(String(bodyText).matchAll(TEMPLATE_VARIABLE_PATTERN));
  const allIndices = matches.map((m) => parseInt(m[1], 10));

  const hasZeroIndex = allIndices.includes(0);

  const occurrences = new Map();
  for (const idx of allIndices) {
    occurrences.set(idx, (occurrences.get(idx) || 0) + 1);
  }
  const duplicateIndices = Array.from(occurrences.entries())
    .filter(([idx, count]) => idx !== 0 && count > 1)
    .map(([idx]) => idx)
    .sort((a, b) => a - b);

  const uniqueIndices = Array.from(new Set(allIndices.filter((idx) => idx !== 0))).sort(
    (a, b) => a - b,
  );

  let isSequential = true;
  let firstGapAt = null;
  for (let i = 0; i < uniqueIndices.length; i++) {
    const expected = i + 1;
    if (uniqueIndices[i] !== expected) {
      isSequential = false;
      firstGapAt = expected;
      break;
    }
  }

  return {
    variables: uniqueIndices.map((index) => ({ index, token: `{{${index}}}` })),
    count: uniqueIndices.length,
    isSequential,
    firstGapAt,
    hasZeroIndex,
    duplicateIndices,
  };
}

// POST /api/templates  →  full create-wizard payload validation.
// Field-by-field so a single failing field never masks another; `validate`
// middleware collects and returns every error in one response.
const createTemplate = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage(TEMPLATE_MESSAGES.NAME_REQUIRED)
    .bail()
    .isLength({ max: TEMPLATE_NAME_MAX_LENGTH })
    .withMessage(TEMPLATE_MESSAGES.NAME_TOO_LONG)
    .bail()
    .matches(TEMPLATE_NAME_REGEX)
    .withMessage(TEMPLATE_MESSAGES.NAME_INVALID_FORMAT),

  body("category")
    .trim()
    .notEmpty()
    .withMessage(TEMPLATE_MESSAGES.CATEGORY_INVALID)
    .bail()
    .customSanitizer((value) => String(value).toUpperCase())
    .isIn(TEMPLATE_CATEGORY_VALUES)
    .withMessage(TEMPLATE_MESSAGES.CATEGORY_INVALID),

  body("language").trim().notEmpty().withMessage(TEMPLATE_MESSAGES.LANGUAGE_REQUIRED),

  body("headerType")
    .optional({ nullable: true })
    .trim()
    .customSanitizer((value) => (value ? String(value).toUpperCase() : "NONE"))
    .isIn(TEMPLATE_HEADER_TYPE_VALUES)
    .withMessage(TEMPLATE_MESSAGES.HEADER_TYPE_INVALID),

  // Conditional on headerType, so it needs req.body rather than a plain chain.
  body("headerText").custom((value, { req }) => {
    const headerType = String(req.body.headerType || "NONE").toUpperCase();
    const text = typeof value === "string" ? value.trim() : "";

    if (headerType === "TEXT") {
      if (!text) throw new Error(TEMPLATE_MESSAGES.HEADER_TEXT_REQUIRED);
      if (text.length > TEMPLATE_CHAR_LIMITS.HEADER_TEXT) {
        throw new Error(TEMPLATE_MESSAGES.HEADER_TEXT_TOO_LONG);
      }
    } else if (text) {
      throw new Error(TEMPLATE_MESSAGES.HEADER_TEXT_NOT_ALLOWED);
    }
    return true;
  }),

  // IMAGE/VIDEO/DOCUMENT headers must reference a handle obtained beforehand
  // from POST /templates/header-media (template.upload.js) — Meta requires a
  // real uploaded sample, not a filename or bare URL.
  body("headerMediaHandle").custom((value, { req }) => {
    const headerType = String(req.body.headerType || "NONE").toUpperCase();
    const handle = typeof value === "string" ? value.trim() : "";

    if (TEMPLATE_UPLOADABLE_HEADER_TYPES.includes(headerType) && !handle) {
      throw new Error(TEMPLATE_MESSAGES.HEADER_MEDIA_SAMPLE_REQUIRED);
    }
    return true;
  }),

  body("bodyText")
    .trim()
    .notEmpty()
    .withMessage(TEMPLATE_MESSAGES.BODY_REQUIRED)
    .bail()
    .isLength({ max: TEMPLATE_CHAR_LIMITS.BODY_TEXT })
    .withMessage(TEMPLATE_MESSAGES.BODY_TOO_LONG)
    .bail()
    .custom((value) => {
      const { hasZeroIndex, duplicateIndices, isSequential } = parseTemplateVariables(value);
      if (hasZeroIndex) throw new Error(TEMPLATE_MESSAGES.VARIABLE_INVALID_INDEX);
      if (duplicateIndices.length > 0) throw new Error(TEMPLATE_MESSAGES.VARIABLE_DUPLICATE);
      if (!isSequential) throw new Error(TEMPLATE_MESSAGES.VARIABLE_NOT_SEQUENTIAL);
      return true;
    }),

  body("footerText")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: TEMPLATE_CHAR_LIMITS.FOOTER_TEXT })
    .withMessage(TEMPLATE_MESSAGES.FOOTER_TOO_LONG),

  body("buttons")
    .optional({ nullable: true })
    .custom((buttons, { req }) => {
      if (buttons === undefined || buttons === null) return true;
      if (!Array.isArray(buttons)) throw new Error(TEMPLATE_MESSAGES.BUTTON_TYPE_INVALID);
      if (buttons.length > TEMPLATE_BUTTON_LIMITS.MAX_TOTAL) {
        throw new Error(TEMPLATE_MESSAGES.BUTTONS_TOO_MANY);
      }

      const category = String(req.body.category || "").toUpperCase();
      const counts = {};

      for (const btn of buttons) {
        const type = String(btn?.type || "").toUpperCase();
        if (!TEMPLATE_BUTTON_TYPE_VALUES.includes(type)) {
          throw new Error(TEMPLATE_MESSAGES.BUTTON_TYPE_INVALID);
        }
        counts[type] = (counts[type] || 0) + 1;

        const text = typeof btn?.text === "string" ? btn.text.trim() : "";
        if (!text) throw new Error(TEMPLATE_MESSAGES.BUTTON_TEXT_REQUIRED);
        if (text.length > TEMPLATE_CHAR_LIMITS.BUTTON_TEXT) {
          throw new Error(TEMPLATE_MESSAGES.BUTTON_TEXT_TOO_LONG);
        }

        if (type === "URL" && !String(btn?.url || "").trim()) {
          throw new Error(TEMPLATE_MESSAGES.BUTTON_URL_REQUIRED);
        }
        if (type === "PHONE_NUMBER" && !String(btn?.phoneNumber || "").trim()) {
          throw new Error(TEMPLATE_MESSAGES.BUTTON_PHONE_REQUIRED);
        }
        if (type === "COPY_CODE") {
          if (!String(btn?.copyCode || "").trim()) {
            throw new Error(TEMPLATE_MESSAGES.BUTTON_COPY_CODE_REQUIRED);
          }
          if (category !== "AUTHENTICATION") {
            throw new Error(TEMPLATE_MESSAGES.BUTTON_COPY_CODE_NOT_ALLOWED);
          }
        }
      }

      if ((counts.URL || 0) > TEMPLATE_BUTTON_LIMITS.MAX_URL) {
        throw new Error(TEMPLATE_MESSAGES.BUTTONS_TOO_MANY_URL);
      }
      if ((counts.PHONE_NUMBER || 0) > TEMPLATE_BUTTON_LIMITS.MAX_PHONE_NUMBER) {
        throw new Error(TEMPLATE_MESSAGES.BUTTONS_TOO_MANY_PHONE);
      }
      if ((counts.COPY_CODE || 0) > TEMPLATE_BUTTON_LIMITS.MAX_COPY_CODE) {
        throw new Error(TEMPLATE_MESSAGES.BUTTONS_TOO_MANY_COPY_CODE);
      }

      return true;
    }),

  body("exampleValues")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === undefined || value === null) return true;
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error("exampleValues must be an object keyed by variable index");
      }
      return true;
    }),
];

// POST /api/templates/header-media  →  multipart upload, validates the
// accompanying headerType field. The file itself is checked in the service
// (mime type / size are per-headerType, which express-validator's file
// support doesn't model cleanly) — this just ensures headerType is present
// and one of the types that actually needs a media sample.
const uploadHeaderMedia = [
  body("headerType")
    .trim()
    .notEmpty()
    .withMessage(TEMPLATE_MESSAGES.MEDIA_HEADER_TYPE_REQUIRED)
    .bail()
    .customSanitizer((value) => String(value).toUpperCase())
    .isIn(TEMPLATE_UPLOADABLE_HEADER_TYPES)
    .withMessage(TEMPLATE_MESSAGES.MEDIA_HEADER_TYPE_REQUIRED),
];

export {
  listTemplates,
  templateIdParam,
  createTemplate,
  uploadHeaderMedia,
  parseTemplateVariables,
};
