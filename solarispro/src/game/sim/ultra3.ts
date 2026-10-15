import { Body } from './engine';
import { Sim } from './sim';
import { ringBand } from './ultra';
import { canvasText } from './colors';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---------- Warped spacetime grid ----------
let gridFrame = 0, wells: Body[] = [], gridDepth = new Float32Array(0), gridSx = new Float32Array(0), gridSy = new Float32Array(0), gridOk = new Uint8Array(0);
export function drawSpacetimeGrid(ctx: Ctx, sim: Sim, sun: Body | undefined) {
  const cam = sim.camera, ox = sun?.x ?? 0, oy = sun?.y ?? 0, oz = sun?.z ?? 0;
  const N = 38, E = 2600, step = (E * 2) / N;
  const depth = (x: number, z: number) => {
    let d = 0;
    for (const m of wells) d += (6 * Math.sqrt(m.mass) * 40) / (Math.hypot(x - m.x, z - m.z) + 40);
    return Math.min(260, d);
  };
  const M = (N + 1) * (N + 1);
  if (gridFrame++ % 12 === 0 || gridDepth.length !== M) {
    wells = sim.world.bodies.filter((b) => b.massive && b.mass > 0.3);
    gridDepth = new Float32Array(M);
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) gridDepth[i * (N + 1) + j] = depth(ox - E + i * step, oz - E + j * step);
  }
  const sx = gridSx.length === M ? gridSx : (gridSx = new Float32Array(M)), sy = gridSy.length === M ? gridSy : (gridSy = new Float32Array(M)), ok = gridOk.length === M ? gridOk : (gridOk = new Uint8Array(M));
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = ox - E + i * step, z = oz - E + j * step, k = i * (N + 1) + j;
    ok[k] = cam.project(x, oy - 40 - gridDepth[k], z) > 0 ? 1 : 0;
    sx[k] = cam.sx; sy[k] = cam.sy;
  }
  ctx.strokeStyle = 'rgba(120,150,255,0.09)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const a = i * (N + 1) + j, b = a + 1, c = j * (N + 1) + i, d = c + N + 1;
    if (ok[a] && ok[b]) { ctx.moveTo(sx[a], sy[a]); ctx.lineTo(sx[b], sy[b]); }
    if (ok[c] && ok[d]) { ctx.moveTo(sx[c], sy[c]); ctx.lineTo(sx[d], sy[d]); }
  }
  ctx.stroke();
}

// ---------- Rings on the orbital plane ----------
function eclipticRing(ctx: Ctx, sim: Sim, sun: Body | undefined, R: number, width: number, color: string, dash?: number[]) {
  const cam = sim.camera, ox = sun?.x ?? 0, oy = sun?.y ?? 0, oz = sun?.z ?? 0;
  let zs = 0, n = 0, pen = false;
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * TAU, z = cam.project(ox + Math.cos(a) * R, oy, oz + Math.sin(a) * R);
    if (z < 0) { pen = false; continue; }
    zs += z; n++;
    pen ? ctx.lineTo(cam.sx, cam.sy) : ctx.moveTo(cam.sx, cam.sy); pen = true;
  }
  if (!n) return;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, (width * cam.F) / (zs / n));
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function ringLabel(ctx: Ctx, sim: Sim, sun: Body | undefined, R: number, text: string, color: string) {
  const cam = sim.camera;
  if (cam.project((sun?.x ?? 0) + R, sun?.y ?? 0, sun?.z ?? 0) < 0) return;
  canvasText(ctx); ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
  ctx.fillText(text, cam.sx + 4, cam.sy - 4);
}

