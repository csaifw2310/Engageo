import api from "./client";
import type {
  ApiTemplate,
  TemplateButton,
  TemplateCategory,
  TemplateHeaderType,
  TemplateStatus,
  TemplateStatusFilter,
  TemplateSyncResult,
  TemplatesListData,
  CreateTemplatePayload,
} from "../types/template";

/**
 * Resource API layer.
 *
 * These services talk to the real Engageo backend. The backend wraps every
 * successful response in the envelope { success, message, data } (see
 * utils/ApiResponse.js), and list endpoints return their rows alongside
 * pagination counters inside `data`, e.g.
 *   { contacts, totalContacts, totalPages, currentPage }.
 *
 * Where the backend field names differ from what the UI components expect, the
 * translation happens HERE (in small map* helpers) so the page JSX stays
 * untouched and visually identical. The UI-facing field names are kept stable.
 */

// ── Generic envelope ───────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ── Contacts ───────────────────────────────────────────────────────────────────
// Backend contact: { _id, name, phoneNumber, email, tags, status:'active'|'inactive', createdAt }
// UI keeps `phone` as the display field; we translate to/from `phoneNumber`.
export interface ApiContact {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  status: "active" | "inactive" | "blocked";
  groupId?: string;
  createdAt: string;
  lastMessageAt?: string;
}

interface RawContact {
  _id: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
  tags?: string[];
  status: "active" | "inactive";
  createdAt: string;
}

const mapContact = (c: RawContact): ApiContact => ({
  _id: c._id,
  name: c.name,
  phone: c.phoneNumber,
  email: c.email ?? undefined,
  tags: c.tags ?? [],
  status: c.status,
  createdAt: c.createdAt,
});

export interface ContactListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  tag?: string;
  sort?: string;
}

export interface ContactsResponse {
  success: boolean;
  message?: string;
  data: {
    contacts: ApiContact[];
    totalContacts: number;
    totalPages: number;
    currentPage: number;
  };
}

export const contactsApi = {
  list: (params?: ContactListQuery) =>
    api
      .get<{
        success: boolean;
        message?: string;
        data: {
          contacts: RawContact[];
          totalContacts: number;
          totalPages: number;
          currentPage: number;
        };
      }>("/contacts", { params })
      .then(
        (r): ContactsResponse => ({
          ...r.data,
          data: {
            ...r.data.data,
            contacts: (r.data.data.contacts ?? []).map(mapContact),
          },
        }),
      ),

  get: (id: string) =>
    api
      .get<{ success: boolean; data: RawContact }>(`/contacts/${id}`)
      .then((r) => ({
        success: r.data.success,
        data: mapContact(r.data.data),
      })),

  create: (data: Partial<ApiContact>) =>
    api
      .post<{ success: boolean; data: RawContact }>("/contacts", {
        name: data.name,
        phoneNumber: data.phone,
        email: data.email || undefined,
        tags: data.tags ?? [],
        status: data.status === "inactive" ? "inactive" : "active",
      })
      .then((r) => ({
        success: r.data.success,
        data: mapContact(r.data.data),
      })),

  update: (id: string, data: Partial<ApiContact>) => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.phone !== undefined) payload.phoneNumber = data.phone;
    if (data.email !== undefined) payload.email = data.email || null;
    if (data.tags !== undefined) payload.tags = data.tags;
    if (data.status !== undefined)
      payload.status = data.status === "inactive" ? "inactive" : "active";
    return api
      .patch<{ success: boolean; data: RawContact }>(`/contacts/${id}`, payload)
      .then((r) => ({
        success: r.data.success,
        data: mapContact(r.data.data),
      }));
  },

  delete: (id: string) => api.delete(`/contacts/${id}`).then((r) => r.data),

  importCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post("/contacts/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  export: () =>
    api.get("/contacts/export", { responseType: "blob" }).then((r) => r.data),
};

// ── Groups ─────────────────────────────────────────────────────────────────────
export interface ApiGroup {
  _id: string;
  name: string;
  description?: string;
  contactCount: number;
  createdAt: string;
}

