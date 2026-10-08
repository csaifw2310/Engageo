import { useEffect, useRef, useState } from "react";
import { C } from "../../lib/uiTokens";

/**
 * AppearanceSelector — premium redesign.
 *
 * Still ONLY controls chat bubble appearance (the outgoing message color).
 * It intentionally never reads or writes app-wide dark/light theme state —
 * that stays fully owned by `useTheme()` / `lib/theme`, exactly as before.
 *
 * Same public contract as the previous version:
 *   <AppearanceSelector value={appearance} onChange={setAppearance} />
 * so no other file needs to change.
 *
 * THEME PASS: the swatch/bubble colors below (green, blue, purple, the
 * Premium Gold gradient, etc.) are intentionally fixed hex values — they
 * ARE the content being previewed (the actual bubble color options), not
 * app chrome, so they must stay the same regardless of which app theme
 * (Dark, Light, Cosmic Noir, …) is active. The one thing that WAS
 * incidentally hardcoded was the card's resting drop-shadow, a raw
 * rgba(0,0,0,.3) that assumed a dark backdrop. That's now routed through
 * the shared --c-shadow-1 token (same fallback value), so it still looks
 * right once a light theme is active.
 *
 * LAYOUT NOTE: "blue" (Ocean) and "purple" (Nebula) were swapped in the
 * array below on purpose. In the 4-column grid this puts Ocean directly
 * above Aurora (both col 4) instead of Nebula — since Ocean now also has
 * a subtle animated swatch, it reads better stacked with the other
 * "living" swatch (Aurora) rather than next to the static ones.
 */

export type ChatAppearanceKey =
  | "classic"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "black"
  | "premium"
  | "aurora";

export interface AppearancePreset {
  key: ChatAppearanceKey;
  label: string;
  swatch: string; // CSS background for the swatch preview
  bubbleOut: string; // value assigned to --c-bubble-out
  bubbleOutText: string; // value assigned to --c-bubble-out-text
  solid: string; // base hex color used to tint the whole conversation area
  // ("" = classic — no tint, matches the app's built-in default exactly)
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    key: "classic",
    label: "Classic",
    swatch: "#D9FDD3",
    bubbleOut: "", // "" = fall back to the theme's built-in default
    bubbleOutText: "",
    solid: "",
  },
  {
    // key stays "green" — index.css selects on
    // .inbox[data-appearance="green"], only the label changed
    key: "green",
    label: "Emerald",
    swatch: "linear-gradient(135deg,#1CBE8C,#0E8F6C)",
    bubbleOut: "linear-gradient(135deg,#1CBE8C,#0E8F6C)",
    bubbleOutText: "#FFFFFF",
    solid: "#12B886",
  },
  {
    key: "purple",
    label: "Nebula",
    swatch: "linear-gradient(135deg,#A78BFA,#7C3AED)",
    bubbleOut: "linear-gradient(135deg,#A78BFA,#7C3AED)",
    bubbleOutText: "#FFFFFF",
    solid: "#8B5CF6",
  },
  {
    key: "blue",
    label: "Ocean",
    // Static fallback (used anywhere the animated swatch isn't rendered,
    // e.g. if this value is reused outside PreviewCard). The live preview
    // uses .ocean-swatch below instead, same as Aurora's pattern.
    swatch: "linear-gradient(135deg,#4C8DFF,#1D4ED8)",
    bubbleOut: "linear-gradient(135deg,#4C8DFF,#1D4ED8)",
    bubbleOutText: "#FFFFFF",
    solid: "#2563EB",
  },
  {
    // Swatch warmed from pink to red/orange to match this appearance's
    // own --c-theme-glow-1 (red) / --c-theme-glow-2 (orange) in
    // index.css, and the reference screenshot's "Sunset" swatch.
    key: "pink",
    label: "Sunset",
    swatch: "linear-gradient(135deg,#FB7185,#F97316)",
    bubbleOut: "linear-gradient(135deg,#F472B6,#DB2777)",
    bubbleOutText: "#FFFFFF",
    solid: "#EC4899",
  },
  {
    key: "black",
    label: "Graphite",
    swatch: "linear-gradient(135deg,#3A3A3A,#0A0A0A)",
    bubbleOut: "linear-gradient(135deg,#2A2A2A,#0A0A0A)",
    bubbleOutText: "#F5F5F5",
    solid: "#2A2A2A",
  },
  {
    key: "premium",
    label: "Gold",
    swatch: "linear-gradient(135deg,#3a2f1f,#8a6a2f 55%,#e8c17a)",
    bubbleOut: "linear-gradient(135deg,#1a1a1a,#4a3a1f 60%,#8a6a2f)",
    bubbleOutText: "#F5D98C",
    solid: "#C9974C",
  },
  {
    key: "aurora",
    label: "Aurora",
    // Aurora's swatch isn't a flat gradient like the others — it's the
    // animated monochrome starfield circle (.aurora-swatch in index.css).
    // This field is kept for type-shape consistency but PreviewCard below
    // renders the real starfield instead of using it as a background.
    swatch: "#000000",
    bubbleOut: "rgba(255,255,255,0.93)",
    bubbleOutText: "#0A0A0A",
    solid: "#FFFFFF",
  },
];

interface AppearanceSelectorProps {
  value: ChatAppearanceKey;
  onChange: (key: ChatAppearanceKey) => void;
}

