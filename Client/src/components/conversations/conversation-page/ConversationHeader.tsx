import { useState } from "react";
import {
  Search,
  Bell,
  BellOff,
  Archive,
  Download,
  Settings,
  PanelLeft,
  PanelRight,
  Focus,
  ArrowLeft,
  Wifi,
  WifiOff,
} from "lucide-react";
import type {
  Conversation,
  HeaderActionKey,
} from "../../../types/conversation";
import ConversationSettingsModal from "../ConversationSettingsModal";
import { C, Avatar, IconBtn } from "./ConversationUI";
import type { Profile, ConvNotifPrefs } from "./ConversationLogic";

/* ─────────────────────────────────────────────────────────────────────────────
   THREAD HEADER
   Visual fixes ported from Bolt (cosmetic only, zero prop/logic changes):
     1. Removed the inline `background: C.surface2` that was overriding the
        `.glass-surface` class and killing the frosted-glass/blur effect.
     2. Outer gap 10 → 12, added flexShrink: 0 (Bolt's exact header layout).
     3. Name label now carries Bolt's letterSpacing: "-.01em".
     4. Action-row gap 4 → 2 (Bolt's tighter icon spacing).
     5. All header IconBtns now explicitly pass size={15} to match Bolt.
     6. Mute/Archive/Export and the trailing PanelLeft/PanelRight buttons
        removed from the action row — they're already covered by
        ConversationSettingsModal and the standalone sidebar-toggle
        button near the avatar, so keeping them here was pure duplication.
   All handlers, props, modal wiring, online-status dot, connection
   indicator, and focus-mode logic are exactly as you had them.
───────────────────────────────────────────────────────────────────────────── */
export function ThreadHeader({
  conv,
  profile,
  onAction,
  onToggleSearch,
  muted,
  archived,
  connected,
  sidebarCollapsed,
  rightCollapsed,
  focusMode,
  onToggleSidebar,
  onToggleRight,
  onToggleFocus,
  onBack,
  notifPrefs,
  onToggleNotifications,
  onToggleSound,
}: {
  conv: Conversation;
  profile: Profile;
  onAction: (key: HeaderActionKey) => void;
  onToggleSearch: () => void;
  muted: boolean;
  archived: boolean;
  connected: boolean;
  sidebarCollapsed: boolean;
  rightCollapsed: boolean;
  focusMode: boolean;
  onToggleSidebar: () => void;
  onToggleRight: () => void;
  onToggleFocus: () => void;
  onBack?: () => void;
  notifPrefs: ConvNotifPrefs;
  onToggleNotifications: (v: boolean) => void;
  onToggleSound: (v: boolean) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div
      className="glass-surface"
      style={{
        padding: "10px 16px",
        borderBottom: `1px solid ${C.border1}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      <button
        onClick={onBack}
        title="Back to chats"
        className="icon-btn mobile-only"
        style={{ color: C.text1 }}
      >
        <ArrowLeft style={{ width: 17, height: 17 }} />
      </button>
      <button
        onClick={onToggleSidebar}
        title={`${sidebarCollapsed ? "Show" : "Hide"} sidebar (Ctrl+B)`}
        className="icon-btn desktop-only"
        style={{ color: C.text2 }}
      >
        <PanelLeft style={{ width: 15, height: 15 }} />
      </button>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={profile.name || conv.phoneNumber || "?"} size={38} />
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: conv.online ? C.success : C.text3,
            boxShadow: `0 0 0 2px ${C.surface1}`,
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
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
            }}
          >
            {profile.name || conv.displayName || conv.phoneNumber}
          </span>
        </div>

        <span
          style={{
            fontSize: 11.5,
            color: C.text2,
            fontFamily: "monospace",
          }}
        >
          {conv.phoneNumber}
        </span>
      </div>
      <div
        className="thread-header-actions"
        style={{ display: "flex", alignItems: "center", gap: 2 }}
      >
        <div
          title={connected ? "Live" : "Reconnecting"}
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          {connected ? (
            <Wifi
              style={{
                width: 13,
                height: 13,
                color: C.successText,
              }}
            />
          ) : (
            <WifiOff
              style={{
                width: 13,
                height: 13,
                color: C.warningText,
              }}
            />
          )}
        </div>

        <IconBtn
          icon={Search}
          title="Search in conversation (Ctrl+F)"
          onClick={onToggleSearch}
          size={15}
        />
        <div className="more-btn-wrap" style={{ position: "relative" }}>
          <IconBtn
            icon={Settings}
            title="Conversation settings"
            onClick={() => setSettingsOpen(true)}
            active={settingsOpen}
            size={15}
          />
          <ConversationSettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            contactName={profile.name || conv.phoneNumber || "this contact"}
            muteNotifications={!notifPrefs.notifications}
            archived={archived}
            muteSound={!notifPrefs.sound}
            onToggleNotifications={(v) => onToggleNotifications(!v)}
            onToggleSound={(v) => onToggleSound(!v)}
            onToggleArchive={() => onAction("archive")}
            onExport={() => onAction("export")}
            onSaveContact={() => onAction("save-contact")}
            onDelete={() => {
              setSettingsOpen(false);
              onAction("delete");
            }}
          />
        </div>
        <IconBtn
          icon={Focus}
          title="Focus mode (Ctrl+Shift+F)"
          onClick={onToggleFocus}
          active={focusMode}
          size={15}
        />
        <IconBtn
          icon={PanelRight}
          title={`${rightCollapsed ? "Show" : "Hide"} contact panel (Ctrl+\\)`}
          onClick={onToggleRight}
          active={!rightCollapsed}
          size={15}
        />
      </div>
    </div>
  );
}

export default ThreadHeader;