export interface GroupsResponse {
  success: boolean;
  message?: string;
  data: {
    groups: ApiGroup[];
    totalGroups: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface GroupMembersPage {
  contacts: ApiContact[];
  totalContacts: number;
  totalPages: number;
  currentPage: number;
}

/** These endpoints aggregate straight off the contacts collection, so rows
 *  arrive in raw schema shape (phoneNumber) and need the same mapping the
 *  contacts endpoints get. */
interface RawGroupMembersPage {
  contacts: RawContact[];
  totalContacts: number;
  totalPages: number;
  currentPage: number;
}

const mapMembersPage = (
  res: ApiResponse<RawGroupMembersPage>,
): ApiResponse<GroupMembersPage> => ({
  ...res,
  data: {
    ...res.data,
    contacts: (res.data?.contacts ?? []).map(mapContact),
  },
});

export interface BulkAddResult {
  added: number;
  /** Already in the group — reported rather than treated as a failure. */
  skipped: number;
  /** Ids that didn't resolve to a contact owned by this tenant. */
  invalid: number;
}

export interface BulkRemoveResult {
  removed: number;
}

export const groupsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<GroupsResponse>("/groups", { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<ApiResponse<ApiGroup>>(`/groups/${id}`).then((r) => r.data),

  create: (data: { name: string; description?: string }) =>
    api.post<ApiResponse<ApiGroup>>("/groups", data).then((r) => r.data),

  update: (id: string, data: Partial<ApiGroup>) =>
    api.patch<ApiResponse<ApiGroup>>(`/groups/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/groups/${id}`).then((r) => r.data),

  // ── Membership, paged + searchable server-side ─────────────────────────
  // The picker must never load the whole contact book to work out what's
  // addable, so both sides are queried per page with the search applied on
  // the server.
  members: (
    groupId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) =>
    api
      .get<ApiResponse<RawGroupMembersPage>>(`/groups/${groupId}/members`, {
        params,
      })
      .then((r) => mapMembersPage(r.data)),

  availableContacts: (
    groupId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) =>
    api
      .get<
        ApiResponse<RawGroupMembersPage>
      >(`/groups/${groupId}/available-contacts`, { params })
      .then((r) => mapMembersPage(r.data)),

  // Bulk add/remove. Pass explicit ids, or { all: true, search } to act on
  // every contact matching the current search without the client having to
  // enumerate them.
  addMembers: (
    groupId: string,
    payload: { contactIds?: string[]; all?: boolean; search?: string },
  ) =>
    api
      .post<ApiResponse<BulkAddResult>>(`/groups/${groupId}/members`, payload)
      .then((r) => r.data),

  removeMembers: (
    groupId: string,
    payload: { contactIds?: string[]; all?: boolean; search?: string },
  ) =>
    api
      .delete<ApiResponse<BulkRemoveResult>>(`/groups/${groupId}/members`, {
        data: payload,
      })
      .then((r) => r.data),

  // Single-contact membership, kept for callers that act on one row.
  assignContact: (groupId: string, contactId: string) =>
    api.post(`/groups/${groupId}/contacts/${contactId}`).then((r) => r.data),

  removeContact: (groupId: string, contactId: string) =>
    api.delete(`/groups/${groupId}/contacts/${contactId}`).then((r) => r.data),
};

// ── Templates ──────────────────────────────────────────────────────────────────
// POST /templates (create) now persists everything the wizard collects and
// submits the built payload to Meta's Graph API — Meta remains the source of
// truth (see Server/src/modules/templates/template.service.js +
// template.meta.js). POST /templates/sync remains the path that refreshes
// status/quality/rejection data from Meta on an ongoing basis. Domain types
// live in ../types/template so every template-feature file shares one
// definition of the shape.
//
// Backend document (lean()):
//   { _id, userId, whatsappConnectionId, metaTemplateId, name, category,
//     language, status, headerType, headerText, headerMediaHandle, bodyText,
//     exampleValues, footerText, buttons, rejectionReason, syncedAt,
//     createdBy, updatedBy, createdAt, updatedAt }
// This already matches ApiTemplate field-for-field (including case), so the
// mapper below is a defensive normalize step rather than a translation layer.
interface RawTemplate {
  _id: string;
  metaTemplateId?: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  language?: string;
  headerType?: TemplateHeaderType;
  bodyText?: string;
  footerText?: string;
  buttons?: TemplateButton[];
  syncedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  rejectionReason?: string | null;
}

const mapTemplate = (t: RawTemplate): ApiTemplate => ({
  _id: t._id,
  metaTemplateId: t.metaTemplateId ?? "",
  name: t.name,
  category: t.category,
  status: t.status,
  language: t.language ?? "",
  headerType: t.headerType ?? "NONE",
  bodyText: t.bodyText ?? "",
  footerText: t.footerText ?? "",
  buttons: t.buttons ?? [],
  syncedAt: t.syncedAt ?? null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  rejectionReason: t.rejectionReason ?? null,
});

interface RawTemplatesListData {
  templates: RawTemplate[];
  totalTemplates: number;
  totalPages: number;
  currentPage: number;
}

export const templatesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: TemplateStatusFilter;
    category?: TemplateCategory | "";
  }) => {
    // UI status tabs use lowercase keys ('approved' | 'pending' | ...);
    // the backend enum is uppercase. Category is already uppercase in the UI
    // (it's typed as TemplateCategory end-to-end), so it's sent as-is.
    const q: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      category?: string;
    } = {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      category: params?.category || undefined,
    };
    if (params?.status) q.status = params.status.toUpperCase();

