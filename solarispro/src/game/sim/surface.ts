import { Body } from './engine';
import { shade } from './colors';

type Ctx = CanvasRenderingContext2D;

interface Spot { lon: number; lat: number; size: number; color: string; stretch?: number }
interface Crater { lon: number; lat: number; size: number; depth: number }
interface Look { bands?: [number, number, string][]; spots?: Spot[]; caps?: string; clouds?: boolean; atmo?: string; spin: number }

const deg = Math.PI / 180;

const LOOKS: Record<string, Look> = {
  Mercury: { spin: 0.05, atmo: 'rgba(195,175,150,0.16)', spots: [
    { lon: 0, lat: 20 * deg, size: 0.18, color: '#7d766c' }, { lon: 70 * deg, lat: -30 * deg, size: 0.12, color: '#8a8378' },
    { lon: 150 * deg, lat: 10 * deg, size: 0.22, color: '#857e74' }, { lon: 230 * deg, lat: -10 * deg, size: 0.1, color: '#6f695f' },
    { lon: 300 * deg, lat: 40 * deg, size: 0.14, color: '#7a7369' },
  ] },
  Venus: { spin: -0.02, atmo: 'rgba(255,220,150,0.5)', bands: [[-0.5, 0.15, 'rgba(255,240,200,0.25)'], [0.1, 0.2, 'rgba(200,150,80,0.25)'], [0.55, 0.12, 'rgba(255,235,190,0.2)']] },
  Earth: { spin: 0.6, atmo: 'rgba(90,175,255,0.72)', caps: '#f2f8ff', clouds: true, spots: [
    { lon: 0, lat: 15 * deg, size: 0.32, color: '#3f9a4a', stretch: 1.6 }, { lon: 30 * deg, lat: -20 * deg, size: 0.22, color: '#c9a65a' },
    { lon: 110 * deg, lat: 35 * deg, size: 0.38, color: '#4a9a50', stretch: 1.8 }, { lon: 200 * deg, lat: -25 * deg, size: 0.2, color: '#c79a52' },
    { lon: 260 * deg, lat: 30 * deg, size: 0.3, color: '#3d8f46', stretch: 1.3 }, { lon: 280 * deg, lat: -15 * deg, size: 0.22, color: '#479c4c' },
  ] },
  Mars: { spin: 0.58, atmo: 'rgba(255,125,70,0.3)', caps: '#fff0df', spots: [
    { lon: 40 * deg, lat: 0, size: 0.35, color: '#9e3f22', stretch: 2.2 }, { lon: 160 * deg, lat: 18 * deg, size: 0.12, color: '#e08a5c' },
    { lon: 250 * deg, lat: -20 * deg, size: 0.25, color: '#a8492a' },
  ] },
  Jupiter: { spin: 1.4, atmo: 'rgba(255,190,130,0.28)', clouds: true, bands: [
    [-0.75, 0.12, '#b88456'], [-0.45, 0.1, '#f1d9b5'], [-0.2, 0.14, '#a8683e'], [0.1, 0.12, '#f3dfc0'],
    [0.35, 0.14, '#b77a4a'], [0.62, 0.1, '#e9cda6'], [0.85, 0.08, '#9c6c48'],
  ], spots: [{ lon: 0, lat: -22 * deg, size: 0.16, color: '#c4533a', stretch: 1.7 }] },
  Saturn: { spin: 1.3, atmo: 'rgba(255,218,150,0.32)', bands: [[-0.72, 0.11, '#a9854e'], [-0.6, 0.15, '#e6c982'], [-0.38, 0.08, '#fff0c7'], [-0.2, 0.12, '#f3e3b8'], [0.02, 0.07, '#a9804e'], [0.15, 0.16, '#c9a96c'], [0.36, 0.08, '#f8e9bd'], [0.55, 0.14, '#efdcaa'], [0.78, 0.08, '#b99a62']] },
  Uranus: { spin: 0.8, atmo: 'rgba(120,245,255,0.62)', bands: [[-0.45, 0.09, 'rgba(255,255,255,0.09)'], [0.2, 0.25, 'rgba(255,255,255,0.18)'], [0.55, 0.08, 'rgba(70,210,230,0.16)']] },
  Neptune: { spin: 0.9, atmo: 'rgba(80,130,255,0.72)', clouds: true, bands: [[-0.3, 0.12, 'rgba(140,190,255,0.36)'], [0.05, 0.06, 'rgba(30,70,210,0.24)'], [0.4, 0.1, 'rgba(30,50,160,0.42)']],
    spots: [{ lon: 0, lat: -20 * deg, size: 0.14, color: '#1e2f8f', stretch: 1.6 }, { lon: 90 * deg, lat: 30 * deg, size: 0.06, color: '#e6ecff', stretch: 2 }] },
};

