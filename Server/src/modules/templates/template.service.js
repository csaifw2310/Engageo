import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../../shared/services/cloudinary.service.js";

import Template from "./template.model.js";
import WhatsAppConnection from "../whatsapp/whatsapp.model.js";
import ApiError from "../../utils/ApiError.js";
import {
  GRAPH_API_BASE_URL,
  GRAPH_API_TIMEOUT_MS,
} from "../whatsapp/whatsapp.constants.js";
import { CONNECTION_STATUS } from "../whatsapp/whatsapp.constants.js";
import {
  TEMPLATE_HEADER_TYPE,
  TEMPLATE_HEADER_TYPE_VALUES,
  TEMPLATE_STATUS,
  TEMPLATE_STATUS_VALUES,
  TEMPLATE_PAGINATION,
  META_TEMPLATES_PAGE_SIZE,
  TEMPLATE_SYNC_MOCK,
  TEMPLATE_MESSAGES,
  TEMPLATE_HEADER_MEDIA_MIME_TYPES,
  TEMPLATE_HEADER_MEDIA_MAX_BYTES,
  TEMPLATE_UPLOADABLE_HEADER_TYPES,
} from "./template.constants.js";
import {
  buildMetaTemplatePayload,
  submitTemplateToMeta,
} from "./template.meta.js";
import { uploadHeaderMediaToMeta } from "./template.upload.js";

// Escape user input before using it inside a RegExp (prevents ReDoS / injection).
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every method is tenant-scoped: it takes the authenticated `userId` and only
 * ever reads or writes documents owned by that user. No method exposes a code
 * path that can reach another tenant's templates or connection.
 */
