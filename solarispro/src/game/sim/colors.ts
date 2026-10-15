const cache = new Map<string, string>();

let ink: string | undefined;
/** Canvas labels use the same semantic white ink as the interface. */
export function canvasText(ctx: CanvasRenderingContext2D) {
  ink ??= getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** factor > 1 mixes toward white, < 1 darkens */
export function shade(hex: string, f: number): string {
  const key = hex + f;
  const hit = cache.get(key);
  if (hit) return hit;
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number) =>
    Math.round(f >= 1 ? c + (255 - c) * Math.min(1, f - 1) : c * Math.max(0, f));
  const out = `rgb(${m(r)},${m(g)},${m(b)})`;
  cache.set(key, out);
  return out;
}