function PreviewCard({
  preset,
  active,
  onSelect,
}: {
  preset: AppearancePreset;
  active: boolean;
  onSelect: () => void;
}) {
  const [justPicked, setJustPicked] = useState(false);
  const prevActive = useRef(active);
  useEffect(() => {
    if (active && !prevActive.current) {
      setJustPicked(true);
      const t = setTimeout(() => setJustPicked(false), 320);
      return () => clearTimeout(t);
    }
    prevActive.current = active;
  }, [active]);

  return (
    <button
      onClick={onSelect}
      className={`appearance-card${justPicked ? " anim-saved" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "10px 6px",
        borderRadius: 12,
        // Screenshot's selected state is a solid border-box drawn in the
        // theme's own accent color, not a background wash + hairline ring
        // — border width carries the selection instead of a filled tint,
        // so it stays legible against every appearance's own surface color.
        border: `1.5px solid ${active ? "var(--c-theme-solid, " + C.accent + ")" : "transparent"}`,
        cursor: "pointer",
        background: "transparent",
        boxShadow: "none",
      }}
    >
      {preset.key === "aurora" ? (
        <div
          className="aurora-swatch"
          style={{
            width: 36,
            height: 36,
            boxShadow: active
              ? "0 0 14px -2px var(--c-theme-wash-soft, transparent), 0 0 0 1px rgba(255,255,255,0.20)"
              : "0 2px 8px var(--c-shadow-1, rgba(0,0,0,.3)), 0 0 0 1px rgba(255,255,255,0.20)",
          }}
        />
      ) : preset.key === "blue" ? (
        // Ocean's swatch is two overlapping wave layers that scroll
        // sideways in a seamless loop — a literal, legible "water" motif
        // instead of abstract light/shading, so it reads as ocean and
        // not as a lit sphere/planet.
        <div
          className="ocean-swatch"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            boxShadow: active
              ? "0 0 14px -2px var(--c-theme-wash-soft, transparent)"
              : "0 2px 8px var(--c-shadow-1, rgba(0,0,0,.3))",
          }}
        >
          <svg
            className="ocean-wave ocean-wave-back"
            viewBox="0 0 80 20"
            preserveAspectRatio="none"
          >
            <path
              d="M0 11 Q10 5 20 11 T40 11 T60 11 T80 11 V20 H0 Z"
              fill="rgba(190,225,255,0.45)"
            />
          </svg>
          <svg
            className="ocean-wave ocean-wave-front"
            viewBox="0 0 80 20"
            preserveAspectRatio="none"
          >
            <path
              d="M0 13 Q10 8 20 13 T40 13 T60 13 T80 13 V20 H0 Z"
              fill="rgba(255,255,255,0.85)"
            />
          </svg>
        </div>
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: preset.swatch,
            boxShadow: active
              ? "0 0 14px -2px var(--c-theme-wash-soft, transparent)"
              : "0 2px 8px var(--c-shadow-1, rgba(0,0,0,.3))",
          }}
        />
      )}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          color: active ? C.text0 : C.text2,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {preset.label}
        {(preset.key === "aurora" || preset.key === "blue") && (
          <span
            className="live-dot"
            title="Animated style"
            style={{
              background: preset.key === "blue" ? "#4C8DFF" : "#FFFFFF",
            }}
          />
        )}
      </span>
    </button>
  );
}

export default function AppearanceSelector({
  value,
  onChange,
}: AppearanceSelectorProps) {
  return (
    <div>
      <div style={{ padding: "14px 0 4px" }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: C.text3,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Chat bubble style
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        {APPEARANCE_PRESETS.map((p) => (
          <PreviewCard
            key={p.key}
            preset={p}
            active={value === p.key}
            onSelect={() => onChange(p.key)}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          marginTop: 12,
          padding: "8px 10px",
          borderRadius: 8,
          background: "var(--c-surface-2, rgba(255,255,255,0.04))",
        }}
      >
        <span style={{ fontSize: 11, lineHeight: 1, marginTop: 1 }}>✦</span>
        <span style={{ fontSize: 10.5, lineHeight: 1.45, color: C.text3 }}>
          Styles with a dot (Ocean, Aurora) have subtle motion — smoothest
          on newer devices, so pick a static style if things ever feel
          sluggish.
        </span>
      </div>

      <style>{`
        .appearance-card {
          transition: transform .18s cubic-bezier(.4,0,.2,1), border-color .18s ease, box-shadow .18s ease;
        }
        .appearance-card:hover {
          transform: translateY(-1px);
        }
        .appearance-card:active {
          transform: translateY(0) scale(.97);
        }
        .appearance-check {
          transition: background .18s ease, border-color .18s ease, transform .18s cubic-bezier(.4,0,.2,1);
        }
        .live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          animation: liveDotPulse 1.8s ease-in-out infinite;
        }
        @keyframes liveDotPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }
        .ocean-swatch {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          background: linear-gradient(180deg, #1E3A8A 0%, #2563EB 55%, #4C8DFF 100%);
        }
        .ocean-wave {
          position: absolute;
          left: 0;
          bottom: -1px;
          width: 220%;
          height: 65%;
        }
        .ocean-wave-back {
          animation: oceanWaveScroll 4.2s linear infinite;
          opacity: 0.9;
        }
        .ocean-wave-front {
          height: 55%;
          animation: oceanWaveScroll 2.8s linear infinite reverse;
        }
        @keyframes oceanWaveScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}