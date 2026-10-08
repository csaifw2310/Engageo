import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Smile,
  Paperclip,
  Zap,
  Reply,
  X,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import ReactEmojiPicker, {
  Theme as EmojiTheme,
  type EmojiClickData,
} from "emoji-picker-react";
import VoiceRecorder, { type RecordedVoiceNote } from "../VoiceRecorder";
import type { SavedReply } from "../../../types/conversation";
import type { ChatMessage, Attachment } from "../../../types/message";
import { C, IconBtn } from "./ConversationUI";

/* ─────────────────────────────────────────────────────────────────────────────
   EMOJI PICKER — unchanged, still your real emoji-picker-react wiring
   Z-INDEX FIX: 60 → 1000 (see Composer wrapper comment below for root cause)
───────────────────────────────────────────────────────────────────────────── */
function EmojiPicker({
  onSelect,
  onClose,
  theme,
}: {
  onSelect: (em: string) => void;
  onClose: () => void;
  theme?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="anim-pop emoji-popover"
      style={{
        position: "absolute",
        bottom: "calc(100% + 12px)",
        left: 0,
        zIndex: 1000,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow:
          "0 24px 56px rgba(0,0,0,.5), 0 2px 0 rgba(255,255,255,0.03) inset",
        border: `1px solid ${C.border2}`,
      }}
    >
      <ReactEmojiPicker
        onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
        theme={theme === "light" ? EmojiTheme.LIGHT : EmojiTheme.DARK}
        autoFocusSearch={false}
        searchDisabled={false}
        skinTonesDisabled={false}
        previewConfig={{ showPreview: false }}
        lazyLoadEmojis
        width={320}
        height={380}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE CONFIRMATION POPOVER
   Replaces window.confirm() with an in-app card that matches the Engageo
   design system (same surface/border/shadow language as EmojiPicker /
   QuickRepliesMenu). Anchored over the saved-replies menu as an overlay.
   - Cancel (secondary) / Delete (danger) actions
   - Clicking outside or Cancel closes it without deleting
   - Delete calls onConfirm() (which triggers onDeleteReply(id)) and closes
───────────────────────────────────────────────────────────────────────────── */
function ConfirmDeletePopover({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onCancel]);

  return (
    <div
      className="anim-pop"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
      }}
    >
      <div
        ref={ref}
        style={{
          width: 232,
          background: C.surface3,
          border: `1px solid ${C.border2}`,
          borderRadius: 12,
          boxShadow: "0 24px 48px rgba(0,0,0,.55)",
          padding: 14,
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: C.text0,
            marginBottom: 4,
          }}
        >
          Delete saved reply?
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: C.text2,
            lineHeight: 1.4,
            marginBottom: 14,
          }}
        >
          This action cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 12px",
              fontSize: 11.5,
              fontWeight: 500,
              border: `1px solid ${C.border2}`,
              borderRadius: 8,
              background: "transparent",
              color: C.text1,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "6px 12px",
              fontSize: 11.5,
              fontWeight: 600,
              border: "none",
              borderRadius: 8,
              background: "#ef4444",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SAVED REPLIES
   - Z-INDEX FIX: 60 → 1000
   - NEW: "replies" now comes from the parent (ConversationLogic's savedReplies
     state) instead of the static DEFAULT_SAVED_REPLIES import, so replies
     added below actually show up here.
   - NEW: "+ Add new reply" inline mini-form at the bottom of the list, wired
     to the new onAddReply prop (→ ConversationLogic's addSavedReply).
   - NEW: window.confirm() removed. Deletion now goes through an in-app
     ConfirmDeletePopover (confirmingId state) instead of the native browser
     dialog. The delete trigger button is a premium destructive icon button
     (36×36 hit area, muted → red on hover, darker red on active).
───────────────────────────────────────────────────────────────────────────── */
function QuickRepliesMenu({
  open,
  replies,
  onPick,
  onAddReply,
  onDeleteReply,
}: {
  open: boolean;
  onClose: () => void;
  replies: SavedReply[];
  onPick: (r: SavedReply) => void;
  onAddReply: (title: string, body: string) => void;
  onDeleteReply: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (!open) return null;

  const canSave = newTitle.trim().length > 0 && newBody.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onAddReply(newTitle.trim(), newBody.trim());
    setNewTitle("");
    setNewBody("");
    setAdding(false);
  };

  return (
    <div
      className="anim-pop"
      style={{
        position: "absolute",
        bottom: "calc(100% + 10px)",
        left: 0,
        zIndex: 1000,
        width: 300,
        background: C.surface3,
        border: `1px solid ${C.border2}`,
        borderRadius: 14,
        boxShadow: "0 24px 48px rgba(0,0,0,.55)",
        overflow: "hidden",
      }}
    >
      <style>{`
        .delete-reply-btn {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: ${C.text2};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 180ms ease, color 180ms ease;
        }
        .delete-reply-btn:hover {
          background: rgba(239, 68, 68, 0.14);
          color: #ef4444;
        }
        .delete-reply-btn:active {
          background: rgba(239, 68, 68, 0.24);
        }
      `}</style>

      {/* Header for saved replies */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 14px",
          borderBottom: `1px solid ${C.border1}`,
          background:
            "linear-gradient(180deg, var(--c-theme-wash-soft, transparent), transparent 120%)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 22,
            height: 22,
            borderRadius: 7,
            flexShrink: 0,
            background:
              "linear-gradient(145deg, var(--c-theme-solid, var(--c-accent)), var(--c-accent-hover))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 2px 8px -2px var(--c-theme-wash-soft, transparent), 0 0 0 1px rgba(255,255,255,0.08) inset",
          }}
        >
          <Zap style={{ width: 12, height: 12, color: "#fff" }} />
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: C.text2,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            flex: 1,
          }}
        >
          Saved replies
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--c-theme-solid, var(--c-accent-text))",
            background: "var(--c-theme-wash-soft, var(--c-accent-dim))",
            border: `1px solid var(--c-theme-wash-strong, rgba(99,102,241,0.2))`,
            padding: "3px 8px",
            borderRadius: 99,
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "currentColor",
            }}
          />
          {replies.length}
        </span>
      </div>

      {/* Footer for saved replies : tip goes at the very bottom, after "Add new reply", not at top */}

      <div
        style={{
          padding: "10px 12px",
          borderTop: `1px solid ${C.border0}`,
          background: `linear-gradient(0deg, ${C.surface2}, transparent)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "7px 10px",
            borderRadius: 10,
            background: C.surface2,
            border: `1px solid ${C.border0}`,
          }}
        >
          <span style={{ fontSize: 11, color: C.text3 }}>Type</span>
          <kbd
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 17,
              height: 17,
              padding: "0 5px",
              borderRadius: 5,
              background: `linear-gradient(180deg, ${C.surface3}, ${C.surface2})`,
              border: `1px solid ${C.border2}`,
              fontSize: 10.5,
              fontFamily: "monospace",
              fontWeight: 600,
              color: C.text0,
              boxShadow:
                "0 1.5px 0 rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,0.03) inset",
            }}
          >
            /
          </kbd>
          <span style={{ fontSize: 11, color: C.text3 }}>
            to open saved replies
          </span>
        </div>
      </div>

      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {replies.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderBottom: `1px solid ${C.border0}`,
            }}
          >
            <button
              onClick={() => onPick(r)}
              className="menu-item"
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "left",
                padding: "9px 12px",
                border: "none",
                cursor: "pointer",
                background: "transparent",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.text0,
                  marginBottom: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                /{r.title}
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color: C.text2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.body}
              </div>
            </button>

            <div
              style={{
                position: "relative",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                paddingRight: 6,
              }}
            >
              <button
                title="Delete saved reply"
                className="delete-reply-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingId(r.id);
                }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add-new-reply inline form */}
      <div style={{ borderTop: `1px solid ${C.border1}` }}>
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 12px",
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: C.text1,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <Plus style={{ width: 13, height: 13 }} />
            Add new reply
          </button>
        ) : (
          <div
            style={{
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. Refund policy)"
              style={{
                width: "100%",
                background: C.surface2,
                border: `1px solid ${C.border2}`,
                borderRadius: 8,
                padding: "6px 8px",
                fontSize: 12,
                color: C.text0,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Message body"
              rows={2}
              style={{
                width: "100%",
                background: C.surface2,
                border: `1px solid ${C.border2}`,
                borderRadius: 8,
                padding: "6px 8px",
                fontSize: 12,
                color: C.text0,
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                  setNewBody("");
                }}
                style={{
                  padding: "5px 10px",
                  fontSize: 11.5,
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
                  color: C.text2,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                style={{
                  padding: "5px 10px",
                  fontSize: 11.5,
                  fontWeight: 500,
                  border: "none",
                  borderRadius: 8,
                  background: canSave ? C.success : C.surface4,
                  color: "#fff",
                  cursor: canSave ? "pointer" : "default",
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmingId && (
        <ConfirmDeletePopover
          onCancel={() => setConfirmingId(null)}
          onConfirm={() => {
            onDeleteReply(confirmingId);
            setConfirmingId(null);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPOSER

   Z-INDEX FIX (popup rendering behind message bubbles):
     Root cause — QuickRepliesMenu/EmojiPicker were only positioned relative
     to their immediate parent, but the OUTER composer wrapper below had no
     `position` / `z-index` of its own. Message bubbles elsewhere in the tree
     create their own stacking contexts (transform/animation classes like
     anim-msg-in), and without an explicit stacking context here, those
     bubbles could paint above the popups regardless of the popup's own
     z-index. Fix: give the outer wrapper `position: relative, zIndex: 30`
     so the whole composer (and everything absolutely positioned inside it)
     forms one proper stacking context above the message list, and bump the
     popups themselves to zIndex: 1000 as extra headroom.

   NEW — custom saved reply add/save:
     Composer now receives `savedReplies` (from ConversationLogic's state,
     no longer the static DEFAULT_SAVED_REPLIES import) and `onAddSavedReply`
     to add new replies, wired into QuickRepliesMenu's inline form.

   Everything else (voice recorder swap, Enter-to-send IME guard, etc.)
   unchanged from before.
───────────────────────────────────────────────────────────────────────────── */
export function Composer({
  draft,
  setDraft,
  onSend,
  sending,
  composerMode,
  showEmoji,
  setShowEmoji,
  showQuickReplies,
  setShowQuickReplies,
  replyTo,
  setReplyTo,
  attachment,
  setAttachment,
  onAttachClick,
  taRef,
  disabled,
  onVoiceRecorded,
  onVoiceError,
  theme,
  savedReplies,
  onAddSavedReply,
  onDeleteSavedReply,
}: {
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  sending: boolean;
  composerMode: "reply" | "note";
  setComposerMode: (m: "reply" | "note") => void;
  showEmoji: boolean;
  setShowEmoji: React.Dispatch<React.SetStateAction<boolean>>;
  showQuickReplies: boolean;
  setShowQuickReplies: React.Dispatch<React.SetStateAction<boolean>>;
  replyTo: ChatMessage | null;
  setReplyTo: (m: ChatMessage | null) => void;
  attachment: Attachment | null;
  setAttachment: (a: Attachment | null) => void;
  onAttachClick: () => void;
  taRef: React.RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
  onVoiceRecorded: (note: RecordedVoiceNote) => void;
  onVoiceError: (message: string) => void;
  theme?: string;
  savedReplies: SavedReply[];
  onAddSavedReply: (title: string, body: string) => void;
  onDeleteSavedReply: (id: string) => void;
}) {
  const hasText = draft.trim().length > 0 || !!attachment;
  // Tracks VoiceRecorder's live recording state so this composer can make
  // room for the wider "recording" pill instead of clipping/overlapping it.
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  return (
    <div
      style={{
        flexShrink: 0,
        padding: "10px 14px",
        borderTop: `1px solid ${C.border1}`,
        background: `linear-gradient(0deg, var(--c-theme-wash-soft, transparent), transparent 130%), ${C.surface0}`,
        // Z-INDEX FIX: explicit stacking context for the whole composer so
        // its absolutely-positioned children (EmojiPicker, QuickRepliesMenu)
        // reliably render above the message list, not just relative to
        // this div's siblings.
        position: "relative",
        zIndex: 30,
      }}
    >
      {replyTo && (
        <div
          className="anim-fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            marginBottom: 7,
            borderRadius: 14,
            background: "var(--c-theme-wash-soft, " + C.accentDim + ")",
            border: `1px solid var(--c-theme-wash-strong, rgba(99,102,241,0.2))`,
          }}
        >
          <Reply
            style={{
              width: 11,
              height: 11,
              color: "var(--c-theme-solid, " + C.accentText + ")",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11.5,
              color: "var(--c-theme-solid, " + C.accentText + ")",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {replyTo.content}
          </span>
          <button
            onClick={() => setReplyTo(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X
              style={{
                width: 11,
                height: 11,
                color: "var(--c-theme-solid, " + C.accentText + ")",
              }}
            />
          </button>
        </div>
      )}
      {attachment && (
        <div
          className="anim-fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            marginBottom: 7,
            borderRadius: 14,
            background: C.surface2,
            border: `1px solid ${C.border2}`,
          }}
        >
          <FileText
            style={{ width: 11, height: 11, color: C.text1, flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 11.5,
              color: C.text1,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {attachment.name}
          </span>
          <button
            onClick={() => setAttachment(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X style={{ width: 11, height: 11, color: C.text2 }} />
          </button>
        </div>
      )}

      <div
        className="composer-shell"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 5,
          background: composerMode === "note" ? C.warningDim : C.surface2,
          border: `1px solid ${composerMode === "note" ? C.warningDim : C.border1}`,
          borderRadius: 24,
          padding: "7px 9px",
          position: "relative",
          transition: "all .2s ease",
        }}
      >
        {/* When recording, hide everything else so the mic wrapper can take
            the full row width — this is what stops the wider "recording"
            pill from overflowing on top of the textarea/placeholder. */}
        {!isRecordingVoice && (
          <>
            {/* 1. Emoji */}
            <div
              style={{ position: "relative", flexShrink: 0, display: "flex" }}
            >
              <IconBtn
                icon={Smile}
                title="Emoji"
                onClick={() => setShowEmoji((v) => !v)}
                active={showEmoji}
                size={14}
              />
              {showEmoji && (
                <EmojiPicker
                  onSelect={(em) => {
                    setDraft((d) => d + em);
                    setShowEmoji(false);
                    taRef.current?.focus();
                  }}
                  onClose={() => setShowEmoji(false)}
                  theme={theme}
                />
              )}
            </div>

            {/* 2. File attachment */}
            <IconBtn
              icon={Paperclip}
              title="Attach file"
              onClick={onAttachClick}
              active={!!attachment}
              size={14}
            />

            {/* 3. Saved replies */}
            <div
              style={{ position: "relative", flexShrink: 0, display: "flex" }}
            >
              <IconBtn
                icon={Zap}
                title="Saved replies (/)"
                onClick={() => setShowQuickReplies((v) => !v)}
                active={showQuickReplies}
                size={14}
              />
              <QuickRepliesMenu
                open={showQuickReplies}
                onClose={() => setShowQuickReplies(false)}
                replies={savedReplies}
                onPick={(r) => {
                  setDraft(r.body);
                  setShowQuickReplies(false);
                  taRef.current?.focus();
                }}
                onAddReply={onAddSavedReply}
                onDeleteReply={onDeleteSavedReply}
              />
            </div>

            {/* 4. Text input */}
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                composerMode === "note"
                  ? "Leave a note for your team…"
                  : "Type a message…"
              }
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: C.text0,
                fontSize: 13.5,
                lineHeight: 1.55,
                maxHeight: 120,
                padding: "3px 2px",
                fontFamily: "inherit",
              }}
              onKeyDown={(e) => {
                // Ignore Enter fired while an IME/predictive keyboard (Gboard,
                // SwiftKey, etc.) is still composing — e.g. confirming a word
                // suggestion. Sending on that Enter fires before the composed
                // text is committed to `draft`, so the next keystroke starts a
                // fresh send and the two land joined together with no space.
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!draft.trim() || sending || disabled) return;
                  onSend();
                }
                if (e.key === "/" && draft === "") setShowQuickReplies(true);
              }}
            />
          </>
        )}

        {/* 5/6. Mic ⟷ Send — swap based on whether there's text (ported from
            Bolt). The mic wrapper is responsive: it's a small fixed circle
            while idle, and grows to fill the row (flex: 1, minWidth: 0)
            while recording so VoiceRecorder's wider pill has room to render
            without overlapping anything. */}
        {!hasText ? (
          <div
            style={{
              flex: isRecordingVoice ? "1 1 auto" : "0 0 auto",
              width: isRecordingVoice ? "auto" : 34,
              height: 34,
              minWidth: 0,
              borderRadius: isRecordingVoice ? 24 : "50%",
              background: isRecordingVoice ? "transparent" : C.surface3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background .15s ease",
            }}
            onMouseEnter={(e) => {
              if (isRecordingVoice) return;
              (e.currentTarget as HTMLDivElement).style.background = C.surface4;
            }}
            onMouseLeave={(e) => {
              if (isRecordingVoice) return;
              (e.currentTarget as HTMLDivElement).style.background = C.surface3;
            }}
          >
            <VoiceRecorder
              onRecorded={onVoiceRecorded}
              onError={onVoiceError}
              onRecordingChange={setIsRecordingVoice}
            />
          </div>
        ) : (
          <button
            onClick={onSend}
            disabled={sending || disabled}
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background:
                !sending && !disabled
                  ? composerMode === "note"
                    ? C.warning
                    : "var(--c-theme-solid, var(--c-accent))"
                  : C.surface4,
              cursor: !sending && !disabled ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background .15s ease",
            }}
          >
            {sending ? (
              <Loader2
                style={{
                  width: 13,
                  height: 13,
                  color: "#fff",
                  animation: "spin 1s linear infinite",
                }}
              />
            ) : (
              <Send style={{ width: 12, height: 12, color: "#fff" }} />
            )}
          </button>
        )}
      </div>

      <p style={{ fontSize: 10, color: C.text3, marginTop: 6, paddingLeft: 2 }}>
        Enter to send · Shift+Enter new line · / for saved replies · right-click
        message for options
      </p>
    </div>
  );
}

export default Composer;
