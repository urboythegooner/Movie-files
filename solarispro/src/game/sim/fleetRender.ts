import { Sim } from './sim';
import { Ship, ShipClass, SHIPS, fmtPeople } from './fleet';
import { canvasText } from './colors';

type Ctx = CanvasRenderingContext2D;

/** Everything fleet-related, drawn on top of the bodies (ultra mode only). */
export function drawFleet(ctx: Ctx, sim: Sim, t: number) {
  const fl = sim.fleet;
  if (!fl.ready) return;
  drawTerritories(ctx, sim, t);
  drawShipTrails(ctx, sim);
  for (const s of fl.ships) drawShip(ctx, sim, s, t);
  drawBolts(ctx, sim);
}

function drawTerritories(ctx: Ctx, sim: Sim, t: number) {
  const cam = sim.camera, fl = sim.fleet;
  ctx.save();
  for (const c of fl.colonies.values()) {
    const b = sim.world.byId(c.planetId), f = fl.faction(c.faction);
    if (!b || !f) continue;
    const z = cam.project(b.x, b.y, b.z);
    if (z < 0) continue;
    const r = Math.max(2, (b.radius * cam.F) / z), sx = cam.sx, sy = cam.sy;
    const war = fl.inAnyWar(f.id);
    // rotating territory ring
    ctx.strokeStyle = f.color; ctx.globalAlpha = 0.65; ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 12;
    ctx.beginPath(); ctx.arc(sx, sy, r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // planetary shield
    if (war && c.defense > 0) {
      const k = c.defense / c.maxDef;
      ctx.globalAlpha = 0.08 + 0.22 * k + (c.siege > 0 ? Math.random() * 0.2 : 0);
      ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r * 1.25 + 7, 0, Math.PI * 2); ctx.stroke();
    }
    if (c.siege > 0) {
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 10);
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, r + 10, 0, Math.PI * 2); ctx.stroke();
    }
    // flag + label
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = f.color;
    ctx.fillRect(sx + r + 6, sy - r - 10, 1, 9);
    ctx.fillRect(sx + r + 7, sy - r - 10, 6, 4);
    if (sim.settings.labels && z < 4000) {
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const cap = f.capital === b.id ? '★ ' : '';
      canvasText(ctx);
      ctx.fillText(`${cap}${f.name}`, sx, sy + r + 22);
      canvasText(ctx);
      ctx.fillText(`${fmtPeople(fl.popOf(b))}${war ? ` · 🛡${Math.round((c.defense / c.maxDef) * 100)}%` : ''}`, sx, sy + r + 32);
    }
  }
  ctx.restore();
}

function drawShipTrails(ctx: Ctx, sim: Sim) {
  const cam = sim.camera, fl = sim.fleet;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of fl.ships) {
    const tr = s.trail, n = tr.length / 3;
    if (n < 2) continue;
    ctx.strokeStyle = fl.faction(s.faction)?.color ?? '#fff';
    ctx.lineWidth = SHIPS[s.cls].size > 2 ? 2 : 1;
    let px = 0, py = 0, ok = false;
    for (let i = 0; i < n; i++) {
      if (cam.project(tr[i * 3], tr[i * 3 + 1], tr[i * 3 + 2]) < 0) { ok = false; continue; }
      if (ok) { ctx.globalAlpha = (i / n) * 0.45; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cam.sx, cam.sy); ctx.stroke(); }
      px = cam.sx; py = cam.sy; ok = true;
    }
  }
  ctx.restore();
}