    return api
      .get<{
        success: boolean;
        message?: string;
        data: RawTemplatesListData;
      }>("/templates", { params: q })
      .then((r) => ({
        success: r.data.success,
        message: r.data.message,
        data: {
          ...r.data.data,
          templates: (r.data.data.templates ?? []).map(mapTemplate),
        } satisfies TemplatesListData,
      }));
  },

  get: (id: string) =>
    api
      .get<{ success: boolean; data: RawTemplate }>(`/templates/${id}`)
      .then((r) => ({
        success: r.data.success,
        data: mapTemplate(r.data.data),
      })),

  // Forwards the full CreateTemplatePayload as-is — the backend now persists
  // every field (headerType/headerText/headerMediaHandle/buttons/
  // exampleValues included) and submits it to Meta's Graph API.
  create: (data: CreateTemplatePayload) =>
    api
      .post<{
        success: boolean;
        message?: string;
        data: RawTemplate;
      }>("/templates", data)
      .then((r) => ({
        success: r.data.success,
        message: r.data.message,
        data: mapTemplate(r.data.data),
      })),

  // Pull the latest approved templates from the connected WhatsApp account.
  sync: () =>
    api
      .post<{
        success: boolean;
        message?: string;
        data: TemplateSyncResult;
      }>("/templates/sync")
      .then((r) => r.data),

  // Uploads an IMAGE/VIDEO/DOCUMENT header sample to Meta and returns the
  // media handle to carry into the create payload as `headerMediaHandle`.
  // Called from StepHeader.tsx as soon as a file is selected.
  uploadHeaderMedia: (file: File, headerType: TemplateHeaderType) => {
    const form = new FormData();
    form.append("file", file);
    form.append("headerType", headerType);
    return api
      .post<{
        success: boolean;
        message?: string;
        data: {
          headerType: TemplateHeaderType;
          headerMediaHandle: string;
          headerMediaUrl: string;
          headerMediaPublicId: string;
          fileName: string;
          mimeType: string;
          size: number;
        };
      }>("/templates/header-media", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  delete: (id: string) =>
    api
      .delete<{ success: boolean; message?: string }>(`/templates/${id}`)
      .then((r) => r.data),
};

// ── Campaigns ──────────────────────────────────────────────────────────────────
// Backend campaign: { _id, name, templateId, groupIds, status (UPPERCASE),
//   scheduledAt, launchedAt, completedAt, totalRecipients, totalSent,
//   totalDelivered, totalRead, totalFailed, createdAt }
export interface ApiCampaign {
  _id: string;
  name: string;
  templateId: string;
  templateName?: string;

  status:
    | "DRAFT"
    | "SCHEDULED"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";

  scheduledAt?: string;
  launchedAt?: string;
  completedAt?: string;

  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;

  createdAt: string;
}

interface RawCampaign {
  _id: string;
  name: string;
  templateId: string;
  templateName?: string;

  status: string;

  scheduledAt?: string;
  launchedAt?: string;
  completedAt?: string;

  totalRecipients?: number;
  totalSent?: number;
  totalDelivered?: number;
  totalRead?: number;
  totalFailed?: number;

  createdAt: string;
}

// Backend RUNNING maps to the UI's "sending" badge; everything else lowercases cleanly.
const mapCampaignStatus = (s: string): ApiCampaign["status"] => {
  const v = (s ?? "").toUpperCase();

  switch (v) {
    case "DRAFT":
    case "SCHEDULED":
    case "RUNNING":
    case "COMPLETED":
    case "FAILED":
    case "CANCELLED":
      return v as ApiCampaign["status"];

    default:
      return "DRAFT";
  }
};

const mapCampaign = (c: RawCampaign): ApiCampaign => ({
  _id: c._id,
  name: c.name,
  templateId: c.templateId,
  templateName: c.templateName,

  status: mapCampaignStatus(c.status),

  scheduledAt: c.scheduledAt,
  launchedAt: c.launchedAt,
  completedAt: c.completedAt,

  totalRecipients: c.totalRecipients ?? 0,
  totalSent: c.totalSent ?? 0,
  totalDelivered: c.totalDelivered ?? 0,
  totalRead: c.totalRead ?? 0,
  totalFailed: c.totalFailed ?? 0,

  createdAt: c.createdAt,
});

export interface CampaignsResponse {
  success: boolean;
  message?: string;
  data: {
    campaigns: ApiCampaign[];
    totalCampaigns: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface CreateCampaignPayload {
  name: string;
  templateId: string;
  groupIds: string[];
  description?: string;
  scheduledAt?: string;
}

export const campaignsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const q = { ...params };
    if (q.status) q.status = q.status.toUpperCase();
    return api
      .get<{
        success: boolean;
        message?: string;
        data: {
          campaigns: RawCampaign[];
          totalCampaigns: number;
          totalPages: number;
          currentPage: number;
        };
      }>("/campaigns", { params: q })
      .then(
        (r): CampaignsResponse => ({
          ...r.data,
          data: {
            ...r.data.data,
            campaigns: (r.data.data.campaigns ?? []).map(mapCampaign),
          },
        }),
      );
  },

  get: (id: string) =>
    api
      .get<{ success: boolean; data: RawCampaign }>(`/campaigns/${id}`)
      .then((r) => ({
        success: r.data.success,
        data: mapCampaign(r.data.data),
      })),

  create: (data: CreateCampaignPayload) =>
    api
      .post<{ success: boolean; data: RawCampaign }>("/campaigns", data)
      .then((r) => ({
        success: r.data.success,
        data: mapCampaign(r.data.data),
      })),

  update: (id: string, data: Partial<CreateCampaignPayload>) =>
    api
      .patch<{ success: boolean; data: RawCampaign }>(`/campaigns/${id}`, data)
      .then((r) => ({
        success: r.data.success,
        data: mapCampaign(r.data.data),
      })),

  delete: (id: string) => api.delete(`/campaigns/${id}`).then((r) => r.data),

  schedule: (id: string, scheduledAt: string) =>
    api.post(`/campaigns/${id}/schedule`, { scheduledAt }).then((r) => r.data),

  launch: (id: string) =>
    api.post(`/campaigns/${id}/launch`).then((r) => r.data),

  cancel: (id: string) =>
    api.post(`/campaigns/${id}/cancel`).then((r) => r.data),
};

// ── Messages ───────────────────────────────────────────────────────────────────
// Backend message: { _id, campaignId, contactId, content, status (UPPERCASE),
//   sentAt, deliveredAt, readAt, failedAt, createdAt }
export interface ApiMessage {
  _id: string;

  campaignId?: string;
  campaignName?: string;

  contactId: string;
  contactName?: string;
  phone?: string;

  content: string;

  status: "pending" | "queued" | "sent" | "delivered" | "read" | "failed";

  direction: "outbound" | "inbound";

  createdAt: string;

  // mapMessage() has always returned these three, but they were never
  // declared — which made `npm run typecheck` fail on the object literal.
  messageType?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  durationSec?: number;
}

interface RawMessage {
  _id: string;

  campaignId?: {
    _id: string;
    name: string;
  };

  contactId?: {
    _id: string;
    name: string;
    phoneNumber: string;
  };

  content?: string;
  status: string;
  createdAt: string;

  // same as content/status
  messageType?: string;
  mediaUrl?: string;
  fileName?: string | null;
  fileSize?: number | null;
  durationSec?: number | null;
}
const mapMessage = (m: RawMessage): ApiMessage => ({
  _id: m._id,

  campaignId: m.campaignId?._id,
  campaignName: m.campaignId?.name,

  contactId: m.contactId?._id ?? "",
  contactName: m.contactId?.name,
  phone: m.contactId?.phoneNumber,

  content: m.content ?? "",

  status: ((m.status ?? "").toLowerCase() as ApiMessage["status"]) || "pending",

  direction: "outbound",

  createdAt: m.createdAt,

  messageType: m.messageType,
  mediaUrl: m.mediaUrl ?? undefined,
  fileName: m.fileName ?? undefined,
  fileSize: m.fileSize ?? undefined,
  durationSec: m.durationSec ?? undefined,
});

export interface MessagesResponse {
  success: boolean;
  message?: string;
  data: {
    messages: ApiMessage[];
    totalMessages: number;
    totalPages: number;
    currentPage: number;
    messageType?: string;
    mediaUrl?: string;
    durationSec?: number;
  };
}

export const messagesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    campaignId?: string;
  }) => {
    const q = { ...params };
    if (q.status) q.status = q.status.toUpperCase();
    return api
      .get<{
        success: boolean;
        message?: string;
        data: {
          messages: RawMessage[];
          totalMessages: number;
          totalPages: number;
          currentPage: number;
        };
      }>("/messages", { params: q })
      .then(
        (r): MessagesResponse => ({
          ...r.data,
          data: {
            ...r.data.data,
            messages: (r.data.data.messages ?? []).map(mapMessage),
          },
        }),
      );
  },

  get: (id: string) =>
    api
      .get<{ success: boolean; data: RawMessage }>(`/messages/${id}`)
      .then((r) => ({
        success: r.data.success,
        data: mapMessage(r.data.data),
      })),

  // Retry a single failed message (backend: POST /messages/retry/:messageId).
  retry: (id: string) => api.post(`/messages/retry/${id}`).then((r) => r.data),
};