/** Habitable zone, frost line, dust bands and the heliosphere edge */
export function drawZones(ctx: Ctx, sim: Sim, sun: Body | undefined) {
  ctx.globalCompositeOperation = 'lighter';
  eclipticRing(ctx, sim, sun, 1100, 200, 'rgba(180,150,110,0.035)');
  eclipticRing(ctx, sim, sun, 19250, 5500, 'rgba(140,180,220,0.025)');
  eclipticRing(ctx, sim, sun, 500, 140, 'rgba(80,230,140,0.035)');
  ctx.globalCompositeOperation = 'source-over';
  eclipticRing(ctx, sim, sun, 1350, 0, 'rgba(150,210,255,0.15)', [3, 6]);
  eclipticRing(ctx, sim, sun, 30000, 0, 'rgba(120,140,255,0.12)', [10, 10]);
  ringLabel(ctx, sim, sun, 570, 'HABITABLE ZONE', 'rgba(110,240,160,0.6)');
  ringLabel(ctx, sim, sun, 1350, 'FROST LINE', 'rgba(150,210,255,0.5)');
  ringLabel(ctx, sim, sun, 30000, 'HELIOPAUSE', 'rgba(140,160,255,0.5)');
}

// ---------- Oort cloud + floating dust ----------
const oort = Array.from({ length: 1800 }, () => {
  const u = Math.random() * 2 - 1, t = Math.random() * TAU, s = Math.sqrt(1 - u * u), r = 45000 + Math.random() * 25000;
  return [s * Math.cos(t) * r, u * r, s * Math.sin(t) * r];
});
export function drawOort(ctx: Ctx, sim: Sim) {
  const cam = sim.camera;
  ctx.fillStyle = 'rgba(170,200,230,0.35)';
  for (const [x, y, z] of oort) if (cam.project(x, y, z) > 0) ctx.fillRect(cam.sx, cam.sy, 1, 1);
}

