import { Building2, Check, CheckCheck, Copy, ExternalLink, FileText, Image as ImageIcon, Phone, Type, Video } from 'lucide-react';
import type { TemplateButton, TemplateHeaderType } from '../../types/template';
import { detectTemplateVariables } from '../../types/template';

export interface TemplatePhonePreviewProps {
  /** Name shown in the chat header bar. Defaults to "Your Business". */
  businessName?: string;
  headerType?: TemplateHeaderType;
  /**
   * Actual header text/filename to render, when known. Synced templates from
   * the API don't carry this (the backend only stores headerType), so those
   * call sites omit it and fall back to the generic "Text header" / "Image
   * header" label below. The create wizard passes the real value so the
   * live preview shows what will actually be sent.
   */
  headerText?: string;
  headerMediaLabel?: string;
  /**
   * Local object URL for a just-picked IMAGE/VIDEO header, so the wizard can
   * render the real asset instead of a filename. Synced templates have no such
   * URL — Meta returns an opaque handle, not a viewable link — so those call
   * sites omit it and keep the icon + label treatment.
   */
  headerMediaPreviewUrl?: string | null;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButton[];
  /** Fake send time shown on the bubble, e.g. "10:42 AM". Defaults to the current time. */
  timestamp?: string;
  className?: string;
}

const HEADER_META: Record<Exclude<TemplateHeaderType, 'NONE'>, { icon: typeof Type; label: string }> = {
  TEXT: { icon: Type, label: 'Text header' },
  IMAGE: { icon: ImageIcon, label: 'Image header' },
  VIDEO: { icon: Video, label: 'Video header' },
  DOCUMENT: { icon: FileText, label: 'Document header' },
};

const BUTTON_ICON: Record<string, typeof ExternalLink> = {
  QUICK_REPLY: Check,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
};

function defaultTimestamp(): string {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Renders bodyText with {{n}} tokens highlighted as pills, so the person can
 * see at a glance which parts of the message will be personalized per-recipient.
 */
function BodyWithVariables({ text }: { text: string }) {
  const { variables } = detectTemplateVariables(text);
  if (variables.length === 0) {
    return <>{text || <span className="text-zinc-400 italic">Your message body will appear here…</span>}</>;
  }

  const tokenPattern = /\{\{\s*\d+\s*\}\}/g;
  const parts: { text: string; isVariable: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isVariable: false });
    }
    parts.push({ text: match[0], isVariable: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isVariable: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.isVariable ? (
          <span key={i} className="inline-block px-1 rounded bg-emerald-500/15 text-emerald-300 font-medium">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function TemplatePhonePreview({
  businessName = 'Your Business',
  headerType = 'NONE',
  headerText,
  headerMediaLabel,
  headerMediaPreviewUrl,
  bodyText,
  footerText,
  buttons = [],
  timestamp,
  className = '',
}: TemplatePhonePreviewProps) {
  const header = headerType !== 'NONE' ? HEADER_META[headerType] : null;
  const HeaderIcon = header?.icon;
  const time = timestamp ?? defaultTimestamp();

  return (
    <div className={`w-full max-w-[300px] mx-auto ${className}`}>
      {/* Phone frame */}
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
        <div className="rounded-[1.5rem] overflow-hidden bg-zinc-950 border border-zinc-800/60">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[10px] text-zinc-500">
            <span>{time}</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1.5 rounded-sm border border-zinc-600" />
              <div className="w-2.5 h-1.5 rounded-sm bg-zinc-600" />
            </div>
          </div>

          {/* Chat header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-900 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{businessName}</p>
              <p className="text-[10px] text-zinc-500">WhatsApp Business</p>
            </div>
          </div>

          {/* Chat surface */}
          <div className="relative px-3 py-4 min-h-[280px] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:16px_16px] bg-zinc-950">
            <div className="max-w-[85%]">
              {/* Message bubble */}
              <div className="rounded-lg rounded-tl-sm bg-zinc-800 border border-zinc-700/60 overflow-hidden">
                {/* A real media preview replaces the icon row entirely — that's
                    how the header actually renders in WhatsApp. */}
                {headerMediaPreviewUrl && headerType === 'IMAGE' && (
                  <img
                    src={headerMediaPreviewUrl}
                    alt={headerMediaLabel ?? 'Header image'}
                    className="w-full max-h-44 object-cover"
                  />
                )}
                {headerMediaPreviewUrl && headerType === 'VIDEO' && (
                  <video
                    src={headerMediaPreviewUrl}
                    controls
                    className="w-full max-h-44 object-cover"
                  />
                )}

                {header && HeaderIcon && !headerMediaPreviewUrl && (
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-zinc-700/40">
                    <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                      <HeaderIcon className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    {headerType === 'TEXT' && headerText ? (
                      <span className="text-[12px] font-semibold text-zinc-100 truncate">{headerText}</span>
                    ) : headerType !== 'TEXT' && headerMediaLabel ? (
                      <span className="text-[10px] text-zinc-400 truncate">{headerMediaLabel}</span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">{header.label}</span>
                    )}
                  </div>
                )}

                <div className="px-3 py-2.5">
                  <p className="text-[13px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words">
                    <BodyWithVariables text={bodyText} />
                  </p>
                  {footerText && <p className="mt-1.5 text-[11px] text-zinc-500">{footerText}</p>}
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <span className="text-[10px] text-zinc-600">{time}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              {buttons.length > 0 && (
                <div className="mt-1 rounded-lg border border-zinc-700/60 overflow-hidden divide-y divide-zinc-700/60">
                  {buttons.map((btn, i) => {
                    const Icon = BUTTON_ICON[btn.type] ?? Check;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900/80 text-[12px] font-medium text-sky-400"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{btn.text || 'Button'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}