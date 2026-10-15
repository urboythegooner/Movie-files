import { Camera } from './camera';
import { Body, G, World } from './engine';
import { makeNebulae } from './ultra';
import { SpawnSpec } from './catalog';
import { Fleet } from './fleet';
import { addBelt, addSwarm, createSolarSystem, EARTH_MASS, makeStars, rock, YEAR } from './setup';

/** Extreme deep-universe camera range: 100× farther, reaching 250 billion simulation units. */
export const MAX_ZOOM_OUT = 250_000_000_000;

export type Tool = 'select' | 'asteroid' | 'blackhole' | 'planet' | 'place';

export interface Settings {
  timeScale: number;
  gravityEnabled: boolean;
  collisionsEnabled: boolean;
  slow: boolean;
  paused: boolean;
  prediction: boolean;
  horizonYears: number;
  labels: boolean;
  trails: boolean;
  orbitAssist: boolean;
  tool: Tool;
  simple: boolean;
  ultra: boolean;
  travel: boolean;
  universeSystems: number;
  planetsPerSystem: number;
  graphicsQuality: number;
}

const PLANET_COLORS = ['#5ad19a', '#e86a8a', '#f2b84b', '#7aa7ff', '#c27bff', '#4fd6d6', '#ff8c5a'];

export class Sim {
  world = new World();
  camera = new Camera();
  fleet = new Fleet();
  stars = makeStars(14000);
  nebulae = makeNebulae();
  settings: Settings = {
    timeScale: 1, gravityEnabled: true, collisionsEnabled: true, slow: false, paused: false, prediction: true, horizonYears: 1,
    labels: true, trails: true, orbitAssist: true, tool: 'select', simple: false, ultra: true, travel: false,
    universeSystems: 5, planetsPerSystem: 4, graphicsQuality: 80,
  };
  panMode = false;
  selectedId: number | null = null;
  hoverId: number | null = null;
  followId: number | null = null;
  prediction = new Map<number, Float32Array>();
  fps = 60;
  /** Brief impact-driven camera impulse, rendered as restrained screen-space shake. */
  shakeStrength = 0;
  shakeTime = 0;
  soundEnabled = true;
  onImpact?: (strength: number, kind: string) => void;
  pending: SpawnSpec | null = null;
  onSelect?: (id: number | null) => void;
  onOpenFacts?: (id: number) => void;
  onWormhole?: () => void;
  private lastClick = { id: -1, t: 0 };

