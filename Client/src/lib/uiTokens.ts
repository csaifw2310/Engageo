/**
 * Shared design tokens for the Engageo inbox UI.
 *
 * These are pure CSS custom-property references (defined in
 * ConversationsPage's <GlobalStyles/> block under `.inbox[data-theme="dark|light"]`).
 * Pulling them into one file lets new modular components (VoiceRecorder,
 * ConversationSettingsModal, AppearanceSelector, MessageContextMenu, etc.)
 * stay visually consistent with the rest of the app without re-declaring
 * the same object everywhere.
 *
 * IMPORTANT: This does not change any values — it is a 1:1 extraction of
 * the existing `C` / `FONT` constants that previously lived only inside
 * ConversationsPage.tsx.
 */

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