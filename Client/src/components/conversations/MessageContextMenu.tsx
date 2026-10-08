import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Reply, Copy, Pin, Star, Forward, Info, Trash2 } from "lucide-react";

export type MessageActionKey =
  | "reply"
  | "copy"
  | "pin"
  | "star"
  | "forward"
  | "info"
  | "delete";

interface MessageContextMenuProps {
  x: number;
  y: number;
  outbound: boolean;
  pinned?: boolean;
  starred?: boolean;
  onAction: (key: MessageActionKey) => void;
  onClose: () => void;
}

const MENU_WIDTH = 200;

export default function MessageContextMenu({
  x,
  y,
  pinned,
  starred,
  onAction,
  onClose,
}: MessageContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Start hidden (opacity 0) at the raw click point, then measure the
  // real rendered size on the next layout pass and reposition — instead
  // of guessing a fixed height up front.
  const [pos, setPos] = useState({ left: x, top: y });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let left = x;
    let top = y;

    // Flip left if it would overflow the right edge
    if (left + w > vw - margin) left = x - w;
    // Flip up if it would overflow the bottom edge
    if (top + h > vh - margin) top = y - h;

    // Final clamp so it's never negative or past the opposite edge
    left = Math.max(margin, Math.min(left, vw - w - margin));
    top = Math.max(margin, Math.min(top, vh - h - margin));

    setPos({ left, top });
    setReady(true);
  }, [x, y]);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const items: {
    key: MessageActionKey;
    icon: React.ComponentType<{ style?: React.CSSProperties }>;
    label: string;
    danger?: boolean;
  }[] = [
    { key: "reply", icon: Reply, label: "Reply" },
    { key: "forward", icon: Forward, label: "Forward" },
    { key: "copy", icon: Copy, label: "Copy" },
    { key: "pin", icon: Pin, label: pinned ? "Unpin message" : "Pin message" },
    { key: "star", icon: Star, label: starred ? "Unstar" : "Star" },
    { key: "info", icon: Info, label: "Message info" },
    { key: "delete", icon: Trash2, label: "Delete", danger: true },
  ];

  // Portal target: same reasoning as ConversationSettingsModal — `.inbox`
  // carries no transform/filter/backdrop-filter of its own, so `position:
  // fixed` resolves against the real viewport from there, while still
  // being a descendant of `.inbox[data-theme][data-appearance]` so every
  // --c-* custom property this menu uses is actually in scope.
  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".inbox")) ||
    document.body;

  return createPortal(
    <div
      ref={ref}
      className="anim-pop"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        visibility: ready ? "visible" : "hidden",
        zIndex: 1000,
        width: MENU_WIDTH,
        background: "color-mix(in srgb, var(--c-surface3) 96%, transparent)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        border: "1px solid var(--c-border2)",
        borderRadius: 14,
        boxShadow: "var(--c-shadow-3)",
        padding: 4,
        overflow: "hidden",
      }}
    >
      {items.map((it, i) => (
        <React.Fragment key={it.key}>
          {i === 6 && <div className="sep" style={{ margin: "4px 0" }} />}
          <button
            onClick={() => {
              onAction(it.key);
              onClose();
            }}
            className={`menu-item${it.danger ? " danger" : ""}`}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              textAlign: "left",
              fontSize: 13,
              color: it.danger ? "var(--c-danger-text)" : "var(--c-text0)",
              fontWeight: 450,
            }}
          >
            <it.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
            <span>{it.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>,
    portalTarget,
  );
}