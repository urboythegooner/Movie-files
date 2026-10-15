import { Body } from './engine';
import { Sim } from './sim';
import { canvasText } from './colors';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

/** Rotating corona streamers + pulsing heat shockwave around stars */
export function drawCorona(ctx: Ctx, sx: number, sy: number, r: number, t: number, color: string) {
  if (r < 3) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + t * 0.05 + Math.sin(t * 0.3 + i) * 0.08;
    const len = r * (1.6 + 0.9 * hash(i) + 0.3 * Math.sin(t * 0.7 + i * 2));
    const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    g.addColorStop(0, 'rgba(255,230,170,0.25)'); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.strokeStyle = g; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); ctx.stroke();
  }
  const ph = (t * 0.25) % 1;
  ctx.strokeStyle = color; ctx.globalAlpha = (1 - ph) * 0.25; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy, r * (1.2 + ph * 3), 0, TAU); ctx.stroke();
  ctx.restore();
}

/** Einstein ring + photon sphere shimmer around black holes */
export function drawEinsteinRing(ctx: Ctx, sx: number, sy: number, rr: number, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(${180 + i * 25},${200 + i * 15},255,${0.18 - i * 0.05})`;
    ctx.lineWidth = 1 + i;
    ctx.beginPath(); ctx.arc(sx, sy, rr * (1.5 + i * 0.12) + Math.sin(t * 2 + i) * 0.6, 0, TAU); ctx.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = t * (0.8 + hash(i)) + i, d = rr * (1.3 + hash(i + 9) * 0.4);
    ctx.fillStyle = 'rgba(255,240,210,0.7)';
    ctx.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.35, 1.5, 1.5);
  }
  ctx.restore();
}

/** Clouds, auroras, volcanoes, frost glitter and meteors on planets */
export function drawPlanetDetail(ctx: Ctx, b: Body, sx: number, sy: number, r: number, t: number, lx: number, ly: number) {
  if (r < 4) return;
  const seed = b.id * 13.7;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.clip();
  // drifting cloud bands on worlds with weather
  if (b.habitable || (b.temperature > -120 && b.temperature < 300 && b.mass > 0.002)) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 24; i++) {
      const y = sy + (hash(seed + i) * 1.6 - 0.8) * r;
      const x = sx + (((hash(seed + i * 3) + t * 0.02 * (1 + hash(i))) % 1) * 2.6 - 1.3) * r;
      ctx.beginPath(); ctx.ellipse(x, y, r * (0.25 + hash(seed + i * 7) * 0.35), r * 0.06, 0, 0, TAU); ctx.fill();
    }
  }
  // volcano glow & eruptions on hot worlds
  if (b.temperature > 250) {
    for (let i = 0; i < 13; i++) {
      const a = hash(seed + i) * TAU, d = hash(seed + i * 5) * 0.8 * r;
      const x = sx + Math.cos(a) * d, y = sy + Math.sin(a) * d, p = 0.5 + 0.5 * Math.sin(t * 3 + i * 2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.18);
      g.addColorStop(0, `rgba(255,${180 + p * 60},80,${0.5 + p * 0.4})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, TAU); ctx.fill();
      if (p > 0.92) { ctx.fillStyle = '#ffd27a'; for (let k = 0; k < 4; k++) ctx.fillRect(x + (hash(t + k) - 0.5) * r * 0.2, y - hash(t * 2 + k) * r * 0.25, 1.5, 1.5); }
    }
  }
  // frost glitter on cold worlds
  if (b.temperature < -60) {
    for (let i = 0; i < 42; i++) {
      if (Math.sin(t * 3 + i * 7.1) < 0.7) continue;
      const a = hash(seed + i * 2) * TAU, d = Math.sqrt(hash(seed + i * 4)) * r * 0.95;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 1.5, 1.5);
    }
  }
  // night side shadow sharpen
  const g = ctx.createLinearGradient(sx + lx * r, sy + ly * r, sx - lx * r, sy - ly * r);
  g.addColorStop(0.55, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,0.35)');
  ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  ctx.restore();
  // auroras at poles
  if (b.habitable || b.mass > 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(${s > 0 ? 90 : 160},255,${s > 0 ? 170 : 220},${0.12 + 0.1 * Math.sin(t * 2 + i)})`;
        ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath(); ctx.ellipse(sx, sy + s * r * (0.82 + i * 0.05), r * (0.35 - i * 0.05), r * 0.09, 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // occasional meteor streaking into the atmosphere
  const m = (t * 0.4 + hash(seed)) % 1;
  if (m < 0.08 && (b.habitable || b.temperature > -150)) {
    const a = hash(Math.floor(t * 0.4 + hash(seed)) + seed) * TAU, k = m / 0.08;
    const x0 = sx + Math.cos(a) * r * (1.6 - k * 0.6), y0 = sy + Math.sin(a) * r * (1.6 - k * 0.6);
    ctx.strokeStyle = `rgba(255,220,160,${1 - k})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * r * 0.4, y0 + Math.sin(a) * r * 0.4); ctx.stroke();
  }
}

