import type { ChatAppearanceKey } from "../AppearanceSelector";

interface ThemeBackdropProps {
  appearance: ChatAppearanceKey;
  scrollDepth: number; // 0..1, how far down the message list the user has scrolled
}

export default function ThemeBackdrop({ appearance, scrollDepth }: ThemeBackdropProps) {
  if (appearance === "classic" || appearance === "aurora") return null;

  return (
    <div
      className={`theme-backdrop theme-backdrop-${appearance}`}
      style={{ "--scroll-depth": scrollDepth } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* scrollDepth: 0 = top of history (oldest), 1 = bottom (newest/present).
          The ocean should read as "surface" at the newest messages and "deep"
          toward the oldest, so we invert it here before passing it down. */}
      {appearance === "blue" && <OceanScene depth={1 - scrollDepth} />}
      {appearance === "green" && <ForestScene />}
      {appearance === "purple" && <NebulaScene />}
      {appearance === "pink" && <SunsetScene />}
      {appearance === "black" && <GraphiteScene />}
      {appearance === "premium" && <GoldScene />}
    </div>
  );
}

/* ── OCEAN ─────────────────────────────────────────────────────────────
   depth 0   = surface: sunlight rays, small fish, sea plants, bright
   depth ~.5 = mid: turtles, jellyfish, coral, dimmer light
   depth 1   = deep: manta rays, bioluminescent jellyfish, glowing plankton
   Bands crossfade based on the live scroll depth so the whole scene reads
   as one continuous dive rather than three swapped scenes.
──────────────────────────────────────────────────────────────────────── */
function OceanScene({ depth }: { depth: number }) {
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  // Triangular opacity curves per band, centered so they overlap smoothly.
  const shallowOp = clamp01(1 - depth / 0.45);
  const midOp = clamp01(1 - Math.abs(depth - 0.5) / 0.4);
  const deepOp = clamp01((depth - 0.55) / 0.45);
  const rayOp = clamp01(1 - depth / 0.6) * 0.9;

  const fishFar = [
    { top: "18%", dur: "38s", delay: "-4s", scale: 0.55, dir: 1 },
    { top: "62%", dur: "44s", delay: "-18s", scale: 0.5, dir: -1 },
  ];
  const fishMid = [
    { top: "35%", dur: "26s", delay: "-6s", scale: 0.8, dir: 1 },
    { top: "78%", dur: "30s", delay: "-14s", scale: 0.75, dir: -1 },
  ];
  const fishNear = [{ top: "50%", dur: "18s", delay: "-2s", scale: 1.1, dir: 1 }];

  const bubbles = Array.from({ length: 20 }).map((_, i) => ({
    left: `${(i * 5.1) % 100}%`,
    size: 3 + ((i * 7) % 10),
    dur: 8 + ((i * 3) % 11),
    delay: -((i * 2.4) % 14),
  }));

  const plankton = Array.from({ length: 26 }).map((_, i) => ({
    left: `${(i * 3.9) % 100}%`,
    top: `${(i * 11.3) % 100}%`,
    size: 1.5 + ((i * 5) % 3),
    dur: 6 + ((i * 2) % 6),
    delay: -((i * 1.7) % 8),
  }));

  return (
    <>
      <div className="ocean-gradient" />

      {/* ── Surface band ── */}
      <div className="ocean-band ocean-band-shallow" style={{ opacity: shallowOp }}>
        <div className="ocean-rays" style={{ opacity: rayOp }} />
        <div className="ocean-layer ocean-layer-far">
          {fishFar.map((f, i) => (
            <Fish key={`f-${i}`} {...f} />
          ))}
        </div>
        <div className="ocean-layer ocean-layer-near">
          {fishNear.map((f, i) => (
            <Fish key={`n-${i}`} {...f} />
          ))}
        </div>
        <SeaPlants />
      </div>

      {/* ── Mid band ── */}
      <div className="ocean-band ocean-band-mid" style={{ opacity: midOp }}>
        <div className="ocean-layer ocean-layer-mid">
          {fishMid.map((f, i) => (
            <Fish key={`m-${i}`} {...f} />
          ))}
        </div>
        <Turtle top="30%" dur="52s" delay="-10s" dir={1} />
        <Turtle top="68%" dur="60s" delay="-30s" dir={-1} />
        <Jellyfish left="20%" bottom="10%" dur="14s" delay="-2s" glow={false} />
        <Jellyfish left="72%" bottom="30%" dur="17s" delay="-7s" glow={false} />
        <CoralReef />
      </div>

      {/* ── Deep band ── */}
      <div className="ocean-band ocean-band-deep" style={{ opacity: deepOp }}>
        <MantaRay top="22%" dur="46s" delay="-6s" dir={1} />
        <MantaRay top="60%" dur="54s" delay="-20s" dir={-1} />
        <Jellyfish left="35%" bottom="20%" dur="19s" delay="-4s" glow />
        <Jellyfish left="82%" bottom="45%" dur="22s" delay="-11s" glow />
        <div className="ocean-plankton">
          {plankton.map((p, i) => (
            <span
              key={i}
              className="ocean-plankton-dot"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Always-on bubbles, all depths ── */}
      <div className="ocean-bubbles">
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="ocean-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="ocean-depth-veil" />
    </>
  );
}

function Fish({
  top,
  dur,
  delay,
  scale,
  dir,
}: {
  top: string;
  dur: string;
  delay: string;
  scale: number;
  dir: number;
}) {
  return (
    <svg
      className="ocean-fish"
      style={{
        top,
        animationDuration: dur,
        animationDelay: delay,
        transform: `scale(${scale}) scaleX(${dir})`,
      }}
      width="52"
      height="26"
      viewBox="0 0 52 26"
    >
      <path
        d="M4 13 C4 6 14 2 26 2 C38 2 46 7 46 13 C46 19 38 24 26 24 C14 24 4 20 4 13 Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path d="M4 13 L-6 6 L-6 20 Z" fill="currentColor" opacity="0.5" />
      <circle cx="34" cy="10" r="1.6" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

function Turtle({
  top,
  dur,
  delay,
  dir,
}: {
  top: string;
  dur: string;
  delay: string;
  dir: number;
}) {
  return (
    <svg
      className="ocean-turtle"
      style={{ top, animationDuration: dur, animationDelay: delay, transform: `scaleX(${dir})` }}
      width="70"
      height="46"
      viewBox="0 0 70 46"
    >
      <ellipse cx="34" cy="24" rx="22" ry="14" fill="currentColor" opacity="0.5" />
      <path d="M34 24 m-15 0 a15 10 0 1 0 30 0 a15 10 0 1 0 -30 0" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
      <circle cx="14" cy="20" r="6" fill="currentColor" opacity="0.5" />
      <ellipse cx="52" cy="10" rx="8" ry="4" fill="currentColor" opacity="0.4" transform="rotate(-20 52 10)" />
      <ellipse cx="52" cy="38" rx="8" ry="4" fill="currentColor" opacity="0.4" transform="rotate(20 52 38)" />
    </svg>
  );
}

function Jellyfish({
  left,
  bottom,
  dur,
  delay,
  glow,
}: {
  left: string;
  bottom: string;
  dur: string;
  delay: string;
  glow: boolean;
}) {
  return (
    <div
      className={`ocean-jellyfish${glow ? " ocean-jellyfish-glow" : ""}`}
      style={{ left, bottom, animationDuration: dur, animationDelay: delay }}
    >
      <svg width="34" height="42" viewBox="0 0 34 42">
        <path d="M2 16 C2 6 10 1 17 1 C24 1 32 6 32 16 C32 22 27 25 17 25 C7 25 2 22 2 16 Z" fill="currentColor" opacity={glow ? 0.75 : 0.45} />
        {[6, 12, 17, 22, 28].map((x, i) => (
          <path
            key={i}
            d={`M${x} 24 Q${x + (i % 2 ? 3 : -3)} 32 ${x} 40`}
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            opacity={glow ? 0.6 : 0.35}
          />
        ))}
      </svg>
    </div>
  );
}

function MantaRay({
  top,
  dur,
  delay,
  dir,
}: {
  top: string;
  dur: string;
  delay: string;
  dir: number;
}) {
  return (
    <svg
      className="ocean-manta"
      style={{ top, animationDuration: dur, animationDelay: delay, transform: `scaleX(${dir})` }}
      width="120"
      height="50"
      viewBox="0 0 120 50"
    >
      <path
        d="M60 8 C30 2 4 18 0 26 C4 24 26 20 44 24 C50 26 55 32 60 44 C65 32 70 26 76 24 C94 20 116 24 120 26 C116 18 90 2 60 8 Z"
        fill="currentColor"
        opacity="0.32"
      />
      <path d="M58 24 L62 24 L64 46 L56 46 Z" fill="currentColor" opacity="0.28" />
    </svg>
  );
}

function SeaPlants() {
  return (
    <svg className="ocean-plants" viewBox="0 0 400 90" preserveAspectRatio="none">
      {[20, 70, 140, 210, 280, 340].map((x, i) => (
        <path
          key={i}
          className="ocean-plant-blade"
          style={{ animationDelay: `${-i * 0.7}s` }}
          d={`M${x} 90 Q${x + (i % 2 ? 14 : -14)} 55 ${x} 20`}
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.4"
        />
      ))}
    </svg>
  );
}

function CoralReef() {
  return (
    <svg className="ocean-coral" viewBox="0 0 400 70" preserveAspectRatio="none">
      <path d="M10 70 Q10 30 30 30 Q50 30 45 70 Z" fill="currentColor" opacity="0.35" />
      <path d="M90 70 Q95 20 115 25 Q130 30 120 70 Z" fill="currentColor" opacity="0.3" />
      <path d="M250 70 Q245 35 270 32 Q295 35 285 70 Z" fill="currentColor" opacity="0.32" />
      <path d="M340 70 Q345 25 365 30 Q380 40 370 70 Z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/* ── Placeholder scenes for the remaining themes — unchanged. ── */
function ForestScene() {
  return <div className="scene-simple scene-forest" />;
}
function NebulaScene() {
  return <div className="scene-simple scene-nebula" />;
}
function SunsetScene() {
  return <div className="scene-simple scene-sunset" />;
}
function GraphiteScene() {
  return <div className="scene-simple scene-graphite" />;
}
function GoldScene() {
  return <div className="scene-simple scene-gold" />;
}