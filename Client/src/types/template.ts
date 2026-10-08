// ── Enums (uppercase — verbatim match with backend / Meta) ──────────────────
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED";
export type TemplateHeaderType =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT";
export type TemplateButtonType =
  | "QUICK_REPLY"
  | "URL"
  | "PHONE_NUMBER"
  | "COPY_CODE";

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Authentication",
};

// UI-facing lowercase filter keys used by the listing page's status tabs.
export type TemplateStatusFilter =
  | ""
  | "approved"
  | "pending"
  | "rejected"
  | "paused";

export const TEMPLATE_STATUS_FILTERS: {
  key: TemplateStatusFilter;
  label: string;
}[] = [
  { key: "", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
];

// Meta locale tags offered when creating a template.
export const TEMPLATE_LANGUAGES: { value: string; label: string }[] = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "pt_BR", label: "Portuguese (BR)" },
  { value: "ar", label: "Arabic" },
];

// ── Button sub-shape (read-only — populated by Meta sync, never authored locally) ──
export interface TemplateButton {
  type: TemplateButtonType | string;
  text: string;
  url?: string | null;
}

// ── Button authoring (create wizard, Step 5) ─────────────────────────────────
export const TEMPLATE_BUTTON_TYPES: TemplateButtonType[] = [
  "QUICK_REPLY",
  "URL",
  "PHONE_NUMBER",
  "COPY_CODE",
];

export const TEMPLATE_BUTTON_TYPE_LABELS: Record<TemplateButtonType, string> = {
  QUICK_REPLY: "Quick Reply",
  URL: "Visit Website",
  PHONE_NUMBER: "Phone Number",
  COPY_CODE: "Copy Code",
};

// Meta's published per-type caps for message template buttons.
export const TEMPLATE_BUTTON_LIMITS: {
  maxTotal: number;
  maxPerType: Partial<Record<TemplateButtonType, number>>;
} = {
  maxTotal: 10,
  maxPerType: { URL: 2, PHONE_NUMBER: 1, COPY_CODE: 1 },
};

/** One row in the Buttons step. `id` is a client-only stable key for React lists / removal. */
export interface CreateTemplateButtonDraft {
  id: string;
  type: TemplateButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
  copyCode?: string;
}

// ── Core template record, as returned by GET /templates and GET /templates/:id ──
export interface ApiTemplate {
  _id: string;
  metaTemplateId: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  language: string;
  headerType: TemplateHeaderType;
  headerMediaUrl?: string | null;
  headerMediaPublicId?: string | null;
  bodyText: string;
  footerText: string;
  buttons: TemplateButton[];
  syncedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  /**
   * Not returned by the backend yet (no field on template.model.js). Typed
   * here — and rendered conditionally wherever it's shown — so the rejection
   * banner lights up the moment the backend starts populating it, without a
   * frontend change. Never fabricated: absent/undefined renders nothing.
   */
  rejectionReason?: string | null;
}

export interface TemplatesListData {
  templates: ApiTemplate[];
  totalTemplates: number;
  totalPages: number;
  currentPage: number;
}

export interface TemplatesResponse {
  success: boolean;
  message?: string;
  data: TemplatesListData;
}

export interface TemplateSyncResult {
  syncedAt: string;
  total: number;
  created: number;
  updated: number;
}

// ── Create payload — sent to POST /templates ─────────────────────────────────
// Every field here is now persisted by the backend and submitted to Meta's
// Graph API (see Server/src/modules/templates/template.meta.js).
export interface CreateTemplatePayload {
  name: string;
  category: TemplateCategory;
  language: string;
  bodyText: string;
  footerText?: string;
  headerType?: TemplateHeaderType;
  headerText?: string;
  /** Meta media handle for IMAGE/VIDEO/DOCUMENT headers, obtained beforehand from POST /templates/header-media. */
  headerMediaHandle?: string;
  headerMediaUrl?: string;
  headerMediaPublicId?: string;
  buttons?: {
    type: TemplateButtonType;
    text: string;
    url?: string;
    phoneNumber?: string;
    copyCode?: string;
  }[];
  /** Keyed by variable index as a string, e.g. { "1": "John", "2": "Order #12345" }. */
  exampleValues?: Record<string, string>;
}

// ── Create-wizard state (6 steps) ────────────────────────────────────────────
export type CreateTemplateStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface CreateTemplateStepMeta {
  step: CreateTemplateStep;
  title: string;
  description: string;
}

