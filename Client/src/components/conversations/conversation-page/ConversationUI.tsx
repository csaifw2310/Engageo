import type React from "react";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  Search,
  X,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  Pin,
  Archive,
  Download,
  UserPlus,
  BellOff,
  Trash2,
  Palette,
  Pencil,
  Plus,
  Save as SaveIcon,
  Command,
  Megaphone,
  CircleDot,
  StickyNote,
  CheckCircle2,
  Wifi,
  WifiOff,
  Hash,
  Zap,
  Crown,
  UserCog,
  Flame,
  Sun,
  Snowflake,
  Trophy,
  FileText,
  Star,
  Gem,
  Handshake,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  PhoneCall,
  Flag,
  CreditCard,
  Wallet,
  RotateCw,
  Truck,
  XCircle,
  Undo2,
} from "lucide-react";
import type {
  Conversation,
  ConversationFilter,
  SavedReply,
  Toast,
  HeaderActionKey,
} from "../../../types/conversation";
import AppearanceSelector, {
  type ChatAppearanceKey,
} from "../AppearanceSelector";
import {
  fmtRelative,
  type IconType,
  type CSS,
  type Profile,
  type SetProfile,
  type PillTone,
  type FilterDef,
} from "./ConversationLogic";

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS

   NOTE: All global CSS (theme tokens, appearance presets, glass-surface,
   keyframes, utility classes, responsive rules) now lives in index.css.
   The GlobalStyles() component that used to render a <style> tag here has
   been removed — remove any remaining `<GlobalStyles />` call at your app
   root, it's no longer exported from this file.
───────────────────────────────────────────────────────────────────────────── */
export const C = {
  base: "var(--c-base)",
  surface0: "var(--c-surface0)",
  surface1: "var(--c-surface1)",
  surface2: "var(--c-surface2)",
  surface3: "var(--c-surface3)",
  surface4: "var(--c-surface4)",
  border0: "var(--c-border0)",
  border1: "var(--c-border1)",
  border2: "var(--c-border2)",
  border3: "var(--c-border3)",
  accent: "var(--c-accent)",
  accentHover: "var(--c-accent-hover)",
  accentDim: "var(--c-accent-dim)",
  accentText: "var(--c-accent-text)",
  violet: "var(--c-violet)",
  violetDim: "var(--c-violet-dim)",
  violetText: "var(--c-violet-text)",
  success: "var(--c-success)",
  successDim: "var(--c-success-dim)",
  successText: "var(--c-success-text)",
  warning: "var(--c-warning)",
  warningDim: "var(--c-warning-dim)",
  warningText: "var(--c-warning-text)",
  danger: "var(--c-danger)",
  dangerDim: "var(--c-danger-dim)",
  dangerText: "var(--c-danger-text)",
  info: "var(--c-info)",
  infoDim: "var(--c-info-dim)",
  infoText: "var(--c-info-text)",
  text0: "var(--c-text0)",
  text1: "var(--c-text1)",
  text2: "var(--c-text2)",
  text3: "var(--c-text3)",
  hover: "var(--c-hover)",
  hoverStrong: "var(--c-hover-strong)",
  bubbleOut: "var(--c-bubble-out)",
  bubbleOutBorder: "var(--c-bubble-out-border)",
  bubbleOutText: "var(--c-bubble-out-text)",
  bubbleIn: "var(--c-bubble-in)",
  bubbleInBorder: "var(--c-bubble-in-border)",
  bubbleInText: "var(--c-bubble-in-text)",
  wall: "var(--c-wall)",
  brand: "var(--c-brand)",
};

export const FONT = `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif`;