class TemplateService {
  /**
   * Create a new template: validate → parse variables (validator layer) →
   * build the Meta payload → submit to Meta's Graph API → persist the
   * complete template locally using Meta's own id/status.
   *
   * `data` has already passed through the createTemplate validator chain
   * (name format, category/language, header rules, body length + variable
   * sequencing, footer length, button shape/limits) by the time it reaches
   * here.
   *
   * Meta remains the source of truth: if the Graph API rejects the payload
   * (or we can't reach Meta), NO local row is created — there is no
   * `local_${Date.now()}` fallback id anymore. The one exception is local
   * development: TEMPLATE_SYNC_MOCK=true (the same flag syncTemplates() uses)
   * skips the real network call and fabricates a PENDING response, so the
   * wizard is fully testable without a live, review-approved Meta app.
   */
  async createTemplate(userId, data) {
    const connection = await WhatsAppConnection.findOne({ userId }).select(
      "+accessToken",
    );
    if (!connection)
      throw new ApiError(
        400,
        "WhatsApp not connected. Connect WhatsApp first.",
      );
    if (connection.status !== CONNECTION_STATUS.CONNECTED) {
      throw new ApiError(400, TEMPLATE_MESSAGES.CONNECTION_NOT_CONNECTED);
    }

    const headerType = TEMPLATE_HEADER_TYPE_VALUES.includes(data.headerType)
      ? data.headerType
      : TEMPLATE_HEADER_TYPE.NONE;
    const normalizedData = { ...data, headerType };

    // Isolated Meta payload builder — throws ApiError(400, ...) for anything
    // Meta itself would reject (currently: media headers with no uploaded
    // sample, since there's no upload endpoint yet). That error propagates
    // straight out of this method — no local row is created.
    const metaPayload = buildMetaTemplatePayload(normalizedData);

    const metaResult = TEMPLATE_SYNC_MOCK
      ? this.#mockMetaCreateResponse(metaPayload)
      : await submitTemplateToMeta({
          businessAccountId: connection.businessAccountId,
          accessToken: connection.accessToken,
          payload: metaPayload,
        });

    const template = await Template.create({
      userId,
      whatsappConnectionId: connection._id,
      metaTemplateId: metaResult.metaTemplateId,
      name: data.name,
      category:
        metaResult.category || data.category?.toUpperCase() || "MARKETING",
      language: data.language || "en_US",
      status: TEMPLATE_STATUS_VALUES.includes(metaResult.status)
        ? metaResult.status
        : TEMPLATE_STATUS.PENDING,
      headerType,
      headerText:
        headerType === TEMPLATE_HEADER_TYPE.TEXT ? data.headerText || "" : "",
      headerMediaHandle: TEMPLATE_UPLOADABLE_HEADER_TYPES.includes(headerType)
        ? data.headerMediaHandle || null
        : null,

      headerMediaUrl: TEMPLATE_UPLOADABLE_HEADER_TYPES.includes(headerType)
        ? data.headerMediaUrl || null
        : null,

      headerMediaPublicId: TEMPLATE_UPLOADABLE_HEADER_TYPES.includes(headerType)
        ? data.headerMediaPublicId || null
        : null,
      bodyText: data.bodyText,
      exampleValues: data.exampleValues || {},
      footerText: data.footerText || "",
      buttons: this.#normalizeButtons(data.buttons),
      syncedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    // .toObject() so the response shape matches the .lean() shape returned by
    // listTemplates()/getTemplate() — plain object, exampleValues as a plain
    // object rather than a Mongoose Map.
    return template.toObject();
  }

  /**
   * Upload a header sample (IMAGE/VIDEO/DOCUMENT) to Meta and return the
   * media handle the create wizard should carry into POST /templates as
   * `headerMediaHandle`. Tenant-scoped via the caller's WhatsApp connection;
   * does not touch the Template collection at all — this is a pure Meta
   * pass-through, matching template.meta.js's separation of concerns.
   */
  async uploadHeaderMedia(userId, { headerType, file }) {
    if (!file) {
      throw new ApiError(400, TEMPLATE_MESSAGES.MEDIA_FILE_REQUIRED);
    }

    const type = String(headerType || "").toUpperCase();

    if (!TEMPLATE_UPLOADABLE_HEADER_TYPES.includes(type)) {
      throw new ApiError(400, TEMPLATE_MESSAGES.MEDIA_HEADER_TYPE_REQUIRED);
    }

    const allowedMimeTypes = TEMPLATE_HEADER_MEDIA_MIME_TYPES[type] || [];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new ApiError(400, TEMPLATE_MESSAGES.MEDIA_TYPE_INVALID);
    }

    const maxBytes = TEMPLATE_HEADER_MEDIA_MAX_BYTES[type];

    if (typeof maxBytes === "number" && file.size > maxBytes) {
      throw new ApiError(400, TEMPLATE_MESSAGES.MEDIA_TOO_LARGE);
    }

    const connection = await WhatsAppConnection.findOne({ userId }).select(
      "+accessToken",
    );

    if (!connection) {
      throw new ApiError(
        400,
        "WhatsApp not connected. Connect WhatsApp first.",
      );
    }

    if (connection.status !== CONNECTION_STATUS.CONNECTED) {
      throw new ApiError(400, TEMPLATE_MESSAGES.CONNECTION_NOT_CONNECTED);
    }

    let cloudinaryResult = null;

    try {
      // 1. Persist application-side copy.
      cloudinaryResult = await uploadBufferToCloudinary(
        file.buffer,
        `engageo/${userId}/templates`,
        type === TEMPLATE_HEADER_TYPE.DOCUMENT ? "raw" : "image",
      );

      // 2. Upload sample to Meta for template creation/approval.

      const { handle } = await uploadHeaderMediaToMeta({
        buffer: file.buffer,
        mimeType: file.mimetype,
      });

      return {
        headerType: type,
        headerMediaHandle: handle,

        // Engageo-owned media
        headerMediaUrl: cloudinaryResult.secure_url,
        headerMediaPublicId: cloudinaryResult.public_id,

        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (err) {
      // Meta failed after Cloudinary succeeded.
      // Remove the orphaned Cloudinary asset.
      if (cloudinaryResult?.public_id) {
        try {
          await deleteFromCloudinary(
            cloudinaryResult.public_id,
            cloudinaryResult.resource_type || "image",
          );
        } catch (cleanupError) {
          console.error("[template.upload] Cloudinary cleanup failed", {
            publicId: cloudinaryResult.public_id,
            error: cleanupError.message,
          });
        }
      }

      throw err;
    }
  }

  /**
   * List templates for a tenant with search + status/category filters + pagination.
   * Returns the project's standard list envelope:
   *   { templates, totalTemplates, totalPages, currentPage }
   */
  async listTemplates(userId, options = {}) {
    const page = Math.max(
      parseInt(options.page, 10) || TEMPLATE_PAGINATION.DEFAULT_PAGE,
      1,
    );
    const limit = Math.min(
      Math.max(
        parseInt(options.limit, 10) || TEMPLATE_PAGINATION.DEFAULT_LIMIT,
        1,
      ),
      TEMPLATE_PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    // Tenant scope is ALWAYS applied first.
    const filter = { userId };

    if (options.status) filter.status = options.status;
    if (options.category) filter.category = options.category;

    if (options.search) {
      const rx = new RegExp(escapeRegex(options.search.trim()), "i");
      filter.$or = [{ name: rx }, { bodyText: rx }];
    }

    const [templates, totalTemplates] = await Promise.all([
      Template.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Template.countDocuments(filter),
    ]);

    return {
      templates,
      totalTemplates,
      totalPages: Math.ceil(totalTemplates / limit) || 0,
      currentPage: page,
    };
  }

  /** Fetch a single owned template (404 if not found OR not owned). */
  async getTemplate(userId, id) {
    const template = await Template.findOne({ _id: id, userId }).lean();
    if (!template) throw new ApiError(404, TEMPLATE_MESSAGES.NOT_FOUND);
    return template;
  }

  /**
   * Sync templates from Meta for the authenticated tenant.
   *
   * Flow:
   *   1. Load the tenant's WhatsApp connection (with the access token).
   *   2. Guard: connection must exist and be CONNECTED.
   *   3. Fetch templates from Meta's Graph API (or the mock data set).
   *   4. Upsert each by { userId, metaTemplateId } — existing rows are updated
   *      in place, new ones inserted, none duplicated.
   *   5. Stamp syncedAt on every touched row.
   *
   * Local audit fields (createdBy/updatedBy) are intentionally NOT included in
   * the $set below, so a sync never overwrites who locally authored/edited a
   * template — only Meta-owned fields are refreshed.
   *
   * Returns: { syncedAt, total, created, updated }
   */
  async syncTemplates(userId) {
    // Token needed only for the Graph call — opt in explicitly (select:false).
    const connection = await WhatsAppConnection.findOne({ userId }).select(
      "+accessToken",
    );
    if (!connection)
      throw new ApiError(404, TEMPLATE_MESSAGES.CONNECTION_NOT_FOUND);

    if (connection.status !== CONNECTION_STATUS.CONNECTED) {
      throw new ApiError(400, TEMPLATE_MESSAGES.CONNECTION_NOT_CONNECTED);
    }

    // Soft Meta dependency: mock in development, real Graph API otherwise.
    const rawTemplates = TEMPLATE_SYNC_MOCK
      ? this.#mockMetaTemplates()
      : await this.#fetchTemplatesFromMeta(
          connection.businessAccountId,
          connection.accessToken,
        );

    const syncedAt = new Date();

    // const mapped = rawTemplates
    //   .filter((t) => {
    //     if (t.name === "hello_world") return false;
    //     if (t.name.startsWith("jaspers_market_")) return false;
    //     return true;
    //   })
    //   .map((t) => this.#mapMetaTemplate(t))
    //   .filter((t) => t.metaTemplateId && t.name);

    // for developement only

    const mapped = rawTemplates
      .map((t) => this.#mapMetaTemplate(t))
      .filter((t) => {
        if (t.name.startsWith("jaspers_market_")) return false;
        return t.metaTemplateId && t.name;
      });

    if (!mapped.length) {
      const deletedResult = await Template.deleteMany({ userId });

      return {
        syncedAt,
        total: 0,
        created: 0,
        updated: 0,
        deleted: deletedResult.deletedCount || 0,
      };
    }

    // Idempotent upsert keyed on { userId, metaTemplateId }. Re-running a sync
    // never creates duplicates — it just refreshes existing rows.
    const ops = mapped.map((t) => ({
      updateOne: {
        filter: { userId, metaTemplateId: t.metaTemplateId },
        update: {
          $set: {
            whatsappConnectionId: connection._id,
            name: t.name,
            category: t.category,
            language: t.language,
            status: t.status,
            headerType: t.headerType,
            headerText: t.headerText,
            bodyText: t.bodyText,
            footerText: t.footerText,
            buttons: t.buttons,
            // Cleared to null whenever the current status isn't REJECTED, so a
            // stale reason never lingers after Meta re-approves a template.
            rejectionReason:
              t.status === TEMPLATE_STATUS.REJECTED ? t.rejectionReason : null,
            syncedAt,
          },
          $setOnInsert: { userId, metaTemplateId: t.metaTemplateId },
        },
        upsert: true,
      },
    }));

    const result = await Template.bulkWrite(ops, { ordered: false });

    // Remove templates that were deleted on Meta.
    const metaTemplateIds = mapped.map((t) => t.metaTemplateId);

    const deletedResult = await Template.deleteMany({
      userId,
      metaTemplateId: { $nin: metaTemplateIds },
    });

    const created = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const deleted = deletedResult.deletedCount || 0;

    return {
      syncedAt,
      total: mapped.length,
      created,
      updated,
      deleted,
    };
  }

  /**
   * Delete a template from the LOCAL database only. The corresponding template
   * is intentionally left untouched on Meta — a later sync would re-import it.
   */
  async deleteTemplate(userId, id) {
    const template = await Template.findOneAndDelete({ _id: id, userId });
    if (!template) throw new ApiError(404, TEMPLATE_MESSAGES.NOT_FOUND);
    return template;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Stand-in for Meta's POST /message_templates response, used when
   * TEMPLATE_SYNC_MOCK=true — same soft-dependency flag #mockMetaTemplates()
   * already uses for sync, so local development never requires a live,
   * review-approved Meta app just to exercise the create wizard end-to-end.
   */
  #mockMetaCreateResponse(payload) {
    return {
      metaTemplateId: `mock_local_${Date.now()}`,
      status: TEMPLATE_STATUS.PENDING,
      category: payload.category,
    };
  }

  /**
   * Normalize the wizard's button drafts ({ type, text, url, phoneNumber,
   * copyCode }) into the sub-schema shape. Already shape/limit-validated by
   * the createTemplate validator chain — this only normalizes casing and
   * drops fields that don't apply to a given button's type, so a URL button's
   * stray phoneNumber (etc.) never gets persisted.
   */
  #normalizeButtons(buttons) {
    if (!Array.isArray(buttons)) return [];

    return buttons.map((b) => {
      const type = String(b?.type || "").toUpperCase();
      return {
        type,
        text: b?.text || "",
        url: type === "URL" ? b?.url || null : null,
        phoneNumber: type === "PHONE_NUMBER" ? b?.phoneNumber || null : null,
        copyCode: type === "COPY_CODE" ? b?.copyCode || null : null,
      };
    });
  }

  /**
   * Call GET /{WABA_ID}/message_templates on the Graph API and return the raw
   * `data` array. Follows the same fetch/timeout/error pattern as the WhatsApp
   * connection verification.
   *
   * TODO(meta): paginate via `paging.next` when a tenant has more than
   *   META_TEMPLATES_PAGE_SIZE templates. The first page is sufficient for now
   *   and for all current test fixtures.
   */
  async #fetchTemplatesFromMeta(businessAccountId, accessToken) {
    const fields =
      "name,language,status,category,components,id,rejected_reason";
    const url =
      `${GRAPH_API_BASE_URL}/${businessAccountId}/message_templates` +
      `?fields=${fields}&limit=${META_TEMPLATES_PAGE_SIZE}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } catch (err) {
      throw new ApiError(
        502,
        `${TEMPLATE_MESSAGES.SYNC_FAILED}: ${err.message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));

    //debug log
    console.log("====== META RESPONSE ======");
    console.log(JSON.stringify(payload, null, 2));
    console.log("===========================");

    if (!response.ok) {
      const metaMessage = payload?.error?.message || `HTTP ${response.status}`;
      const statusCode =
        response.status === 401 || response.status === 403 ? 401 : 502;
      throw new ApiError(
        statusCode,
        `${TEMPLATE_MESSAGES.SYNC_FAILED}: ${metaMessage}`,
      );
    }

    return Array.isArray(payload.data) ? payload.data : [];
  }

  /**
   * Normalize one Meta template object into our schema shape.
   *
   * Meta returns content as a `components` array; we flatten the relevant pieces
   * into headerType / headerText / bodyText / footerText / buttons. Unknown header
   * formats fall back to NONE so a new Meta format can't produce an invalid document.
   */
  #mapMetaTemplate(raw = {}) {
    const components = Array.isArray(raw.components) ? raw.components : [];

    let headerType = TEMPLATE_HEADER_TYPE.NONE;
    let headerText = "";
    let bodyText = "";
    let footerText = "";
    let buttons = [];

    for (const component of components) {
      const type = String(component?.type || "").toUpperCase();

      if (type === "HEADER") {
        const format = String(component.format || "").toUpperCase();
        headerType = TEMPLATE_HEADER_TYPE_VALUES.includes(format)
          ? format
          : TEMPLATE_HEADER_TYPE.NONE;
        if (headerType === TEMPLATE_HEADER_TYPE.TEXT) {
          headerText = component.text || "";
        }
      } else if (type === "BODY") {
        bodyText = component.text || "";
      } else if (type === "FOOTER") {
        footerText = component.text || "";
      } else if (type === "BUTTONS") {
        const list = Array.isArray(component.buttons) ? component.buttons : [];
        buttons = list.map((b) => ({
          type: String(b?.type || "").toUpperCase(),
          text: b?.text || "",
          url: b?.url || null,
          phoneNumber: b?.phone_number || b?.phoneNumber || null,
          copyCode: b?.example || b?.copyCode || null,
        }));
      }
    }

    return {
      metaTemplateId: raw.id ? String(raw.id) : "",
      name: raw.name || "",
      category: raw.category,
      language: raw.language,
      status: raw.status,
      headerType,
      headerText,
      bodyText,
      footerText,
      buttons,
      rejectionReason: raw.rejected_reason ? String(raw.rejected_reason) : null,
    };
  }

