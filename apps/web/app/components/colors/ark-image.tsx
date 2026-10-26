// EF-22 (D-27): the creature as it looks in ARK, coloured like in ASB. The images are renders of
// the game made by the community (github.com/arkutils/species-images, MIT), hosted with the site in
// public/creatures: for each species a white base image and a mask whose key colours mark the 6
// colour regions. manifest.json maps the species name to its files (the ASA render first).

import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import type { RegionColor } from "./regions";

const IMAGES = "/creatures/";

type Manifest = Record<string, string>;
let manifest: Promise<Manifest> | null = null;
/** Species name → file name without extension; empty when the list cannot be read. */
function loadManifest(): Promise<Manifest> {
  manifest ??= fetch(`${IMAGES}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
    .catch((): Manifest => ({}));
  return manifest;
}

/** Mask key colour of each region, as captured in game (ASB: region 0 red, 1 green, 2 blue, 3 cyan, 4 yellow, 5 magenta). */
type Rgb = [number, number, number];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const cache = new Map<string, Promise<{ base: ImageData; mask: ImageData } | null>>();

/** Base and mask of a species; null when the species has no image. */
function speciesImages(name: string) {
  let found = cache.get(name);
  if (!found) {
    found = (async () => {
      const file = (await loadManifest())[name];
      if (file) {
        try {
          const [base, mask] = await Promise.all([
            loadImage(`${IMAGES}${encodeURIComponent(file)}.png`),
            loadImage(`${IMAGES}${encodeURIComponent(file)}_m.png`),
          ]);
          const read = (img: HTMLImageElement) => {
            const canvas = document.createElement("canvas");
            canvas.width = base.naturalWidth;
            canvas.height = base.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return ctx.getImageData(0, 0, canvas.width, canvas.height);
          };
          return { base: read(base), mask: read(mask) };
        } catch {
          // missing or unreadable file: no image
        }
      }
      return null;
    })();
    cache.set(name, found);
  }
  return found;
}

const toRgb = (hex: string): Rgb | null => {
  const n = Number.parseInt(hex.slice(1), 16);
  return Number.isNaN(n) ? null : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Tints the white base image: each pixel takes the colours of the regions its mask pixel belongs
 * to (key colours can blend on the edges), multiplied by the base lightness.
 */
function colorize(base: ImageData, mask: ImageData, colors: (Rgb | null)[]): ImageData {
  const out = new ImageData(base.width, base.height);
  const b = base.data;
  const m = mask.data;
  const o = out.data;
  for (let i = 0; i < b.length; i += 4) {
    const r = m[i]! / 255;
    const g = m[i + 1]! / 255;
    const bl = m[i + 2]! / 255;
    // white (no region) first, then the secondary key colours, then the primary ones
    const white = Math.min(r, g, bl);
    let [r1, g1, b1] = [r - white, g - white, bl - white];
    const cyan = Math.min(g1, b1);
    const yellow = Math.min(r1, g1);
    const magenta = Math.min(r1, b1);
    r1 -= yellow + magenta;
    g1 -= yellow + cyan;
    b1 -= cyan + magenta;
    const weights = [Math.max(0, r1), Math.max(0, g1), Math.max(0, b1), cyan, yellow, magenta];
    const factor: Rgb = [1, 1, 1];
    let total = 0;
    weights.forEach((w, region) => {
      const c = colors[region];
      if (!w || !c) return;
      total += w;
      for (let k = 0; k < 3; k++) factor[k]! += w * (c[k]! - 1);
    });
    if (total > 1) for (let k = 0; k < 3; k++) factor[k] = 1 + (factor[k]! - 1) / total;
    o[i] = b[i]! * factor[0];
    o[i + 1] = b[i + 1]! * factor[1];
    o[i + 2] = b[i + 2]! * factor[2];
    o[i + 3] = b[i + 3]!;
  }
  return out;
}

/** 0. Rendu ARK: the game's look of the species, in the creature's colours. */
export function ArkCreatureImage({
  speciesName,
  regions,
  className,
}: {
  /** ASB display name of the species ("Rex", "Therizinosaur"…). */
  speciesName: string;
  regions: RegionColor[];
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const colorsKey = regions.map((r) => `${r.index}:${r.hex}`).join(",");

  useEffect(() => {
    let active = true;
    setState("loading");
    void speciesImages(speciesName).then((images) => {
      if (!active) return;
      if (!images || !canvas.current) {
        setState("missing");
        return;
      }
      const colors: (Rgb | null)[] = Array(6).fill(null);
      for (const r of regions) colors[r.index] = r.color ? toRgb(r.hex) : null;
      canvas.current.width = images.base.width;
      canvas.current.height = images.base.height;
      canvas.current.getContext("2d")!.putImageData(colorize(images.base, images.mask, colors), 0, 0);
      setState("ready");
    });
    return () => {
      active = false;
    };
    // colorsKey stands for the regions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesName, colorsKey]);

  return (
    <div className={cn("relative aspect-square w-full max-w-sm", className)}>
      <canvas
        ref={canvas}
        className={cn("size-full object-contain", state !== "ready" && "invisible")}
        role="img"
        aria-label={`${speciesName} aux couleurs : ${regions.map((r) => `${r.name} ${r.color?.name ?? "—"}`).join(", ")}`}
      />
      {state !== "ready" && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" role="status">
          {state === "loading" ? "Chargement de l'image…" : "Pas encore d'image pour cette espèce."}
        </p>
      )}
    </div>
  );
}
