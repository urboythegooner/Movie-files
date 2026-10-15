import { Body } from './engine';
import { Sim } from './sim';
import { atmosphereFor, drawSurface } from './surface';
import { drawCityLights, drawFineBands, drawNebulae, drawRingsUltra } from './ultra';

import * as U2 from './ultra2';
import * as U3 from './ultra3';
import * as U4 from './ultra4';
import { drawFleet, drawHeat } from './fleetRender';
import { drawDeepSpace } from './deepspace';
import { drawPhotographicSurface } from './photographic';
import { canvasText } from './colors';
import { drawExoticObject, drawStellarSphere } from './cosmic';

type Ctx = CanvasRenderingContext2D;
let lastT = 0;

export function render(ctx: Ctx, sim: Sim, w: number, h: number, t: number) {
  const cam = sim.camera, world = sim.world;
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, w, h);
  const simple = sim.settings.simple, ultra = sim.settings.ultra;
  const fdt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  if (ultra) {
    drawUltraBackground(ctx, sim, w, h);
    U2.drawShootingStars(ctx, w, h, fdt);
  } else drawStars(ctx, sim, w, h, t, simple ? 350 : 1600);
  drawDeepSpace(ctx, sim, w, h, simple);
  const byId = new Map(world.bodies.map((b) => [b.id, b]));
  if (sim.settings.trails && !simple) drawTrails(ctx, sim);
  if (sim.settings.prediction) drawPrediction(ctx, sim, byId);

  const sun = world.bodies.find((b) => b.kind === 'sun');
  let lsx = cam.cx, lsy = cam.cy;
  if (sun && cam.project(sun.x, sun.y, sun.z) > 0) { lsx = cam.sx; lsy = cam.sy; }

  if (ultra) {
    // Keep space unobstructed; orbit paths supply the spatial reference.
    U3.drawZones(ctx, sim, sun);
    U3.drawMoonOrbits(ctx, sim);
    U4.drawLagrange(ctx, sim, t);
    U2.drawSolarWind(ctx, sim, sun, sim.settings.paused ? 0 : fdt * sim.settings.timeScale * (sim.settings.slow ? 0.15 : 1));
    U2.drawCometTails(ctx, sim, sun);
  }
  // Small bodies and impact ejecta are drawn in one fast pass for performance
  const F = cam.F;
  for (const b of world.bodies) {
    if (b.kind !== 'asteroid') continue;
    const z = cam.project(b.x, b.y, b.z);
    if (z < 0 || cam.sx < 0 || cam.sy < 0 || cam.sx > w || cam.sy > h) continue;
    const projected = (b.radius * 2 * F) / z;
    if (projected < 0.55) continue;
    const s = Math.max(0.8, projected);
    if (ultra && s > 3) { U3.drawRock(ctx, b, cam.sx, cam.sy, s, t); continue; }
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(cam.sx, cam.sy, s * 0.5, 0, Math.PI * 2); ctx.fill();
    if (s > 2.2) {
      const rockShade = ctx.createRadialGradient(cam.sx - s * 0.2, cam.sy - s * 0.22, 0.2, cam.sx, cam.sy, s * 0.58);
      rockShade.addColorStop(0, 'rgba(255,255,255,0.24)');
      rockShade.addColorStop(0.55, 'rgba(0,0,0,0)');
      rockShade.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = rockShade;
      ctx.beginPath(); ctx.arc(cam.sx, cam.sy, s * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (ultra) ctx.globalCompositeOperation = 'lighter';
  const streaks = ultra && world.debris.length < 2500;
  for (const d of world.debris) {
    const z = cam.project(d.x, d.y, d.z);
    if (z < 0 || cam.sx < 0 || cam.sy < 0 || cam.sx > w || cam.sy > h) continue;
    const s = Math.max(1.5, (d.size * F) / z);
    ctx.globalAlpha = Math.min(1, (d.life / d.max) * 1.6);
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(cam.sx, cam.sy, s * 0.5, 0, Math.PI * 2); ctx.fill();
    if (ultra && s > 2.4) {
      ctx.globalAlpha *= 0.16;
      ctx.beginPath(); ctx.arc(cam.sx, cam.sy, s * 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = Math.min(1, (d.life / d.max) * 1.6);
    }
    if (streaks && d.life > d.max * 0.5 && s > 1.2) {
      const x0 = cam.sx, y0 = cam.sy;
      if (cam.project(d.x - d.vx * 0.25, d.y - d.vy * 0.25, d.z - d.vz * 0.25) > 0) {
        ctx.strokeStyle = d.color; ctx.lineWidth = Math.max(1, s * 0.6); ctx.globalAlpha *= 0.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cam.sx, cam.sy); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const list: { z: number; b: Body; sx: number; sy: number }[] = [];
  for (const b of world.bodies) {
    if (b.kind === 'asteroid') continue;
    const z = cam.project(b.x, b.y, b.z);
    if (z < 0) continue;
    const r = (b.radius * F) / z * (b.kind === 'sun' ? 5 : 3) + 4;
    if (cam.sx < -r || cam.sy < -r || cam.sx > w + r || cam.sy > h + r) continue;
    list.push({ z, b, sx: cam.sx, sy: cam.sy });
  }
  list.sort((a, b) => b.z - a.z);
  for (const it of list) drawBody(ctx, sim, it.b, it.sx, it.sy, it.z, lsx, lsy, t);
  ctx.globalAlpha = 1;

  if ((sim.settings.graphicsQuality ?? 80) >= 25) drawSolarStorms(ctx, sim);
  if ((sim.settings.graphicsQuality ?? 80) >= 40) drawShockwaves(ctx, sim);

  for (const f of world.flashes) {
    const z = cam.project(f.x, f.y, f.z);
    if (z < 0) continue;
    const k = 1 - f.life / f.max;
    if (ultra) U2.drawImpactGlow(ctx, cam.sx, cam.sy, Math.max(10, ((f.r * cam.F) / z) * (2 + k * 6)), (1 - k) * 0.7, f.color);
    ctx.strokeStyle = f.color;
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cam.sx, cam.sy, Math.max(4, ((f.r * cam.F) / z) * (1 + k * 5)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (sim.settings.travel) drawFleet(ctx, sim, t);
  if (ultra) { U4.drawReticle(ctx, sim, t); U4.drawDust(ctx, sim, w, h); }
  if (ultra) { U3.drawMotes(ctx, sim, t); U2.drawLensFlare(ctx, sim, sun, w, h); U2.drawVignette(ctx, w, h); U3.drawVelocityArrow(ctx, sim); }
  drawOverlays(ctx, sim);
}

/** Supernova blast fronts: a glowing expanding shell plus a white-out flash at the start */
function drawSolarStorms(ctx: Ctx, sim: Sim) {
  const cam=sim.camera;
  for(const storm of sim.world.solarStorms){
    const headX=storm.x+storm.dx*storm.distance, headY=storm.y+storm.dy*storm.distance, headZ=storm.z+storm.dz*storm.distance;
    const z0=cam.project(storm.x,storm.y,storm.z); if(z0<=0) continue; const x0=cam.sx,y0=cam.sy;
    const z1=cam.project(headX,headY,headZ); if(z1<=0) continue; const x1=cam.sx,y1=cam.sy;
    const alpha=Math.min(0.82,0.2+storm.intensity*0.1)*(storm.life/storm.maxLife*0.4+0.6);
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    ctx.strokeStyle=storm.color;ctx.globalAlpha=alpha*0.22;ctx.lineWidth=Math.max(2,Math.min(34,storm.width*cam.F/z1*2.4));ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    ctx.globalAlpha=alpha;ctx.lineWidth=Math.max(1,Math.min(8,storm.width*cam.F/z1*0.55));ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    ctx.fillStyle=storm.color;ctx.globalAlpha=alpha*0.9;ctx.beginPath();ctx.arc(x1,y1,Math.max(2,Math.min(12,storm.width*cam.F/z1*0.35)),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

function drawShockwaves(ctx: Ctx, sim: Sim) {
  const cam = sim.camera;
  for (const sw of sim.world.shockwaves) {
    const z = cam.project(sw.x, sw.y, sw.z);
    if (z < 0) continue;
    const sx = cam.sx, sy = cam.sy;
    const k = Math.min(1, sw.r / sw.maxR);
    const a = Math.max(0, 1 - k);
    const rs = Math.min(60000, (sw.r * cam.F) / z);
    ctx.globalCompositeOperation = 'lighter';
    if (rs > 2 && rs < 8000) {
      const g = ctx.createRadialGradient(sx, sy, rs * 0.72, sx, sy, rs);
      g.addColorStop(0, 'rgba(255,140,40,0)');
      g.addColorStop(0.9, `rgba(255,150,50,${0.14 * a})`);
      g.addColorStop(1, `rgba(255,205,130,${0.34 * a})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, rs, 0, Math.PI * 2); ctx.fill();
    }
    const lw = Math.min(36, Math.max(1.5, (sw.r * 0.025 * cam.F) / z));
    // Main plasma shell: subtly rippled rather than a perfectly sterile circle.
    if (rs > 4 && rs < 8000) {
      const segments = 320;
      const phase = sw.r * 0.012;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const wave = 1 + Math.sin(angle * 9 + phase) * 0.009 + Math.sin(angle * 17 - phase * 0.7) * 0.004;
        const radius = Math.max(2, rs * wave);
        const px = sx + Math.cos(angle) * radius;
        const py = sy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, rs), 0, Math.PI * 2);
    }
    ctx.strokeStyle = `rgba(255,145,65,${0.72 * a})`;
    ctx.lineWidth = lw;
    ctx.stroke();

    if (rs > 4 && rs < 8000) {
      // A stack of concentric pressure ripples trails the leading blast front.
      // Each band has its own glow and a slightly different phase, like a shockwave moving through gas.
      for (let ripple = 1; ripple <= 9; ripple++) {
        const gap = Math.max(3, rs * 0.024);
        const rippleR = rs - gap * ripple;
        if (rippleR <= 2) continue;
        const fade = a * (1 - ripple / 6);
        ctx.beginPath();
        ctx.arc(sx, sy, rippleR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,${Math.max(105, 220 - ripple * 18)},${Math.max(65, 160 - ripple * 18)},${0.28 * fade})`;
        ctx.lineWidth = Math.max(1, lw * (0.22 - ripple * 0.025));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, rippleR - Math.max(1, lw * 0.55), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,238,200,${0.12 * fade})`;
        ctx.lineWidth = Math.max(0.7, lw * 0.07);
        ctx.stroke();
      }
      // Hot inner filament and a broader, dimmer wake sell the rolling plasma edge.
      ctx.strokeStyle = `rgba(255,245,210,${0.48 * a})`;
      ctx.lineWidth = Math.max(1, lw * 0.2);
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, rs - lw * 0.3), 0, Math.PI * 2); ctx.stroke();
      const trailR = rs * 0.91;
      ctx.strokeStyle = `rgba(255,95,35,${0.13 * a})`;
      ctx.lineWidth = Math.max(1, lw * 1.5);
      ctx.beginPath(); ctx.arc(sx, sy, trailR, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// The far background (nebulae, galaxies, stars, constellations, Oort cloud) only depends on
// where the camera points, so it's painted to an offscreen canvas and reused until the view turns.
let bg: HTMLCanvasElement | null = null;
let bgKey = '';
function drawUltraBackground(ctx: Ctx, sim: Sim, w: number, h: number) {
  const c = sim.camera;
  const key = [c.fx, c.fy, c.fz, c.F].map((v) => v.toFixed(3)).join(',') + w + 'x' + h;
  if (!bg) bg = document.createElement('canvas');
  if (key !== bgKey) {
    bgKey = key;
    if (bg.width !== w || bg.height !== h) { bg.width = w; bg.height = h; }
    const b = bg.getContext('2d');
    if (!b) return;
    b.clearRect(0, 0, w, h);
    b.globalAlpha = 0.35;
    drawNebulae(b, sim, w, h);
    b.globalAlpha = 1;
    U2.drawGalaxies(b, sim, w, h);
    drawStars(b, sim, w, h, 0, sim.stars.length);
    U3.drawStarDetails(b, sim, w, h);
    U3.drawOort(b, sim);
  }
  ctx.drawImage(bg, 0, 0, w, h);
}

function drawStars(ctx: Ctx, sim: Sim, w: number, h: number, t: number, count: number) {
  const c = sim.camera;
  for (let i = 0; i < count; i++) {
    const s = sim.stars[i];
    const zc = s.x * c.fx + s.y * c.fy + s.z * c.fz;
    if (zc <= 0.05) continue;
    const sx = c.cx + ((s.x * c.rx + s.y * c.ry + s.z * c.rz) * c.F) / zc;
    const sy = c.cy - ((s.x * c.ux + s.y * c.uy + s.z * c.uz) * c.F) / zc;
    if (sx < 0 || sy < 0 || sx > w || sy > h) continue;
    ctx.globalAlpha = s.b * (0.7 + 0.3 * Math.sin(t * s.tw + s.ph));
    ctx.fillStyle = s.c;
    ctx.fillRect(sx, sy, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}

function strokePath(ctx: Ctx, sim: Sim, pts: ArrayLike<number>, maxAlpha: number, fadeIn: boolean, tail?: [number, number, number]) {
  const cam = sim.camera;
  const n = Math.floor(pts.length / 3) + (tail ? 1 : 0);
  if (n < 2) return;
  const coord = (i: number, axis: number) => i === n - 1 && tail ? tail[axis] : pts[i * 3 + axis];
  const chunks = 8, size = Math.ceil(n / chunks);
  for (let c = 0; c < chunks; c++) {
    const k = fadeIn ? (c + 1) / chunks : 1 - c / chunks;
    ctx.globalAlpha = maxAlpha * k;
    ctx.beginPath();
    let pen = false;
    for (let i = c * size; i <= Math.min(n - 1, (c + 1) * size); i++) {
      if (cam.project(coord(i, 0), coord(i, 1), coord(i, 2)) < 0) { pen = false; continue; }
      if (pen) ctx.lineTo(cam.sx, cam.sy); else ctx.moveTo(cam.sx, cam.sy);
      pen = true;
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTrails(ctx: Ctx, sim: Sim) {
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  for (const b of sim.world.bodies) {
    if (b.trail.length < 6) continue;
    const color = b.kind === 'blackhole' ? '#c58bff' : b.color;
    // A soft luminous under-stroke makes orbital paths read like premium sci-fi HUD trails.
    if (sim.settings.ultra) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 4;
      strokePath(ctx, sim, b.trail, 0.16, true, [b.x, b.y, b.z]);
      ctx.restore();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = sim.settings.ultra ? 1.15 : 1;
    strokePath(ctx, sim, b.trail, sim.settings.ultra ? 0.62 : 0.4, true, [b.x, b.y, b.z]);
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawPrediction(ctx: Ctx, sim: Sim, byId: Map<number, Body>) {
  const cam = sim.camera;
  for (const [id, pts] of sim.prediction) {
    const b = byId.get(id);
    if (!b || b.kind === 'sun') continue;
    const sel = id === sim.selectedId;
    ctx.strokeStyle = b.kind === 'blackhole' ? '#c58bff' : b.color;
    ctx.lineWidth = sel ? 2 : 1.2;
    ctx.setLineDash([4, 5]);
    strokePath(ctx, sim, pts, sel ? 1 : 0.75, false);
    const n = pts.length / 3;
    if (n > 1 && cam.project(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1], pts[(n - 1) * 3 + 2]) > 0) {
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cam.sx, cam.sy, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.setLineDash([]);
}

function drawRing(ctx: Ctx, sim: Sim, b: Body, zCenter: number, back: boolean) {
  const cam = sim.camera;
  const tilt = 0.47, R = b.radius * 1.9, N = 48;
  const pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const z = cam.project(b.x + Math.cos(a) * R, b.y + Math.sin(a) * Math.sin(tilt) * R, b.z + Math.sin(a) * Math.cos(tilt) * R);
    pts.push(cam.sx, cam.sy, z);
  }
  ctx.strokeStyle = 'rgba(222,200,150,0.6)';
  ctx.lineWidth = Math.max(1, ((b.radius * 0.6) * cam.F) / zCenter);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const z1 = pts[i * 3 + 2], z2 = pts[i * 3 + 5];
    if (z1 < 0 || z2 < 0) continue;
    if ((z1 + z2) / 2 > zCenter !== back) continue;
    ctx.moveTo(pts[i * 3], pts[i * 3 + 1]);
    ctx.lineTo(pts[i * 3 + 3], pts[i * 3 + 4]);
  }
  ctx.stroke();
}

function drawBody(ctx: Ctx, sim: Sim, b: Body, sx: number, sy: number, z: number, lsx: number, lsy: number, t: number) {
  const r = (b.radius * sim.camera.F) / z;
  if (b.kind === 'asteroid') {
    const s = Math.max(1.3, r * 2);
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(sx, sy, s / 2, 0, Math.PI * 2); ctx.fill();
    if (s > 2.2) {
      const rockShade = ctx.createRadialGradient(sx - s * 0.18, sy - s * 0.2, 0.2, sx, sy, s * 0.58);
      rockShade.addColorStop(0, 'rgba(255,255,255,0.2)'); rockShade.addColorStop(0.55, 'rgba(0,0,0,0)'); rockShade.addColorStop(1, 'rgba(0,0,0,0.48)');
      ctx.fillStyle = rockShade; ctx.beginPath(); ctx.arc(sx, sy, s / 2, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  const simple = sim.settings.simple;
  if (simple) {
    ctx.fillStyle = b.kind === 'blackhole' ? '#000' : b.color;
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(r, 1.5), 0, Math.PI * 2); ctx.fill();
    if (b.kind === 'blackhole') { ctx.strokeStyle = '#ff9a4a'; ctx.lineWidth = 1.5; ctx.stroke(); }
    return;
  }
  const ultra = sim.settings.ultra;
  if (b.kind === 'sun') {
    const pulse = 0.98 + Math.sin(t * 1.7 + b.id) * 0.02;
    const starName = (b.name || '').toLowerCase();
    const isRedStar = /red dwarf|red giant|red supergiant/.test(starName) || (b.color || '').toLowerCase() === '#ff6a3d';
    const isBlueStar = /blue giant|blue supergiant|white dwarf|neutron star/.test(starName) || ['#8fc4ff','#bfe4ff','#eef6ff'].includes((b.color || '').toLowerCase());
    const glowCore = isBlueStar ? [190,225,255] : isRedStar ? [255,95,48] : [255,205,105];
    // At extreme zoom-out, reduce both halo radius and energy so many stars don't wash out the scene.
    const far = r < 2.5;
    const glowR = Math.max(2, Math.min(far ? 12 : 220, r * (ultra ? 5.2 : 4.2)) * pulse);
    const glowAlpha = far ? 0.12 : Math.min(0.42, 0.12 + r * 0.008);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, Math.max(0.2, r * 0.35), sx, sy, Math.max(r + 0.5, glowR));
    g.addColorStop(0, `rgba(${glowCore[0]},${glowCore[1]},${glowCore[2]},${Math.min(0.62, glowAlpha + 0.15)})`);
    g.addColorStop(0.24, `rgba(${glowCore[0]},${glowCore[1]},${glowCore[2]},${glowAlpha})`);
    g.addColorStop(0.68, `rgba(${glowCore[0]},${Math.floor(glowCore[1]*0.72)},${Math.floor(glowCore[2]*0.55)},${glowAlpha*0.32})`);
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    drawStellarSphere(ctx, sim, b, sx, sy, Math.max(r, 2));
    // At extreme close range, intense bloom and soft blur wash out the solar disc.
    // Keep the effect localized to the sun so the rest of the scene stays sharp.
    // Persistent solar glare: even a distant sun lights up its surrounding space.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glareRadius = Math.max(1.5, Math.min(r < 2.5 ? 7 : 180, r * 1.9));
    const glareAlpha = r < 2.5 ? 0.035 : Math.min(0.14, 0.04 + r * 0.001);
    const glareColor = isBlueStar ? [190,225,255] : isRedStar ? [255,100,55] : [255,220,155];
    const wash = ctx.createRadialGradient(sx, sy, Math.max(0.2, r * 0.12), sx, sy, glareRadius);
    wash.addColorStop(0, `rgba(${glareColor[0]},${glareColor[1]},${glareColor[2]},${glareAlpha})`);
    wash.addColorStop(0.32, `rgba(${glareColor[0]},${glareColor[1]},${glareColor[2]},${glareAlpha*0.52})`);
    wash.addColorStop(0.72, `rgba(${glareColor[0]},${Math.floor(glareColor[1]*0.72)},${Math.floor(glareColor[2]*0.5)},${glareAlpha*0.14})`);
    wash.addColorStop(1, 'rgba(255,125,45,0)');
    ctx.fillStyle = wash;
    ctx.beginPath(); ctx.arc(sx, sy, glareRadius, 0, Math.PI * 2); ctx.fill();
    if (r > 24) {
      ctx.globalAlpha = Math.min(0.035, r / 9000);
      ctx.fillStyle = isBlueStar ? '#e5f5ff' : isRedStar ? '#ffb078' : '#fff8df';
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(r * 0.72, 1.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (b.kind === 'wormhole' || b.kind === 'blackhole') {
    drawExoticObject(ctx, sim, b, sx, sy, r, z);
    return;
  }
  if (r < 1.6) {
    const s = Math.max(2, r * 2);
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(sx, sy, s / 2, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const ultraRing = ultra && (b.ring || b.name === 'Uranus' || b.name === 'Jupiter');
  if (ultraRing) drawRingsUltra(ctx, sim, b, z, true);
  else if (b.ring) drawRing(ctx, sim, b, z, true);
  const lx = lsx - sx, ly = lsy - sy, l = Math.hypot(lx, ly) || 1;
  const atmo = atmosphereFor(b);
  if (atmo && r > 3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22;
    const a = ctx.createRadialGradient(sx, sy, r * 0.98, sx, sy, r * 1.12);
    a.addColorStop(0, 'rgba(0,0,0,0)');
    a.addColorStop(0.68, atmo);
    a.addColorStop(0.86, atmo);
    a.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = a;
    ctx.beginPath(); ctx.arc(sx, sy, r * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  if (r > 5) {
    drawPhotographicSurface(ctx, b, sim, sx, sy, r, t);
  } else {
  if (r > 5 && (b.kind === 'planet' || (ultra && b.kind === 'moon'))) {
    const cam = sim.camera;
    const viewLon = Math.atan2(cam.pz - b.z, cam.px - b.x);
    const viewLat = Math.atan2(cam.py - b.y, Math.hypot(cam.px - b.x, cam.pz - b.z));
    drawSurface(ctx, b, sx, sy, r, t, viewLon, viewLat, sim.settings.graphicsQuality ?? 80);
  }
  if (ultra && r > 8 && b.kind === 'planet') drawFineBands(ctx, b, sx, sy, r, t);
  // Sphere lighting pass: keep the sunward hemisphere rich and readable, with a
  // narrow terminator, low ambient night-side fill, and a subtle reflected-light rim.
  const sunX = lx / l, sunY = ly / l;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
  const terminator = ctx.createLinearGradient(sx + sunX * r, sy + sunY * r, sx - sunX * r, sy - sunY * r);
  terminator.addColorStop(0, 'rgba(255,244,211,0.24)');
  terminator.addColorStop(0.24, 'rgba(255,238,205,0.11)');
  terminator.addColorStop(0.43, 'rgba(255,255,255,0)');
  terminator.addColorStop(0.49, 'rgba(1,3,13,0.15)');
  terminator.addColorStop(0.56, 'rgba(1,3,13,0.48)');
  terminator.addColorStop(0.72, 'rgba(0,2,10,0.70)');
  terminator.addColorStop(1, 'rgba(0,1,7,0.82)');
  ctx.fillStyle = terminator; ctx.fillRect(sx-r, sy-r, r*2, r*2);
  // Broad spherical falloff adds curvature even on bodies with a fairly uniform texture.
  const curvature = ctx.createRadialGradient(
    sx - sunX * r * 0.42 - sunY * r * 0.12,
    sy - sunY * r * 0.42 + sunX * r * 0.12,
    r * 0.04, sx, sy, r * 1.12
  );
  curvature.addColorStop(0, 'rgba(255,248,230,0.15)');
  curvature.addColorStop(0.48, 'rgba(255,245,225,0.025)');
  curvature.addColorStop(0.76, 'rgba(0,0,0,0.10)');
  curvature.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = curvature; ctx.fillRect(sx-r, sy-r, r*2, r*2);
  ctx.restore();
  // A small warm bounce-light patch gives the lit limb a more photographic finish.
  if (r > 7) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const hx = sx + sunX * r * 0.42 - sunY * r * 0.14;
    const hy = sy + sunY * r * 0.42 + sunX * r * 0.14;
    const spec = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.58);
    spec.addColorStop(0, 'rgba(255,255,245,0.25)');
    spec.addColorStop(0.24, 'rgba(255,225,175,0.10)');
    spec.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  }
  // Atmosphere is a thin illuminated shell, strongest on the star-facing limb.
  if (atmo && r > 4) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.38;
    const rim = ctx.createRadialGradient(sx, sy, r * 0.985, sx, sy, r * 1.035);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(0.56, atmo);
    rim.addColorStop(0.78, 'rgba(160,210,255,0.16)');
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(sx, sy, r * 1.035, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawHeat(ctx, b.temperature, sx, sy, r, t);
  if (ultra) {
    drawCityLights(ctx, b, sx, sy, r, t, lx / l, ly / l);
    // The photographic sphere replaces flat surface decorations.

    if (b.kind === 'planet') U2.drawSatellites(ctx, sim, b, t);
  }
  if (ultraRing) drawRingsUltra(ctx, sim, b, z, false);
  else if (b.ring) drawRing(ctx, sim, b, z, false);
  if (b.habitable && r > 3) {
    ctx.strokeStyle = 'rgba(110,240,160,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawOverlays(ctx: Ctx, sim: Sim) {
  const cam = sim.camera;
  ctx.save();
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  const bodies = [...sim.world.bodies].sort((a, b) => Number(b.id === sim.selectedId) - Number(a.id === sim.selectedId));
  for (const b of bodies) {
    const sel = b.id === sim.selectedId, hov = b.id === sim.hoverId;
    const showLabel = sim.settings.labels && (b.kind !== 'asteroid' || (b.name !== 'Asteroid' && b.name !== 'Kuiper Object')) && (b.kind !== 'moon' || (b.radius * cam.F) / Math.max(1, cam.project(b.x, b.y, b.z)) > 1.5);
    if (!sel && !hov && !showLabel) continue;
    const z = cam.project(b.x, b.y, b.z);
    if (z < 0) continue;
    const r = Math.max((b.radius * cam.F) / z, 2);
    if (sel) {
      const s = r + 7, k = Math.max(4, s * 0.4);
      ctx.strokeStyle = '#ffc04d'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = cam.sx + dx * s, y = cam.sy + dy * s;
        ctx.moveTo(x, y - dy * k); ctx.lineTo(x, y); ctx.lineTo(x - dx * k, y);
      }
      ctx.stroke();
    } else if (hov) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cam.sx, cam.sy, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (showLabel || sel) {
      const width = Math.max(ctx.measureText(b.name.toUpperCase()).width, 42) + 8;
      const box = { x: cam.sx - width / 2, y: cam.sy - r - 28, w: width, h: 26 };
      if (!sel && !hov && occupied.some(o => box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y)) continue;
      occupied.push(box);
      canvasText(ctx);
      ctx.shadowColor = getComputedStyle(document.documentElement).getPropertyValue('--shadow').trim();
      ctx.shadowBlur = 4;
      ctx.fillText(b.name.toUpperCase(), cam.sx, cam.sy - r - (sel ? 12 : 6));
      if ((b.kind === 'planet' || (b.kind === 'moon' && sel)) && !sim.settings.simple) {
        const T = Math.round(b.temperature);
        canvasText(ctx);
        ctx.fillText(`${T}°C`, cam.sx, cam.sy - r - (sel ? 22 : 16));
      }
    }
  }
  ctx.restore();
}