/* ─────────────────────────────────────────────────────────────────────────────
   AMBIENT PARTICLES — purely decorative floating dots for the sidebar header,
   matching Bolt's reference design. No state, no logic, just visual flourish.
───────────────────────────────────────────────────────────────────────────── */
const PARTICLE_SPECS = [
  { left: "12%", size: 3, duration: 26, delay: 0, opacity: 0.35 },
  { left: "34%", size: 2, duration: 32, delay: 6, opacity: 0.25 },
  { left: "58%", size: 4, duration: 29, delay: 3, opacity: 0.3 },
  { left: "76%", size: 2, duration: 35, delay: 10, opacity: 0.22 },
  { left: "90%", size: 3, duration: 24, delay: 14, opacity: 0.3 },
];
function AmbientParticles() {
  return (
    <>
      {PARTICLE_SPECS.map((p, i) => (
        <span
          key={i}
          className="aurora-particle"
          style={{
            left: p.left,
            bottom: "-6%",
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRIMITIVES
───────────────────────────────────────────────────────────────────────────── */
export function Avatar({
  name = "",
  size = 36,
  ring = false,
  online = false,
}: {
  name?: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
}) {
  const letter = (name || "?")[0]?.toUpperCase() || "?";
  let h = 0;
  for (let i = 0; i < (name || "").length; i++)
    h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = ((h % 120) + 200 + 360) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: size * 0.37,
        color: "rgba(255,255,255,0.92)",
        background: `linear-gradient(145deg, hsl(${hue},40%,28%), hsl(${(hue + 25) % 360},50%,36%))`,
        boxShadow: ring
          ? `0 0 0 2px ${C.surface0}, 0 0 0 3.5px var(--c-theme-solid, ${C.accent})`
          : `0 1px 3px rgba(0,0,0,.5)`,
      }}
    >
      {letter}
      {online && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            right: 1,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: "50%",
            background: C.success,
            border: `2px solid ${C.surface0}`,
          }}
        />
      )}
    </div>
  );
}

export function IconBtn({
  icon: Icon,
  onClick,
  title,
  size = 14,
  active = false,
  danger = false,
  disabled = false,
  style: sx = {},
}: {
  icon: IconType;
  onClick?: () => void;
  title?: string;
  size?: number;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  style?: CSS;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`icon-btn${active ? " active" : ""}${danger ? " danger" : ""}`}
      style={{
        width: 30,
        height: 30,
        color: active ? C.accentText : C.text1,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
        ...sx,
      }}
    >
      <Icon style={{ width: size, height: size }} />
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
  size = "sm",
}: {
  children: React.ReactNode;
  tone?: PillTone;
  size?: "sm" | "md";
}) {
  const t = {
    neutral: { bg: "rgba(255,255,255,0.06)", fg: C.text1 },
    accent: { bg: C.accentDim, fg: C.accentText },
    violet: { bg: C.violetDim, fg: C.violetText },
    success: { bg: C.successDim, fg: C.successText },
    danger: { bg: C.dangerDim, fg: C.dangerText },
    warning: { bg: C.warningDim, fg: C.warningText },
    info: { bg: C.infoDim, fg: C.infoText },
  }[tone] || { bg: "rgba(255,255,255,0.06)", fg: C.text1 };
  return (
    <span
      className="pill"
      style={{
        background: t.bg,
        color: t.fg,
        fontSize: size === "sm" ? 10.5 : 11.5,
      }}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAG BADGE SYSTEM — maps a tag's text to an icon + color so different tag
   *categories* (role, lead-stage, customer-tier, support-state, order-state)
   are instantly recognizable at a glance, not just colored text.
   Rules are checked top-to-bottom, first match wins — more specific phrases
   (e.g. "hot lead") are listed before their generic parent ("lead").
───────────────────────────────────────────────────────────────────────────── */
interface TagRule {
  match: (t: string) => boolean;
  icon: IconType;
  tone: PillTone;
}

const TAG_RULES: TagRule[] = [
  // ── Role / seniority ──────────────────────────────────────────────
  {
    match: (t) => /owner|ceo|founder|leader|director/.test(t),
    icon: Crown,
    tone: "warning",
  },
  {
    match: (t) => /employee|staff|member|team/.test(t),
    icon: UserCog,
    tone: "info",
  },

  // ── Lead pipeline ─────────────────────────────────────────────────
  { match: (t) => /hot lead/.test(t), icon: Flame, tone: "danger" },
  { match: (t) => /warm lead/.test(t), icon: Sun, tone: "warning" },
  { match: (t) => /cold lead/.test(t), icon: Snowflake, tone: "neutral" },
  { match: (t) => /qualified/.test(t), icon: CheckCircle2, tone: "violet" },
  { match: (t) => /proposal sent/.test(t), icon: FileText, tone: "warning" },
  { match: (t) => /^won$|deal won/.test(t), icon: Trophy, tone: "success" },
  { match: (t) => /^lost$|deal lost/.test(t), icon: XCircle, tone: "danger" },
  { match: (t) => /^lead$/.test(t), icon: CircleDot, tone: "accent" },

  // ── Customer tier ─────────────────────────────────────────────────
  { match: (t) => /^vip$/.test(t), icon: Crown, tone: "warning" },
  { match: (t) => /premium/.test(t), icon: Star, tone: "accent" },
  { match: (t) => /enterprise/.test(t), icon: Gem, tone: "violet" },
  { match: (t) => /loyal/.test(t), icon: Handshake, tone: "success" },
  { match: (t) => /new customer/.test(t), icon: Sparkles, tone: "info" },
  { match: (t) => /returning/.test(t), icon: RefreshCw, tone: "accent" },

  // ── Support state ─────────────────────────────────────────────────
  { match: (t) => /urgent/.test(t), icon: AlertTriangle, tone: "danger" },
  {
    match: (t) => /pending/.test(t) && !/payment/.test(t),
    icon: Clock,
    tone: "warning",
  },
  { match: (t) => /resolved/.test(t), icon: CheckCircle2, tone: "success" },
  { match: (t) => /follow.?up/.test(t), icon: PhoneCall, tone: "info" },
  { match: (t) => /high priority/.test(t), icon: Flag, tone: "danger" },

  // ── Order / payment state ─────────────────────────────────────────
  { match: (t) => /^paid$/.test(t), icon: CreditCard, tone: "success" },
  { match: (t) => /payment pending/.test(t), icon: Wallet, tone: "warning" },
  { match: (t) => /processing/.test(t), icon: RotateCw, tone: "info" },
  { match: (t) => /shipped/.test(t), icon: Truck, tone: "accent" },
  { match: (t) => /cancelled|canceled/.test(t), icon: XCircle, tone: "danger" },
  { match: (t) => /refund/.test(t), icon: Undo2, tone: "warning" },
];

/* Deterministic fallback for tags that match no rule above — same hashing
   trick Avatar uses for hue, so an unmatched custom tag still gets a
   consistent (not random-per-render) color instead of always defaulting
   to plain gray. */
const FALLBACK_TONES: PillTone[] = [
  "accent",
  "violet",
  "success",
  "warning",
  "info",
];
function fallbackTone(tag: string): PillTone {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  return FALLBACK_TONES[Math.abs(h) % FALLBACK_TONES.length];
}

function getTagMeta(tag: string): {
  Icon: IconType;
  tone: PillTone;
  matched: boolean;
} {
  const t = tag.trim().toLowerCase();
  const rule = TAG_RULES.find((r) => r.match(t));
  return rule
    ? { Icon: rule.icon, tone: rule.tone, matched: true }
    : { Icon: Hash, tone: fallbackTone(tag), matched: false };
}

/* Premium tag badge — icon + label, tone-colored, slightly bolder than the
   generic Pill (used for campaign/label pills) so contact tags read as a
   distinct, higher-signal category in the conversation list and panel. */
export function TagBadge({
  tag,
  size = "sm",
  onRemove,
  hideFallbackIcon = false,
}: {
  tag: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  /** When true, tags that don't match a known category (Owner, VIP, Hot Lead,
      etc.) render without the generic "#" icon — used in the conversation
      list where space is tight and an unmatched icon reads as noise. The
      RightPanel keeps showing "#" for unmatched tags since there's more
      room and context there. */
  hideFallbackIcon?: boolean;
}) {
  const { Icon, tone, matched } = getTagMeta(tag);
  const showIcon = matched || !hideFallbackIcon;
  const t = {
    neutral: { bg: "rgba(255,255,255,0.06)", fg: C.text1, border: C.border1 },
    accent: {
      bg: C.accentDim,
      fg: C.accentText,
      border: "color-mix(in srgb, var(--c-accent) 35%, transparent)",
    },
    violet: {
      bg: C.violetDim,
      fg: C.violetText,
      border: "color-mix(in srgb, var(--c-violet) 35%, transparent)",
    },
    success: {
      bg: C.successDim,
      fg: C.successText,
      border: "color-mix(in srgb, var(--c-success) 35%, transparent)",
    },
    danger: {
      bg: C.dangerDim,
      fg: C.dangerText,
      border: "color-mix(in srgb, var(--c-danger) 35%, transparent)",
    },
    warning: {
      bg: C.warningDim,
      fg: C.warningText,
      border: "color-mix(in srgb, var(--c-warning) 35%, transparent)",
    },
    info: {
      bg: C.infoDim,
      fg: C.infoText,
      border: "color-mix(in srgb, var(--c-info) 35%, transparent)",
    },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: showIcon ? (size === "sm" ? 4 : 5) : 0,
        fontSize: size === "sm" ? 10.5 : 11.5,
        fontWeight: 600,
        padding: showIcon
          ? size === "sm"
            ? "3px 8px 3px 6px"
            : "4px 10px 4px 7px"
          : size === "sm"
            ? "3px 8px"
            : "4px 10px",
        borderRadius: 99,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        letterSpacing: ".01em",
      }}
    >
      {showIcon && Icon && (
        <Icon
          style={{
            width: size === "sm" ? 10 : 11,
            height: size === "sm" ? 10 : 11,
            flexShrink: 0,
          }}
        />
      )}
      {tag}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            marginLeft: 1,
          }}
        >
          <X style={{ width: 9, height: 9, opacity: 0.7 }} />
        </button>
      )}
    </span>
  );
}

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: C.text2,
          letterSpacing: ".07em",
          textTransform: "uppercase",
        }}
      >
        {children}
      </span>
      {action}
    </div>
  );
}

