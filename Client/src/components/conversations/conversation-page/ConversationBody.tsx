import type React from "react";
import { useState, useRef } from "react";
import {
  MessageSquare,
  Search,
  X,
  ChevronDown,
  Pin,
  Star,
  FileText,
  StickyNote,
  Play,
  Pause,
  Download,
} from "lucide-react";
import MessageContextMenu from "../MessageContextMenu";
import type {
  MessageActionKey,
  MessageDayGroup,
} from "../../../types/conversation";
import type { ChatMessage } from "../../../types/message";
import { StatusDot, Avatar } from "./ConversationUI";
import { fmtTime, type TypingEntry } from "./ConversationLogic";

/* ─────────────────────────────────────────────────────────────────────────────
   VOICE MESSAGE PLAYER — custom-styled replacement for the browser's default
   <audio controls>, matching the app's theme tokens instead of OS chrome.
───────────────────────────────────────────────────────────────────────────── */
function VoiceMessagePlayer({
  src,
  outbound,
  fallbackDuration,
}: {
  src: string;
  outbound: boolean;
  fallbackDuration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(fallbackDuration ?? 0);
  const [current, setCurrent] = useState(0);

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 200,
        padding: "2px 2px 2px 0",
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        style={{ display: "none" }}
      />
      <button
        onClick={toggle}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "none",
          flexShrink: 0,
          cursor: "pointer",
          background: outbound
            ? "rgba(255,255,255,0.22)"
            : "var(--c-theme-solid, var(--c-accent))",
          color: outbound ? "var(--c-bubble-out-text)" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {playing ? (
          <Pause style={{ width: 12, height: 12 }} />
        ) : (
          <Play style={{ width: 12, height: 12, marginLeft: 1 }} />
        )}
      </button>

      <div
        onClick={(e) => {
          const el = audioRef.current;
          if (!el || !duration) return;
          const rect = (
            e.currentTarget as HTMLDivElement
          ).getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          el.currentTime = ratio * duration;
        }}
        style={{
          flex: 1,
          height: 22,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "100%",
            height: 3,
            borderRadius: 2,
            background: outbound
              ? "rgba(255,255,255,0.28)"
              : "var(--c-border2)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progress}%`,
              background: outbound
                ? "#fff"
                : "var(--c-theme-solid, var(--c-accent))",
              transition: "width .1s linear",
            }}
          />
        </div>
      </div>

      <span
        style={{
          fontSize: 10.5,
          fontVariantNumeric: "tabular-nums",
          color: outbound ? "var(--c-bubble-out-text)" : "var(--c-text2)",
          opacity: 0.85,
          flexShrink: 0,
          minWidth: 30,
        }}
      >
        {fmt(playing || current > 0 ? current : duration)}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MEDIA ATTACHMENT — image / video / document rendering for the message
   bubble. Audio is handled separately by VoiceMessagePlayer above.

   Before this existed the bubble only special-cased audio, so an image or a
   PDF fell through to `{msg.content}` and rendered as a bare filename string
   even though the file itself had been delivered fine.
───────────────────────────────────────────────────────────────────────────── */

/** Display name for a media message: the persisted filename, falling back to
 *  the optimistic attachmentName, then to the URL's last path segment. */
function mediaLabel(msg: ChatMessage): string {
  if (msg.fileName) return msg.fileName;
  if (msg.attachmentName) return msg.attachmentName;
  try {
    const path = new URL(msg.mediaUrl as string).pathname;
    return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1)) || "File";
  } catch {
    return "File";
  }
}

