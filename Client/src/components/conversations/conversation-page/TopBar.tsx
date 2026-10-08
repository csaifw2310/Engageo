import { Search, Command, Maximize2, Minimize2, PanelLeft, PanelRight } from "lucide-react";
import { Avatar } from "./ConversationUI";

interface TopBarProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  leftPanelVisible: boolean;
  onToggleLeftPanel: () => void;
  rightPanelVisible: boolean;
  onToggleRightPanel: () => void;
  workspaceName?: string;
}

export function TopBar({
  onOpenSearch, onOpenSettings, isFullscreen, onToggleFullscreen,
  leftPanelVisible, onToggleLeftPanel, rightPanelVisible, onToggleRightPanel,
  workspaceName = "Workspace",
}: TopBarProps) {
  return (
    <div className="topbar glass-surface">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onToggleLeftPanel} title={leftPanelVisible ? "Hide conversations" : "Show conversations"} className="icon-btn" style={{ width: 34, height: 34, color: leftPanelVisible ? "var(--c-text1)" : "var(--c-text3)" }}>
          <PanelLeft style={{ width: 16, height: 16 }} />
        </button>
        <button className="topbar-search" onClick={onOpenSearch}>
          <Search style={{ width: 14, height: 14, color: "var(--c-text2)", flexShrink: 0 }} />
          <span className="topbar-search-label">Search…</span>
          <span className="topbar-kbd"><Command style={{ width: 9, height: 9 }} />K</span>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={onToggleRightPanel} title={rightPanelVisible ? "Hide details panel" : "Show details panel"} className="icon-btn" style={{ width: 34, height: 34, color: rightPanelVisible ? "var(--c-text1)" : "var(--c-text3)" }}>
          <PanelRight style={{ width: 16, height: 16 }} />
        </button>
        <button onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} className="icon-btn" style={{ width: 34, height: 34, color: "var(--c-text1)" }}>
          {isFullscreen ? <Minimize2 style={{ width: 15, height: 15 }} /> : <Maximize2 style={{ width: 15, height: 15 }} />}
        </button>
        <button onClick={onOpenSettings} className="topbar-profile" title="Account & appearance">
          <Avatar name={workspaceName} size={28} ring />
          <span className="topbar-profile-name">{workspaceName}</span>
        </button>
      </div>
    </div>
  );
}