import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, X, Send } from "lucide-react";

/**
 * VoiceRecorder — WhatsApp-style microphone button.
 *
 * UI INTEGRATION ONLY (Task 6):
 * This component never calls the message-send API directly. Instead it
 * hands a lightweight "recorded voice note" descriptor back to the parent
 * via `onRecorded`, which the parent (ConversationsPage) plugs into the
 * *existing* attachment + send pipeline exactly the way a file attachment
 * already works today. This means zero changes to send-message logic,
 * Socket.IO flow, or API contracts.
 *
 * Theming split (deliberate):
 * - Pill background + waveform bars + send button → --c-theme-solid /
 *   --c-theme-wash-soft, so the ambient look matches the active chat
 *   appearance (Green/Blue/Purple/Pink/Black/Premium/Aurora).
 * - Pulsing mic dot + timer text → stay on --c-danger / --c-danger-text.
 *   This is the "mic is hot, you are live" status signal and needs to
 *   read as unambiguous "recording" across every appearance, including
 *   grayscale ones (Black, Aurora) where a theme-colored dot would blend
 *   in and be harder to distinguish from idle at a glance.
 * - Cancel (X) button hover blends the theme color into the dark surface
 *   (color-mix) instead of a flat gray step, so hover is visible without
 *   competing with the red recording indicator.
 *
 * RESPONSIVE / OVERLAP FIX:
 * Previously the parent (Composer.tsx) wrapped this component in a fixed
 * 34x34px circular box. That box was sized for the *idle* mic button, but
 * once recording starts this component swaps to a much wider pill (timer +
 * waveform + send button). The fixed-size wrapper didn't grow with it, so
 * the pill visually overflowed on top of the text input / placeholder.
 * Fix: this component now reports its recording state up via
 * `onRecordingChange`, so the parent can resize/collapse its wrapper (and
 * hide the other composer icons) instead of clipping/overlapping.
 */

export interface RecordedVoiceNote {
  name: string;
  size: number;
  durationSec: number;
  blob?: Blob;
}

interface VoiceRecorderProps {
  onRecorded: (note: RecordedVoiceNote) => void;
  onError?: (message: string) => void;
  /** Fires true when recording starts, false when it stops/cancels. Lets
   *  the parent (Composer) resize its wrapper instead of clipping the
   *  wider "recording" pill. Optional — safe to omit. */
  onRecordingChange?: (isRecording: boolean) => void;
  disabled?: boolean;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

const WAVE_BARS = 28;
const MAX_RECORDING_SECONDS = 120; // 2 minutes

export default function VoiceRecorder({
  onRecorded,
  onError,
  onRecordingChange,
  disabled,
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Visual-only: drives the idle waveform animation. Does not touch
  // recording/business state below.
  const [waveAnim, setWaveAnim] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const startedAtRef = useRef<number>(0);
  const cancelledRef = useRef(false);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(waveTimerRef.current);
      cleanupStream();
    };
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        cleanupStream();
        clearInterval(timerRef.current);
        clearInterval(waveTimerRef.current);
        const durationSec = (Date.now() - startedAtRef.current) / 1000;
        setRecording(false);
        onRecordingChange?.(false);
        setElapsed(0);

        if (cancelledRef.current) return;

        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        onRecorded({
          name: `Voice message (${formatDuration(durationSec)}).webm`,
          size: blob.size,
          durationSec,
          blob,
        });
      };

      mr.start();
      startedAtRef.current = Date.now();
      setRecording(true);
      onRecordingChange?.(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const secs = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(secs);
        // Auto-stop (and send, same as tapping the send button) once the
        // recording hits the cap — mirrors WhatsApp's own voice-note limit
        // instead of letting the file grow unbounded.
        if (secs >= MAX_RECORDING_SECONDS) {
          stopRecording(false);
        }
      }, 200);
      waveTimerRef.current = setInterval(() => {
        setWaveAnim(Math.random());
      }, 200);
    } catch {
      onError?.("Microphone access was blocked or unavailable");
    }
  }, [
    disabled,
    recording,
    onRecorded,
    onError,
    onRecordingChange,
    cleanupStream,
  ]);

  const stopRecording = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel;
    mediaRecorderRef.current?.stop();
  }, []);

  if (recording) {
    return (
      <div
        className="composer-shell anim-fade-up"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          background: "var(--c-theme-wash-soft)",
          border: "1px solid var(--c-theme-wash-soft)",
          borderRadius: 24,
          padding: "10px 12px",
        }}
      >
        <button
          title="Cancel recording"
          onClick={() => stopRecording(true)}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            background: "var(--c-surface3)",
            color: "var(--c-text1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background .15s ease, color .15s ease",
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = "var(--c-danger-dim)";
            btn.style.color = "var(--c-danger-text)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = "var(--c-surface3)";
            btn.style.color = "var(--c-text1)";
          }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            className="anim-pulse"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--c-danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mic style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
        </div>

        <span
          style={{
            fontSize: 13.5,
            color: "var(--c-danger-text)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            flexShrink: 0,
            minWidth: 42,
          }}
        >
          {formatDuration(elapsed)}
          {MAX_RECORDING_SECONDS - elapsed <= 10 && (
            <span style={{ opacity: 0.75 }}>
              {" "}
              / {formatDuration(MAX_RECORDING_SECONDS)}
            </span>
          )}
        </span>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 2,
            height: 28,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: WAVE_BARS }).map((_, i) => {
            const base =
              Math.sin((i / WAVE_BARS) * Math.PI * 2 + waveAnim * 10) * 0.5 +
              0.5;
            const h = 4 + base * 20;
            return (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: "var(--c-theme-solid)",
                  opacity: 0.35 + base * 0.65,
                  transition: "height .18s ease, opacity .18s ease",
                }}
              />
            );
          })}
        </div>

        <button
          title="Send voice message"
          onClick={() => stopRecording(false)}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            background: "var(--c-theme-solid)",
            color: "var(--c-bubble-out-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send style={{ width: 13, height: 13 }} />
        </button>
      </div>
    );
  }

  return (
    <button
      title="Record a voice message"
      disabled={disabled}
      onClick={startRecording}
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        background: "var(--c-surface3)",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--c-text1)",
        opacity: disabled ? 0.35 : 1,
        transition: "background .15s, transform .12s",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--c-surface4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--c-surface3)";
      }}
    >
      <Mic style={{ width: 14, height: 14 }} />
    </button>
  );
}
