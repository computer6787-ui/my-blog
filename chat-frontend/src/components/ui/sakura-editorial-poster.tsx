"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type SakuraEditorialKeyword = {
  label: string;
};

export type SakuraEditorialPosterProps = {
  title?: string;
  keywords?: SakuraEditorialKeyword[];
  headline?: string;
  body?: string;
  subheadline?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  socialHandle?: string;
  sceneSrc?: string;
  sceneAlt?: string;
  foregroundSrc?: string | null;
  foregroundAlt?: string;
  height?: string;
  forceProgress?: number;
  /**
   * Kept for backwards compatibility — no longer used. The poster now reveals
   * itself automatically when the page loads; all click/tap/hover handling
   * has been removed.
   */
  interactiveReveal?: boolean;
  preview?: boolean;
  className?: string;
};

const FONT_LINK_ID = "sakura-editorial-poster-fonts";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&family=Saira+Extra+Condensed:wght@700;800&display=swap";

export const SAKURA_EDITORIAL_DEFAULT_KEYWORDS: SakuraEditorialKeyword[] = [
  { label: "Bloom" },
  { label: "Pause" },
  { label: "Return" },
];

const DEFAULT_BODY =
  "For a few still days the canopy turns pale pink, and the street below goes quiet. Walk while the color lasts — it is already leaving, petal by petal, into the wind.";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

type TitleChar = {
  key: string;
  char: string;
  index: number;
  fromCenter: number;
};

function splitTitleChars(title: string): TitleChar[] {
  const chars = Array.from(title);
  const mid = Math.max(chars.length - 1, 1) / 2;
  return chars.map((char, index) => ({
    key: `${index}-${char === " " ? "sp" : char}`,
    char: char === " " ? " " : char,
    index,
    fromCenter: mid <= 0 ? 0 : Math.abs(index - mid) / mid,
  }));
}

function useSakuraEditorialFonts() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

function SakuraFitTitle({ title }: { title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [fontPx, setFontPx] = useState<number | null>(null);
  const chars = splitTitleChars(title);

  useEffect(() => {
    const wrap = wrapRef.current;
    const probe = probeRef.current;
    if (!wrap || !probe) return;

    const PROBE = 100;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      const next = (wrap.clientWidth / Math.max(1, probe.scrollWidth)) * PROBE;
      if (!Number.isFinite(next) || next <= 0) return;
      setFontPx(next);
    };

    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const fonts = document.fonts;
    const onFonts = () => {
      void fonts?.ready.then(fit);
    };
    fonts?.addEventListener?.("loadingdone", onFonts);
    void (async () => {
      try {
        await fonts?.load?.('800 100px "Saira Extra Condensed"');
      } catch {
        /* fallback metrics */
      }
      await fonts?.ready;
      fit();
    })();
    fit();

    return () => {
      cancelled = true;
      ro.disconnect();
      fonts?.removeEventListener?.("loadingdone", onFonts);
    };
  }, [title]);

  const titleStyle = {
    fontFamily: '"Saira Extra Condensed", "Arial Narrow", sans-serif',
    fontWeight: 800,
    letterSpacing: "0.02em",
    WebkitFontSmoothing: "antialiased" as const,
    MozOsxFontSmoothing: "grayscale" as const,
    textRendering: "geometricPrecision" as const,
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-x-[4%] top-[4%] z-20 overflow-visible"
    >
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-nowrap uppercase leading-none"
        style={{ ...titleStyle, fontSize: 100 }}
      >
        {title}
      </span>
      <h1
        className="m-0 overflow-visible whitespace-nowrap text-left uppercase leading-none text-white"
        style={{
          ...titleStyle,
          fontSize: fontPx != null ? `${fontPx}px` : "min(36cqw, 52cqh)",
        }}
      >
        {chars.map((item) => {
          // Characters expand symmetrically outward from the center:
          // left-half chars slide left (negative), right-half slide right (positive)
          const isLeftHalf = item.index < chars.length / 2;
          const xOff =
            item.fromCenter > 0.01
              ? item.fromCenter * 22 * (isLeftHalf ? -1 : 1)
              : 0;
          return (
            <span
              key={item.key}
              aria-hidden
              className="sakura-char"
              style={
                {
                  "--fc": item.fromCenter,
                  "--y-off": `${50 + item.fromCenter * 80}px`,
                  "--x-off": `${xOff}px`,
                } as CSSProperties
              }
            >
              {item.char}
            </span>
          );
        })}
        <span className="sr-only">{title}</span>
      </h1>
    </div>
  );
}