export const CREATE_TEMPLATE_STEPS: CreateTemplateStepMeta[] = [
  {
    step: 1,
    title: "Basic Information",
    description: "Name, category & language",
  },
  {
    step: 2,
    title: "Header",
    description: "Optional text, image, video or document",
  },
  { step: 3, title: "Body", description: "Message content & variables" },
  { step: 4, title: "Footer", description: "Optional footer text" },
  { step: 5, title: "Buttons", description: "Quick replies & call-to-actions" },
  {
    step: 6,
    title: "Preview & Submit",
    description: "Review and send for approval",
  },
];

export interface CreateTemplateFormState {
  name: string;
  category: TemplateCategory;
  language: string;
  headerType: TemplateHeaderType;
  headerText: string;
  /** Display-only filename for IMAGE/VIDEO/DOCUMENT headers — shown immediately on selection, before the upload resolves. */
  headerMediaFileName: string | null;
  /** Meta media handle returned by POST /templates/header-media once the file finishes uploading. Null while no file is selected or an upload is in progress/failed. */
  headerMediaHandle: string | null;
  headerMediaUrl: string | null;
  headerMediaPublicId: string | null;
  /**
   * Browser-local object URL for the selected file, used only to render the
   * live preview. Meta returns an opaque handle rather than a viewable link,
   * so without this the wizard can only ever show a filename. Never sent to
   * the API.
   */
  headerMediaPreviewUrl: string | null;
  bodyText: string;
  /** Keyed by variable index, e.g. { 1: "John", 2: "Order #12345" }. Drives the live phone preview. */
  exampleValues: Record<number, string>;
  footerText: string;
  buttons: CreateTemplateButtonDraft[];
}

export const INITIAL_CREATE_TEMPLATE_FORM: CreateTemplateFormState = {
  name: "",
  category: "MARKETING",
  language: "en_US",
  headerType: "NONE",
  headerText: "",
  headerMediaFileName: null,
  headerMediaHandle: null,
  headerMediaUrl: null,
  headerMediaPublicId: null,
  headerMediaPreviewUrl: null,
  bodyText: "",
  exampleValues: {},
  footerText: "",
  buttons: [],
};

export interface CreateTemplateFieldErrors {
  name?: string;
  category?: string;
  language?: string;
  header?: string;
  bodyText?: string;
  buttons?: string;
}

// ── Body-variable detection ({{1}}, {{2}}, ...) ──────────────────────────────
export interface DetectedVariable {
  index: number;
  token: string; // e.g. "{{1}}"
}

export interface VariableValidationResult {
  variables: DetectedVariable[];
  isSequential: boolean;
  /** The first missing index in the sequence, if any (e.g. 2 for {{1}}, {{3}}). */
  firstGapAt: number | null;
}

/**
 * Extracts {{n}} tokens from body text and checks that the distinct indices
 * found form a contiguous 1..n sequence with no gaps. Used by the Body step
 * for live validation and by the phone preview for variable placeholders.
 */
export function detectTemplateVariables(
  bodyText: string,
): VariableValidationResult {
  const matches = Array.from(bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g));
  const uniqueIndices = Array.from(
    new Set(matches.map((m) => parseInt(m[1], 10))),
  ).sort((a, b) => a - b);

  const variables: DetectedVariable[] = uniqueIndices.map((index) => ({
    index,
    token: `{{${index}}}`,
  }));

  let isSequential = true;
  let firstGapAt: number | null = null;
  for (let i = 0; i < uniqueIndices.length; i++) {
    const expected = i + 1;
    if (uniqueIndices[i] !== expected) {
      isSequential = false;
      firstGapAt = expected;
      break;
    }
  }

  return { variables, isSequential, firstGapAt };
}

// ── Badge tone mapping (maps to the .badge-* utility classes in index.css) ──
export type BadgeTone = "default" | "success" | "warning" | "error" | "info";

/**
 * Formats an ISO timestamp as a short relative string ("Just now", "5 mins
 * ago", "3 hours ago", "2 days ago"). Shared by the template list cards, the
 * preview panel, and the sync button's "Last synced" label so the wording is
 * consistent everywhere it's used. Returns null for a missing/invalid
 * timestamp so callers can decide their own fallback text.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  if (ms < 60_000) return "Just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const TEMPLATE_CATEGORY_TONE: Record<TemplateCategory, BadgeTone> = {
  MARKETING: "info",
  UTILITY: "success",
  AUTHENTICATION: "warning",
};

export const TEMPLATE_STATUS_TONE: Record<TemplateStatus, BadgeTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
  PAUSED: "default",
};