const motes = Array.from({ length: 90 }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
export function drawMotes(ctx: Ctx, sim: Sim, t: number) {
  const cam = sim.camera, box = Math.max(60, cam.dist * 0.6);
  ctx.fillStyle = '#cfd8ff';
  for (const [a, b, c, p] of motes) {
    const wrap = (v: number, o: number) => o - box / 2 + ((((v * box - o) % box) + box) % box);
    const x = wrap(a + t * 0.002, cam.px), y = wrap(b, cam.py), z = wrap(c, cam.pz);
    const zc = cam.project(x, y, z);
    if (zc < 0) continue;
    ctx.globalAlpha = 0.25 * (1 - zc / box) * (0.6 + 0.4 * Math.sin(t + p * 10));
    const s = Math.max(1, 30 / zc);
    ctx.fillRect(cam.sx, cam.sy, s, s);
  }
  ctx.globalAlpha = 1;
}

// ---------- Stars: diffraction spikes + constellations ----------
let constellations: [number, number][] | null = null;
function buildConstellations(sim: Sim) {
  const bright = sim.stars.map((s, i) => ({ s, i })).filter((o) => o.s.b > 0.6);
  const out: [number, number][] = [];
  for (let k = 0; k < 14 && bright.length; k++) {
    let cur = bright[(Math.random() * bright.length) | 0];
    for (let n = 0; n < 5; n++) {
      let best: typeof cur | null = null, bd = 0.04;
      for (const o of bright) {
        if (o === cur) continue;
        const d = (o.s.x - cur.s.x) ** 2 + (o.s.y - cur.s.y) ** 2 + (o.s.z - cur.s.z) ** 2;
        if (d < bd && d > 0.002 && !out.some(([a, b]) => (a === o.i && b === cur.i) || (a === cur.i && b === o.i))) { bd = d; best = o; }
      }
      if (!best) break;
      out.push([cur.i, best.i]); cur = best;
    }
  }
  return out;
}

export function drawStarDetails(ctx: Ctx, sim: Sim, w: number, h: number) {
  const c = sim.camera;
  const proj = (s: { x: number; y: number; z: number }) => {
    const zc = s.x * c.fx + s.y * c.fy + s.z * c.fz;
    if (zc <= 0.05) return null;
    return [c.cx + ((s.x * c.rx + s.y * c.ry + s.z * c.rz) * c.F) / zc, c.cy - ((s.x * c.ux + s.y * c.uy + s.z * c.uz) * c.F) / zc];
  };
  constellations ??= buildConstellations(sim);
  ctx.strokeStyle = 'rgba(150,180,255,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [a, b] of constellations) {
    const p = proj(sim.stars[a]), q = proj(sim.stars[b]);
    if (p && q) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  for (const s of sim.stars) {
    if (s.b < 0.85) continue;
    const p = proj(s);
    if (!p || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) continue;
    const L = 5 * s.s;
    ctx.moveTo(p[0] - L, p[1]); ctx.lineTo(p[0] + L, p[1]);
    ctx.moveTo(p[0], p[1] - L); ctx.lineTo(p[0], p[1] + L);
  }
  ctx.stroke();
}

// ---------- Asteroids up close ----------
export function drawRock(ctx: Ctx, b: Body, x: number, y: number, s: number, t: number) {
  const rot = t * (0.3 + (b.id % 7) * 0.1) + b.id;
  ctx.fillStyle = b.color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + rot, rr = (s / 2) * (0.65 + 0.35 * Math.abs(Math.sin(b.id * 13.7 + i * 2.3)));
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(x + s * 0.12, y + s * 0.1, s * 0.12, 0, TAU); ctx.fill();
}

// ---------- Sun: sunspots + coronal mass ejections ----------
export function drawSunspots(ctx: Ctx, sx: number, sy: number, r: number, t: number) {
  if (r < 8) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.clip();
  for (let i = 0; i < 6; i++) {
    const lon = i * 1.9 + t * 0.05, lat = Math.sin(i * 4.1) * 0.5;
    const c = Math.cos(lon);
    if (c < 0.1) continue;
    const x = sx + Math.sin(lon) * Math.cos(lat) * r, y = sy - Math.sin(lat) * r;
    ctx.fillStyle = 'rgba(120,40,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.09 * c, r * 0.09, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(60,15,0,0.6)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.04 * c, r * 0.04, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

const cmes: { a: number; k: number }[] = [];
export function drawCMEs(ctx: Ctx, sx: number, sy: number, r: number, dt: number) {
  if (Math.random() < dt * 0.15) cmes.push({ a: Math.random() * TAU, k: 0 });
  ctx.globalCompositeOperation = 'lighter';
  for (let i = cmes.length - 1; i >= 0; i--) {
    const c = cmes[i];
    c.k += dt * 0.25;
    if (c.k >= 1) { cmes.splice(i, 1); continue; }
    const R = r * (1.1 + c.k * 14);
    ctx.strokeStyle = `rgba(255,170,90,${0.45 * (1 - c.k)})`;
    ctx.lineWidth = Math.max(1, r * 0.25 * (1 - c.k));
    ctx.beginPath(); ctx.arc(sx, sy, R, c.a - 0.45, c.a + 0.45); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Black hole: Einstein ring + jets ----------
export function drawBlackHoleExtras(ctx: Ctx, sx: number, sy: number, rr: number, t: number) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(170,200,255,${0.25 + 0.1 * Math.sin(t * 2)})`;
  ctx.lineWidth = Math.max(1, rr * 0.1);
  ctx.beginPath(); ctx.arc(sx, sy, rr * 2.2, 0, TAU); ctx.stroke();
  for (const s of [-1, 1]) {
    const L = rr * (7 + Math.sin(t * 3) * 0.6);
    const g = ctx.createLinearGradient(sx, sy, sx + s * L * 0.25, sy + s * -L);
    g.addColorStop(0, 'rgba(160,190,255,0.7)'); g.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - rr * 0.25, sy); ctx.lineTo(sx + s * L * 0.25 - rr * 0.6, sy - s * L);
    ctx.lineTo(sx + s * L * 0.25 + rr * 0.6, sy - s * L); ctx.lineTo(sx + rr * 0.25, sy);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Planet surface physics hints ----------
export function drawPlanetMaterial(ctx: Ctx, b: Body, sx: number, sy: number, r: number, lx: number, ly: number) {
  if (r < 4) return;
  const gx = sx + lx * r * 0.5, gy = sy + ly * r * 0.5;
  const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * (b.habitable ? 0.35 : 0.22));
  glint.addColorStop(0, `rgba(255,255,255,${b.habitable ? 0.45 : 0.18})`); glint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  if (b.temperature > 250) {
    const k = Math.min(1, (b.temperature - 250) / 500);
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(sx, sy, r * 0.8, sx, sy, r * 1.6);
    hg.addColorStop(0, `rgba(255,80,20,${0.5 * k})`); hg.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(sx, sy, r * 1.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (b.temperature < -150) {
    ctx.fillStyle = 'rgba(220,240,255,0.1)';
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }
}

export function drawRadiationBelts(ctx: Ctx, sim: Sim, b: Body, z: number) {
  if (b.name !== 'Earth' && b.name !== 'Jupiter') return;
  for (const [rm, col] of [[1.6, 'rgba(255,120,200,0.12)'], [2.3, 'rgba(120,200,255,0.1)']] as const) {
    ringBand(ctx, sim, b, z, true, rm, 0.35, col, 1.2);
    ringBand(ctx, sim, b, z, false, rm, 0.35, col, 1.2);
  }
}

export function drawMoonOrbits(ctx: Ctx, sim: Sim) {
  const cam = sim.camera, w = sim.world;
  const parents = new Map(w.bodies.filter((b) => b.kind !== 'asteroid').map((b) => [b.id, b]));
  ctx.strokeStyle = 'rgba(200,210,255,0.12)'; ctx.lineWidth = 1;
  for (const m of w.bodies) {
    if (m.parentId == null) continue;
    const p = parents.get(m.parentId);
    if (!p) continue;
    const R = p.radius * m.orbitR, st = Math.sin(m.orbitTilt), ct = Math.cos(m.orbitTilt);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      if (cam.project(p.x + R * Math.cos(a), p.y + R * Math.sin(a) * st, p.z + R * Math.sin(a) * ct) < 0) { pen = false; continue; }
      pen ? ctx.lineTo(cam.sx, cam.sy) : ctx.moveTo(cam.sx, cam.sy); pen = true;
    }
    ctx.stroke();
  }
}

// ---------- HUD bits ----------
export function drawVelocityArrow(ctx: Ctx, sim: Sim) {
  const b = sim.selected, cam = sim.camera;
  if (!b) return;
  if (cam.project(b.x, b.y, b.z) < 0) return;
  const x0 = cam.sx, y0 = cam.sy;
  if (cam.project(b.x + b.vx * 4, b.y + b.vy * 4, b.z + b.vz * 4) < 0) return;
  const x1 = cam.sx, y1 = cam.sy, a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = 'rgba(120,255,200,0.8)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.4) * 7, y1 - Math.sin(a - 0.4) * 7);
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a + 0.4) * 7, y1 - Math.sin(a + 0.4) * 7);
  ctx.stroke();
  canvasText(ctx); ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
  ctx.fillText(`v ${Math.hypot(b.vx, b.vy, b.vz).toFixed(1)}`, x1 + 5, y1);
}

let scanPattern: CanvasPattern | null = null;
export function drawScanlines(ctx: Ctx, w: number, h: number) {
  if (!scanPattern) {
    const c = document.createElement('canvas'); c.width = 1; c.height = 3;
    const g = c.getContext('2d'); if (!g) return; g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, 1, 1);
    scanPattern = ctx.createPattern(c, 'repeat');
  }
  if (scanPattern) { ctx.fillStyle = scanPattern; ctx.fillRect(0, 0, w, h); }
}