// ── Conversations (WhatsApp inbox) ──────────────────────────────────────────────
export interface ApiConversation {
  _id: string;
  phoneNumber: string;
  displayName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  status: "open" | "resolved";
}

export interface ApiConversationMessage {
  _id: string;
  content: string;
  direction: "inbound" | "outbound";
  status: string;
  createdAt: string;
}

export const conversationsApi = {
  list: () => api.get("/conversations").then((r) => r.data),

  getMessages: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/conversations/${id}/messages`, { params }).then((r) => r.data),

  markRead: (id: string) =>
    api.post(`/conversations/${id}/read`).then((r) => r.data),

  findOrCreate: (payload: { phoneNumber: string; displayName?: string }) =>
    api.post("/conversations", payload).then((r) => r.data),

  sendMessage: (
    id: string,
    content: string,
    media?: {
      mediaUrl: string;
      mediaType: string;
      durationSec?: number;
      /**
       * Original filename. Required for `document` sends — without it the
       * recipient's WhatsApp shows the Cloudinary public_id as the document
       * name instead of e.g. "Ravi_Pariyar_Resume.pdf".
       */
      filename?: string;
      /** Bytes — persisted so the document card can show "PDF · 245 KB". */
      fileSize?: number;
    } | null,
  ) =>
    api
      .post(`/conversations/${id}/messages`, {
        content,
        ...(media
          ? {
              mediaUrl: media.mediaUrl,
              mediaType: media.mediaType,
              ...(media.durationSec !== undefined
                ? { durationSec: media.durationSec }
                : {}),
              ...(media.filename ? { filename: media.filename } : {}),
              ...(media.fileSize ? { fileSize: media.fileSize } : {}),
            }
          : {}),
      })
      .then((r) => r.data),

  // NEW — archive / unarchive (backend routes already exist)
  archive: (id: string) =>
    api.patch(`/conversations/${id}/archive`).then((r) => r.data),

  unarchive: (id: string) =>
    api.patch(`/conversations/${id}/unarchive`).then((r) => r.data),

  // NEW — internal notes (visible only to the tenant, never sent to the customer)
  updateNotes: (id: string, notes: string) =>
    api.patch(`/conversations/${id}/notes`, { notes }).then((r) => r.data),

  // NEW — persist an edited display name; syncs to the linked Contact too
  updateDisplayName: (id: string, displayName: string) =>
    api
      .patch(`/conversations/${id}/display-name`, { displayName })
      .then((r) => r.data),

  // Upload a recorded voice note blob to Cloudinary via the backend's
  // audio-only endpoint (tighter size cap than the general attach-file one).
  uploadVoiceNote: (blob: Blob, filename: string) => {
    const form = new FormData();
    form.append("file", blob, filename);
    return api
      .post("/media/upload/voice-note", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // Upload a file picked via the composer's attach button (image / video /
  // document) to Cloudinary. Hits the general 25MB endpoint rather than the
  // audio-only voice-note one. The returned `url` is what gets handed to the
  // Cloud API as the media `link`.
  uploadAttachment: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post("/media/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // NEW — mute notifications / sound (backend route already exists)
  updatePreferences: (
    id: string,
    prefs: { muteNotifications?: boolean; muteSound?: boolean },
  ) => api.patch(`/conversations/${id}/preferences`, prefs).then((r) => r.data),

  // NEW — check if a Contact already exists with this conversation's exact
  // phone number but isn't linked yet (returns null if none)
  findMatchingContact: (id: string) =>
    api.get(`/conversations/${id}/matching-contact`).then((r) => r.data),

  // NEW — link an existing contact to a conversation whose contactId is null.
  // Backend enforces exact phone-number match; this will reject mismatches.
  linkContact: (id: string, contactId: string) =>
    api
      .patch(`/conversations/${id}/link-contact`, { contactId })
      .then((r) => r.data),

  // NEW — create a brand-new contact (phone pre-filled server-side) and link it
  createAndLinkContact: (
    id: string,
    data: { name: string; email?: string; tags?: string[] },
  ) => api.post(`/conversations/${id}/contact`, data).then((r) => r.data),

  // NEW — soft "delete for me": hides one message from this user's view only.
  // Backend never removes the row (see Message.deletedFor), so this is safe
  // to call repeatedly and never affects the other party's copy.
  deleteMessage: (conversationId: string, messageId: string) =>
    api
      .delete(`/conversations/${conversationId}/messages/${messageId}`)
      .then((r) => r.data),
};

// ── Saved Replies (nested under /conversations on the backend) ────────────────
export interface ApiSavedReply {
  _id: string;
  title: string;
  body: string;
  createdAt: string;
}

export const savedRepliesApi = {
  list: () =>
    api
      .get<{
        success: boolean;
        data: ApiSavedReply[];
      }>("/conversations/saved-replies")
      .then((r) => r.data),

  create: (title: string, body: string) =>
    api
      .post<{
        success: boolean;
        data: ApiSavedReply;
      }>("/conversations/saved-replies", { title, body })
      .then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/conversations/saved-replies/${id}`).then((r) => r.data),
};
