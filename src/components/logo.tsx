import { useId } from "react";

/** Winged "H" emblem: a gold H with an upswept flight chevron, three-feather wings and a cyan beacon. */
export function LogoMark({ className = "h-10 w-auto" }: { className?: string }) {
  const id = "hm" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const gold = `${id}-gold`;
  const glow = `${id}-glow`;

  return (
    <svg viewBox="0 0 120 64" className={className} role="img" aria-label="Hermes">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="0.35" stopColor="#f7d98a" />
          <stop offset="0.7" stopColor="#e9b44c" />
          <stop offset="1" stopColor="#a8711f" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#3cc8ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#3cc8ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g fill={`url(#${gold})`}>
        {/* Left wing; the right wing mirrors it */}
        <g id={`${id}-wing`}>
          <path d="M42 15 L4 6 L11 13.5 L41 22 Z" />
          <path d="M41.5 25 L9 19.5 L15.5 26.5 L41 31.5 Z" />
          <path d="M41 35 L16 32.5 L22 38.5 L40.5 41 Z" />
        </g>
        <use href={`#${id}-wing`} transform="translate(120 0) scale(-1 1)" />

        {/* H uprights with bevelled tops */}
        <path d="M44 14 L48 10 L52 14 L52 54 L44 54 Z" />
        <path d="M68 14 L72 10 L76 14 L76 54 L68 54 Z" />
        {/* Crossbar with a shallow dihedral, like a wing in level flight */}
        <path d="M52 32 L60 29.5 L68 32 L68 38 L60 35.5 L52 38 Z" />
      </g>

      {/* Beacon */}
      <circle cx="60" cy="18" r="7" fill={`url(#${glow})`} />
      <path d="M60 14 L62 18 L60 22 L58 18 Z" fill="#bfefff" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className={compact ? "h-7 w-auto" : "h-9 w-auto"} />
      <div className="leading-none">
        <span className="text-gold-gradient block text-lg font-semibold tracking-[0.32em]">HERMES</span>
        {!compact && (
          <span className="mt-1 block font-mono text-[9px] tracking-[0.25em] text-muted">
            DIGITAL ENGINEERING
          </span>
        )}
      </div>
    </div>
  );
}