  private predictClock = 0;
  private mode: 'none' | 'orbit' | 'pan' | 'drag' | 'spray' | 'pinch' = 'none';
  private lastX = 0; private lastY = 0; private downX = 0; private downY = 0;
  private moved = false;
  private dragBody: Body | null = null;
  private planeY = 0; private offX = 0; private offZ = 0;
  private hist: { t: number; x: number; y: number; z: number }[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private lastSpray = 0;
  private spawned = { planet: 0, bh: 0 };

  constructor() { this.reset(); }

  reset() {
    this.world = new World();
    this.world.onImpact = (strength, kind) => {
      this.shakeStrength = Math.max(this.shakeStrength, Math.min(13, strength * 12));
      this.shakeTime = Math.max(this.shakeTime, 0.16 + strength * 0.48);
      this.onImpact?.(strength, kind);
    };
    this.shakeStrength = 0; this.shakeTime = 0;
    this.fleet = new Fleet();
    this.world.simple = this.settings.simple;
    this.world.ultra = this.settings.ultra;
    createSolarSystem(this.world, this.settings.ultra, this.settings.universeSystems, this.settings.planetsPerSystem);
    this.camera.targetDist = this.settings.ultra ? 1500 : 720;
    this.select(null);
    this.followId = null;
    this.camera.tx = this.camera.ty = this.camera.tz = 0;
    this.prediction.clear();
    this.spawned = { planet: 0, bh: 0 };
  }

  serialize() {
    const w = this.world;
    return {
      v: 1, time: w.time, moonTime: w.moonTime, nextId: w.nextId,
      ultra: true, simple: false,
      bodies: w.bodies.filter((b) => b.alive).map((b) => ({ ...b, trail: [], dragging: false })),
      cam: { yaw: this.camera.yaw, pitch: this.camera.pitch, targetDist: this.camera.targetDist },
    };
  }

  load(data: ReturnType<Sim['serialize']>) {
    // All galaxies now load in Ultra quality, including older saves made in Simple/Normal modes.
    Object.assign(this.settings, { ultra: true, simple: false, paused: false, tool: 'select' as Tool });
    this.reset();
    const w = this.world;
    w.bodies = data.bodies.map((b) => ({ ...b, trail: [] }));
    w.time = data.time; w.moonTime = data.moonTime ?? 0; w.nextId = data.nextId;
    if (data.cam) Object.assign(this.camera, data.cam);
  }

  get selected() { return this.world.byId(this.selectedId); }

  select(id: number | null) {
    this.selectedId = id;
    this.predictClock = 0;
    this.onSelect?.(id);
  }

  tick(realDt: number) {
    const s = this.settings;
    const dt = s.paused ? 0 : realDt * s.timeScale * (s.slow ? 0.15 : 1);
    this.world.simple = s.simple;
    this.world.ultra = s.ultra;
    this.world.gravityEnabled = s.gravityEnabled;
    this.world.collisionsEnabled = s.collisionsEnabled;
    const d = this.dragBody;
    if (d) {
      if (!d.alive) { this.dragBody = null; this.mode = 'none'; }
      else { const v = this.releaseVel(d); d.vx = v.x; d.vy = v.y; d.vz = v.z; }
    }
    this.shakeTime = Math.max(0, this.shakeTime - realDt);
    this.shakeStrength *= Math.exp(-realDt * 8.5);
    this.world.step(dt);
    if (s.travel && !this.fleet.ready) this.fleet.init(this.world);
    if (s.travel) this.fleet.step(this.world, s.paused ? 0 : Math.min(0.05, realDt) * (s.slow ? 0.15 : 1) * Math.min(3, Math.sqrt(s.timeScale)));
    if (this.selectedId != null && !this.selected) this.select(null);
    const f = this.world.byId(this.followId);
    if (f) {
      const c = this.camera;
      // Frame-rate independent damped follow keeps the camera glide buttery at 30–144 FPS.
      const followEase = 1 - Math.exp(-realDt * 7.5);
      c.tx += (f.x - c.tx) * followEase; c.ty += (f.y - c.ty) * followEase; c.tz += (f.z - c.tz) * followEase;
    } else this.followId = null;
    if (!s.prediction) { this.prediction.clear(); return; }
    this.predictClock -= realDt;
    if (this.predictClock <= 0) {
      const extra = new Set<number>();
      if (this.selectedId != null) extra.add(this.selectedId);
      this.prediction = this.world.predict(s.horizonYears * YEAR, extra);
      this.predictClock = (this.dragBody ? 0.1 : 0.4) * (s.simple ? 2 : 1);
    }
  }

  /** Strongest gravitational attractor at a point */
  private dominant(x: number, y: number, z: number, exclude?: Body) {
    let best: Body | null = null, score = 0;
    for (const m of this.world.bodies) {
      if (!m.alive || !m.massive || m === exclude) continue;
      const r2 = (m.x - x) ** 2 + (m.y - y) ** 2 + (m.z - z) ** 2 + 1;
      const sc = m.mass / r2;
      if (sc > score) { score = sc; best = m; }
    }
    return best;
  }

  circularVel(x: number, y: number, z: number, exclude?: Body) {
    const dom = this.dominant(x, y, z, exclude);
    if (!dom) return { x: 0, y: 0, z: 0 };
    const dx = x - dom.x, dz = z - dom.z;
    const r = Math.hypot(dx, y - dom.y, dz);
    const hl = Math.hypot(dx, dz);
    if (hl < 1e-3) return { x: dom.vx, y: dom.vy, z: dom.vz };
    const vc = Math.sqrt((G * dom.mass) / r);
    return { x: dom.vx + (-dz / hl) * vc, y: dom.vy, z: dom.vz + (dx / hl) * vc };
  }

  private dragVel() {
    const now = performance.now() / 1000;
    const recent = this.hist.filter((h) => now - h.t < 0.12);
    if (recent.length < 2) return { x: 0, y: 0, z: 0 };
    const a = recent[0], b = recent[recent.length - 1];
    const dt = Math.max(0.016, now - a.t);
    const k = 0.35;
    const v = { x: ((b.x - a.x) / dt) * k, y: 0, z: ((b.z - a.z) / dt) * k };
    const sp = Math.hypot(v.x, v.z);
    if (sp > 30) { v.x *= 30 / sp; v.z *= 30 / sp; }
    return v;
  }

  private releaseVel(b: Body) {
    const dv = this.dragVel();
    if (!this.settings.orbitAssist) return dv;
    const c = this.circularVel(b.x, b.y, b.z, b);
    return { x: c.x + dv.x, y: c.y + dv.y, z: c.z + dv.z };
  }

  pick(sx: number, sy: number): Body | null {
    const cam = this.camera;
    let best: Body | null = null, bestScore = Infinity;
    for (const b of this.world.bodies) {
      const z = cam.project(b.x, b.y, b.z);
      if (z < 0) continue;
      const pad = b.kind === 'asteroid' ? 5 : 10;
      const r = Math.max((b.radius * cam.F) / z, 3) + pad;
      const d2 = (cam.sx - sx) ** 2 + (cam.sy - sy) ** 2;
      if (d2 > r * r) continue;
      const score = (b.kind === 'asteroid' ? 1e6 : 0) + z;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  spawn(tool: Tool, x: number, z: number) {
    const w = this.world;
    if (tool === 'asteroid') {
      const v = this.circularVel(x, 0, z);
      const j = 0.95 + Math.random() * 0.1;
      w.add({ name: 'Asteroid', kind: 'asteroid', x, y: (Math.random() - 0.5) * 2, z, vx: v.x * j, vy: v.y, vz: v.z * j, mass: 0.00005, radius: 0.6 + Math.random() * 0.8, color: rock() });
    } else if (tool === 'blackhole') {
      const b = w.add({ name: `Black Hole ${++this.spawned.bh}`, kind: 'blackhole', x, y: 0, z, mass: 3000, radius: 6, color: '#c58bff' });
      this.select(b.id);
    } else if (tool === 'planet') {
      const v = this.circularVel(x, 0, z);
      const b = w.add({
        name: `Planet ${String.fromCharCode(65 + (this.spawned.planet++ % 26))}`, kind: 'planet', x, y: 0, z,
        vx: v.x, vy: v.y, vz: v.z, mass: EARTH_MASS * 2, radius: 4,
        color: PLANET_COLORS[this.spawned.planet % PLANET_COLORS.length],
      });
      this.select(b.id);
    }
  }

  placeSpec(spec: SpawnSpec, x: number, z: number) {
    const n = spec.count ?? 1;
    let last: Body | null = null;
    for (let i = 0; i < n; i++) {
      const jx = n > 1 ? (Math.random() - 0.5) * 30 : 0, jz = n > 1 ? (Math.random() - 0.5) * 30 : 0;
      const y = n > 1 ? (Math.random() - 0.5) * 6 : 0;
      const v = spec.orbit ? this.circularVel(x + jx, y, z + jz) : { x: 0, y: 0, z: 0 };
      const b = this.world.add({ name: spec.name, kind: spec.kind, x: x + jx, y, z: z + jz, vx: v.x, vy: v.y, vz: v.z, mass: spec.mass, radius: spec.radius, color: spec.color, ring: spec.ring });
      if (spec.temperature != null) b.temperature = spec.temperature;
      if (spec.habitable != null) b.habitable = spec.habitable;
      if (spec.kind === 'planet' && b.habitable && b.population === 0) b.population = 1e4;
      last = b;
    }
    if (last && n === 1) this.select(last.id);
  }

  /** Give a planet (or star) a new moon on its own little orbit */
  addMoon(p: Body) {
    const count = this.world.bodies.filter((b) => b.alive && b.parentId === p.id).length;
    const orbitR = 2 + count * 0.9 + Math.random() * 0.4;
    const m = this.world.add({
      name: `${p.name} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][count] ?? count + 1}`, kind: 'moon',
      x: p.x, y: p.y, z: p.z, mass: 0.0004, radius: Math.max(0.4, Math.min(2, p.radius * (0.15 + Math.random() * 0.15))),
      color: ['#cfcac2', '#a99a86', '#e6dccb', '#8a8f9c', '#d9c49a'][count % 5], parentId: p.id, orbitR,
      orbitSpeed: (1.6 / Math.sqrt(orbitR / 2)) * (Math.random() < 0.15 ? -1 : 1), orbitPhase: Math.random() * 6.28, orbitTilt: (Math.random() - 0.5) * 0.4,
    });
    m.temperature = p.temperature;
    this.world.placeMoons();
    return m;
  }

  addBelt(n: number) { addBelt(this.world, n); }
  addSwarm(n: number) { addSwarm(this.world, n); }

  destroySelected() {
    const b = this.selected;
    if (b) this.world.destroy(b);
  }

  pointerDown(id: number, button: number, x: number, y: number) {
    this.pointers.set(id, { x, y });
    if (this.pointers.size === 2) {
      this.endDrag();
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.mode = 'pinch';
      return;
    }
    this.downX = this.lastX = x; this.downY = this.lastY = y;
    this.moved = false;
    if (button === 1 || this.panMode) { this.mode = 'pan'; return; }
    if (button !== 0) { this.mode = 'orbit'; return; }
    const hit = this.pick(x, y);
    if (hit) {
      if (hit.kind === 'wormhole') { this.onWormhole?.(); return; }
      const now = performance.now();
      if (this.lastClick.id === hit.id && now - this.lastClick.t < 400 && hit.kind !== 'asteroid') this.onOpenFacts?.(hit.id);
      this.lastClick = { id: hit.id, t: now };
      this.select(hit.id);
      this.mode = 'drag';
      this.dragBody = hit;
      hit.dragging = true;
      this.planeY = hit.y;
      const p = this.camera.rayPlaneY(x, y, this.planeY);
      this.offX = p ? hit.x - p.x : 0; this.offZ = p ? hit.z - p.z : 0;
      this.hist = [];
      return;
    }
    const tool = this.settings.tool;
    if (tool === 'select') { this.mode = 'orbit'; return; }
    const p = this.camera.rayPlaneY(x, y, this.camera.ty);
    if (p && tool === 'place') { if (this.pending) this.placeSpec(this.pending, p.x, p.z); this.mode = 'none'; return; }
    if (p) this.spawn(tool, p.x, p.z);
    this.mode = tool === 'asteroid' ? 'spray' : 'none';
  }

  pointerMove(id: number, x: number, y: number) {
    if (this.pointers.has(id)) this.pointers.set(id, { x, y });
    if (this.mode === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && this.pinchDist > 0) this.zoomBy(this.pinchDist / d);
      this.pinchDist = d;
      return;
    }
    const dx = x - this.lastX, dy = y - this.lastY;
    this.lastX = x; this.lastY = y;
    if (Math.abs(x - this.downX) + Math.abs(y - this.downY) > 4) this.moved = true;
    const cam = this.camera;
    if (this.mode === 'orbit') {
      cam.yaw -= dx * 0.006;
      cam.pitch = Math.max(-1.52, Math.min(1.52, cam.pitch + dy * 0.006));
    } else if (this.mode === 'pan') {
      // Pan in camera-relative directions; scale movement with zoom so it feels
      // natural both near a planet and when exploring the outer system.
      const scale = Math.max(0.15, cam.dist / Math.max(1, cam.F)) * 0.9;
      cam.tx += (-cam.rx * dx + cam.ux * dy) * scale;
      cam.ty += (-cam.ry * dx + cam.uy * dy) * scale;
      cam.tz += (-cam.rz * dx + cam.uz * dy) * scale;
    } else if (this.mode === 'drag' && this.dragBody) {
      const p = cam.rayPlaneY(x, y, this.planeY);
      if (!p) return;
      const b = this.dragBody;
      b.x = p.x + this.offX; b.y = this.planeY; b.z = p.z + this.offZ;
      this.hist.push({ t: performance.now() / 1000, x: b.x, y: b.y, z: b.z });
      if (this.hist.length > 30) this.hist.shift();
    } else if (this.mode === 'spray') {
      const now = performance.now();
      if (now - this.lastSpray < 30) return;
      this.lastSpray = now;
      const p = cam.rayPlaneY(x, y, cam.ty);
      if (p) this.spawn('asteroid', p.x + (Math.random() - 0.5) * 4, p.z + (Math.random() - 0.5) * 4);
    } else if (this.mode === 'none' && this.pointers.size === 0) {
      this.hoverId = this.pick(x, y)?.id ?? null;
    }
  }

  pointerUp(id: number, button: number) {
    this.pointers.delete(id);
    if (this.mode === 'orbit' && !this.moved && button === 0) this.select(null);
    this.endDrag();
    this.mode = 'none';
  }

  private endDrag() {
    const b = this.dragBody;
    if (!b) return;
    const v = this.releaseVel(b);
    b.vx = v.x; b.vy = v.y; b.vz = v.z;
    b.dragging = false;
    b.parentId = null;
    this.dragBody = null;
  }

  zoomBy(f: number) {
    const max = MAX_ZOOM_OUT;
    this.camera.targetDist = Math.max(25, Math.min(max, this.camera.targetDist * f));
  }

  get isDragging() { return !!this.dragBody; }
}