function drawShip(ctx: Ctx, sim: Sim, s: Ship, t: number) {
  const cam = sim.camera, sp = SHIPS[s.cls];
  const z = cam.project(s.x + s.vx * 0.05, s.y + s.vy * 0.05, s.z + s.vz * 0.05);
  const ax = cam.sx, ay = cam.sy;
  if (cam.project(s.x, s.y, s.z) < 0 || z < 0) return;
  const sx = cam.sx, sy = cam.sy;
  if (Math.hypot(ax - sx, ay - sy) > 0.3) s.ang = Math.atan2(ay - sy, ax - sx);
  const px = Math.min(46, Math.max(3, (sp.size * cam.F) / z * 1.4));
  const u = px / 4, color = sim.fleet.faction(s.faction)?.color ?? '#fff';
  ctx.save();
  ctx.translate(sx, sy);
  // engine glow
  ctx.globalCompositeOperation = 'lighter';
  const flick = 0.7 + Math.random() * 0.3;
  const back = -2.2 * u * Math.cos(s.ang), backY = -2.2 * u * Math.sin(s.ang);
  const g = ctx.createRadialGradient(back, backY, 0, back, backY, u * 2.5 * flick);
  g.addColorStop(0, 'rgba(160,220,255,0.9)'); g.addColorStop(0.4, hexA(color, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(back, backY, u * 2.5 * flick, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(s.ang);
  // flame
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath(); ctx.moveTo(-2 * u, -0.35 * u); ctx.lineTo((-2.4 - 1.6 * flick) * u, 0); ctx.lineTo(-2 * u, 0.35 * u); ctx.fill();
  drawHull(ctx, s.cls, u, color, t + s.id);
  ctx.rotate(-s.ang);
  if (s.hit > 0 && s.shield > 0) {
    ctx.strokeStyle = `rgba(140,210,255,${s.hit * 3})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, px * 0.9 + 3, 0, Math.PI * 2); ctx.stroke();
  }
  if ((s.hp < sp.hp || s.shield < sp.shield) && px > 6) {
    const w = Math.max(14, px * 1.2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-w / 2, -px - 8, w, 4);
    ctx.fillStyle = '#5dff7a'; ctx.fillRect(-w / 2, -px - 8, (w * Math.max(0, s.hp)) / sp.hp, 2);
    if (sp.shield) { ctx.fillStyle = '#7cc8ff'; ctx.fillRect(-w / 2, -px - 6, (w * s.shield) / sp.shield, 2); }
  }
  if (px > 12 && sim.settings.labels) {
    ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    canvasText(ctx); ctx.fillText(s.name, 0, px + 12);
  }
  ctx.restore();
}

function drawHull(ctx: Ctx, cls: ShipClass, u: number, color: string, t: number) {
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * u, y * u, w * u, h * u); };
  const poly = (pts: number[], c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0] * u, pts[1] * u); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * u, pts[i + 1] * u); ctx.closePath(); ctx.fill(); };
  const light = (x: number, y: number, c: string, rate = 3) => { if (Math.sin(t * rate) > 0) rect(x - 0.12, y - 0.12, 0.24, 0.24, c); };
  switch (cls) {
    case 'shuttle':
      poly([2, 0, -1.6, -1.1, -1, 0, -1.6, 1.1], '#e8eef8');
      poly([2, 0, 0.4, -0.35, 0.4, 0.35], '#3a4a66');
      rect(-0.6, -0.15, 1, 0.3, color);
      light(-1.5, -1.05, '#ff4d4d'); light(-1.5, 1.05, '#4dff7a');
      break;
    case 'fighter':
      poly([2.4, 0, -1.8, -1.6, -0.8, 0, -1.8, 1.6], color);
      poly([2.4, 0, -0.6, -0.5, -0.6, 0.5], '#1c2233');
      rect(0.6, -0.15, 0.8, 0.3, '#9fe6ff');
      rect(-1.9, -1.2, 0.9, 0.35, '#c9d2e4'); rect(-1.9, 0.85, 0.9, 0.35, '#c9d2e4');
      break;
    case 'freighter':
      rect(-2, -0.9, 3.2, 1.8, '#7b8496');
      for (let i = 0; i < 4; i++) rect(-1.9 + i * 0.78, -0.8, 0.7, 0.75, i % 2 ? color : '#c8903c'), rect(-1.9 + i * 0.78, 0.05, 0.7, 0.75, i % 2 ? '#5d8f6e' : color);
      poly([1.2, -0.7, 2.1, -0.4, 2.1, 0.4, 1.2, 0.7], '#d7dde8');
      rect(1.6, -0.15, 0.35, 0.3, '#9fe6ff');
      light(2, 0, '#ffffff', 2);
      break;
    case 'colony': {
      rect(-2.2, -0.3, 4.4, 0.6, '#c7ccd6');
      poly([2.2, -0.45, 2.9, 0, 2.2, 0.45], color);
      const spin = t * 1.5;
      ctx.strokeStyle = '#d9e2f2'; ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.beginPath(); ctx.ellipse(0, 0, 0.6 * u, 1.9 * u, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = spin + (i * Math.PI) / 3; rect(Math.cos(a) * 0.6 - 0.12, Math.sin(a) * 1.9 - 0.12, 0.24, 0.24, Math.cos(a) > 0 ? '#9dff9a' : '#4f8f5a'); }
      rect(-2.3, -0.8, 0.5, 1.6, '#8a93a6');
      break;
    }
    case 'cruiser':
      poly([2.8, 0, 0.8, -1.1, -2, -1.2, -2.2, 0, -2, 1.2, 0.8, 1.1], '#8d97ab');
      poly([2.8, 0, 0.8, -0.3, 0.8, 0.3], '#d3d9e4');
      rect(-1.8, -0.15, 3.2, 0.3, color);
      rect(-1, -0.55, 0.9, 1.1, '#5d677b');
      rect(-0.75, -0.25, 0.4, 0.5, '#9fe6ff');
      for (const [x, y] of [[0.6, -0.75], [0.6, 0.75], [-1.4, -0.85], [-1.4, 0.85]]) rect(x - 0.18, y - 0.18, 0.36, 0.36, '#2b3140');
      light(2.6, 0, '#ff4d4d', 4);
      break;
    case 'dreadnought':
      poly([3, 0, 1.6, -1.4, -2.2, -1.8, -2.6, -0.8, -2.6, 0.8, -2.2, 1.8, 1.6, 1.4], '#6c7488');
      poly([3, 0, 1.6, -0.8, -1.8, -1, -1.8, 1, 1.6, 0.8], '#8e98ad');
      rect(-2.2, -0.2, 4.6, 0.4, color);
      rect(-2.4, -1.5, 3.6, 0.15, color); rect(-2.4, 1.35, 3.6, 0.15, color);
      rect(-1.5, -0.7, 1.2, 1.4, '#4a5164'); rect(-1.2, -0.3, 0.6, 0.6, '#9fe6ff');
      for (let i = 0; i < 4; i++) { rect(1.2 - i * 0.9 - 0.2, -1.1, 0.4, 0.4, '#262b38'); rect(1.2 - i * 0.9 - 0.2, 0.7, 0.4, 0.4, '#262b38'); }
      light(2.8, 0, '#ff4d4d', 2); light(-2.4, -1.6, '#ffd34d', 5); light(-2.4, 1.6, '#ffd34d', 5);
      break;
  }
}

function drawBolts(ctx: Ctx, sim: Sim) {
  const cam = sim.camera;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of sim.fleet.bolts) {
    if (b.missile) {
      const tr = b.trail;
      ctx.strokeStyle = 'rgba(200,190,180,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < tr.length; i += 3) {
        if (cam.project(tr[i], tr[i + 1], tr[i + 2]) < 0) { pen = false; continue; }
        pen ? ctx.lineTo(cam.sx, cam.sy) : ctx.moveTo(cam.sx, cam.sy); pen = true;
      }
      ctx.stroke();
      if (cam.project(b.x, b.y, b.z) < 0) continue;
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(cam.sx, cam.sy, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cam.sx - 0.75, cam.sy - 0.75, 1.5, 1.5);
      continue;
    }
    if (cam.project(b.x, b.y, b.z) < 0) continue;
    const hx = cam.sx, hy = cam.sy;
    if (cam.project(b.x - b.vx * 0.03, b.y - b.vy * 0.03, b.z - b.vz * 0.03) < 0) continue;
    ctx.strokeStyle = hexA(b.color, 0.35); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cam.sx, cam.sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cam.sx, cam.sy); ctx.lineTo(hx, hy); ctx.stroke();
  }
  ctx.restore();
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/** Visible heat: hot worlds glow red/orange, cold worlds frost over in blue. */
export function drawHeat(ctx: Ctx, temp: number, sx: number, sy: number, r: number, t: number) {
  if (temp > 80) {
    const k = Math.min(1, (temp - 80) / 900);
    const g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 1.6);
    g.addColorStop(0, `rgba(255,${Math.round(150 - 110 * k)},40,${0.15 + 0.45 * k})`);
    g.addColorStop(0.62, `rgba(255,70,20,${0.1 + 0.35 * k})`);
    g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 1.6, 0, Math.PI * 2); ctx.fill();
    if (temp > 500 && r > 4) {
      ctx.strokeStyle = `rgba(255,${120 + Math.sin(t * 4) * 40},40,${0.4 * k + 0.2})`; ctx.lineWidth = Math.max(1, r * 0.06);
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + t * 0.2; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * r * 0.4, sy + Math.sin(a) * r * 0.4, r * 0.35, a, a + 1.4); ctx.stroke(); }
    }
  } else if (temp < -40) {
    const k = Math.min(1, (-40 - temp) / 180);
    ctx.fillStyle = `rgba(200,235,255,${0.12 + 0.35 * k})`;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(240,250,255,${0.4 + 0.4 * k})`;
    ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.82, r * 0.5 * (0.5 + k), r * 0.18 * (0.5 + k), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.82, r * 0.45 * (0.5 + k), r * 0.16 * (0.5 + k), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(150,210,255,${0.25 + 0.35 * k})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, r + 1.5, 0, Math.PI * 2); ctx.stroke();
  }
}

/** Star color from surface temperature (Kelvin) */
export function starColor(k: number) {
  if (k < 3500) return '#ff6a3d';
  if (k < 5000) return '#ffa64d';
  if (k < 6500) return '#ffd86a';
  if (k < 8000) return '#fff4e0';
  if (k < 12000) return '#dce9ff';
  return '#8fc4ff';
}