/** "245 KB" / "1.4 MB" — the subtitle WhatsApp shows on a document card. */
function fmtBytes(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Uppercase extension ("PDF", "DOCX") for the document card subtitle. */
function fileExt(label: string): string | null {
  const dot = label.lastIndexOf(".");
  if (dot < 0 || dot === label.length - 1) return null;
  const ext = label.slice(dot + 1).toUpperCase();
  return ext.length <= 5 ? ext : null;
}

/**
 * Media messages persist a `content` string purely so the conversation list
 * has a snippet — either the filename, or a bracket placeholder the webhook
 * writes for inbound media ("[Image]", "[Sticker]", …). Neither should be
 * printed underneath the rendered file; only a real user caption should.
 */
const MEDIA_PLACEHOLDERS = new Set([
  "[image]",
  "[sticker]",
  "[video]",
  "[audio]",
  "[document]",
]);

function isCaptionRedundant(msg: ChatMessage): boolean {
  if (!msg.mediaUrl || !msg.content) return false;
  const content = msg.content.trim();
  if (MEDIA_PLACEHOLDERS.has(content.toLowerCase())) return true;
  const label = msg.fileName || msg.attachmentName;
  return !!label && content === label.trim();
}

/** True when the bubble should collapse its chrome around the media —
 *  WhatsApp renders a bare photo/sticker with no padding or background. */
export function isBareMedia(msg: ChatMessage): boolean {
  if (!msg.mediaUrl) return false;
  if (msg.messageType === "sticker") return true;
  const isPicture = msg.messageType === "image" || msg.messageType === "video";
  return isPicture && isCaptionRedundant(msg);
}

function MediaAttachment({ msg }: { msg: ChatMessage }) {
  const src = msg.mediaUrl as string;
  const label = mediaLabel(msg);
  const type = msg.messageType;
  const hasCaption = !isCaptionRedundant(msg) && !!msg.content?.trim();

  // Stickers render bare — no background, no border, like WhatsApp.
  if (type === "sticker") {
    return (
      <img
        src={src}
        alt="Sticker"
        loading="lazy"
        style={{
          display: "block",
          width: 128,
          height: 128,
          objectFit: "contain",
        }}
      />
    );
  }

  if (type === "image") {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        style={{ display: "block" }}
      >
        <img
          src={src}
          alt={label}
          loading="lazy"
          style={{
            display: "block",
            width: "100%",
            maxHeight: 330,
            borderRadius: 10,
            objectFit: "cover",
            marginBottom: hasCaption ? 6 : 0,
            cursor: "pointer",
          }}
        />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        style={{
          display: "block",
          width: "100%",
          maxHeight: 330,
          borderRadius: 10,
          marginBottom: hasCaption ? 6 : 0,
        }}
      />
    );
  }

  // document (and any unknown media type) → downloadable file card
  const meta = [fileExt(label), fmtBytes(msg.fileSize)]
    .filter(Boolean)
    .join(" · ");

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      download={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: hasCaption ? 6 : 0,
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--c-hover-strong)",
        border: "1px solid var(--c-border1)",
        textDecoration: "none",
        color: "inherit",
        minWidth: 200,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "rgba(224,102,102,.16)",
          flexShrink: 0,
        }}
      >
        <FileText style={{ width: 17, height: 17, color: "#e06666" }} />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        {meta && (
          <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>

      <Download
        style={{ width: 15, height: 15, opacity: 0.75, flexShrink: 0 }}
      />
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MESSAGE BUBBLE
───────────────────────────────────────────────────────────────────────────── */
export const MessageBubble = function MessageBubble({
  msg,
  outbound,
  onAction,
  starred,
  pinned,
  info,
  onCloseInfo,
  highlight,
  customerName,
  isLastInGroup = true,
}: {
  msg: ChatMessage;
  outbound: boolean;
  onAction: (key: MessageActionKey, msg: ChatMessage) => void;
  starred?: boolean;
  pinned?: boolean;
  info?: boolean;
  onCloseInfo?: () => void;
  highlight?: boolean;
  customerName?: string;
  isLastInGroup?: boolean;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Caption-less photos/videos/stickers shed the bubble's chrome (see the
  // style block below) so the media itself is the message.
  const bareMedia = isBareMedia(msg);

  return (
    <div
      className="msg-group anim-msg-in"
      style={{
        display: "flex",
        justifyContent: outbound ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: 8,
        marginBottom: 2,
        position: "relative",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {!outbound && <Avatar name={customerName} size={26} />}
      <div style={{ position: "relative", maxWidth: "64%" }}>
        {menu && (
          <MessageContextMenu
            x={menu.x}
            y={menu.y}
            outbound={outbound}
            pinned={pinned}
            starred={starred}
            onAction={(key) => onAction(key, msg)}
            onClose={() => setMenu(null)}
          />
        )}

        {(pinned || starred) && (
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 3,
              justifyContent: outbound ? "flex-end" : "flex-start",
            }}
          >
            {pinned && (
              <span
                style={{
                  fontSize: 9.5,
                  color: "var(--c-text3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Pin style={{ width: 9, height: 9 }} />
                Pinned
              </span>
            )}
            {starred && (
              <Star
                style={{
                  width: 10,
                  height: 10,
                  color: "var(--c-warning-text)",
                  fill: "var(--c-warning-text)",
                }}
              />
            )}
          </div>
        )}

        {msg.replyToPreview && (
          <div
            style={{
              marginBottom: 3,
              padding: "5px 9px",
              borderRadius: 8,
              borderLeft: "3px solid var(--c-accent)",
              background: "var(--c-hover)",
              fontSize: 11.5,
              color: "var(--c-text2)",
              lineHeight: 1.4,
            }}
          >
            {msg.replyToPreview}
          </div>
        )}

        <div
          className={`bubble ${outbound ? "bubble-out" : "bubble-in"}${isLastInGroup ? (outbound ? " tail-out" : " tail-in") : ""}`}
          style={{
            // A caption-less photo, video or sticker drops the bubble's
            // padding, fill and border so the media reads as the message
            // itself — the way WhatsApp renders it — instead of sitting
            // inside a coloured box.
            padding: bareMedia ? 0 : "8px 12px 9px",
            borderRadius: 14,
            borderTopRightRadius: outbound ? (isLastInGroup ? 3 : 14) : 14,
            borderTopLeftRadius: outbound ? 14 : isLastInGroup ? 3 : 14,
            overflow: bareMedia ? "hidden" : undefined,
            background: bareMedia
              ? "transparent"
              : outbound
                ? "var(--c-bubble-out)"
                : "var(--c-bubble-in)",
            border: bareMedia
              ? "none"
              : `1px solid ${outbound ? "var(--c-bubble-out-border)" : "var(--c-bubble-in-border)"}`,
            color: outbound
              ? "var(--c-bubble-out-text)"
              : "var(--c-bubble-in-text)",
            fontSize: 13.5,
            lineHeight: 1.58,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            boxShadow: highlight ? "0 0 0 2px var(--c-accent)" : undefined,
          }}
        >
          {msg.messageType === "audio" && msg.mediaUrl ? (
            <VoiceMessagePlayer
              src={msg.mediaUrl}
              outbound={outbound}
              fallbackDuration={msg.durationSec}
            />
          ) : msg.mediaUrl ? (
            <MediaAttachment msg={msg} />
          ) : (
            msg.attachmentName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                  padding: "6px 10px",
                  borderRadius: 9,
                  background: "var(--c-hover-strong)",
                  border: "1px solid var(--c-border1)",
                }}
              >
                <FileText
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--c-text1)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--c-text1)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {msg.attachmentName}
                </span>
              </div>
            )
          )}
          {msg.messageType !== "audio" && !isCaptionRedundant(msg) && msg.content}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: outbound ? "flex-end" : "flex-start",
              gap: 4,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--c-text2)",
                opacity: 0.85,
                letterSpacing: ".01em",
              }}
            >
              {fmtTime(msg.createdAt)}
            </span>
            {outbound && <StatusDot s={msg.status} />}
          </div>
        </div>

        {info && (
          <div
            className="anim-fade-up"
            style={{
              marginTop: 5,
              padding: "8px 10px",
              borderRadius: 9,
              background: "var(--c-surface3)",
              border: "1px solid var(--c-border2)",
              fontSize: 10.5,
              color: "var(--c-text1)",
            }}
          >
            {(
              [
                ["Sent", new Date(msg.createdAt).toLocaleString()],
                ["Status", msg.status || "received"],
                ["ID", String(msg._id).slice(-8)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 2,
                }}
              >
                <span style={{ color: "var(--c-text2)" }}>{k}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10.5 }}>
                  {v}
                </span>
              </div>
            ))}
            <button
              onClick={onCloseInfo}
              style={{
                marginTop: 5,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--c-text2)",
                fontSize: 10.5,
                padding: 0,
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
      {outbound && <div style={{ width: 26 }} />}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   TYPING INDICATOR
───────────────────────────────────────────────────────────────────────────── */
export function TypingIndicator({ name }: { name?: string }) {
  return (
    <div
      className="anim-fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0 8px 34px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 3,
          padding: "7px 10px",
          background: "var(--c-surface2)",
          borderRadius: 12,
          border: "1px solid var(--c-border1)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="typing-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--c-text2)",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "var(--c-text2)" }}>
        {name || "Customer"} is typing…
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PINNED BAR
───────────────────────────────────────────────────────────────────────────── */
export function PinnedBar({
  pinnedMsgs,
  onJump,
  onUnpin,
}: {
  pinnedMsgs: ChatMessage[];
  onJump: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!pinnedMsgs.length) return null;
  return (
    <div
      style={{
        borderBottom: "1px solid var(--c-border1)",
        background: "var(--c-warning-dim)",
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Pin
          style={{ width: 11, height: 11, color: "var(--c-warning-text)" }}
        />
        <span
          style={{
            fontSize: 11.5,
            color: "var(--c-warning-text)",
            fontWeight: 500,
          }}
        >
          {pinnedMsgs.length} pinned
        </span>
        <ChevronDown
          style={{
            width: 11,
            height: 11,
            color: "var(--c-text2)",
            marginLeft: "auto",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s",
          }}
        />
      </button>
      {open && (
        <div
          className="anim-fade-up"
          style={{
            padding: "0 16px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {pinnedMsgs.map((m) => (
            <div
              key={m._id}
              onClick={() => onJump(m)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                background: "var(--c-surface2)",
                border: "1px solid var(--c-border1)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--c-text1)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.content}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnpin(m);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <X style={{ width: 11, height: 11, color: "var(--c-text2)" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONVERSATION BODY
───────────────────────────────────────────────────────────────────────────── */
export function ConversationBody({
  inThreadSearch,
  threadQuery,
  setThreadQuery,
  visibleMsgCount,
  onCloseThreadSearch,
  pinnedMsgObjs,
  onUnpinMsg,
  onJumpToMsg,
  scrollRef,
  onScroll,
  groupedMsgs,
  msgRefs,
  handleMsgAction,
  starredMsgIds,
  pinnedMsgIds,
  infoIds,
  setInfoIds,
  isTyping,
  bottomRef,
  atBottom,
  goBottom,
  customerName,
  loadingOlder,
}: {
  inThreadSearch: boolean;
  threadQuery: string;
  setThreadQuery: (v: string) => void;
  visibleMsgCount: number;
  onCloseThreadSearch: () => void;
  pinnedMsgObjs: ChatMessage[];
  onUnpinMsg: (m: ChatMessage) => void;
  onJumpToMsg: (m: ChatMessage) => void;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onScroll: () => void;
  groupedMsgs: MessageDayGroup[];
  msgRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  handleMsgAction: (key: MessageActionKey, msg: ChatMessage) => void;
  starredMsgIds: Set<string>;
  pinnedMsgIds: Set<string>;
  infoIds: Record<string, boolean>;
  setInfoIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isTyping?: TypingEntry;
  bottomRef: React.MutableRefObject<HTMLDivElement | null>;
  atBottom: boolean;
  goBottom: () => void;
  customerName?: string;
  loadingOlder?: boolean;
}) {
  return (
    <>
      {inThreadSearch && (
        <div
          className="anim-fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 16px",
            borderRadius: 14,
            border: "1px solid var(--c-border1)",
            margin: "12px 16px 0",
            background: "var(--c-surface0)",
            flexShrink: 0,
          }}
        >
          <Search style={{ width: 13, height: 13, color: "var(--c-text2)" }} />
          <input
            autoFocus
            value={threadQuery}
            onChange={(e) => setThreadQuery(e.target.value)}
            placeholder="Search in conversation…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--c-text0)",
              fontSize: 12.5,
              padding: "0 12px",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--c-text2)" }}>
            {visibleMsgCount} result{visibleMsgCount === 1 ? "" : "s"}
          </span>
          <button
            onClick={onCloseThreadSearch}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X style={{ width: 13, height: 13, color: "var(--c-text2)" }} />
          </button>
        </div>
      )}

      <PinnedBar
        pinnedMsgs={pinnedMsgObjs}
        onUnpin={onUnpinMsg}
        onJump={onJumpToMsg}
      />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll chat-wall"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 6%",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          backgroundImage: `radial-gradient(var(--c-wall-pattern, rgba(255,255,255,0.02)) 1px, transparent 1px), radial-gradient(var(--c-wall-pattern, rgba(255,255,255,0.02)) 1px, transparent 1px)`,
          backgroundSize: "28px 28px, 28px 28px",
          backgroundPosition: "0 0, 14px 14px",
        }}
      >
        {loadingOlder && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "10px 0",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--c-text2)" }}>
              Loading older messages…
            </span>
          </div>
        )}
        {groupedMsgs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "var(--c-text2)",
            }}
          >
            <MessageSquare
              style={{
                width: 32,
                height: 32,
                marginBottom: 10,
                opacity: 0.15,
              }}
            />
            <span style={{ fontSize: 13 }}>
              {inThreadSearch ? "No matching messages" : "No messages yet"}
            </span>
          </div>
        ) : (
          groupedMsgs.map(({ label, msgs: group }, dayIdx) => (
            <div key={`day-${dayIdx}-${label}`}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "18px 0 12px",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--c-text1)",
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: "var(--c-surface2)",
                    boxShadow: "var(--c-shadow-1)",
                    fontWeight: 500,
                    letterSpacing: ".01em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
              </div>

              {group.map((msg, msgIdx) => {
                if (msg.direction === "note") {
                  return (
                    <div
                      key={msg._id}
                      ref={(el) => {
                        msgRefs.current[msg._id] = el;
                      }}
                      className="anim-fade-up"
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        margin: "6px 0",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "70%",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 7,
                          padding: "8px 12px",
                          borderRadius: 10,
                          background: "var(--c-warning-dim)",
                          border: "1px solid rgba(245,158,11,0.16)",
                        }}
                      >
                        <StickyNote
                          style={{
                            width: 12,
                            height: 12,
                            color: "var(--c-warning-text)",
                            marginTop: 1,
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--c-warning-text)",
                              lineHeight: 1.5,
                            }}
                          >
                            {msg.content}
                          </div>
                          <div
                            style={{
                              fontSize: 9.5,
                              color: "rgba(245,158,11,0.55)",
                              marginTop: 3,
                            }}
                          >
                            Internal note · {fmtTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                const out = msg.direction === "outbound";
                const highlight = !!(
                  inThreadSearch &&
                  threadQuery &&
                  msg.content?.toLowerCase().includes(threadQuery.toLowerCase())
                );
                const nextMsg = group[msgIdx + 1];
                const isLastInGroup =
                  !nextMsg || nextMsg.direction !== msg.direction;
                return (
                  <div
                    key={msg._id}
                    ref={(el) => {
                      msgRefs.current[msg._id] = el;
                    }}
                    style={{ position: "relative" }}
                  >
                    <MessageBubble
                      msg={msg}
                      outbound={out}
                      onAction={handleMsgAction}
                      starred={starredMsgIds.has(msg._id)}
                      pinned={pinnedMsgIds.has(msg._id)}
                      info={infoIds[msg._id]}
                      highlight={highlight}
                      customerName={customerName}
                      isLastInGroup={isLastInGroup}
                      onCloseInfo={() =>
                        setInfoIds((s) => {
                          const n = { ...s };
                          delete n[msg._id];
                          return n;
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          ))
        )}

        {isTyping && <TypingIndicator name={isTyping.name} />}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {!atBottom && (
        <button
          onClick={goBottom}
          style={{
            position: "absolute",
            bottom: 148,
            right: 18,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--c-surface3)",
            border: "1px solid var(--c-border2)",
            color: "var(--c-text0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "var(--c-shadow-2)",
            zIndex: 5,
          }}
        >
          <ChevronDown style={{ width: 15, height: 15 }} />
        </button>
      )}
    </>
  );
}

export default ConversationBody;