function SakuraHeroVisual({
  title,
  sceneSrc,
  sceneAlt,
  foregroundSrc,
  foregroundAlt,
}: {
  title: string;
  sceneSrc: string;
  sceneAlt: string;
  foregroundSrc: string | null;
  foregroundAlt: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={sceneSrc}
          alt={sceneAlt}
          width={1024}
          height={1024}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-105 object-cover object-center"
          draggable={false}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <SakuraFitTitle title={title} />

      {foregroundSrc ? (
        <img
          src={foregroundSrc}
          alt={foregroundAlt}
          className="sakura-branch pointer-events-none absolute bottom-0 left-1/2 z-30 h-auto w-[min(92%,78cqh)] -translate-x-[40%] object-contain object-bottom drop-shadow-[0_10px_28px_rgba(40,20,20,0.18)]"
          draggable={false}
        />
      ) : null}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[35] bg-gradient-to-b from-transparent via-transparent to-[#f5f5f0]/18"
      />
    </div>
  );
}

function SakuraEditorialCopy({
  keywordItems,
  headline,
  body,
  subheadline,
  footerLeft,
  footerCenter,
  footerRight,
  socialHandle,
}: {
  keywordItems: SakuraEditorialKeyword[];
  headline: string;
  body: string;
  subheadline: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  socialHandle?: string;
}) {
  return (
    <div className="relative flex min-h-[38%] flex-col border-0 bg-transparent p-[clamp(1.1rem,4.5cqw,2.25rem)] text-[#f6eee8]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#4a2c32]/55 via-[#c99aa0]/25 to-transparent"
      />
      <div className="sakura-copy-row relative z-10 flex items-start justify-between gap-3 text-[clamp(9px,1.7cqw,11px)] font-light tracking-[0.16em] text-[#f6eee8]/70">
        {keywordItems.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>

      <h2
        className="sakura-copy-row relative z-10 mt-[clamp(0.7rem,2.2cqw,1.15rem)] text-[clamp(1.2rem,3.6cqw,1.7rem)] font-semibold leading-[1.3] text-[#f6eee8]"
        style={{
          fontFamily:
            '"Cormorant Garamond", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif',
        }}
      >
        {headline}
      </h2>

      <p className="sakura-copy-row relative z-10 mt-[clamp(0.5rem,1.6cqw,0.75rem)] max-w-[62%] text-[clamp(10px,1.7cqw,12px)] font-light leading-[1.55] text-[#f6eee8]/85">
        {body}
      </p>

      <p
        className="sakura-copy-row relative z-10 mt-[clamp(0.65rem,2cqw,0.95rem)] text-[clamp(0.95rem,2.6cqw,1.2rem)] font-medium leading-[1.35] text-[#f6eee8]"
        style={{ fontFamily: '"Jost", ui-sans-serif, sans-serif' }}
      >
        {subheadline}
      </p>

      <div className="sakura-copy-row relative z-10 mt-auto flex items-end justify-between gap-3 pt-[clamp(0.7rem,2.4cqw,1.1rem)] text-[clamp(9px,1.6cqw,11px)] font-light tracking-[0.08em] text-[#f6eee8]/75">
        <span>{footerLeft}</span>
        <span>{footerCenter}</span>
        <span>{footerRight}</span>
      </div>

      {socialHandle ? (
        <span className="sakura-copy-row absolute bottom-[clamp(0.35rem,1.2cqw,0.65rem)] right-[clamp(0.75rem,4.5cqw,2.25rem)] z-10 text-[clamp(9px,2cqw,11px)] font-light tracking-[0.04em] text-[#f6eee8]/40">
          {socialHandle}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Sakura Editorial Poster — the site hero.
 *
 * - The big "SAKURA" title bursts outward from behind the branch and the
 *   editorial copy slides up automatically when the page loads (CSS transitions)
 * - No click / tap / hover interaction — the reveal runs once on mount
 * - No scroll-based animation — no sticky, no scroll freeze
 */
export function SakuraEditorialPoster({
  title = "LUMORA",
  keywords = SAKURA_EDITORIAL_DEFAULT_KEYWORDS,
  headline = "Petals Hold the Light | 花びらが光を抱く。",
  body = DEFAULT_BODY,
  subheadline = "Stay for the fall. 散るまで、見ていて。",
  footerLeft = "DesignLayer",
  footerCenter = "Vol. 01",
  footerRight = "03.26 2026",
  socialHandle = "@designlayer",
  sceneSrc = "/static/images/sakura/hero-scene-bg.webp",
  sceneAlt = "Soft bokeh cherry blossoms background",
  foregroundSrc = "/static/images/sakura/hero-branch.webp",
  foregroundAlt = "Cherry blossom branch in the foreground",
  height = "100svh",
  forceProgress,
  preview = false,
  className,
}: SakuraEditorialPosterProps) {
  useSakuraEditorialFonts();

  const sectionRef = useRef<HTMLElement>(null);
  const keywordItems = keywords.filter((item) => item.label.trim().length > 0);

  const locked = forceProgress != null && Number.isFinite(forceProgress);

  // True = editorial text revealed; false = only the sakura branch scene.
  const [isRevealed, setIsRevealed] = useState(
    locked ? clamp01(forceProgress ?? 1) < 0.5 : false,
  );

  const fillViewport = locked || preview;
  const panelHeight = fillViewport ? "100%" : height;

  /* ── Sync with external forceProgress ── */
  useEffect(() => {
    if (locked) setIsRevealed(clamp01(forceProgress ?? 0) < 0.5);
  }, [forceProgress, locked]);

  /* ── Auto-reveal on page load ──
     The poster mounts in its hidden state, then flips to revealed a short
     beat later so the entrance animation actually plays. There is no longer
     any click / tap / hover to reveal the text (preview / externally-driven
     instances keep their current behaviour).

     Force a reflow (offsetHeight) right before flipping so the browser has
     definitely committed the hidden styles — this guarantees the CSS
     transition starts from the hidden state instead of a flash-of-instant. */
  useEffect(() => {
    if (locked || preview) return;
    const id = window.setTimeout(() => {
      if (sectionRef.current) void sectionRef.current.offsetHeight;
      setIsRevealed(true);
    }, 120);
    return () => window.clearTimeout(id);
  }, [locked, preview]);

  return (
    <section
      ref={sectionRef}
      data-revealed={isRevealed}
      className={cn(
        "sakura-poster relative isolate w-full overflow-hidden",
        fillViewport && "h-screen",
        className,
      )}
      style={{
        height: fillViewport ? undefined : height,
        fontFamily: '"Jost", ui-sans-serif, sans-serif',
      }}
    >
      <div
        className="box-border w-full h-full overflow-hidden"
        style={{ height: panelHeight }}
      >
        <article className="@container relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-xl bg-[#f5f5f0] shadow-[0_24px_80px_rgba(80,50,50,0.12)]">
          <div className="@container relative min-h-0 flex-1 overflow-hidden [container-type:size]">
            <SakuraHeroVisual
              title={title}
              sceneSrc={sceneSrc}
              sceneAlt={sceneAlt}
              foregroundSrc={foregroundSrc}
              foregroundAlt={foregroundAlt}
            />
          </div>

          <div className="sakura-copy-shell absolute inset-x-0 bottom-0 z-30">
            <SakuraEditorialCopy
              keywordItems={keywordItems}
              headline={headline}
              body={body}
              subheadline={subheadline}
              footerLeft={footerLeft}
              footerCenter={footerCenter}
              footerRight={footerRight}
              socialHandle={socialHandle}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

export default SakuraEditorialPoster;
