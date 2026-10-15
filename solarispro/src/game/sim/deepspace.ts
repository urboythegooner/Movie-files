import type { Sim } from './sim';

type Ctx = CanvasRenderingContext2D;

/** Deep space: thousands of far-off suns and whole spiral galaxies, placed in real 3D so they only
 *  come into view (and drift past) as you zoom way, way out. */

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FarStar { x: number; y: number; z: number; c: string; b: number; s: number }
interface Galaxy { cx: number; cy: number; cz: number; R: number; rgb: string; pts: Float32Array }

const rand = rng(20261009);
const STAR_COLORS = ['#ffffff', '#cfe0ff', '#ffe9b8', '#ffb38a', '#9db8ff'];
const GALAXY_COLORS = ['180,200,255', '255,210,160', '220,170,255', '160,255,230', '255,170,170'];

function dir() {
  const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return [s * Math.cos(th), u, s * Math.sin(th)];
}

const farStars: FarStar[] = Array.from({ length: 12000 }, () => {
  const d = 6000 * Math.pow(42000000, rand()); // 6,000 … 252 billion units out, matching the expanded deep-zoom range
  const [x, y, z] = dir();
  const roll = rand();
  return { x: x * d, y: y * d, z: z * d, c: STAR_COLORS[(rand() * STAR_COLORS.length) | 0], b: 0.35 + rand() * 0.65, s: roll < 0.06 ? 2.6 : roll < 0.4 ? 1.7 : 1.1 };
});

const galaxies: Galaxy[] = Array.from({ length: 28 }, (_, gi) => {
  // Distant galaxies span from the nearby galactic neighborhood to the visible-universe boundary.
  const d = 250000 + Math.pow(rand(), 1.7) * 180000000000;
  const [dx, dy, dz] = dir();
  const R = Math.max(40000, d * (0.00012 + rand() * 0.00016));
  const tilt = rand() * Math.PI, yaw = rand() * Math.PI * 2;
  const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const N = 900;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = Math.pow(rand(), 0.8);
    const ang = (i % 2) * Math.PI + t * 5.5 + (rand() - 0.5) * 0.6;
    const rad = R * t;
    let lx = rad * Math.cos(ang), ly = (rand() - 0.5) * R * 0.07 * (1 - t), lz = rad * Math.sin(ang);
    const y1 = ly * ct - lz * st, z1 = ly * st + lz * ct;
    const x2 = lx * cy + z1 * sy, z2 = -lx * sy + z1 * cy;
    lx = x2; ly = y1;
    pts[i * 3] = lx; pts[i * 3 + 1] = ly; pts[i * 3 + 2] = z2;
  }
  return { cx: dx * d, cy: dy * d, cz: dz * d, R, rgb: GALAXY_COLORS[gi % GALAXY_COLORS.length], pts };
});

interface VoidBeast { x: number; y: number; z: number; size: number; hue: number; seed: number; kind: number }

// Ancient, planet-scale silhouettes seeded into the deep void. They are deliberately rare:
// the player discovers them while leaving the familiar scale of a solar system behind.
const voidBeasts: VoidBeast[] = Array.from({ length: 11 }, (_, i) => {
  const d = 18000 * Math.pow(90000, rand());
  const [x, y, z] = dir();
  return { x: x * d, y: y * d, z: z * d, size: d * (0.018 + rand() * 0.035), hue: [170, 205, 285, 335, 25][i % 5], seed: rand() * 20, kind: i % 3 };
});