  /**
   * In-memory stand-in for Meta's /message_templates response, shaped exactly
   * like the real API so #mapMetaTemplate handles it unchanged. Used when
   * TEMPLATE_SYNC_MOCK=true so the module is fully testable without a live WABA.
   *
   * TODO(meta): remove once Embedded Signup + a real approved-template set is
   *   wired up in the target environment.
   */
  #mockMetaTemplates() {
    return [
      {
        id: "mock_1000000000001",
        name: "order_confirmation",
        language: "en_US",
        status: "APPROVED",
        category: "UTILITY",
        components: [
          { type: "HEADER", format: "TEXT", text: "Order Confirmed" },
          {
            type: "BODY",
            text: "Hi {{1}}, your order {{2}} has been confirmed and will ship soon.",
          },
          { type: "FOOTER", text: "Thank you for shopping with us" },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "Track order",
                url: "https://example.com/track/{{1}}",
              },
              { type: "QUICK_REPLY", text: "Contact support" },
            ],
          },
        ],
      },
      {
        id: "mock_1000000000002",
        name: "summer_promo",
        language: "en_US",
        status: "APPROVED",
        category: "MARKETING",
        components: [
          { type: "HEADER", format: "IMAGE" },
          {
            type: "BODY",
            text: "Summer sale is here! Get {{1}}% off your next order.",
          },
          { type: "FOOTER", text: "Reply STOP to opt out" },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "Shop now",
                url: "https://example.com/sale",
              },
            ],
          },
        ],
      },
      {
        id: "mock_1000000000003",
        name: "login_code",
        language: "en_US",
        status: "APPROVED",
        category: "AUTHENTICATION",
        components: [
          {
            type: "BODY",
            text: "Your verification code is {{1}}. It expires in 10 minutes.",
          },
          {
            type: "BUTTONS",
            buttons: [
              { type: "COPY_CODE", text: "Copy Code", example: "123456" },
            ],
          },
        ],
      },
      {
        id: "mock_1000000000004",
        name: "feedback_request",
        language: "en_US",
        status: "PENDING",
        category: "MARKETING",
        components: [
          { type: "BODY", text: "How was your experience with us, {{1}}?" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Great" },
              { type: "QUICK_REPLY", text: "Could be better" },
            ],
          },
        ],
      },
      {
        id: "mock_1000000000005",
        name: "flash_sale_alert",
        language: "en_US",
        status: "REJECTED",
        category: "MARKETING",
        rejected_reason:
          "Contains promotional wording that violates WhatsApp commerce policy.",
        components: [
          {
            type: "BODY",
            text: "Flash sale! Everything must go, {{1}}. Shop now before it ends!",
          },
        ],
      },
    ];
  }
}

export default new TemplateService();
