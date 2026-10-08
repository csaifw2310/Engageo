import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Maximize2, Minimize2 } from "lucide-react";
import {
  FONT,
  ToastStack,
  CommandPalette,
  ForwardModal,
  SettingsModal,
  LinkContactModal,
  LeftPanel,
  RightPanel,
} from "../components/conversations/conversation-page/ConversationUI";
import { ThreadHeader } from "../components/conversations/conversation-page/ConversationHeader";
import { ConversationBody } from "../components/conversations/conversation-page/ConversationBody";
import { Composer } from "../components/conversations/conversation-page/ConversationComposer";
import { useConversationPageLogic } from "../components/conversations/conversation-page/ConversationLogic.ts";
import ThemeBackdrop from "../components/conversations/conversation-page/ThemeBackdrop.tsx";
import {
  useIsInboxCompact,
  useIsInboxMobile,
} from "../hooks/useMediaQuery";

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function ConversationsPage() {
  const logic = useConversationPageLogic();
  const {
    selected,
    loading,
    draft,
    setDraft,
    sending,
    search,
    setSearch,
    filter,
    setFilter,
    showEmoji,
    setShowEmoji,
    showQuickReplies,
    setShowQuickReplies,
    atBottom,
    scrollDepth,
    loadingOlder,
    composerMode,
    setComposerMode,
    cmdOpen,
    setCmdOpen,
    inThreadSearch,
    setInThreadSearch,
    threadQuery,
    setThreadQuery,
    replyTo,
    setReplyTo,
    attachment,
    setAttachment,
    forwardTarget,
    setForwardTarget,
    settingsOpen,
    setSettingsOpen,
    toasts,
    infoIds,
    setInfoIds,
    pinnedConvIds,
    mutedConvIds,
    archivedConvIds,
    pinnedMsgIds,
    starredMsgIds,
    appearance,
    setAppearance,
    sidebarCollapsed,
    setSidebarCollapsed,
    rightCollapsed,
    setRightCollapsed,
    focusMode,
    setFocusMode,
    onlineUsers,
    theme,
    isFullscreen,
    setIsFullscreen,
    scrollRef,
    bottomRef,
    taRef,
    fileInputRef,
    msgRefs,
    connected,
    pick,
    profile,
    setProfile,
    groupedMsgs,
    visibleMsgCount,
    pinnedMsgObjs,
    isTyping,
    onScroll,
    goBottom,
    send,
    handleMsgAction,
    handleForward,
    handleHeaderAction,
    selectedNotifPrefs,
    handleToggleNotifications,
    handleToggleSound,
    handleVoiceRecorded,
    handleVoiceError,
    handleSaveNotes,
    handleSaveProfileName,
    handleSaveTag,
    handleAttachClick,
    handleFileChosen,
    linkContactModalOpen,
    openLinkContactModal,
    closeLinkContactModal,
    checkMatchingContact,
    linkExistingContact,
    createAndLinkNewContact,
    convsList,
    appearanceVars,
    savedReplies,
    addSavedReply,
    deleteSavedReply,
  } = logic;

  /* ── Runtime-measured embed height ───────────────────────────────────
     Replaces the old (missing) .conv-embed-frame CSS-class dependency.
     Instead of hardcoding DashboardLayout's topbar height or padding
     values here (which would silently break again the moment those
     Tailwind classes change), we measure the actual available space at
     runtime:
       - containerRef.getBoundingClientRect().top already reflects the
         fixed topbar height + the parent wrapper's top padding, whatever
         those currently are.
       - The parent wrapper's bottom padding is read live via
         getComputedStyle, not assumed.
     This makes the panel's height self-correcting against any future
     change to DashboardLayout.tsx or its Tailwind classes, without this
     file needing to know their exact values — and without touching
     DashboardLayout.tsx or index.css at all.
     Skipped entirely in fullscreen mode, which already gets a real
     position:fixed 100vh box from outerStyle below.
  ───────────────────────────────────────────────────────────────────── */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [embedHeight, setEmbedHeight] = useState<number | null>(null);

  useEffect(() => {
    if (isFullscreen) return;
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const recalc = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const parent = el.parentElement;
        const parentPaddingBottom = parent
          ? parseFloat(getComputedStyle(parent).paddingBottom || "0")
          : 0;
        const available = window.innerHeight - rect.top - parentPaddingBottom;
        setEmbedHeight(Math.max(available, 0));
      });
    };

    recalc();

    const ro = new ResizeObserver(recalc);
    ro.observe(document.body);
    window.addEventListener("resize", recalc);
    window.addEventListener("orientationchange", recalc);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", recalc);
      window.removeEventListener("orientationchange", recalc);
    };
  }, [isFullscreen]);

  /* ── Responsive layout ────────────────────────────────────────────────
     The grid's column template is an inline style, so no @media rule in
     index.css can touch it — JS has to own the breakpoint.

       ≤ 760px  single column. CSS swaps which pane is visible based on
                `.has-selection`; the thread's back button returns to the list.
       ≤ 1080px list + thread. The contact panel has no room for a static
                column, so it becomes a slide-over instead of disappearing.
       > 1080px list + thread + contact panel.
  ─────────────────────────────────────────────────────────────────────── */
  const isMobile = useIsInboxMobile();
  const isCompact = useIsInboxCompact();

  // On compact widths the panel is overlaid, so it must not reserve a column.
  const showRightColumn = !isCompact && !rightCollapsed;
  const rightOverlayOpen = isCompact && !rightCollapsed && !!selected;

  // rightCollapsed defaults to false (correct on desktop, where the panel is
  // a visible column). Entering compact width would therefore pop the
  // slide-over open unprompted, so collapse it on the way in.
  useEffect(() => {
    if (isCompact) setRightCollapsed(true);
  }, [isCompact, setRightCollapsed]);

  // Likewise the sidebar: below 760px CSS shows one pane at a time, so a
  // collapsed sidebar would leave the list unreachable from the empty state.
  useEffect(() => {
    if (isMobile) setSidebarCollapsed(false);
  }, [isMobile, setSidebarCollapsed]);

  const gridColumns = isMobile
    ? "minmax(0,1fr)"
    : [
        sidebarCollapsed ? "0px" : "320px",
        "minmax(0,1fr)",
        ...(isCompact ? [] : [showRightColumn ? "340px" : "0px"]),
      ].join(" ");

  /* ── Render ───────────────────────────────────────────────────────── */
  const outerStyle: React.CSSProperties = isFullscreen
    ? {
        display: "flex",
        flexDirection: "row",
        width: "100vw",
        height: "100vh",
        border: "none",
        borderRadius: 0,
        overflow: "hidden",
        background: "var(--c-base)",
        fontFamily: FONT,
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        boxShadow: "none",
      }
    : {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: embedHeight ?? undefined,
        minHeight: 560,
        border: "1px solid var(--c-border1)",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--c-base)",
        fontFamily: FONT,
        position: "relative",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset",
      };

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="inbox"
        data-theme={theme}
        style={outerStyle}
      >
        <div
          style={{
            width: isMobile ? "100%" : 290,
            flexShrink: 0,
            borderRight: isMobile ? "none" : "1px solid var(--c-border1)",
            padding: 12,
            background: "var(--c-surface0)",
          }}
        >
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 56, borderRadius: 10, marginBottom: 8 }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2
            style={{
              width: 18,
              height: 18,
              color: "var(--c-text2)",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`inbox${selected ? " has-selection" : ""}`}
      data-theme={theme}
      data-appearance={appearance}
      style={{ ...outerStyle, ...appearanceVars }}
    >
      <ThemeBackdrop
        appearance={appearance}
        scrollDepth={selected ? scrollDepth : 0}
      />
      <button
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
        className="icon-btn"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 400,
          width: 34,
          height: 34,
          background: "var(--c-surface3)",
          border: "1px solid var(--c-border2)",
          color: "var(--c-text0)",
          boxShadow: "var(--c-shadow-2)",
        }}
      >
        {isFullscreen ? (
          <Minimize2 style={{ width: 16, height: 16 }} />
        ) : (
          <Maximize2 style={{ width: 16, height: 16 }} />
        )}
      </button>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        conversations={convsList}
        savedReplies={savedReplies}
        onPick={pick}
        onInsertReply={(r) => setDraft((d) => (d ? d + " " : "") + r.body)}
        onAction={handleHeaderAction}
      />
      <ForwardModal
        open={!!forwardTarget}
        onClose={() => setForwardTarget(null)}
        conversations={convsList}
        currentId={selected?._id}
        onForward={handleForward}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={appearance}
        setAppearance={setAppearance}
      />
      <LinkContactModal
        open={linkContactModalOpen}
        onClose={closeLinkContactModal}
        phoneNumber={selected?.phoneNumber}
        onCheckMatch={checkMatchingContact}
        onLinkExisting={linkExistingContact}
        onCreateNew={createAndLinkNewContact}
      />
      {/* `accept` mirrors the backend's chatAttachmentFileFilter so the picker
          can't offer a type the upload endpoint would reject with a 400. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv"
        style={{ display: "none" }}
        onChange={handleFileChosen}
      />

      <div
        className="conversation-layout"
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          width: "100%",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      >
        <LeftPanel
          conversations={convsList}
          selectedId={selected?._id}
          onSelect={pick}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          pinnedIds={pinnedConvIds}
          onOpenCommandPalette={() => setCmdOpen(true)}
          collapsed={sidebarCollapsed}
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
        />

        {selected ? (
          <div
            className="thread-host"
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              position: "relative",
              background:
                "color-mix(in srgb, var(--c-surface1) 55%, transparent)",
              overflow: "hidden",
            }}
          >
            <ThreadHeader
              conv={{
                ...selected,
                online: onlineUsers[selected._id] ?? selected.online,
              }}
              profile={profile}
              onAction={handleHeaderAction}
              onToggleSearch={() => setInThreadSearch((v) => !v)}
              muted={mutedConvIds.has(selected._id)}
              archived={archivedConvIds.has(selected._id)}
              connected={connected}
              sidebarCollapsed={sidebarCollapsed}
              rightCollapsed={rightCollapsed}
              focusMode={focusMode}
              onToggleSidebar={() => {
                setSidebarCollapsed((v) => !v);
                setFocusMode(false);
              }}
              onToggleRight={() => {
                setRightCollapsed((v) => !v);
                setFocusMode(false);
              }}
              onToggleFocus={() => setFocusMode((v) => !v)}
              onBack={() => logic.setSelected(null)}
              notifPrefs={selectedNotifPrefs}
              onToggleNotifications={handleToggleNotifications}
              onToggleSound={handleToggleSound}
            />

            <div
              className="thread-body-flex"
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <ConversationBody
                inThreadSearch={inThreadSearch}
                threadQuery={threadQuery}
                setThreadQuery={setThreadQuery}
                visibleMsgCount={visibleMsgCount}
                onCloseThreadSearch={() => {
                  setInThreadSearch(false);
                  setThreadQuery("");
                }}
                pinnedMsgObjs={pinnedMsgObjs}
                onUnpinMsg={(m) =>
                  logic.setPinnedMsgIds((s) => {
                    const n = new Set(s);
                    n.delete(m._id);
                    return n;
                  })
                }
                onJumpToMsg={(m) =>
                  msgRefs.current[m._id]?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                scrollRef={scrollRef}
                onScroll={onScroll}
                groupedMsgs={groupedMsgs}
                msgRefs={msgRefs}
                customerName={profile.name || selected.phoneNumber}
                handleMsgAction={handleMsgAction}
                starredMsgIds={starredMsgIds}
                pinnedMsgIds={pinnedMsgIds}
                infoIds={infoIds}
                setInfoIds={setInfoIds}
                isTyping={isTyping}
                bottomRef={bottomRef}
                atBottom={atBottom}
                goBottom={goBottom}
                loadingOlder={loadingOlder}
              />
            </div>

            <div className="composer-pinned" style={{ flex: "0 0 auto" }}>
              <Composer
                draft={draft}
                setDraft={setDraft}
                onSend={send}
                sending={sending}
                composerMode={composerMode}
                setComposerMode={setComposerMode}
                showEmoji={showEmoji}
                setShowEmoji={setShowEmoji}
                showQuickReplies={showQuickReplies}
                setShowQuickReplies={setShowQuickReplies}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                attachment={attachment}
                setAttachment={setAttachment}
                onAttachClick={handleAttachClick}
                taRef={taRef}
                onVoiceRecorded={handleVoiceRecorded}
                onVoiceError={handleVoiceError}
                theme={theme}
                savedReplies={savedReplies}
                onAddSavedReply={addSavedReply}
                onDeleteSavedReply={deleteSavedReply}
              />
            </div>
          </div>
        ) : (
          <div
            className="thread-host chat-wall"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              color: "var(--c-text2)",
              gap: 14,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                background:
                  "linear-gradient(145deg, var(--c-brand), var(--c-accent))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--c-shadow-2)",
              }}
            >
              <MessageSquare style={{ width: 38, height: 38, color: "#fff" }} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 19,
                  color: "var(--c-text0)",
                  fontWeight: 500,
                  letterSpacing: "-.01em",
                }}
              >
                engageo for teams
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--c-text2)",
                  marginTop: 8,
                  maxWidth: 380,
                  lineHeight: 1.6,
                }}
              >
                Select a conversation from the list to start messaging. Your
                chats stay in sync across every device.
              </div>
            </div>
          </div>
        )}

        {/* Tap-to-dismiss scrim behind the slide-over. Only rendered on
            compact widths, where the contact panel floats over the thread
            instead of occupying its own column. */}
        {rightOverlayOpen && (
          <div
            onClick={() => setRightCollapsed(true)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              zIndex: 39,
            }}
          />
        )}

        <div
          className="panel-right-host"
          style={
            isCompact
              ? {
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: "min(340px, 88vw)",
                  zIndex: 40,
                  display: rightOverlayOpen ? "flex" : "none",
                  boxShadow: "-8px 0 24px rgba(0,0,0,.35)",
                }
              : { display: "flex", minWidth: 0, minHeight: 0 }
          }
        >
          <RightPanel
            conv={selected}
            profile={profile}
            setProfile={setProfile}
            onAction={handleHeaderAction}
            // The slide-over is either fully open or not mounted, so it must
            // never render the 44px collapsed rail inside the overlay.
            collapsed={isCompact ? false : rightCollapsed}
            onSaveNotes={handleSaveNotes}
            onSaveProfileName={handleSaveProfileName}
            onSaveTag={handleSaveTag}
            onOpenLinkContact={openLinkContactModal}
          />
        </div>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}

export default ConversationsPage;