function drawVoidBeast(ctx: Ctx, cam: Sim['camera'], beast: VoidBeast, t: number) {
  const depth = cam.project(beast.x, beast.y, beast.z);
  if (depth <= 0) return;
  const x = cam.sx, y = cam.sy;
  const r = beast.size * cam.F / depth;
  if (r < 7 || r > 1800) return;
  const pulse = 0.9 + Math.sin(t * 0.00022 + beast.seed) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(beast.seed) * 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(0.92, 0.28 + r / 240);

  // Long tendrils reach into the black like torn shadows.
  const tendrils = beast.kind === 2 ? 10 : 7;
  for (let i = 0; i < tendrils; i++) {
    const a = (i / tendrils) * Math.PI * 2 + beast.seed;
    const len = r * (1.05 + ((i * 17 + beast.kind * 11) % 9) * 0.16) * pulse;
    const bend = Math.sin(t * 0.0003 + beast.seed + i * 1.7) * r * 0.24;
    const sx = Math.cos(a) * r * 0.42, sy = Math.sin(a) * r * 0.42;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + Math.cos(a + 0.7) * len * 0.45, sy + Math.sin(a + 0.7) * len * 0.45,
      Math.cos(a) * len + bend, Math.sin(a) * len - bend,
      Math.cos(a + 0.18) * len, Math.sin(a + 0.18) * len);
    ctx.strokeStyle = `rgba(${beast.hue > 250 ? '108,76,150' : '68,80,105'},${0.35 + (i % 3) * 0.1})`;
    ctx.lineWidth = Math.max(1, r * (0.055 - (i % 3) * 0.009));
    ctx.lineCap = 'round'; ctx.stroke();
    if (r > 28 && i % 2 === 0) {
      ctx.beginPath(); ctx.arc(Math.cos(a) * len, Math.sin(a) * len, Math.max(1, r * 0.025), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,65,90,0.7)'; ctx.fill();
    }
  }

  // Irregular, armored body with a cold rim-light.
  const body = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.08, 0, 0, r * 1.08);
  body.addColorStop(0, `rgba(${beast.hue > 250 ? '65,45,82' : '48,58,73'},0.98)`);
  body.addColorStop(0.58, 'rgba(10,12,23,0.99)');
  body.addColorStop(0.88, `rgba(${beast.hue > 250 ? '104,48,100' : '57,83,110'},0.92)`);
  body.addColorStop(1, 'rgba(1,2,8,0.02)');
  ctx.fillStyle = body;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const jag = 1 + 0.09 * Math.sin(a * 5 + beast.seed) + 0.055 * Math.cos(a * 9 + beast.seed * 2);
    const px = Math.cos(a) * r * jag, py = Math.sin(a) * r * jag * 0.78;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(${beast.hue > 250 ? '177,95,190' : '115,150,177'},0.48)`;
  ctx.lineWidth = Math.max(1, r * 0.035); ctx.stroke();

  // The mouth is a lightless eclipse ringed with tiny, uneven teeth.
  const mx = r * 0.12, my = r * 0.12, mw = r * (beast.kind === 1 ? 0.48 : 0.34), mh = r * (beast.kind === 1 ? 0.32 : 0.25);
  const mouth = ctx.createRadialGradient(mx, my, 1, mx, my, mw * 1.3);
  mouth.addColorStop(0, '#000'); mouth.addColorStop(0.68, '#020107'); mouth.addColorStop(0.84, 'rgba(120,13,35,0.95)'); mouth.addColorStop(1, 'rgba(255,45,75,0)');
  ctx.fillStyle = mouth; ctx.beginPath(); ctx.ellipse(mx, my, mw * 1.3, mh * 1.5, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(mx, my, mw, mh, -0.15, 0, Math.PI * 2); ctx.fill();
  if (r > 18) {
    const teeth = Math.min(18, Math.max(6, Math.floor(r / 5)));
    for (let i = 0; i < teeth; i++) {
      const a = Math.PI * (i / (teeth - 1));
      const tx = mx + Math.cos(a) * mw * 0.9, ty = my - Math.sin(a) * mh * 0.92;
      ctx.fillStyle = i % 3 === 0 ? '#e6d8d1' : '#a9a5b5';
      ctx.beginPath(); ctx.moveTo(tx - r * 0.018, ty); ctx.lineTo(tx + r * 0.018, ty); ctx.lineTo(tx, ty + mh * 0.24); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < (beast.kind === 2 ? 6 : 2); i++) {
      const ex = -r * 0.3 + i * r * 0.17, ey = -r * (0.2 + (i % 2) * 0.16);
      ctx.fillStyle = 'rgba(255,20,55,0.22)'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.075, r * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i % 2 ? '#ffb94d' : '#ff263e'; ctx.beginPath(); ctx.arc(ex, ey, Math.max(1, r * 0.035), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#05040a'; ctx.beginPath(); ctx.arc(ex + r * 0.012, ey, Math.max(0.6, r * 0.012), 0, Math.PI * 2); ctx.fill();
    }
  }
  // A warped gravitational halo makes the silhouette read as something impossibly massive.
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${beast.hue > 250 ? '142,62,174' : '68,124,165'},${0.12 + 0.06 * Math.sin(t * 0.00015 + beast.seed)})`;
  ctx.lineWidth = Math.max(1, r * 0.025); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.42, r * 0.4, -0.18, Math.PI * 0.08, Math.PI * 1.92); ctx.stroke();
  ctx.restore();
}

export function drawDeepSpace(ctx: Ctx, sim: Sim, w: number, h: number, simple: boolean) {
  const cam = sim.camera;
  const fade = Math.min(1, Math.max(0, (cam.dist - 1500) / 6000));
  if (fade <= 0.01) return;
  ctx.globalCompositeOperation = 'lighter';

  // Keep galaxy detail visible at the new deep-universe zoom levels.
  const gfade = Math.min(0.65, Math.max(0, (cam.dist - 15000) / 6000000) * 0.65);
  if (gfade > 0.01 && !simple) {
    for (const g of galaxies) {
      const z = cam.project(g.cx, g.cy, g.cz);
      if (z < 0) continue;
      const gx = cam.sx, gy = cam.sy;
      const rs = Math.min(3000, (g.R * cam.F) / z);
      if (gx < -rs || gy < -rs || gx > w + rs || gy > h + rs) continue;
      const glow = Math.max(3, rs);
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, glow);
      grad.addColorStop(0, `rgba(255,245,225,${0.9 * gfade})`);
      grad.addColorStop(0.15, `rgba(${g.rgb},${0.35 * gfade})`);
      grad.addColorStop(1, `rgba(${g.rgb},0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(gx, gy, glow, 0, Math.PI * 2); ctx.fill();
      if (rs > 8) {
        ctx.fillStyle = `rgb(${g.rgb})`;
        ctx.globalAlpha = 0.55 * gfade;
        const p = g.pts;
        for (let i = 0; i < p.length; i += 3) {
          if (cam.project(g.cx + p[i], g.cy + p[i + 1], g.cz + p[i + 2]) < 0) continue;
          ctx.fillRect(cam.sx - 1, cam.sy - 1, 2, 2);
        }
      }
    }
  }

  const count = simple ? 1800 : farStars.length;
  for (let i = 0; i < count; i++) {
    const s = farStars[i];
    if (cam.project(s.x, s.y, s.z) < 0) continue;
    const sx = cam.sx, sy = cam.sy;
    if (sx < 0 || sy < 0 || sx > w || sy > h) continue;
    ctx.fillStyle = s.c;
    ctx.globalAlpha = s.b * fade;
    ctx.fillRect(sx - s.s / 2, sy - s.s / 2, s.s, s.s);
    if (s.s > 2) {
      ctx.globalAlpha = s.b * fade * 0.2;
      ctx.fillRect(sx - s.s * 1.5, sy - s.s * 1.5, s.s * 3, s.s * 3);
    }
  }
  if (!simple && cam.dist > 5200) {
    for (const beast of voidBeasts) drawVoidBeast(ctx, cam, beast, performance.now());
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}