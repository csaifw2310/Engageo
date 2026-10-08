import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BellOff,
  Bell,
  Volume2,
  VolumeX,
  Archive,
  Download,
  UserPlus,
  Trash2,
  X,
} from "lucide-react";
import { C, FONT } from "../../lib/uiTokens";

// The full set of --c-* custom properties this modal (and its children)
// reference, either directly via C.xxx / uiTokens, or via var(--c-theme-…)
// fallback patterns. Kept as an explicit list because getComputedStyle
// doesn't let you enumerate custom properties generically — you have to
// ask for each name by hand.
const THEME_VAR_NAMES = [
  "--c-base",
  "--c-surface0",
  "--c-surface1",
  "--c-surface2",
  "--c-surface3",
  "--c-surface4",
  "--c-border0",
  "--c-border1",
  "--c-border2",
  "--c-border3",
  "--c-accent",
  "--c-accent-hover",
  "--c-accent-dim",
  "--c-accent-text",
  "--c-violet",
  "--c-violet-dim",
  "--c-violet-text",
  "--c-success",
  "--c-success-dim",
  "--c-success-text",
  "--c-warning",
  "--c-warning-dim",
  "--c-warning-text",
  "--c-danger",
  "--c-danger-dim",
  "--c-danger-text",
  "--c-info",
  "--c-info-dim",
  "--c-info-text",
  "--c-text0",
  "--c-text1",
  "--c-text2",
  "--c-text3",
  "--c-hover",
  "--c-hover-strong",
  "--c-bubble-out",
  "--c-bubble-out-border",
  "--c-bubble-out-text",
  "--c-bubble-in",
  "--c-bubble-in-border",
  "--c-bubble-in-text",
  "--c-wall",
  "--c-brand",
  "--c-theme-solid",
  "--c-theme-wash-soft",
  "--c-theme-wash-strong",
  "--c-shadow-1",
  "--c-shadow-2",
  "--c-shadow-3",
];