/** Targeting reticle with live readouts around the selected body */
export function drawReticle(ctx: Ctx, sim: Sim, t: number) {
  const b = sim.selected, cam = sim.camera;
  if (!b) return;
  const z = cam.project(b.x, b.y, b.z);
  if (z < 0) return;
  const r = Math.max(8, (b.radius * cam.F) / z) + 10, sx = cam.sx, sy = cam.sy;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,192,77,0.8)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + t * 0.6;
    ctx.beginPath(); ctx.arc(sx, sy, r, a, a + 0.5); ctx.stroke();
  }
  ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(sx, sy, r + 6, -t * 0.4, -t * 0.4 + TAU); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(sx + r + 4, sy - 4); ctx.lineTo(sx + r + 24, sy - 18); ctx.lineTo(sx + r + 90, sy - 18); ctx.stroke();
  ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; canvasText(ctx);
  const v = Math.hypot(b.vx, b.vy, b.vz);
  ctx.fillText(`V ${v.toFixed(1)}  M ${(b.mass / 0.03).toPrecision(3)}⊕`, sx + r + 26, sy - 22);
  if (b.kind === 'planet' || b.kind === 'moon') ctx.fillText(`T ${Math.round(b.temperature)}°C`, sx + r + 26, sy - 8);
  ctx.restore();
}

/** Lagrange points L1–L5 for the selected planet around its star */
export function drawLagrange(ctx: Ctx, sim: Sim, t: number) {
  const p = sim.selected, cam = sim.camera;
  if (!p || p.kind !== 'planet') return;
  const sun = sim.world.bodies.find((b) => b.kind === 'sun' && b.alive);
  if (!sun) return;
  const dx = p.x - sun.x, dz = p.z - sun.z, R = Math.hypot(dx, dz);
  if (R < 1) return;
  const a = Math.atan2(dz, dx), h = R * Math.cbrt(p.mass / (3 * sun.mass));
  const pts: [string, number, number][] = [
    ['L1', a, R - h], ['L2', a, R + h], ['L3', a + Math.PI, R], ['L4', a + Math.PI / 3, R], ['L5', a - Math.PI / 3, R],
  ];
  ctx.save();
  ctx.font = '8px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
  for (const [n, ang, d] of pts) {
    if (cam.project(sun.x + Math.cos(ang) * d, p.y, sun.z + Math.sin(ang) * d) < 0) continue;
    const s = 3 + Math.sin(t * 3) * 0.6;
    ctx.strokeStyle = 'rgba(140,220,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cam.sx, cam.sy - s); ctx.lineTo(cam.sx + s, cam.sy); ctx.lineTo(cam.sx, cam.sy + s); ctx.lineTo(cam.sx - s, cam.sy); ctx.closePath(); ctx.stroke();
    canvasText(ctx); ctx.fillText(n, cam.sx, cam.sy - 7);
  }
  ctx.restore();
}

/** Foreground space dust drifting past the camera for depth */
let dust: { x: number; y: number; z: number }[] = [];
export function drawDust(ctx: Ctx, sim: Sim, w: number, h: number) {
  if (!dust.length) dust = Array.from({ length: 240 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));
  const cam = sim.camera;
  ctx.save();
  for (const d of dust) {
    const x = (((d.x + cam.yaw * 0.15 * d.z) % 1) + 1) % 1, y = (((d.y + cam.pitch * 0.15 * d.z) % 1) + 1) % 1;
    ctx.fillStyle = `rgba(200,210,255,${0.08 + d.z * 0.12})`;
    const s = d.z * 1.8;
    ctx.fillRect(x * w, y * h, s, s);
  }
  ctx.restore();
}