const customCache = new Map<number, Look>();
function lookFor(b: Body): Look {
  if (LOOKS[b.name]) return LOOKS[b.name];
  let l = customCache.get(b.id);
  if (!l) {
    let seed = b.id * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    l = {
      spin: 0.4 + rnd(),
      bands: Array.from({ length: 30 }, () => [rnd() * 1.8 - 0.9, 0.025 + rnd() * 0.07, rnd() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'] as [number, number, string]),
      spots: Array.from({ length: 24 }, () => ({ lon: rnd() * 6.28, lat: (rnd() - 0.5) * 1.6, size: 0.035 + rnd() * 0.11, color: 'rgba(0,0,0,0.22)', stretch: 1 + rnd() })), 
    };
    customCache.set(b.id, l);
  }
  return l;
}

function spot(ctx: Ctx, s: Spot, sx: number, sy: number, r: number, spin: number, viewLon = 0, viewLat = 0) {
  // Longitude is camera-relative: the texture wraps around the sphere as the observer orbits it.
  const lon = s.lon + spin - viewLon;
  const lat = Math.max(-1.52, Math.min(1.52, s.lat - viewLat * 0.42));
  const c = Math.cos(lon);
  if (c < 0.035) return;
  const x = sx + r * Math.sin(lon) * Math.cos(lat);
  const y = sy - r * Math.sin(lat);
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.ellipse(x, y, s.size * r * c * (s.stretch ?? 1), s.size * r, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Paints surface features (bands, continents, storms, ice caps, clouds) clipped to the disc */
const textureCache = new Map<number, Spot[]>();
const craterCache = new Map<number, Crater[]>();
function proceduralCraters(b: Body) {
  let craters = craterCache.get(b.id);
  if (craters) return craters;
  let seed = b.id * 31337 + 1709;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  craters = Array.from({ length: 360 }, () => ({
    lon: rnd() * Math.PI * 2,
    lat: (rnd() - 0.5) * 2.5,
    size: 0.006 + Math.pow(rnd(), 2.0) * 0.09,
    depth: 0.35 + rnd() * 0.65,
  }));
  craterCache.set(b.id, craters);
  return craters;
}

function drawCraters(ctx: Ctx, b: Body, sx: number, sy: number, r: number, spin: number, viewLon: number, viewLat: number, quality: number) {
  // Rocky worlds gain overlapping, softly lit impact basins at close range; gas giants stay smooth.
  if (r < 18 || /jupiter|saturn|uranus|neptune|venus/i.test(b.name)) return;
  const craters = proceduralCraters(b);
  const count = Math.min(craters.length, Math.round((r > 70 ? 360 : 210) * Math.max(0.5, Math.min(1.5, quality / 100))));
  for (let i = 0; i < count; i++) {
    const c = craters[i];
    const lon = c.lon + spin - viewLon;
    const lat = Math.max(-1.52, Math.min(1.52, c.lat - viewLat * 0.42));
    const facing = Math.cos(lon);
    if (facing < 0.06) continue;
    const x = sx + r * Math.sin(lon) * Math.cos(lat);
    const y = sy - r * Math.sin(lat);
    const rr = Math.max(0.65, c.size * r * facing);
    ctx.globalAlpha = c.depth * 0.42;
    ctx.strokeStyle = 'rgba(12,13,20,0.96)';
    ctx.lineWidth = Math.max(0.5, rr * 0.24);
    ctx.beginPath(); ctx.ellipse(x, y, rr * 1.25, rr * 0.78, Math.sin(lon) * 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = c.depth * 0.32;
    ctx.strokeStyle = 'rgba(255,241,218,0.95)';
    ctx.lineWidth = Math.max(0.45, rr * 0.15);
    ctx.beginPath(); ctx.ellipse(x - rr * 0.12, y - rr * 0.12, rr, rr * 0.62, Math.sin(lon) * 0.2, Math.PI * 1.05, Math.PI * 2.0); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function proceduralTexture(b: Body, quality = 100) {
  let spots = textureCache.get(b.id);
  if (spots) return spots;
  let seed = b.id * 741103 + 9137;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const base = b.color.startsWith('#') ? b.color : '#8a8f9c';
  spots = Array.from({ length: 1600 }, (_, i) => ({
    lon: rnd() * Math.PI * 2, lat: (rnd() - 0.5) * 2.55,
    size: i < 64 ? 0.025 + rnd() * 0.04 : i < 360 ? 0.008 + rnd() * 0.018 : 0.003 + rnd() * 0.012,
    color: i % 5 === 0 ? 'rgba(255,255,255,0.22)' : i % 3 === 0 ? shade(base, 1.35) : shade(base, 0.58),
    stretch: 0.65 + rnd() * 2.2,
  }));
  textureCache.set(b.id, spots);
  return spots;
}

export function drawSurface(ctx: Ctx, b: Body, sx: number, sy: number, r: number, t: number, viewLon = 0, viewLat = 0, quality = 100) {
  const look = lookFor(b);
  const spin = t * look.spin * 0.25 + b.id;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.clip();
  for (const [y, hgt, col] of look.bands ?? []) {
    ctx.fillStyle = col;
    ctx.fillRect(sx - r, sy + y * r - (hgt * r) / 2, r * 2, hgt * r);
  }
  // 3x detailed texture pass for richer planetary surfaces.
  const texture = proceduralTexture(b, quality);
  const textureCount = Math.min(texture.length, Math.round(1200 * Math.max(1, Math.min(1.5, quality / 100))));
  for (let i = 0; i < textureCount; i++) spot(ctx, texture[i], sx, sy, r, spin, viewLon, viewLat);
  drawCraters(ctx, b, sx, sy, r, spin, viewLon, viewLat, quality);
  // Fine deterministic pixel grain creates layered material detail on close-up worlds.
  if (r >= 24) {
    let seed = b.id * 104729 + 8171;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    // Fine grain is costly to redraw every frame; reserve it for true close-ups.
    const grainCount = Math.min(1100, Math.round(r * 3.2 * Math.max(1, Math.min(1.5, quality / 100))));
    for (let i = 0; i < grainCount; i++) {
      const lon = rnd() * Math.PI * 2 + spin - viewLon;
      const lat = (rnd() - 0.5) * 2.35 - viewLat * 0.42;
      if (Math.cos(lon) <= 0.08) continue;
      const gx = sx + r * Math.sin(lon) * Math.cos(lat);
      const gy = sy - r * Math.sin(lat);
      const px = Math.max(0.55, Math.min(2.0, r * (0.006 + rnd() * 0.012)));
      const tone = rnd();
      ctx.fillStyle = tone > 0.78 ? 'rgba(255,255,255,0.19)' : tone < 0.25 ? 'rgba(0,0,0,0.2)' : 'rgba(30,35,45,0.08)';
      ctx.fillRect(gx, gy, px, px * (0.65 + rnd() * 0.7));
    }
  }
  for (const s of look.spots ?? []) spot(ctx, s, sx, sy, r, spin, viewLon, viewLat);
  if (look.clouds) {
    // Layered, softly broken cloud bands catch the key light and add a 3D atmosphere.
    for (let i = 0; i < 18; i++) {
      const lat = Math.sin(i * 2.3) * 0.92;
      const size = 0.045 + (i % 4) * 0.018;
      const alpha = 0.18 + (i % 3) * 0.09;
      spot(ctx, { lon: i * 0.69, lat, size, color: `rgba(255,255,255,${alpha})`, stretch: 2.1 + (i % 3) * 0.65 }, sx, sy, r, spin * 1.15, viewLon, viewLat);
      if (i % 2 === 0) spot(ctx, { lon: i * 0.69 + 0.22, lat: lat + 0.12, size: size * 0.55, color: 'rgba(190,225,255,0.2)', stretch: 2.8 }, sx, sy, r, spin * 1.22, viewLon, viewLat);
    }
  }
  if (look.caps) {
    ctx.fillStyle = look.caps;
    ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.95, r * 0.45, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.97, r * 0.35, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export const lookSpin = (b: Body, t: number) => t * lookFor(b).spin * 0.25 + b.id;

export function atmosphereFor(b: Body) { return lookFor(b).atmo; }