/**
 * ConversationSettingsModal — Task 2 & Task 3
 *
 * Every conversation now owns its own settings panel (opened from the
 * premium icon in the chat header, replacing the old "..." menu).
 *
 * Notifications + notification sound are PER-CONVERSATION here (Task 3) —
 * the parent (ConversationsPage) is the source of truth and passes the
 * current values in / receives toggle callbacks out, the same pattern
 * already used for `mutedConvIds` / `archivedConvIds`.
 *
 * POLISH PASS: sections are now grouped into distinct cards (surface1,
 * bordered, rounded) instead of a flat list separated only by per-row
 * borders — matches the card language already used in the right panel
 * (Tags / Internal notes). Rows within a card are separated by a single
 * hairline divider instead of every row carrying its own border-bottom,
 * and action buttons now sit in the same icon-box treatment as the
 * toggle rows so "Manage" doesn't read as a visually lighter section.
 *
 * THEME PASS: every surface/border/text color in this file already comes
 * from `C.*` (which resolves to the active theme's --c-* custom
 * properties) or from a `var(--c-theme-…)` accent hook with a themed
 * fallback. The only values that were still hardcoded were shadow/border
 * colors expressed as raw rgba() blacks and reds — those are now routed
 * through the shared --c-shadow-* tokens and a color-mix() off C.danger,
 * so a "Cosmic Noir" (or any future) theme can restyle shadows and the
 * danger-zone border without touching this component.
 *
 * NAMING PASS: props renamed to match the backend's `preferences` shape
 * 1:1 (muteNotifications / muteSound) instead of the old muted/notifications
 * mix — the leftover `notifications` prop that never existed on the
 * interface has been removed from destructuring here.
 */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        background: checked
          ? "var(--c-theme-solid, var(--c-accent))"
          : C.surface4,
        transition: "background .2s ease",
        boxShadow: checked
          ? "0 0 8px -2px var(--c-theme-wash-soft, transparent)"
          : "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          // The knob itself stays a fixed light color across every theme —
          // like a native iOS/Material switch, it's a physical affordance
          // rather than a themed surface, and needs to read clearly
          // against whatever color the track becomes once `checked`.
          // Only the shadow beneath it is theme-driven now, via the
          // shared shadow token (falls back to the old rgba if a theme
          // hasn't defined --c-shadow-1).
          background: "#fff",
          boxShadow: "0 1px 4px var(--c-shadow-1, rgba(0,0,0,.4))",
          transition: "left .2s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        // Solid (not color-mixed/translucent) background — this card sits
        // on top of an already-translucent, blurred modal sheet, so a
        // semi-transparent surface color here let the chat behind the
        // modal show through in testing. surface1 itself may carry alpha
        // depending on the active theme, so pin full opacity explicitly.
        background: C.surface1,
        opacity: 1,
        isolation: "isolate",
        border: `1px solid ${C.border1}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  desc,
  right,
  last,
}: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  desc?: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderBottom: last ? "none" : `1px solid ${C.border0}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          flexShrink: 0,
          background: C.surface2,
          border: `1px solid ${C.border1}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 15, height: 15, color: C.text2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text0, fontWeight: 500 }}>
          {label}
        </div>
        {desc && (
          <div
            style={{
              fontSize: 11,
              color: C.text2,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {desc}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  danger,
  last,
  onClick,
}: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  danger?: boolean;
  last?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 14px",
        textAlign: "left",
        fontSize: 13,
        fontWeight: 500,
        color: danger ? C.dangerText : C.text0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        borderBottom: last ? "none" : `1px solid ${C.border0}`,
        transition: "background .14s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger
          ? C.dangerDim
          : C.hoverStrong;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          flexShrink: 0,
          background: danger ? C.dangerDim : C.surface2,
          // Was a fixed "rgba(239,68,68,0.22)" — now derived from the
          // theme's own --c-danger, so a theme that defines danger as a
          // different hue (or a colorblind-safe palette) gets a matching
          // border automatically instead of always rendering WhatsApp-red.
          border: `1px solid ${
            danger
              ? `color-mix(in srgb, ${C.danger} 22%, transparent)`
              : C.border1
          }`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 15, height: 15 }} />
      </div>
      {label}
    </button>
  );
}

export interface ConversationSettingsModalProps {
  open: boolean;
  onClose: () => void;
  contactName: string;

  muteNotifications: boolean;
  archived: boolean;
  muteSound: boolean;

  onToggleNotifications: (v: boolean) => void;
  onToggleArchive: () => void;
  onToggleSound: (v: boolean) => void;

  onExport: () => void;
  onSaveContact: () => void;
  onDelete: () => void;
}

export default function ConversationSettingsModal({
  open,
  onClose,
  contactName,
  muteNotifications,
  archived,
  muteSound,
  onToggleArchive,
  onToggleNotifications,
  onToggleSound,
  onExport,
  onSaveContact,
  onDelete,
}: ConversationSettingsModalProps) {
  // Hooks must run unconditionally on every render — declared before the
  // `if (!open) return null` below rather than after it.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset the confirm step whenever the modal closes, so reopening it
  // always starts back at the plain "Delete conversation" button instead
  // of stranding the user on the warning screen from last time.
  useEffect(() => {
    if (!open) setConfirmingDelete(false);
  }, [open]);

  if (!open) return null;
  // Portal target: the `.inbox` root, NOT document.body.
  //
  // Every color this modal uses (C.surface1, C.border1, --c-theme-solid,
  // etc.) is a CSS custom property defined on `.inbox[data-theme="…"]
  // [data-appearance="…"]` in index.css. Custom properties only cascade
  // DOWN the DOM tree from where they're declared — document.body is an
  // ANCESTOR of `.inbox`, not a descendant, so a modal portaled there
  // sees none of those variables. That's what produced the flat,
  // borderless, colorless "Conversation settings" sheet with the aurora
  // glow bleeding through: SectionCard's `background: C.surface1` etc.
  // were resolving to nothing out there.
  //
  // `.inbox` itself is a safe portal target for a `position: fixed`
  // overlay: unlike its `.glass-surface` / `.topbar` / `.panel-*`
  // children, the `.inbox` div carries no `transform`, `filter`,
  // `perspective`, `will-change`, or `backdrop-filter` of its own, so it
  // never becomes a containing block — `position: fixed` still resolves
  // against the real viewport, exactly as when this portaled to
  // document.body. We just gain the CSS variable scope back.
  //
  // Falls back to document.body only if `.inbox` genuinely isn't in the
  // document (shouldn't happen in normal use, but keeps this from
  // silently rendering nothing).
  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".inbox")) ||
    document.body;
  return createPortal(
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 260,
          // Kept as a fixed black scrim rather than a themed token on
          // purpose: its only job is to dim whatever is behind the modal
          // regardless of theme, the same way every OS-level modal scrim
          // (light or dark mode) stays black — it's not a themed surface.
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="anim-pop"
          style={{
            width: 440,
            maxWidth: "93vw",
            maxHeight: "84vh",
            // The sheet is now a flex column with a fixed-height header and
            // footer and only the middle section scrolling — previously
            // `overflowY: auto` was on this outer div, so scrolling the
            // content also scrolled the title and the ✕ button out of view
            // with no way to get back to them without scrolling back up.
            display: "flex",
            flexDirection: "column",
            // Bumped from 94% to 99% opaque. This sheet sits over a busy,
            // moving chat view; at 94% + blur, some renderers under-blur the
            // backdrop and chat text shows through legibly. Going near-fully
            // opaque removes the dependency on backdrop-filter for privacy
            // of the content behind it — the blur is now purely decorative.
            background: `color-mix(in srgb, ${C.surface3} 99%, transparent)`,
            backdropFilter: "blur(24px) saturate(1.3)",
            WebkitBackdropFilter: "blur(24px) saturate(1.3)",
            border: `1px solid ${C.border2}`,
            borderRadius: 20,
            // Was a hardcoded "rgba(0,0,0,.65)" — now the shared --c-shadow-3
            // token (with the same rgba as a fallback), so themes that use a
            // lighter ambient shadow (e.g. a light theme) aren't stuck with
            // a shadow tuned for dark mode.
            boxShadow:
              "0 24px 60px var(--c-shadow-3, rgba(0,0,0,.65)), 0 0 0 1px var(--c-theme-wash-soft, transparent)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "18px 18px 14px",
              borderBottom: `1px solid ${C.border1}`,
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: C.text0,
                  letterSpacing: "-.02em",
                }}
              >
                Conversation settings
              </p>
              <p style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>
                {contactName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="icon-btn"
              style={{ width: 28, height: 28, color: C.text2, flexShrink: 0 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div
            className="scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "16px 18px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: C.text3,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                Notifications for this chat
              </div>
              <SectionCard>
                <SettingsRow
                  icon={muteNotifications ? BellOff : Bell}
                  label="Mute message notifications"
                  desc="Get notified when this contact messages you"
                  right={
                    <Toggle
                      checked={muteNotifications}
                      onChange={onToggleNotifications}
                    />
                  }
                />
                <SettingsRow
                  icon={muteSound ? VolumeX : Volume2}
                  label="Mute notification sound"
                  desc="Play a sound for new messages in this chat"
                  right={
                    <Toggle checked={muteSound} onChange={onToggleSound} />
                  }
                  last
                />
              </SectionCard>
            </div>

            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: C.text3,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                Manage
              </div>
              <SectionCard>
                <ActionButton
                  icon={Archive}
                  label={
                    archived ? "Unarchive conversation" : "Archive conversation"
                  }
                  onClick={onToggleArchive}
                />
                <ActionButton
                  icon={Download}
                  label="Export chat"
                  onClick={onExport}
                />
                <ActionButton
                  icon={UserPlus}
                  label="Save contact"
                  onClick={onSaveContact}
                />
                <ActionButton
                  icon={Trash2}
                  label="Delete conversation"
                  danger
                  onClick={() => setConfirmingDelete(true)}
                  last
                />
              </SectionCard>
            </div>
          </div>

          {/* Pinned footer — stays put regardless of scroll position, so
            there's always an obvious, reachable way to close the sheet. */}
          <div
            style={{
              flexShrink: 0,
              padding: "12px 18px",
              borderTop: `1px solid ${C.border1}`,
            }}
          >
            <button
              onClick={onClose}
              className="premium-pill-btn"
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 10,
                border: `1px solid ${C.border2}`,
                background: C.surface2,
                color: C.text0,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation — a genuine popup layered above the settings
        sheet (its own backdrop + centered card, higher z-index), not an
        inline expansion inside the Manage card. Clicking its own backdrop
        (not the settings sheet's) only dismisses the confirm step. */}
      {confirmingDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 280,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmingDelete(false);
          }}
        >
          <div
            className="anim-pop"
            style={{
              width: 360,
              maxWidth: "90vw",
              background: C.surface3,
              border: `1px solid ${C.border2}`,
              borderRadius: 16,
              boxShadow: "0 24px 60px var(--c-shadow-3, rgba(0,0,0,.65))",
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: C.text0,
                marginBottom: 8,
              }}
            >
              Delete conversation?
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: C.text1,
                lineHeight: 1.5,
                marginBottom: 18,
              }}
            >
              Delete this conversation with{" "}
              <span style={{ color: C.text0, fontWeight: 600 }}>
                {contactName}
              </span>
              ? This can't be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmingDelete(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${C.border2}`,
                  background: C.surface2,
                  color: C.text0,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setConfirmingDelete(false);
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: C.danger,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    portalTarget,
  );
}