import { Body } from './engine';
import { Sim } from './sim';
import { lookSpin } from './surface';

type Ctx = CanvasRenderingContext2D;

export interface Nebula { x: number; y: number; z: number; size: number; color: string }

export function makeNebulae(): Nebula[] {
  const cols = ['120,60,200', '40,90,200', '200,60,120', '30,150,170', '220,120,60', '90,50,160'];
  return Array.from({ length: 48 }, (_, i) => {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return { x: s * Math.cos(t), y: u * 0.6, z: s * Math.sin(t), size: 0.25 + Math.random() * 0.45, color: cols[i % cols.length] };
  });
}

/** Faint colored gas clouds far behind the stars */
export function drawNebulae(ctx: Ctx, sim: Sim, w: number, h: number) {
  const c = sim.camera;
  ctx.globalCompositeOperation = 'lighter';
  for (const n of sim.nebulae) {
    const l = Math.hypot(n.x, n.y, n.z);
    const x = n.x / l, y = n.y / l, z = n.z / l;
    const zc = x * c.fx + y * c.fy + z * c.fz;
    if (zc <= 0.1) continue;
    const sx = c.cx + ((x * c.rx + y * c.ry + z * c.rz) * c.F) / zc;
    const sy = c.cy - ((x * c.ux + y * c.uy + z * c.uz) * c.F) / zc;
    const R = (n.size * c.F) / zc;
    if (sx < -R || sy < -R || sx > w + R || sy > h + R) continue;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
    g.addColorStop(0, `rgba(${n.color},0.13)`);
    g.addColorStop(0.5, `rgba(${n.color},0.05)`);
    g.addColorStop(1, `rgba(${n.color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Big bloom, rotating corona rays and flickering surface for the Sun */
export function drawSunUltra(ctx: Ctx, sx: number, sy: number, r: number, t: number) {
  ctx.globalCompositeOperation = 'lighter';
  const bloom = ctx.createRadialGradient(sx, sy, r, sx, sy, r * 4.5);
  bloom.addColorStop(0, 'rgba(255,170,70,0.12)');
  bloom.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = bloom;
  ctx.beginPath(); ctx.arc(sx, sy, r * 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  // Reduce ray count on huge close-up suns to avoid spending the frame on tiny details.
  for (let i = 0, rays = r > 90 ? 20 : r > 35 ? 36 : 56; i < rays; i++) {
    const a = (i / 28) * Math.PI * 2 + t * 0.04 * (i % 2 ? 1 : -1);
    const len = r * (1.8 + 0.9 * Math.sin(t * 0.7 + i * 1.7) + (i % 3) * 0.4);
    ctx.strokeStyle = 'rgba(255,180,90,0.06)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * r * 0.8, sy + Math.sin(a) * r * 0.8);
    ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function drawSunGranules(ctx: Ctx, sx: number, sy: number, r: number, t: number) {
  if (r < 8) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996 + t * 0.03, d = Math.sqrt((i + 0.5) / 40) * r;
    const flick = 0.5 + 0.5 * Math.sin(t * 2 + i * 3.1);
    ctx.fillStyle = i % 7 === 0 ? `rgba(160,60,10,${0.25 * flick})` : `rgba(255,255,220,${0.12 * flick})`;
    ctx.beginPath(); ctx.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d, r * (i % 7 === 0 ? 0.07 : 0.12), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** One ring band, split into the half behind and in front of the planet */
export function ringBand(ctx: Ctx, sim: Sim, b: Body, zCenter: number, back: boolean, rm: number, width: number, color: string, tilt: number) {
  const cam = sim.camera, R = b.radius * rm, N = 64;
  const pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const z = cam.project(b.x + Math.cos(a) * R, b.y + Math.sin(a) * Math.sin(tilt) * R, b.z + Math.sin(a) * Math.cos(tilt) * R);
    pts.push(cam.sx, cam.sy, z);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.7, (b.radius * width * cam.F) / zCenter);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const z1 = pts[i * 3 + 2], z2 = pts[i * 3 + 5];
    if (z1 < 0 || z2 < 0 || ((z1 + z2) / 2 > zCenter) !== back) continue;
    ctx.moveTo(pts[i * 3], pts[i * 3 + 1]);
    ctx.lineTo(pts[i * 3 + 3], pts[i * 3 + 4]);
  }
  ctx.stroke();
}

const SATURN_BANDS: [number, number, string][] = [
  [1.3, 0.1, 'rgba(160,140,110,0.25)'], [1.45, 0.14, 'rgba(200,180,140,0.45)'], [1.62, 0.16, 'rgba(235,215,170,0.75)'],
  [1.8, 0.14, 'rgba(225,200,155,0.7)'], [2.05, 0.12, 'rgba(210,190,150,0.5)'], [2.2, 0.08, 'rgba(190,170,135,0.4)'], [2.32, 0.03, 'rgba(230,220,200,0.5)'],
];

export function drawRingsUltra(ctx: Ctx, sim: Sim, b: Body, z: number, back: boolean) {
  if (b.name === 'Uranus') { ringBand(ctx, sim, b, z, back, 1.9, 0.03, 'rgba(200,230,240,0.35)', 1.45); return; }
  if (b.name === 'Jupiter') { ringBand(ctx, sim, b, z, back, 1.7, 0.03, 'rgba(220,190,150,0.18)', 0.05); return; }
  for (const [rm, wd, col] of SATURN_BANDS) ringBand(ctx, sim, b, z, back, rm, wd, col, 0.47);
}

/** Thin turbulent cloud stripes */
export function drawFineBands(ctx: Ctx, b: Body, sx: number, sy: number, r: number, t: number) {
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 18; i++) {
    const y = -1 + (i + 0.5) / 9;
    const wob = Math.sin(t * 0.3 + i * 1.3 + b.id) * 0.02;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(sx - r, sy + (y + wob) * r, r * 2, r * 0.05);
  }
  ctx.restore();
}

/** Glowing cities on the night side of populated worlds */
export function drawCityLights(ctx: Ctx, b: Body, sx: number, sy: number, r: number, t: number, lx: number, ly: number) {
  if (b.population < 1e5 || r < 6) return;
  const count = Math.min(70, Math.round(10 + Math.log10(b.population) * 6));
  const spin = lookSpin(b, t);
  let seed = b.id * 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = 'rgba(255,214,120,0.9)';
  for (let i = 0; i < count; i++) {
    const lon = rnd() * Math.PI * 2 + spin, lat = (rnd() - 0.5) * 2.2;
    if (Math.cos(lon) < 0.1) continue;
    const px = Math.sin(lon) * Math.cos(lat) * r, py = -Math.sin(lat) * r * 0.9;
    if ((px * lx + py * ly) / r > -0.25) continue;
    const s = Math.max(1, r * 0.035);
    ctx.fillRect(sx + px - s / 2, sy + py - s / 2, s, s);
  }
}