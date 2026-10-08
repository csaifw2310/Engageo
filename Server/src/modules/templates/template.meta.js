import ApiError from "../../utils/ApiError.js";
import {
  GRAPH_API_BASE_URL,
  GRAPH_API_TIMEOUT_MS,
} from "../whatsapp/whatsapp.constants.js";
import {
  TEMPLATE_HEADER_TYPE,
  TEMPLATE_BUTTON_TYPE,
  TEMPLATE_MESSAGES,
} from "./template.constants.js";

/**
 * Meta Payload Builder + Submission
 *
 * Dedicated, isolated module responsible for:
 *   1. Transforming our internal (flat) template shape into the `components`
 *      array Meta's Graph API expects on POST /{WABA_ID}/message_templates.
 *   2. Actually submitting that payload to Meta.
 *
 * Kept separate from template.service.js on purpose — the service layer
 * orchestrates (validate → build → submit → persist), this file only knows
 * how to talk to Meta's template format and endpoint. Nothing here touches
 * the database.
 */

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Extracts {{1}}, {{2}}, ... from body text, in ascending unique order.
 * Kept local (not imported from the validator) so this module has zero
 * dependency on the validation layer — it only needs the indices, not the
 * full sequential/duplicate diagnostics the validator already ran earlier in
 * the create flow.
 */
function extractVariableIndices(bodyText = "") {
  const matches = Array.from(String(bodyText).matchAll(/\{\{\s*(\d+)\s*\}\}/g));
  const indices = matches.map((m) => parseInt(m[1], 10)).filter((n) => n > 0);
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}

/**
 * Builds the HEADER component, or omits it entirely for NONE.
 *
 * IMAGE/VIDEO/DOCUMENT headers require a Meta media *handle* (obtained via
 * POST /templates/header-media → template.upload.js, a separate resumable
 * upload session against Meta's Media API) before they can be attached to a
 * template submission — Meta will not accept a bare URL or filename as a
 * header sample. When a handle is present we attach it as
 * `example.header_handle`; when it's missing we fail fast with a clear,
 * honest error instead of submitting a payload Meta would reject anyway.
 */
function buildHeaderComponent({ headerType, headerText, headerMediaHandle }) {
  if (!headerType || headerType === TEMPLATE_HEADER_TYPE.NONE) return null;

  if (headerType === TEMPLATE_HEADER_TYPE.TEXT) {
    return { type: "HEADER", format: "TEXT", text: headerText || "" };
  }

  // IMAGE / VIDEO / DOCUMENT
  const handle =
    typeof headerMediaHandle === "string" ? headerMediaHandle.trim() : "";
  if (!handle) {
    throw new ApiError(400, TEMPLATE_MESSAGES.HEADER_MEDIA_SAMPLE_REQUIRED);
  }

  return {
    type: "HEADER",
    format: headerType,
    example: { header_handle: [handle] },
  };
}

/**
 * Builds the BODY component. Attaches an `example.body_text` array only when
 * every detected {{n}} variable has a corresponding exampleValues entry —
 * Meta requires either all examples or none; a partial set is worse than
 * omitting it, since Meta would reject a mismatched example array outright.
 */
function buildBodyComponent({ bodyText, exampleValues }) {
  const component = {
    type: "BODY",
    text: bodyText,
  };

  const indices = extractVariableIndices(bodyText);

  if (indices.length === 0) {
    return component;
  }

  const values = indices.map((i) => {
    const raw =
      exampleValues instanceof Map
        ? exampleValues.get(String(i))
        : (exampleValues?.[String(i)] ?? exampleValues?.[i]);

    return typeof raw === "string" ? raw.trim() : "";
  });

  // Meta requires an example for every BODY variable.
  if (values.some((value) => !value)) {
    throw new ApiError(
      400,
      "Every body variable must have an example value before submitting the template.",
    );
  }

  component.example = {
    body_text: [values],
  };

  return component;
}

/** Builds the FOOTER component, or omits it when there's no footer text. */
function buildFooterComponent({ footerText }) {
  const text = (footerText || "").trim();
  if (!text) return null;
  return { type: "FOOTER", text };
}

/**
 * Builds the BUTTONS component, or omits it when there are no buttons.
 * Each button is translated to Meta's exact field names — note Meta uses
 * `phone_number` (snake_case) even though the rest of the payload is
 * effectively free-form JSON, and represents a COPY_CODE button's code as an
 * `example` string.
 */
function buildButtonsComponent({ buttons }) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;

  const metaButtons = buttons.map((b) => {
    const type = String(b?.type || "").toUpperCase();

    switch (type) {
      case TEMPLATE_BUTTON_TYPE.URL:
        return { type: "URL", text: b.text, url: b.url };
      case TEMPLATE_BUTTON_TYPE.PHONE_NUMBER:
        return {
          type: "PHONE_NUMBER",
          text: b.text,
          phone_number: b.phoneNumber,
        };
      case TEMPLATE_BUTTON_TYPE.COPY_CODE:
        return { type: "COPY_CODE", example: b.copyCode };
      case TEMPLATE_BUTTON_TYPE.QUICK_REPLY:
      default:
        return { type: "QUICK_REPLY", text: b.text };
    }
  });

  return { type: "BUTTONS", buttons: metaButtons };
}

/**
 * Transforms our internal template create-data into the exact payload shape
 * Meta's POST /{WABA_ID}/message_templates expects:
 *   { name, category, language, components: [...] }
 *
 * `data` is expected to already be validator-clean (see
 * shared/validators/template.validator.js#createTemplate) — this function
 * does not re-run business validation, it only transforms shape and enforces
 * the one rule that validator intentionally can't (media sample presence,
 * since that depends on infrastructure the validator has no knowledge of).
 */
function buildMetaTemplatePayload(data) {
  const components = [
    buildHeaderComponent(data),
    buildBodyComponent(data),
    buildFooterComponent(data),
    buildButtonsComponent(data),
  ].filter(Boolean);

  return {
    name: data.name,
    category: (data.category || "").toUpperCase(),
    language: data.language,
    components,
  };
}

// ── Submission ─────────────────────────────────────────────────────────────

/**
 * POSTs a built payload to Meta's Graph API and returns the normalized
 * result. Meta's create-template response is `{ id, status, category }` on
 * success — status is virtually always "PENDING" (review is asynchronous),
 * so we pass it through rather than assuming.
 */
async function submitTemplateToMeta({
  businessAccountId,
  accessToken,
  payload,
}) {
  const url = `${GRAPH_API_BASE_URL}/${businessAccountId}/message_templates`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(
      502,
      `Failed to submit template to Meta: ${err.message}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Meta rejects invalid payloads (bad category/wording/etc.) with a 400
    // carrying a human-readable error message — surface that verbatim so the
    // frontend can show the real reason instead of a generic failure.
    const metaMessage =
      result?.error?.error_user_msg ||
      result?.error?.message ||
      `HTTP ${response.status}`;
    const statusCode =
      response.status === 401 || response.status === 403 ? 401 : 400;
    throw new ApiError(
      statusCode,
      `Template already exists or was rejected by Meta: ${metaMessage}`,
    );
  }

  if (!result?.id) {
    throw new ApiError(
      502,
      "Meta accepted the request but returned no template id",
    );
  }

  return {
    metaTemplateId: String(result.id),
    status: result.status || "PENDING",
    category: result.category || payload.category,
  };
}

export { buildMetaTemplatePayload, submitTemplateToMeta };