export function Divider({ margin = "8px 0" }: { margin?: string }) {
  return <div style={{ height: "1px", background: C.border1, margin }} />;
}

export function StatusDot({ s }: { s?: string }) {
  const v = String(s || "").toLowerCase();
  if (v === "sending" || v === "pending")
    return (
      <Clock style={{ opacity: 0.45, width: 12, height: 12, color: C.text2 }} />
    );
  if (v === "failed")
    return (
      <AlertCircle style={{ width: 12, height: 12, color: C.dangerText }} />
    );
  if (v === "read")
    return <CheckCheck style={{ width: 13, height: 13, color: C.infoText }} />;
  if (v === "delivered")
    return <CheckCheck style={{ width: 13, height: 13, color: C.text2 }} />;
  if (v === "sent" || v === "queued")
    return (
      <Check style={{ width: 13, height: 13, color: C.text2, opacity: 0.7 }} />
    );
  return null;
}

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? "Live — Socket.IO" : "Polling"}
      style={{ display: "flex", alignItems: "center", gap: 4 }}
    >
      {connected ? (
        <Wifi style={{ width: 12, height: 12, color: C.successText }} />
      ) : (
        <WifiOff style={{ width: 12, height: 12, color: C.text2 }} />
      )}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOAST STACK
───────────────────────────────────────────────────────────────────────────── */
export const ToastStack = memo(function ToastStack({
  toasts,
}: {
  toasts: Toast[];
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        right: 18,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        alignItems: "flex-end",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-toast"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 13px",
            borderRadius: 10,
            background: C.surface3,
            border: `1px solid ${t.tone === "danger" ? "rgba(239,68,68,0.22)" : C.border2}`,
            boxShadow: "0 8px 24px rgba(0,0,0,.45)",
            maxWidth: 280,
          }}
        >
          {t.tone === "danger" ? (
            <AlertCircle
              style={{
                width: 13,
                height: 13,
                color: C.dangerText,
                flexShrink: 0,
              }}
            />
          ) : (
            <CheckCircle2
              style={{
                width: 13,
                height: 13,
                color: C.successText,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontSize: 12, color: C.text0, lineHeight: 1.4 }}>
            {t.msg}
          </span>
        </div>
      ))}
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   COMMAND PALETTE
───────────────────────────────────────────────────────────────────────────── */
export function CommandPalette({
  open,
  onClose,
  conversations,
  savedReplies,
  onPick,
  onInsertReply,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  savedReplies: SavedReply[];
  onPick: (c: Conversation) => void;
  onInsertReply: (r: SavedReply) => void;
  onAction: (key: HeaderActionKey) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  const ql = q.trim().toLowerCase();
  const convMatches = ql
    ? conversations.filter((c) =>
        (c.displayName || c.phoneNumber || "").toLowerCase().includes(ql),
      )
    : conversations.slice(0, 5);
  const replyMatches = ql
    ? savedReplies.filter(
        (r) =>
          r.title.toLowerCase().includes(ql) ||
          r.body.toLowerCase().includes(ql),
      )
    : savedReplies;
  const actions = [
    {
      label: "Archive conversation",
      icon: Archive,
      run: () => onAction("archive"),
    },
    { label: "Mute conversation", icon: BellOff, run: () => onAction("mute") },
    { label: "Export chat", icon: Download, run: () => onAction("export") },
  ].filter((a) => !ql || a.label.toLowerCase().includes(ql));
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(5,5,7,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "center",
        paddingTop: "11vh",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-pop"
        style={{
          width: 560,
          maxHeight: "62vh",
          display: "flex",
          flexDirection: "column",
          background: C.surface3,
          border: `1px solid ${C.border2}`,
          borderRadius: 16,
          boxShadow: "0 40px 90px rgba(0,0,0,.65)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "13px 16px",
            borderBottom: `1px solid ${C.border1}`,
          }}
        >
          <Command style={{ width: 15, height: 15, color: C.text2 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations, saved replies, actions…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: C.text0,
              fontSize: 14,
              letterSpacing: "-.01em",
            }}
          />
          <Pill tone="neutral">Esc</Pill>
        </div>
        <div
          className="scroll"
          style={{ flex: 1, overflowY: "auto", padding: 6 }}
        >
          {convMatches.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 10.5,
                  color: C.text2,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  padding: "6px 10px",
                }}
              >
                Conversations
              </div>
              {convMatches.slice(0, 6).map((c) => (
                <button
                  key={c._id}
                  onClick={() => {
                    onPick(c);
                    onClose();
                  }}
                  className="menu-item"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    textAlign: "left",
                  }}
                >
                  <Avatar
                    name={c.displayName || c.phoneNumber || "?"}
                    size={24}
                  />
                  <span
                    style={{ fontSize: 13, color: C.text0, fontWeight: 500 }}
                  >
                    {c.displayName || c.phoneNumber}
                  </span>
                  <span
                    style={{ fontSize: 11, color: C.text2, marginLeft: "auto" }}
                  >
                    jump to →
                  </span>
                </button>
              ))}
            </div>
          )}
          {replyMatches.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 10.5,
                  color: C.text2,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  padding: "6px 10px",
                }}
              >
                Saved replies
              </div>
              {replyMatches.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onInsertReply(r);
                    onClose();
                  }}
                  className="menu-item"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    textAlign: "left",
                  }}
                >
                  <Zap
                    style={{
                      width: 13,
                      height: 13,
                      color: C.accentText,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: C.text0,
                        fontWeight: 500,
                      }}
                    >
                      {r.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.text2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.body}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {actions.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: C.text2,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  padding: "6px 10px",
                }}
              >
                Actions
              </div>
              {actions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => {
                    a.run();
                    onClose();
                  }}
                  className="menu-item"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    textAlign: "left",
                  }}
                >
                  <a.icon style={{ width: 13, height: 13, color: C.text1 }} />
                  <span style={{ fontSize: 12.5, color: C.text0 }}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          )}
          {convMatches.length === 0 &&
            replyMatches.length === 0 &&
            actions.length === 0 && (
              <div
                style={{
                  padding: "28px 10px",
                  textAlign: "center",
                  fontSize: 12.5,
                  color: C.text2,
                }}
              >
                No results for "{q}"
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEFT SIDEBAR
───────────────────────────────────────────────────────────────────────────── */
export const FILTERS: FilterDef[] = [
  { key: "all", label: "All", icon: MessageSquare },
  { key: "unread", label: "Unread", icon: CircleDot },
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "campaign", label: "Campaigns", icon: Megaphone },
  { key: "archived", label: "Archived", icon: Archive },
];

/* Conversation row typography hierarchy (polish pass):
   - Name:       15px / 600 — the primary scan target, gets full contrast
   - Preview:    13px / 400, dimmed to text2 — reads as secondary at a glance
   - Timestamp:  11px / 400, dimmed to text3 by default — only lifts to
                 success/500 when the row has unread messages, so it doesn't
                 compete with the name for attention */
const ConvListItem = memo(function ConvListItem({
  conv,
  active,
  pinned,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  pinned: boolean;
  onClick: () => void;
}) {
  const unread = (conv.unreadCount ?? 0) > 0;
  const contactTag =
    (typeof conv.contactId === "object"
      ? (conv.contactId as any)?.tags?.[0]
      : undefined) || null;
  return (
    <button
      onClick={onClick}
      className={`conv-row${active ? " active" : ""}`}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "11px 14px 11px 13px",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${C.border0}`,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <Avatar
        name={conv.displayName || conv.phoneNumber || "?"}
        size={44}
        online={conv.online}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.text0,
              letterSpacing: "-.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {pinned && (
              <Pin
                style={{ width: 10, height: 10, color: C.text2, flexShrink: 0 }}
              />
            )}
            {conv.displayName || conv.phoneNumber || "Unknown"}
          </span>
          <span
            style={{
              fontSize: 11,
              color: unread ? C.successText : C.text3,
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
              fontWeight: unread ? 500 : 400,
            }}
          >
            {conv.lastMessageAt ? fmtRelative(conv.lastMessageAt) : ""}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: conv.draft ? C.warningText : C.text2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              lineHeight: 1.4,
            }}
          >
            {conv.draft
              ? `Draft: ${conv.draft}`
              : conv.lastMessage || "No messages yet"}
          </span>
          {unread && (
            <span
              style={{
                flexShrink: 0,
                minWidth: 19,
                height: 19,
                borderRadius: 99,
                background: C.success,
                color: "#fff",
                fontSize: 10.5,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
              }}
            >
              {conv.unreadCount}
            </span>
          )}
        </div>
        {(conv.campaignTag || contactTag || (conv.labels?.length ?? 0) > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 5,
              flexWrap: "wrap",
            }}
          >
            {conv.campaignTag && (
              <Pill tone="info" size="sm">
                <Megaphone style={{ width: 9, height: 9 }} />
                {conv.campaignTag}
              </Pill>
            )}
            {contactTag && (
              <TagBadge tag={contactTag} size="sm" hideFallbackIcon />
            )}
            {conv.labels?.slice(0, 2).map((l) => (
              <Pill key={l} size="sm">
                {l}
              </Pill>
            ))}
          </div>
        )}
      </div>
    </button>
  );
});

export function LeftPanel({
  conversations,
  selectedId,
  onSelect,
  search,
  setSearch,
  filter,
  setFilter,
  pinnedIds,
  onOpenCommandPalette,
  collapsed,
  onOpenSettings,
}: {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (c: Conversation) => void;
  search: string;
  setSearch: (v: string) => void;
  filter: ConversationFilter;
  setFilter: (v: ConversationFilter) => void;
  pinnedIds: Set<string>;
  onOpenCommandPalette: () => void;
  collapsed: boolean;
  onOpenSettings?: () => void;
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => (c.unreadCount ?? 0) > 0).length,
      pinned: conversations.filter((c) => pinnedIds.has(c._id)).length,
      campaign: conversations.filter((c) => !!c.campaignTag).length,
      archived: conversations.filter((c) => c.archived).length,
    }),
    [conversations, pinnedIds],
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread")
      list = list.filter((c) => (c.unreadCount ?? 0) > 0);
    else if (filter === "pinned")
      list = list.filter((c) => pinnedIds.has(c._id));
    else if (filter === "campaign") list = list.filter((c) => !!c.campaignTag);
    else if (filter === "archived") list = list.filter((c) => c.archived);
    else list = list.filter((c) => !c.archived);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.displayName || "").toLowerCase().includes(s) ||
          (c.phoneNumber || "").includes(s),
      );
    }
    return [...list].sort(
      (a, b) => (pinnedIds.has(b._id) ? 1 : 0) - (pinnedIds.has(a._id) ? 1 : 0),
    );
  }, [conversations, filter, search, pinnedIds]);

  if (collapsed) {
    return (
      <div
        className="tr-panel panel-sidebar left-static"
        style={{
          width: 52,
          background: C.surface0,
          borderRight: `1px solid ${C.border1}`,
          alignItems: "center",
          paddingTop: 12,
          gap: 2,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: C.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
            flexShrink: 0,
          }}
        >
          <MessageSquare style={{ width: 14, height: 14, color: "#fff" }} />
        </div>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const cnt = counts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              title={f.label}
              className={`icon-btn${active ? " active" : ""}`}
              style={{
                width: 36,
                height: 36,
                position: "relative",
                color: active ? C.accentText : C.text2,
              }}
            >
              <f.icon style={{ width: 15, height: 15 }} />
              {cnt > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: C.accent,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="tr-panel panel-sidebar glass-surface left-static"
      style={{
        width: 320,
        borderRight: `1px solid ${C.border1}`,
        background: "color-mix(in srgb, var(--c-surface0) 72%, transparent)",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "10px 12px 10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          background: "color-mix(in srgb, var(--c-surface2) 70%, transparent)",
          borderBottom: `1px solid ${C.border1}`,
        }}
      >
        <AmbientParticles />
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: `linear-gradient(145deg, var(--c-theme-solid, ${C.brand}), ${C.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow:
              "var(--c-shadow-1), 0 0 14px -4px var(--c-theme-wash-soft, transparent)",
          }}
        >
          <MessageSquare style={{ width: 14, height: 14, color: "#fff" }} />
        </div>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: C.text0,
            letterSpacing: "-.02em",
            flex: 1,
          }}
        >
          engageo
        </span>
        <IconBtn
          icon={Palette}
          title="Appearance"
          onClick={onOpenSettings}
          size={15}
        />
        <button
          onClick={onOpenCommandPalette}
          title="Command palette"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 8px",
            background: C.surface0,
            border: `1px solid ${C.border1}`,
            borderRadius: 8,
            color: C.text2,
            fontSize: 10.5,
            cursor: "pointer",
          }}
        >
          <Command style={{ width: 10, height: 10 }} />K
        </button>
      </div>

      <div style={{ padding: "10px 12px 8px", flexShrink: 0 }}>
        {/* Search bar polish: was a flat, borderless pill that felt like a
            different visual language from the composer. Now it carries a
            real (if subtle) border that brightens and gets a soft accent
            ring on focus — the same depth cues used elsewhere (notes
            textarea, composer shell) instead of sitting flat on the page. */}
        <div style={{ position: "relative" }}>
          <Search
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: C.text2,
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search or start new chat"
            className="search-field-premium"
            style={{
              width: "100%",
              background: C.surface2,
              border: `1px solid ${searchFocused ? "var(--c-theme-solid, " + C.accent + ")" : C.border1}`,
              borderRadius: 22,
              padding: "9px 32px",
              fontSize: 13,
              color: C.text0,
              boxShadow: searchFocused
                ? "0 0 0 3px var(--c-theme-wash-soft, transparent)"
                : "none",
              transition: "border-color .16s ease, box-shadow .16s ease",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X style={{ width: 12, height: 12, color: C.text2 }} />
            </button>
          )}
        </div>
      </div>

      <div
        style={{ padding: "0 12px 10px", flexShrink: 0, position: "relative" }}
      >
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ConversationFilter)}
          style={{
            width: "100%",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            background: C.surface2,
            border: `1px solid ${C.border1}`,
            borderRadius: 9,
            padding: "7px 30px 7px 11px",
            fontSize: 12.5,
            fontWeight: 500,
            color: C.text0,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {FILTERS.map((f) => (
            <option
              key={f.key}
              value={f.key}
              style={{ background: C.surface2 }}
            >
              {f.key === "campaign" ? "Campaign Chats" : f.label} (
              {counts[f.key]})
            </option>
          ))}
        </select>
        <ChevronDown
          style={{
            position: "absolute",
            right: 22,
            top: 9,
            width: 14,
            height: 14,
            color: C.text2,
            pointerEvents: "none",
          }}
        />
      </div>

      <Divider margin="0 0 0" />

      <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: C.text2,
              gap: 10,
              padding: 24,
            }}
          >
            <MessageSquare style={{ width: 26, height: 26, opacity: 0.2 }} />
            <span style={{ fontSize: 12, textAlign: "center" }}>
              {search ? "No matches found" : "Nothing here yet"}
            </span>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConvListItem
              key={conv._id}
              conv={conv}
              active={selectedId === conv._id}
              pinned={pinnedIds.has(conv._id)}
              onClick={() => onSelect(conv)}
            />
          ))
        )}
      </div>

      <div
        style={{
          padding: "9px 14px",
          borderTop: `1px solid ${C.border1}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10.5, color: C.text3 }}>
          {conversations.length} conversations
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FORWARD MODAL
───────────────────────────────────────────────────────────────────────────── */
export function ForwardModal({
  open,
  onClose,
  conversations,
  currentId,
  onForward,
}: {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentId?: string;
  onForward: (c: Conversation) => void;
}) {
  const [q, setQ] = useState("");
  if (!open) return null;
  const list = conversations.filter(
    (c) =>
      c._id !== currentId &&
      (!q ||
        (c.displayName || c.phoneNumber || "")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(5,5,7,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-pop"
        style={{
          width: 360,
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          background: C.surface3,
          border: `1px solid ${C.border2}`,
          borderRadius: 16,
          boxShadow: "0 40px 90px rgba(0,0,0,.6)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${C.border1}`,
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text0,
              marginBottom: 8,
            }}
          >
            Forward message to…
          </p>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations…"
            style={{
              width: "100%",
              background: C.surface2,
              border: `1px solid ${C.border1}`,
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 12.5,
              color: C.text0,
            }}
          />
        </div>
        <div
          className="scroll"
          style={{ flex: 1, overflowY: "auto", padding: 6 }}
        >
          {list.length === 0 && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                fontSize: 12,
                color: C.text2,
              }}
            >
              No other conversations
            </div>
          )}
          {list.map((c) => (
            <button
              key={c._id}
              onClick={() => onForward(c)}
              className="menu-item"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Avatar name={c.displayName || c.phoneNumber || "?"} size={28} />
              <span style={{ fontSize: 12.5, color: C.text0, fontWeight: 500 }}>
                {c.displayName || c.phoneNumber}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LINK CONTACT MODAL — shown when a conversation has no linked contact
   (contactId is null, e.g. after the original Contact was deleted). Lets the
   user either search+link an existing contact, or create a new one with the
   conversation's phoneNumber pre-filled.
───────────────────────────────────────────────────────────────────────────── */
export function LinkContactModal({
  open,
  onClose,
  phoneNumber,
  onCheckMatch,
  onLinkExisting,
  onCreateNew,
}: {
  open: boolean;
  onClose: () => void;
  phoneNumber?: string;
  onCheckMatch: () => Promise<{
    _id: string;
    name: string;
    phone: string;
  } | null>;
  onLinkExisting: (contactId: string) => Promise<void>;
  onCreateNew: (data: { name: string; email?: string }) => Promise<void>;
}) {
  const [checking, setChecking] = useState(true);
  const [match, setMatch] = useState<{
    _id: string;
    name: string;
    phone: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setChecking(true);
      setMatch(null);
      setName("");
      setEmail("");
      setBusy(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    onCheckMatch()
      .then((r) => {
        if (!cancelled) setMatch(r);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: "rgba(5,5,7,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-pop"
        style={{
          width: 380,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          background: C.surface3,
          border: `1px solid ${C.border2}`,
          borderRadius: 16,
          boxShadow: "0 40px 90px rgba(0,0,0,.6)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${C.border1}`,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text0 }}>
            Link a contact
          </p>
          <p style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>
            A contact can only be linked if its phone number matches this
            conversation exactly.
          </p>
        </div>
        <div
          className="scroll"
          style={{ flex: 1, overflowY: "auto", padding: 14 }}
        >
          {checking && (
            <div
              style={{
                fontSize: 12,
                color: C.text2,
                textAlign: "center",
                padding: 20,
              }}
            >
              Checking for an existing contact…
            </div>
          )}

          {!checking && match && (
            <>
              <p
                style={{
                  fontSize: 11.5,
                  color: C.text2,
                  marginBottom: 8,
                  lineHeight: 1.5,
                }}
              >
                A contact with this exact phone number already exists — it's
                just not linked to this conversation yet.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${C.border1}`,
                  background: C.surface2,
                  marginBottom: 12,
                }}
              >
                <Avatar name={match.name || match.phone} size={32} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{ fontSize: 12.5, color: C.text0, fontWeight: 500 }}
                  >
                    {match.name || "Unnamed"}
                  </div>
                  <div style={{ fontSize: 11, color: C.text2 }}>
                    {match.phone}
                  </div>
                </div>
              </div>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onLinkExisting(match._id);
                    onClose();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="premium-pill-btn"
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--c-theme-solid, var(--c-accent))",
                  color: "var(--c-bubble-out-text, #fff)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Linking…" : "Relink this contact"}
              </button>
            </>
          )}

          {!checking && !match && (
            <>
              <p
                style={{
                  fontSize: 11.5,
                  color: C.text2,
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                No existing contact matches this number. Create a new one.
              </p>
              <label
                style={{
                  fontSize: 11,
                  color: C.text2,
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contact name"
                style={{
                  width: "100%",
                  background: C.surface2,
                  border: `1px solid ${C.border1}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12.5,
                  color: C.text0,
                  marginBottom: 10,
                }}
              />
              <label
                style={{
                  fontSize: 11,
                  color: C.text2,
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Email (optional)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: "100%",
                  background: C.surface2,
                  border: `1px solid ${C.border1}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12.5,
                  color: C.text0,
                  marginBottom: 10,
                }}
              />
              <label
                style={{
                  fontSize: 11,
                  color: C.text2,
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Phone
              </label>
              <div
                style={{
                  fontSize: 12.5,
                  color: C.text1,
                  fontFamily: "monospace",
                  padding: "8px 10px",
                  background: C.surface2,
                  borderRadius: 8,
                  border: `1px solid ${C.border1}`,
                  marginBottom: 14,
                }}
              >
                {phoneNumber}
              </div>
              <button
                disabled={busy || !name.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onCreateNew({
                      name: name.trim(),
                      email: email.trim() || undefined,
                    });
                    onClose();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="premium-pill-btn"
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: name.trim()
                    ? "var(--c-theme-solid, var(--c-accent))"
                    : C.surface4,
                  color: name.trim()
                    ? "var(--c-bubble-out-text, #fff)"
                    : C.text2,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: name.trim() && !busy ? "pointer" : "default",
                }}
              >
                {busy ? "Creating…" : "Create & link contact"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SETTINGS MODAL
───────────────────────────────────────────────────────────────────────────── */
export function SettingsModal({
  open,
  onClose,
  appearance,
  setAppearance,
}: {
  open: boolean;
  onClose: () => void;
  appearance: ChatAppearanceKey;
  setAppearance: (v: ChatAppearanceKey) => void;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-pop"
        style={{
          width: 440,
          maxWidth: "92vw",
          background: "color-mix(in srgb, var(--c-surface3) 94%, transparent)",
          backdropFilter: "blur(24px) saturate(1.3)",
          WebkitBackdropFilter: "blur(24px) saturate(1.3)",
          border: `1px solid ${C.border2}`,
          borderRadius: 20,
          boxShadow:
            "var(--c-shadow-3), 0 0 0 1px var(--c-theme-wash-soft, transparent)",
          padding: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 4,
          }}
        >
          <Palette
            style={{
              width: 16,
              height: 16,
              color: "var(--c-theme-solid, " + C.accentText + ")",
            }}
          />
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.text0,
              letterSpacing: "-.02em",
            }}
          >
            Appearance
          </p>
        </div>
        <p style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.5 }}>
          Customize how your sent messages look. Notification preferences now
          live inside each conversation's own settings.
        </p>

        <AppearanceSelector value={appearance} onChange={setAppearance} />

        <button
          onClick={onClose}
          className="premium-pill-btn"
          style={{
            marginTop: 20,
            width: "100%",
            padding: "11px 0",
            borderRadius: 10,
            border: "none",
            background: "var(--c-theme-solid, var(--c-accent))",
            color: "var(--c-bubble-out-text, #fff)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RIGHT PANEL
───────────────────────────────────────────────────────────────────────────── */
export function EditableField({
  value,
  onSave,
  placeholder,
  fontSize = 13,
  fontWeight = 600,
}: {
  value?: string;
  onSave: (v: string) => void;
  placeholder?: string;
  fontSize?: number;
  fontWeight?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  useEffect(() => setVal(value || ""), [value]);
  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => {
          // Push every keystroke up immediately (not just on blur/Enter) so
          // the parent's `profile.name` stays live — the Save button's
          // dirty-check compares against this, so without it the button
          // stayed disabled until you clicked away or hit Enter first.
          const next = e.target.value;
          setVal(next);
          onSave(next);
        }}
        onBlur={() => {
          setEditing(false);
          onSave(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            onSave(val);
          }
          if (e.key === "Escape") {
            setEditing(false);
            setVal(value || "");
          }
        }}
        style={{
          fontSize,
          fontWeight,
          color: C.text0,
          background: C.surface2,
          border: `1px solid ${C.accent}`,
          borderRadius: 7,
          padding: "4px 8px",
          width: "100%",
          outline: "none",
        }}
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "3px 6px",
        borderRadius: 7,
        width: "100%",
        textAlign: "left",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontSize, fontWeight, color: value ? C.text0 : C.text2 }}>
        {value || placeholder}
      </span>
      <Pencil
        style={{ width: 10, height: 10, color: C.text3, flexShrink: 0 }}
      />
    </button>
  );
}

export function RightPanel({
  conv,
  profile,
  setProfile,
  onAction,
  collapsed,
  onSaveNotes,
  onSaveProfileName,
  onSaveTag,
  onOpenLinkContact,
}: {
  conv: Conversation | null;
  profile: Profile;
  setProfile: SetProfile;
  onAction: (key: HeaderActionKey) => void;
  collapsed: boolean;
  onSaveNotes?: (notes: string) => void;
  onSaveProfileName?: (name: string) => void;
  onSaveTag?: (tag: string) => void;
  onOpenLinkContact?: () => void;
}) {
  const linkedContactId =
    typeof conv?.contactId === "object"
      ? (conv?.contactId as any)?._id
      : conv?.contactId;
  const hasContact = !!linkedContactId;

  const currentTag =
    (typeof conv?.contactId === "object"
      ? (conv?.contactId as any)?.tags?.[0]
      : undefined) || "";
  const [tagInput, setTagInput] = useState(currentTag);
  useEffect(() => {
    setTagInput(currentTag);
  }, [currentTag]);

  /* Track the last *saved* notes value per-conversation so the Save button
     can reflect whether there are unsaved changes, and show a confirmed
     "Saved" state right after saving instead of staying in the same
     always-active state. */
  const [lastSavedNotes, setLastSavedNotes] = useState(profile.notes || "");
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Name save — locked/disabled until the name actually diverges from what's
  // saved on the conversation (conv.displayName is the source of truth).
  const [lastSavedName, setLastSavedName] = useState(conv?.displayName || "");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  function toggleExportMenu() {
    if (!exportMenuOpen) {
      const rect = exportBtnRef.current?.getBoundingClientRect();
      if (rect) {
        const menuWidth = Math.max(rect.width, 216);
        // Anchor to the button's right edge and clamp so the menu never
        // crosses the viewport (or the panel's right border) — previously
        // it always grew rightward from `rect.left`, which pushed it past
        // the panel edge on a narrow 300px sidebar.
        let left = rect.right - menuWidth;
        const minLeft = 8;
        const maxLeft = window.innerWidth - menuWidth - 8;
        left = Math.min(Math.max(left, minLeft), maxLeft);
        setMenuPos({ top: rect.bottom + 6, left, width: menuWidth });
      }
    }
    setExportMenuOpen((v) => !v);
  }

  // Reset the "saved" baseline whenever we switch to a different conversation
  useEffect(() => {
    setLastSavedNotes(profile.notes || "");
    setJustSaved(false);
    setConfirmingClear(false);
    clearTimeout(confirmTimerRef.current);
    setLastSavedName(conv?.displayName || "");
    setExportMenuOpen(false);
  }, [conv?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!exportMenuOpen) return;
    const close = () => setExportMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    return () => {
      clearTimeout(savedTimerRef.current);
      clearTimeout(confirmTimerRef.current);
    };
  }, []);

  if (collapsed) {
    if (!conv) return null;
    return (
      <div
        className="tr-panel panel-right"
        style={{
          width: 44,
          background: C.surface0,
          borderLeft: `1px solid ${C.border1}`,
          alignItems: "center",
          paddingTop: 12,
          gap: 4,
        }}
      >
        <Avatar
          name={profile?.name || conv?.phoneNumber || "?"}
          size={28}
          ring
        />
      </div>
    );
  }

  if (!conv)
    return (
      <div
        className="panel-right glass-surface"
        style={{
          width: 300,
          flexShrink: 0,
          borderLeft: `1px solid ${C.border1}`,
        }}
      />
    );

  const nameDirty =
    !!(profile.name || "").trim() &&
    (profile.name || "").trim() !== (lastSavedName || "").trim();

  function saveProfileName() {
    if (!nameDirty) return;
    const trimmed = (profile.name || "").trim();
    onSaveProfileName?.(trimmed);
    setLastSavedName(trimmed);
  }

  function saveTag() {
    onSaveTag?.(tagInput.trim());
  }
  function clearTag() {
    setTagInput("");
    onSaveTag?.("");
  }

  const currentNotes = profile.notes || "";
  const notesDirty = currentNotes !== lastSavedNotes;

  function handleSaveNotes() {
    if (!notesDirty) return;
    onSaveNotes?.(currentNotes);
    setLastSavedNotes(currentNotes);
    setJustSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setJustSaved(false), 1800);
  }

  return (
    <div
      className="tr-panel scroll panel-right glass-surface"
      style={{
        width: 300,
        borderLeft: `1px solid ${C.border1}`,
        overflowY: "auto",
        padding: "18px 16px 32px",
        display: "flex",
        flexDirection: "column",
        background: "color-mix(in srgb, var(--c-surface0) 72%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "18px 14px 14px",
          borderRadius: 16,
          background: `linear-gradient(160deg, color-mix(in srgb, ${C.surface2} 1%, transparent), color-mix(in srgb, ${C.surface1} 30%, transparent))`,
          border: `1px solid ${C.border1}`,
        }}
      >
        <Avatar name={profile.name || conv.phoneNumber} size={60} ring />
        <div style={{ width: "100%" }}>
          <EditableField
            value={profile.name}
            placeholder="Add customer name"
            fontSize={14}
            onSave={(v) => setProfile((p) => ({ ...p, name: v }))}
          />
        </div>
        <span
          style={{
            fontSize: 11.5,
            color: C.text2,
            fontFamily: "monospace",
            letterSpacing: ".02em",
          }}
        >
          {conv.phoneNumber}
        </span>

        {/* Save — persists profile edits (currently: display name) to the
            backend. Locked/disabled by default; only lights up once the
            name has actually been edited, so it never looks actionable
            when there's nothing to save. */}
        <div
          style={{
            display: "flex",
            gap: 7,
            width: "100%",
            marginTop: 6,
            position: "relative",
          }}
        >
          <button
            onClick={saveProfileName}
            disabled={!nameDirty}
            title={nameDirty ? "Save changes" : "No changes to save"}
            style={{
              flex: 1,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              borderRadius: 11,
              border: `1px solid ${
                nameDirty ? "var(--c-theme-solid, " + C.accent + ")" : C.border2
              }`,
              background: nameDirty
                ? "var(--c-theme-solid, var(--c-accent))"
                : C.surface3,
              color: nameDirty ? "var(--c-bubble-out-text, #fff)" : C.text3,
              fontSize: 12,
              fontWeight: 600,
              cursor: nameDirty ? "pointer" : "default",
              boxShadow: "0 1px 2px rgba(0,0,0,.3)",
              transition:
                "background .16s ease, border-color .16s ease, color .16s ease",
            }}
          >
            <SaveIcon style={{ width: 14, height: 14 }} />
            Save
          </button>

          <div style={{ flex: 1, position: "relative" }}>
            <button
              ref={exportBtnRef}
              onClick={toggleExportMenu}
              style={{
                width: "100%",
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 11,
                border: `1px solid ${C.border2}`,
                background: C.surface3,
                color: C.text0,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,.3)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = C.surface4;
                el.style.borderColor = C.border3;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = C.surface3;
                el.style.borderColor = C.border2;
              }}
            >
              <Download style={{ width: 14, height: 14 }} />
              Export
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>

            {exportMenuOpen &&
              menuPos &&
              createPortal(
                <>
                  <div
                    onClick={() => setExportMenuOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 10000 }}
                  />
                  <div
                    className="anim-pop"
                    style={{
                      position: "fixed",
                      top: menuPos.top + 6,
                      left: menuPos.left,
                      width: Math.max(menuPos.width, 210),
                      background:
                        "color-mix(in srgb, var(--c-surface3) 97%, black)",
                      backdropFilter: "blur(24px) saturate(1.3)",
                      WebkitBackdropFilter: "blur(24px) saturate(1.3)",
                      border: `1px solid ${C.border2}`,
                      borderRadius: 11,
                      boxShadow:
                        "0 16px 40px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35)",
                      overflow: "hidden",
                      zIndex: 10001,
                      padding: 6,
                      transformOrigin: "top right",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.text3,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        padding: "6px 8px 8px",
                      }}
                    >
                      Export
                    </div>
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        onAction("save-contact");
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        borderRadius: 9,
                        background: "transparent",
                        transition: "background .12s ease, transform .1s ease",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background =
                          "var(--c-theme-wash-soft, rgba(255,255,255,0.07))";
                        const icon = el.querySelector(
                          ".menu-icon-chip",
                        ) as HTMLElement | null;
                        if (icon) {
                          icon.style.background =
                            "var(--c-theme-solid, var(--c-accent))";
                          icon.style.borderColor = "transparent";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = "transparent";
                        const icon = el.querySelector(
                          ".menu-icon-chip",
                        ) as HTMLElement | null;
                        if (icon) {
                          icon.style.background = C.surface4;
                          icon.style.borderColor = C.border2;
                        }
                      }}
                    >
                      <span
                        className="menu-icon-chip"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: C.surface4,
                          border: `1px solid ${C.border2}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition:
                            "background .12s ease, border-color .12s ease",
                        }}
                      >
                        <UserPlus
                          style={{ width: 13, height: 13, color: "#fff" }}
                        />
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: C.text0,
                        }}
                      >
                        Export as vCard (.vcf)
                      </span>
                    </button>
                    <div
                      style={{
                        height: 1,
                        background: C.border2,
                        margin: "5px 4px",
                      }}
                    />
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        onAction("export");
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        borderRadius: 9,
                        background: "transparent",
                        transition: "background .12s ease, transform .1s ease",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background =
                          "var(--c-theme-wash-soft, rgba(255,255,255,0.07))";
                        const icon = el.querySelector(
                          ".menu-icon-chip",
                        ) as HTMLElement | null;
                        if (icon) {
                          icon.style.background =
                            "var(--c-theme-solid, var(--c-accent))";
                          icon.style.borderColor = "transparent";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = "transparent";
                        const icon = el.querySelector(
                          ".menu-icon-chip",
                        ) as HTMLElement | null;
                        if (icon) {
                          icon.style.background = C.surface4;
                          icon.style.borderColor = C.border2;
                        }
                      }}
                    >
                      <span
                        className="menu-icon-chip"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: C.surface4,
                          border: `1px solid ${C.border2}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition:
                            "background .12s ease, border-color .12s ease",
                        }}
                      >
                        <FileText
                          style={{ width: 13, height: 13, color: "#fff" }}
                        />
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: C.text0,
                        }}
                      >
                        Export chat as text (.txt)
                      </span>
                    </button>
                  </div>
                </>,
                document.body,
              )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 16,
          background: `color-mix(in srgb, ${C.surface1} 1%, transparent)`,
          border: `1px solid color-mix(in srgb, ${C.border1} 1%, transparent)`,
        }}
      >
        <SectionLabel>Tags</SectionLabel>
        {hasContact ? (
          <>
            {currentTag && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 5,
                  marginBottom: 7,
                }}
              >
                <TagBadge tag={currentTag} size="md" onRemove={clearTag} />
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTag()}
                placeholder="Add a tag…"
                style={{
                  flex: 1,
                  fontSize: 12,
                  background: C.surface2,
                  border: `1px solid ${C.border1}`,
                  borderRadius: 9,
                  padding: "7px 10px",
                  color: C.text0,
                }}
              />
              <button
                onClick={saveTag}
                className="premium-pill-btn"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  border: `1px solid ${C.border1}`,
                  background: C.surface2,
                  color: C.text1,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Plus style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onOpenLinkContact}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "9px 0",
              borderRadius: 9,
              border: `1px dashed ${C.border2}`,
              background: C.surface2,
              color: C.text1,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <UserPlus style={{ width: 13, height: 13 }} />
            Link Contact
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: 12,
          borderRadius: 16,
          background: `color-mix(in srgb, ${C.surface1} 1%, transparent)`,
          border: `1px solid color-mix(in srgb, ${C.border1} 1%, transparent)`,
        }}
      >
        <SectionLabel
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!!profile.notes && (
                <button
                  onClick={() => {
                    if (!confirmingClear) {
                      setConfirmingClear(true);
                      clearTimeout(confirmTimerRef.current);
                      confirmTimerRef.current = setTimeout(
                        () => setConfirmingClear(false),
                        2500,
                      );
                      return;
                    }
                    clearTimeout(confirmTimerRef.current);
                    setConfirmingClear(false);
                    setProfile((p) => ({ ...p, notes: "" }));
                    onSaveNotes?.("");
                    setLastSavedNotes("");
                    setJustSaved(false);
                  }}
                  title={
                    confirmingClear ? "Click again to confirm" : "Clear notes"
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: confirmingClear ? C.dangerDim : "none",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    padding: confirmingClear ? "2px 6px" : 0,
                    color: confirmingClear ? C.dangerText : C.text3,
                    fontSize: 10,
                    fontWeight: 600,
                    transition: "background .15s ease, color .15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!confirmingClear)
                      e.currentTarget.style.color = C.dangerText;
                  }}
                  onMouseLeave={(e) => {
                    if (!confirmingClear) e.currentTarget.style.color = C.text3;
                  }}
                >
                  <Trash2 style={{ width: 11, height: 11 }} />
                  {confirmingClear && <span>Confirm?</span>}
                </button>
              )}
            </div>
          }
        >
          Internal notes
        </SectionLabel>
        <textarea
          value={profile.notes || ""}
          onChange={(e) => {
            const v = e.target.value.slice(0, 500);
            setProfile((p) => ({ ...p, notes: v }));
          }}
          maxLength={500}
          placeholder="Visible only to you…"
          style={{
            width: "100%",
            minHeight: 90,
            fontSize: 12.5,
            color: C.text0,
            background: C.surface2,
            border: `1px solid ${notesDirty ? "var(--c-theme-solid)" : C.border1}`,
            borderRadius: 11,
            padding: 12,
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.6,
            transition: "border-color .18s ease, box-shadow .18s ease",
            boxShadow: notesDirty
              ? "0 0 0 3px var(--c-theme-wash-soft)"
              : "none",
          }}
        />
        {(() => {
          const remaining = 500 - (profile.notes?.length ?? 0);
          const isLow = remaining <= 50;
          const isExceeded = remaining <= 0;
          return (
            <div
              style={{
                fontSize: 10,
                color: isExceeded
                  ? C.dangerText
                  : isLow
                    ? C.warningText
                    : C.text3,
                fontWeight: isExceeded ? 700 : 400,
                textAlign: "right",
                marginTop: 4,
              }}
            >
              {remaining.toLocaleString()} characters remaining
            </div>
          );
        })()}
        <button
          onClick={handleSaveNotes}
          disabled={!notesDirty}
          className={`premium-pill-btn${justSaved ? " anim-saved" : ""}`}
          style={{
            marginTop: 8,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 0",
            borderRadius: 10,
            border: "none",
            background: notesDirty ? "var(--c-theme-solid)" : C.surface4,
            color: notesDirty ? "var(--c-bubble-out-text)" : C.text2,
            fontSize: 12,
            fontWeight: 600,
            cursor: notesDirty ? "pointer" : "default",
            transition: "background .18s ease, color .18s ease",
          }}
        >
          {justSaved && !notesDirty && (
            <CheckCircle2 style={{ width: 13, height: 13 }} />
          )}
          {notesDirty ? "Save notes" : justSaved ? "Saved" : "Saved"}
        </button>
      </div>
    </div>
  );
}
