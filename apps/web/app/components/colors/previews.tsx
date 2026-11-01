// Ways to show a creature's 6 colour regions (EF-22, R-03: nothing from the game files).

import { useId } from "react";
import { cn } from "~/lib/utils";
import { silhouetteColors, type RegionColor } from "./regions";

const label = (r: RegionColor) => `Région ${r.index} (${r.name}) : ${r.color ? `${r.color.name}, n° ${r.color.id}` : "aucune couleur"}`;

/** Black or white text, whichever reads better on this colour. */
function textOn(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return "#000";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}

/** 1. Nuancier: one card per region, with the colour's name and number. */
export function RegionSwatches({ regions }: { regions: RegionColor[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
      {regions.map((r) => (
        <li key={r.index} className="flex items-center gap-3 rounded-md border p-2">
          <span className="size-12 shrink-0 rounded-md border" style={{ background: r.hex }} aria-hidden />
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">{r.color?.name ?? "—"}</span>
            <span className="block truncate text-muted-foreground">
              Région {r.index} · {r.name}
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {r.color ? `n° ${r.color.id} · ${r.hex.toUpperCase()}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 2. Pastilles: a compact row for the library, details on hover. */
export function ColorPills({ regions, size = "md" }: { regions: RegionColor[]; size?: "sm" | "md" }) {
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Couleurs">
      {regions.map((r) => (
        <li
          key={r.index}
          title={label(r)}
          aria-label={label(r)}
          className={cn(
            "flex items-center justify-center rounded-full border font-mono font-semibold",
            size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs",
          )}
          style={{ background: r.hex, color: textOn(r.hex) }}
        >
          {r.index}
        </li>
      ))}
    </ul>
  );
}

/** 3. Silhouette: a stylised dinosaur drawn for the site, its parts coloured by region name. */
export function DinoSilhouette({ regions, className }: { regions: RegionColor[]; className?: string }) {
  const id = useId().replace(/:/g, "");
  const parts = silhouetteColors(regions);
  const fill = (part: keyof typeof parts) => parts[part]?.hex ?? parts.body?.hex ?? "#8a8a8a";
  // tail tip on the left, shoulders on the right; head and legs drawn on top
  const trunk =
    "M10,112 C60,100 120,88 170,84 C220,80 262,86 290,100 C300,106 306,116 304,130 C300,150 280,168 250,174 C215,182 180,178 160,168 C130,154 80,134 10,112 Z";
  const head =
    "M278,100 C290,80 300,66 316,58 C336,48 372,46 392,56 C399,60 399,70 392,74 C372,80 350,82 336,86 L337,92 C352,94 372,94 384,98 C378,106 350,109 330,104 C316,112 306,124 304,132 Z";
  const leg = "M188,140 C172,160 176,184 194,196 L186,224 L172,236 L214,236 L206,224 L214,196 C234,184 240,158 230,140 Z";
  const arm = "M294,132 C302,142 308,150 304,160 L316,161 C319,150 313,136 302,127 Z";
  // ridge of spikes along the back line
  const spikes = [118, 140, 162, 184, 206, 228, 250, 270].map((x) => {
    const y = 0.0016 * (x - 205) ** 2 + 80;
    return `M${x - 8},${y + 4} L${x},${y - 11} L${x + 8},${y + 4} Z`;
  });
  const title = regions.map(label).join(" ; ");
  return (
    <svg viewBox="0 0 404 244" className={cn("w-full max-w-xl", className)} role="img" aria-label={`Silhouette coloriée. ${title}`}>
      <defs>
        <clipPath id={`${id}-trunk`}>
          <path d={trunk} />
        </clipPath>
      </defs>
      <g stroke="currentColor" strokeOpacity="0.5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {/* far legs, in the shade */}
        <path d={leg} transform="translate(38,-8)" fill={fill("limbs")} style={{ filter: "brightness(0.7)" }} />
        <path d={arm} transform="translate(-10,-4)" fill={fill("limbs")} style={{ filter: "brightness(0.7)" }} />
        {parts.spine && <path d={spikes.join(" ")} fill={fill("spine")} />}
        <path d={trunk} fill={fill("body")} />
        <g clipPath={`url(#${id}-trunk)`} stroke="none">
          {/* back: the upper side of the body and tail */}
          <path d="M0,0 H404 V96 C330,100 300,116 220,112 C160,110 90,112 0,124 Z" fill={fill("back")} />
          {parts.pattern && (
            <g fill={fill("pattern")}>
              {[96, 128, 160, 192, 224, 256].map((x) => (
                <path key={x} d={`M${x},76 l12,0 l-9,46 l-12,0 Z`} />
              ))}
            </g>
          )}
          <ellipse cx="226" cy="178" rx="92" ry="24" fill={fill("belly")} />
        </g>
        <path d={trunk} fill="none" />
        <path d={leg} fill={fill("limbs")} />
        <path d={head} fill={fill("head")} />
        <path d={arm} fill={fill("limbs")} />
        <path d="M340,90 C356,91 372,92 383,96" fill="none" strokeOpacity="0.7" />
      </g>
      <circle cx="362" cy="62" r="4" fill="#111" />
      <circle cx="388" cy="62" r="1.8" fill="#111" opacity="0.6" />
    </svg>
  );
}

/** 4. Œuf: a small avatar striped with the colours, for lists. */
export function ColorEgg({ regions, size = 48 }: { regions: RegionColor[]; size?: number }) {
  const id = useId().replace(/:/g, "");
  const egg = "M30,2 C46,2 58,28 58,48 C58,66 46,78 30,78 C14,78 2,66 2,48 C2,28 14,2 30,2 Z";
  const bands = regions.length ? regions : [];
  const h = 80 / Math.max(1, bands.length);
  return (
    <svg viewBox="0 0 60 80" width={size * 0.75} height={size} role="img" aria-label={bands.map(label).join(" ; ")}>
      <defs>
        <clipPath id={`${id}-egg`}>
          <path d={egg} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-egg)`}>
        {bands.map((r, i) => (
          <path
            key={r.index}
            d={`M-10,${i * h + 6} C10,${i * h} 30,${i * h + 12} 70,${i * h + 4} L70,${(i + 1) * h + 10} L-10,${(i + 1) * h + 10} Z`}
            fill={r.hex}
          />
        ))}
      </g>
      <path d={egg} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  );
}

/** 5. Bandeau: the header of a creature page in its colours. */
export function ColorBanner({ regions, title, subtitle }: { regions: RegionColor[]; title: string; subtitle: string }) {
  const n = Math.max(1, regions.length);
  const stops = regions.map((r, i) => `${r.hex} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(", ");
  return (
    <div className="overflow-hidden rounded-lg border" style={{ background: `linear-gradient(115deg, ${stops || "#444, #444"})` }}>
      <div className="bg-gradient-to-r from-black/70 via-black/40 to-transparent px-5 py-6 text-white">
        <p className="text-2xl font-semibold drop-shadow">{title}</p>
        <p className="text-sm text-white/85 drop-shadow">{subtitle}</p>
        <div className="mt-3">
          <ColorPills regions={regions} size="sm" />
        </div>
      </div>
    </div>
  );
}
