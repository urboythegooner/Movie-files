import { Body } from './engine';
import { Sim } from './sim';
import { lookSpin } from './surface';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---------- Background: galaxies + shooting stars ----------
const galaxies = Array.from({ length: 12 }, () => {
  const u = Math.random() * 2 - 1, t = Math.random() * TAU, s = Math.sqrt(1 - u * u);
  return { x: s * Math.cos(t), y: u, z: s * Math.sin(t), size: 0.025 + Math.random() * 0.035, rot: Math.random() * Math.PI, flat: 0.3 + Math.random() * 0.5, hue: Math.random() < 0.5 ? '200,210,255' : '255,220,190' };
});

export function drawGalaxies(ctx: Ctx, sim: Sim, w: number, h: number) {
  const c = sim.camera;
  for (const g of galaxies) {
    const zc = g.x * c.fx + g.y * c.fy + g.z * c.fz;
    if (zc <= 0.1) continue;
    const sx = c.cx + ((g.x * c.rx + g.y * c.ry + g.z * c.rz) * c.F) / zc;
    const sy = c.cy - ((g.x * c.ux + g.y * c.uy + g.z * c.uz) * c.F) / zc;
    const R = (g.size * c.F) / zc;
    if (sx < -R || sy < -R || sx > w + R || sy > h + R) continue;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(g.rot); ctx.scale(1, g.flat);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, `rgba(${g.hue},0.55)`); gr.addColorStop(0.2, `rgba(${g.hue},0.18)`); gr.addColorStop(1, `rgba(${g.hue},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${g.hue},0.12)`; ctx.lineWidth = Math.max(1, R * 0.12);
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let k = 0; k < 20; k++) {
        const a = arm * Math.PI + k * 0.28, rr = (k / 20) * R;
        k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(0, 0);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

const meteors: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
export function drawShootingStars(ctx: Ctx, w: number, h: number, dt: number) {
  if (Math.random() < 0.012) {
    const a = Math.PI * (0.15 + Math.random() * 0.7);
    meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.6, vx: Math.cos(a) * 900, vy: Math.sin(a) * 500, life: 0.7 });
  }
  ctx.lineCap = 'round';
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.life -= dt; m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.life <= 0) { meteors.splice(i, 1); continue; }
    const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.12, m.y - m.vy * 0.12);
    g.addColorStop(0, `rgba(255,255,255,${m.life})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.12, m.y - m.vy * 0.12); ctx.stroke();
  }
}

// ---------- Ecliptic grid ----------
export function drawEclipticGrid(ctx: Ctx, sim: Sim, sun: Body | undefined) {
  const cam = sim.camera, ox = sun?.x ?? 0, oy = sun?.y ?? 0, oz = sun?.z ?? 0;
  ctx.strokeStyle = 'rgba(140,160,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let R = 250; R <= 2500; R += 250) {
    let pen = false;
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      if (cam.project(ox + Math.cos(a) * R, oy, oz + Math.sin(a) * R) < 0) { pen = false; continue; }
      pen ? ctx.lineTo(cam.sx, cam.sy) : ctx.moveTo(cam.sx, cam.sy); pen = true;
    }
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    let pen = false;
    for (let R = 250; R <= 2500; R += 125) {
      if (cam.project(ox + Math.cos(a) * R, oy, oz + Math.sin(a) * R) < 0) { pen = false; continue; }
      pen ? ctx.lineTo(cam.sx, cam.sy) : ctx.moveTo(cam.sx, cam.sy); pen = true;
    }
  }
  ctx.stroke();
}

// ---------- Solar wind ----------
const wind = Array.from({ length: 320 }, () => newWind(Math.random() * 1400));
function newWind(d = 15) {
  const u = Math.random() * 2 - 1, t = Math.random() * TAU, s = Math.sqrt(1 - u * u);
  return { x: s * Math.cos(t), y: u * 0.4, z: s * Math.sin(t), d, v: 60 + Math.random() * 80 };
}
export function drawSolarWind(ctx: Ctx, sim: Sim, sun: Body | undefined, dt: number) {
  if (!sun) return;
  const cam = sim.camera;
  ctx.fillStyle = '#ffd890';
  for (let i = 0; i < wind.length; i++) {
    const p = wind[i];
    p.d += p.v * dt;
    if (p.d > 1400) { wind[i] = newWind(); continue; }
    const z = cam.project(sun.x + p.x * p.d, sun.y + p.y * p.d, sun.z + p.z * p.d);
    if (z < 0) continue;
    ctx.globalAlpha = 0.35 * (1 - p.d / 1400);
    ctx.fillRect(cam.sx, cam.sy, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
}

// ---------- Comet tails ----------
export function drawCometTails(ctx: Ctx, sim: Sim, sun: Body | undefined) {
  if (!sun) return;
  const cam = sim.camera;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of sim.world.bodies) {
    if (!b.name.startsWith('Comet')) continue;
    const dx = b.x - sun.x, dy = b.y - sun.y, dz = b.z - sun.z, d = Math.hypot(dx, dy, dz) || 1;
    const L = Math.min(220, Math.max(8, 30000 / d));
    if (cam.project(b.x, b.y, b.z) < 0) continue;
    const hx = cam.sx, hy = cam.sy;
    if (cam.project(b.x + (dx / d) * L, b.y + (dy / d) * L, b.z + (dz / d) * L) < 0) continue;
    const tx = cam.sx, ty = cam.sy;
    for (const [wd, col] of [[6, '120,200,255'], [2.5, '230,245,255']] as const) {
      const g = ctx.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    }
    const coma = ctx.createRadialGradient(hx, hy, 0, hx, hy, 9);
    coma.addColorStop(0, 'rgba(220,240,255,0.9)'); coma.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = coma; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Sun prominences ----------
export function drawProminences(ctx: Ctx, sx: number, sy: number, r: number, t: number) {
  if (r < 6) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.07 + t * 0.02, span = 0.25, hgt = r * (0.35 + 0.3 * Math.sin(t * 0.5 + i * 2));
    const a1 = a - span, a2 = a + span;
    ctx.strokeStyle = `rgba(255,${90 + i * 15},40,0.55)`;
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a1) * r, sy + Math.sin(a1) * r);
    ctx.quadraticCurveTo(sx + Math.cos(a) * (r + hgt * 2), sy + Math.sin(a) * (r + hgt * 2), sx + Math.cos(a2) * r, sy + Math.sin(a2) * r);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Black hole accretion disk ----------
export function drawAccretionDisk(ctx: Ctx, sx: number, sy: number, rr: number, t: number, front: boolean) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const R = rr * (1.6 + i * 0.35);
    ctx.strokeStyle = `rgba(255,${200 - i * 30},${120 - i * 20},${0.5 - i * 0.07})`;
    ctx.lineWidth = Math.max(1, rr * 0.22);
    ctx.setLineDash([rr * 0.8, rr * 0.4]);
    ctx.lineDashOffset = -t * 30 * (1 + i * 0.3);
    ctx.beginPath();
    ctx.ellipse(sx, sy, R, R * 0.28, -0.25, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (!front) {
    ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = Math.max(1, rr * 0.08);
    ctx.beginPath(); ctx.arc(sx, sy, rr * 1.15, 0, TAU); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Planet extras ----------
const AURORA: Record<string, string> = { Earth: '80,255,150', Jupiter: '190,120,255', Saturn: '120,180,255', Uranus: '120,255,230' };
const LIGHTNING = new Set(['Earth', 'Jupiter', 'Venus', 'Saturn']);

export function drawPlanetExtras(ctx: Ctx, b: Body, sx: number, sy: number, r: number, t: number, lx: number, ly: number) {
  if (r < 5) return;
  // twilight band along the day/night line
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.clip();
  const g = ctx.createLinearGradient(sx + lx * r, sy + ly * r, sx - lx * r, sy - ly * r);
  g.addColorStop(0.42, 'rgba(255,120,60,0)'); g.addColorStop(0.5, 'rgba(255,120,60,0.22)'); g.addColorStop(0.58, 'rgba(255,120,60,0)');
  ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  // lightning on the night side
  if (LIGHTNING.has(b.name) && Math.random() < 0.1) {
    const a = Math.random() * TAU, d = Math.random() * r * 0.8;
    const px = Math.cos(a) * d, py = Math.sin(a) * d;
    if ((px * lx + py * ly) / r < -0.1) {
      const f = ctx.createRadialGradient(sx + px, sy + py, 0, sx + px, sy + py, r * 0.15);
      f.addColorStop(0, 'rgba(230,240,255,0.9)'); f.addColorStop(1, 'rgba(180,200,255,0)');
      ctx.fillStyle = f; ctx.fillRect(sx + px - r * 0.15, sy + py - r * 0.15, r * 0.3, r * 0.3);
    }
  }
  ctx.restore();
  // auroras at the poles
  const col = AURORA[b.name];
  if (col) {
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.6 + 0.4 * Math.sin(t * 3 + b.id);
    for (const s of [-1, 1]) {
      const ay = sy + s * r * 0.92;
      const ag = ctx.createRadialGradient(sx, ay, 0, sx, ay, r * 0.5);
      ag.addColorStop(0, `rgba(${col},${0.45 * fl})`); ag.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.ellipse(sx, ay, r * 0.5, r * 0.22, 0, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Blinking satellites around Earth */
export function drawSatellites(ctx: Ctx, sim: Sim, b: Body, t: number) {
  if (b.name !== 'Earth') return;
  const cam = sim.camera, spin = lookSpin(b, t);
  for (let i = 0; i < 8; i++) {
    const a = t * (0.9 + i * 0.13) + i * 0.8 + spin * 0.1, inc = i * 0.4, R = b.radius * (1.35 + (i % 3) * 0.12);
    const z = cam.project(b.x + Math.cos(a) * R, b.y + Math.sin(a) * Math.sin(inc) * R, b.z + Math.sin(a) * Math.cos(inc) * R);
    if (z < 0) continue;
    ctx.fillStyle = Math.sin(t * 6 + i) > 0.7 ? '#ff5050' : '#e8f0ff';
    ctx.fillRect(cam.sx - 1, cam.sy - 1, 2, 2);
  }
}

// ---------- Screen effects ----------
export function drawLensFlare(ctx: Ctx, sim: Sim, sun: Body | undefined, w: number, h: number) {
  if (!sun) return;
  const cam = sim.camera;
  if (cam.project(sun.x, sun.y, sun.z) < 0 || cam.sx < 0 || cam.sy < 0 || cam.sx > w || cam.sy > h) return;
  const sx = cam.sx, sy = cam.sy, vx = cam.cx - sx, vy = cam.cy - sy;
  ctx.globalCompositeOperation = 'lighter';
  const flares: [number, number, string][] = [[0.5, 18, '255,200,120'], [0.8, 8, '120,200,255'], [1.2, 30, '255,140,200'], [1.5, 12, '160,255,180'], [1.9, 45, '255,210,150']];
  for (const [k, s, col] of flares) {
    const x = sx + vx * k, y = sy + vy * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, `rgba(${col},0.12)`); g.addColorStop(0.7, `rgba(${col},0.06)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function drawVignette(ctx: Ctx, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

export function drawImpactGlow(ctx: Ctx, x: number, y: number, R: number, alpha: number, color: string) {
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(255,240,200,${alpha})`); g.addColorStop(0.4, `rgba(255,150,60,${alpha * 0.5})`); g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  void color;
}