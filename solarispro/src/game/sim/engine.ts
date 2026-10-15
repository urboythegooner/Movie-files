import { shade } from './colors';
import { factsFor, suitability } from './facts';

// Slightly stronger sandbox gravity lets widely separated worlds remain dynamically bound
// while initial orbital speeds are computed from the same constant in setup.ts.
export const G = 2.5;
const EPS2 = 0.6;
const MAX_DEBRIS = 1800;

export type Kind = 'sun' | 'planet' | 'moon' | 'asteroid' | 'blackhole' | 'wormhole';

export interface Body {
  id: number;
  name: string;
  kind: Kind;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  mass: number;
  baseMass: number;
  baseRadius: number;
  radius: number;
  color: string;
  ring: boolean;
  massive: boolean;
  alive: boolean;
  dragging: boolean;
  trail: number[];
  temperature: number;
  habitable: boolean;
  population: number;
  parentId: number | null;
  orbitR: number; orbitSpeed: number; orbitPhase: number; orbitTilt: number;
  /** Greenhouse / internal heat on top of what nearby stars provide (°C) */
  heatBase?: number;
  /** Time spent above the catastrophic temperature threshold. */
  extremeHeatTime?: number;
  /** Set only when a supernova blast has flash-heated this star. */
  blastHeated?: boolean;
  /** Delay before a blast-heated star collapses into a black hole. */
  collapseTime?: number;
  wormholeTime?: number;
}

export interface Debris {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  color: string; size: number;
}

export interface Flash { x: number; y: number; z: number; r: number; life: number; max: number; color: string }

/** Directed coronal mass ejection / solar storm moving through the system. */
export interface SolarStorm { x: number; y: number; z: number; dx: number; dy: number; dz: number; speed: number; distance: number; width: number; intensity: number; life: number; maxLife: number; sourceId: number; color: string; hit: Set<number> }

/** Expanding supernova blast front. Everything it reaches (planets, moons, asteroids) is obliterated. */
export interface Shockwave {
  x: number; y: number; z: number;
  r: number; speed: number; maxR: number;
  color: string; sourceId: number;
  hit: Set<number>;
}

export interface NewBody {
  name: string; kind: Kind;
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  mass: number; radius: number; color: string; ring?: boolean;
  parentId?: number; orbitR?: number; orbitSpeed?: number; orbitPhase?: number; orbitTilt?: number;
}

const rank = (b: Body) => (b.kind === 'blackhole' ? 3 : b.kind === 'sun' ? 2 : 1);
const isMassive = (kind: Kind, mass: number) => (kind !== 'asteroid' && kind !== 'moon') || mass >= 0.001;

export function radiusFor(b: Pick<Body, 'kind' | 'mass' | 'baseMass' | 'baseRadius'>) {
  if (b.kind === 'blackhole') return 2.5 + Math.cbrt(b.mass) * 0.25;
  return Math.min(5000, Math.max(0.4, b.baseRadius * Math.cbrt(b.mass / b.baseMass)));
}

export class World {
  bodies: Body[] = [];
  simple = false;
  ultra = false;
  gravityEnabled = true;
  collisionsEnabled = true;
  debris: Debris[] = [];
  flashes: Flash[] = [];
  shockwaves: Shockwave[] = [];
  solarStorms: SolarStorm[] = [];
  private stormClock = 0;
  onImpact?: (strength: number, kind: Kind) => void;
  time = 0;
  nextId = 1;
  private trailClock = 0;
  private captureClock = 0;

  add(o: NewBody): Body {
    const b: Body = {
      id: this.nextId++, name: o.name, kind: o.kind,
      x: o.x, y: o.y, z: o.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
      mass: o.mass, baseMass: o.mass, baseRadius: o.radius, radius: o.radius,
      color: o.color, ring: !!o.ring, massive: isMassive(o.kind, o.mass),
      alive: true, dragging: false, trail: [],
      temperature: 0, habitable: false, population: 0,
      parentId: o.parentId ?? null, orbitR: o.orbitR ?? 0, orbitSpeed: o.orbitSpeed ?? 0, orbitPhase: o.orbitPhase ?? 0, orbitTilt: o.orbitTilt ?? 0,
    };
    const f = factsFor(o.name);
    b.temperature = f === factsFor('') && o.kind === 'planet' ? Math.round(278 * Math.sqrt(100 / Math.max(10, Math.hypot(o.x, o.z))) - 273) : f.temp;
    b.habitable = f.habitable; b.population = f.pop;
    if (b.kind === 'blackhole') b.radius = radiusFor(b);
    this.bodies.push(b);
    return b;
  }

  byId(id: number | null) {
    if (id == null) return undefined;
    return this.bodies.find((b) => b.id === id && b.alive);
  }

  setMass(b: Body, m: number) {
    b.mass = m;
    b.massive = isMassive(b.kind, m);
    b.radius = radiusFor(b);
  }

  step(dt: number) {
    if (dt > 0) {
      // Adaptive substeps reduce tunnelling when fast-moving bodies cross a collision
      // radius between frames. Keep a hard cap so busy sandboxes remain responsive.
      let fastest = 0;
      for (const b of this.bodies) {
        if (!b.alive || b.parentId != null || b.dragging) continue;
        fastest = Math.max(fastest, Math.hypot(b.vx, b.vy, b.vz));
      }
      const maxSteps = this.simple ? 6 : this.ultra ? 18 : 14;
      const travelSteps = Math.ceil((fastest * dt) / 0.75);
      const subs = Math.min(maxSteps, Math.max(1, Math.ceil(dt / 0.012), travelSteps));
      const h = dt / subs;
      for (let s = 0; s < subs; s++) {
        if (this.gravityEnabled) this.gravity(h);
        if (this.collisionsEnabled) this.collide(s === subs - 1);
      }
      this.captureClock += dt;
      if (this.captureClock >= 0.15) {
        this.captureClock %= 0.15;
        this.captureNearbyAsteroids();
      }
      this.updateLife(dt);
      this.time += dt;
      this.updateDebris(dt);
      this.updateShockwaves(dt);
      this.updateSolarStorms(dt);
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        this.flashes[i].life -= dt;
        if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
      }
      this.trailClock += dt;
      if (this.trailClock >= 0.25) {
        this.trailClock = 0;
        for (const b of this.bodies) {
          if (!b.alive || b.kind === 'asteroid' || b.kind === 'sun' || b.kind === 'moon') continue;
          b.trail.push(b.x, b.y, b.z);
          if (b.trail.length > 480) b.trail.splice(0, 3);
        }
      }
    }
    this.bodies = this.bodies.filter((b) => b.alive);
  }

  private gravity(h: number) {
    const M = this.bodies.filter((b) => b.alive && b.massive);
    for (const b of this.bodies) {
      if (!b.alive || b.dragging || b.parentId != null) continue;
      let ax = 0, ay = 0, az = 0;
      for (const m of M) {
        if (m === b) continue;
        const dx = m.x - b.x, dy = m.y - b.y, dz = m.z - b.z;
        const r2 = dx * dx + dy * dy + dz * dz + EPS2;
        const inv = (G * m.mass) / (r2 * Math.sqrt(r2));
        ax += dx * inv; ay += dy * inv; az += dz * inv;
      }
      b.vx += ax * h; b.vy += ay * h; b.vz += az * h;
    }
    for (const b of this.bodies) {
      if (!b.alive || b.dragging || b.parentId != null) continue;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    }
    this.moonTime += h;
    this.placeMoons();
  }

  moonTime = 0;

  /** Moons ride fixed orbits around their planet (real moons are too close for the sandbox's scale) */
  placeMoons() {
    const parents = new Map<number, Body>();
    for (const b of this.bodies) if (b.alive && (b.kind === 'planet' || b.kind === 'sun' || b.kind === 'blackhole')) parents.set(b.id, b);
    for (const m of this.bodies) {
      if (m.parentId == null || !m.alive || m.dragging) continue;
      const p = parents.get(m.parentId);
      if (!p) { m.parentId = null; continue; }
      // Moon distances are parent-radius multiples; stellar planet orbits are world units.
      const R = m.kind === 'moon' ? p.radius * m.orbitR : m.orbitR;
      const a = m.orbitPhase + this.moonTime * m.orbitSpeed;
      const st = Math.sin(m.orbitTilt), ct = Math.cos(m.orbitTilt), c = Math.cos(a), s = Math.sin(a);
      m.x = p.x + R * c; m.y = p.y + R * s * st; m.z = p.z + R * s * ct;
      const v = R * m.orbitSpeed;
      m.vx = p.vx - v * s; m.vy = p.vy + v * c * st; m.vz = p.vz + v * c * ct;
    }
  }

  private collide(withSmall: boolean) {
    const M = this.bodies.filter((b) => b.alive && b.massive);
    const pool = withSmall ? this.bodies : M;
    for (const a of M) {
      if (!a.alive) continue;
      for (const b of pool) {
        if (b === a || !b.alive) continue;
        if (b.massive && b.id < a.id) continue;
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const rr = a.radius + b.radius;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          this.impact(a, b);
          if (!a.alive) break;
        }
      }
    }
  }

  private impact(a: Body, b: Body) {
    const impactX = (a.x + b.x) * 0.5, impactY = (a.y + b.y) * 0.5, impactZ = (a.z + b.z) * 0.5;
    const impactSpeed = Math.hypot(a.vx - b.vx, a.vy - b.vy, a.vz - b.vz);
    let big = a, small = b;
    if (rank(b) > rank(a) || (rank(b) === rank(a) && b.mass > a.mass)) { big = b; small = a; }
    const impactStrength = Math.min(1, impactSpeed / 13 + Math.min(0.45, small.mass / Math.max(big.mass, 0.001)));
    this.onImpact?.(impactStrength, big.kind);
    if (big.kind === 'planet' || big.kind === 'moon') {
      const severity = Math.min(1, impactSpeed / 12 + small.mass / Math.max(big.mass, 0.0001));
      big.temperature = Math.min(6000, Math.max(big.temperature, 900 + severity * 2600));
      big.heatBase = Math.max(big.heatBase ?? 0, big.temperature - this.starHeat(big.x, big.y, big.z, this.bodies.filter((x) => x.alive && x.kind === 'sun')));
      big.population *= Math.max(0.02, 0.18 - severity * 0.14);
      this.flashes.push({ x: impactX, y: impactY, z: impactZ, r: Math.max(2, big.radius * 1.8), life: 0.7, max: 0.7, color: '#ff9b45' });
      this.flashes.push({ x: impactX, y: impactY, z: impactZ, r: Math.max(1, big.radius * 0.8), life: 0.22, max: 0.22, color: '#fff4cf' });
    }
    if (small.massive || big.kind === 'blackhole') {
      const totalMass = big.mass + small.mass;
      // High-energy impacts eject some material instead of unrealistically converting every
      // collision into a perfectly inelastic, perfectly efficient merger.
      const escapeSpeed = Math.sqrt((2 * G * totalMass) / Math.max(0.5, big.radius + small.radius));
      const hypervelocity = big.kind !== 'blackhole' && impactSpeed > Math.max(3.5, escapeSpeed * 1.45);
      const ejectaFraction = big.kind === 'blackhole' ? 0 : hypervelocity ? Math.min(0.28, 0.045 + (impactSpeed / Math.max(escapeSpeed, 1)) * 0.035) : 0;
      // A black hole keeps captured matter instead of ejecting it; even tiny asteroids feed its mass.
      const retainedMass = big.kind === 'blackhole' ? totalMass : Math.max(big.mass * 0.72, totalMass * (1 - ejectaFraction));
      if (!big.dragging) {
        big.vx = (big.vx * big.mass + small.vx * small.mass) / totalMass;
        big.vy = (big.vy * big.mass + small.vy * small.mass) / totalMass;
        big.vz = (big.vz * big.mass + small.vz * small.mass) / totalMass;
        // A small recoil makes violent off-centre impacts visibly perturb the surviving orbit.
        if (hypervelocity && impactSpeed > 0) {
          const recoil = Math.min(0.22, ejectaFraction * impactSpeed / Math.max(escapeSpeed, 1) * 0.18);
          big.vx += ((big.x - small.x) / Math.max(0.001, Math.hypot(big.x - small.x, big.y - small.y, big.z - small.z))) * recoil;
          big.vy += ((big.y - small.y) / Math.max(0.001, Math.hypot(big.x - small.x, big.y - small.y, big.z - small.z))) * recoil;
          big.vz += ((big.z - small.z) / Math.max(0.001, Math.hypot(big.x - small.x, big.y - small.y, big.z - small.z))) * recoil;
        }
      }
      this.setMass(big, retainedMass);
      this.flashes.push({ x: small.x, y: small.y, z: small.z, r: small.radius * (big.kind === 'blackhole' ? 2.8 : hypervelocity ? 2.2 : 1.5), life: big.kind === 'blackhole' ? 1.8 : hypervelocity ? 1.5 : 1.2, max: big.kind === 'blackhole' ? 1.8 : hypervelocity ? 1.5 : 1.2, color: big.kind === 'blackhole' ? '#b9a0ff' : hypervelocity ? '#ffd19a' : small.color });
      if (hypervelocity) {
        const extra = Math.min(90, Math.round(12 + impactSpeed * 5 + small.radius * 8));
        this.explode({ ...small, mass: Math.max(0.001, small.mass * ejectaFraction), radius: Math.max(1, small.radius * 0.7) }, Math.round(extra * (this.simple ? 0.35 : this.ultra ? 1.1 : 0.7)));
        if (big.kind === 'planet' || big.kind === 'moon') {
          big.temperature = Math.min(6000, big.temperature + impactSpeed * 35);
          big.heatBase = Math.max(big.heatBase ?? 0, big.temperature - this.starHeat(big.x, big.y, big.z, this.bodies.filter((x) => x.alive && x.kind === 'sun')));
        }
      }
    }
    const n = small.massive ? Math.min(180, Math.round(18 + small.radius * 14)) : 4;
    this.explode(small, Math.round(n * (big.kind === 'blackhole' ? 0.6 : 1) * (this.simple ? 0.25 : this.ultra ? 1.25 : 0.65)));
    if (small.kind === 'sun') this.supernova(small);
    small.alive = false;
    small.dragging = false;
  }

  /** Capture a slow asteroid that enters a planet's near-gravity zone into a stable moon orbit. */
  private captureNearbyAsteroids() {
    const planets = this.bodies.filter((b) => b.alive && b.kind === 'planet' && !b.dragging);
    if (!planets.length) return;
    const asteroids = this.bodies.filter((b) => b.alive && b.kind === 'asteroid' && !b.dragging);
    for (const a of asteroids) {
      let best: Body | null = null, bestD = Infinity;
      for (const p of planets) {
        const dx = a.x - p.x, dy = a.y - p.y, dz = a.z - p.z;
        const d = Math.hypot(dx, dy, dz);
        const captureR = Math.max(p.radius * 7, Math.min(42, Math.cbrt(p.mass / 0.03) * 12));
        if (d < p.radius + a.radius || d > captureR || d >= bestD) continue;
        const rv = Math.hypot(a.vx - p.vx, a.vy - p.vy, a.vz - p.vz);
        const escape = Math.sqrt((2 * G * p.mass) / Math.max(d, p.radius));
        if (rv > Math.max(1.8, escape * 0.9)) continue;
        best = p; bestD = d;
      }
      if (!best) continue;
      const p = best;
      const dx = a.x - p.x, dz = a.z - p.z;
      const dist = Math.max(p.radius * 2.4, Math.hypot(dx, a.y - p.y, dz));
      const count = this.bodies.filter((b) => b.alive && b.parentId === p.id).length;
      a.kind = 'moon';
      a.name = `${p.name} ${['I', 'II', 'III', 'IV', 'V', 'VI'][count] ?? count + 1}`;
      a.mass = Math.max(a.mass, 0.00008);
      a.baseMass = a.mass;
      a.baseRadius = Math.max(0.45, Math.min(1.1, a.radius));
      a.radius = a.baseRadius;
      a.parentId = p.id;
      a.orbitR = dist / Math.max(0.1, p.radius);
      a.orbitPhase = Math.atan2(dz, dx);
      a.orbitTilt = (Math.random() - 0.5) * 0.35;
      a.orbitSpeed = 1.1 / Math.sqrt(Math.max(1, a.orbitR / 2));
      a.temperature = p.temperature;
      a.trail.length = 0;
      this.flashes.push({ x: a.x, y: a.y, z: a.z, r: a.radius * 2, life: 1.0, max: 1.0, color: '#b9d9ff' });
    }
  }

  /** Approximate planetary equilibrium temperature (°C) from all nearby stars.
   * Star radii are visual units, so derive an effective luminosity from mass and spectral color
   * rather than using the tiny drawn radius as the physical radius. This keeps generated systems warm. */
  starHeat(x: number, y: number, z: number, suns: Body[]) {
    let t4 = 3 ** 4;
    for (const s of suns) {
      const d = Math.max(1, Math.hypot(s.x - x, s.y - y, s.z - z));
      // Giant stars have enormous radiating surfaces. In this sandbox, a visually super-sized
      // star (radius >= 100 units) enters an extreme giant phase: its effective temperature
      // is multiplied by 40, as requested, and its radius boosts luminosity via area.
      const baseTemp = Math.max(2400, s.temperature || 5500);
      const stellarTemp = baseTemp * (s.radius >= 100 ? 40 : 1);
      const massLuminosity = Math.max(0.08, (s.mass / 10000) ** 2.8);
      const radiusLuminosity = Math.max(0.15, (s.radius / 14) ** 2);
      // Approximate equilibrium heating from inverse-square radiation and stellar surface area.
      const flux = massLuminosity * radiusLuminosity * (278 ** 4) / Math.max(0.01, (d / 500) ** 2);
      const spectralFactor = (stellarTemp / 5778) ** 2;
      t4 += (Math.max(35, flux ** 0.25 * spectralFactor ** 0.25)) ** 4;
    }
    return t4 ** 0.25 - 273;
  }

  private updateHeat(dt: number) {
    const suns = this.bodies.filter((b) => b.alive && b.kind === 'sun');
    const k = Math.min(1, dt * 2);
    for (const b of this.bodies) {
      if (!b.alive || (b.kind !== 'planet' && b.kind !== 'moon')) continue;
      const eq = this.starHeat(b.x, b.y, b.z, suns);
      if (b.heatBase == null) b.heatBase = 0;
      const target = Math.max(-270, Math.min(6000, eq + b.heatBase));
      b.temperature += (target - b.temperature) * k;
    }
  }

  private updateLife(dt: number) {
    this.updateHeat(dt);
    const yrs = dt / 62.83;
    for (const b of this.bodies) {
      if (!b.alive) continue;

      // A planet that stays catastrophically hot for several simulated seconds erupts.
      if (b.kind === 'planet') {
        if (b.temperature >= 1800) b.extremeHeatTime = (b.extremeHeatTime ?? 0) + dt;
        else b.extremeHeatTime = Math.max(0, (b.extremeHeatTime ?? 0) - dt * 1.5);
        if ((b.extremeHeatTime ?? 0) >= 4) {
          this.flashes.push({ x: b.x, y: b.y, z: b.z, r: b.radius * 5, life: 1.4, max: 1.4, color: '#7ed8ff' });
          this.flashes.push({ x: b.x, y: b.y, z: b.z, r: b.radius * 2.5, life: 0.8, max: 0.8, color: '#ffffff' });
          this.destroy(b);
          continue;
        }
      }

      // Only stars recently flash-heated by a supernova can undergo this special collapse.
      if (b.kind === 'sun' && b.blastHeated) {
        if (b.temperature >= 80000) b.extremeHeatTime = (b.extremeHeatTime ?? 0) + dt;
        else b.extremeHeatTime = 0;
        if (b.collapseTime != null) {
          b.collapseTime -= dt;
          if (b.collapseTime <= 0 && b.alive) {
            // The star has already erupted; its remnant now collapses into a black hole.
            b.kind = 'blackhole';
            b.name = b.name.replace(/\\s*\\(Supernova Remnant\\)$/i, '') + ' (Black Hole)';
            b.color = '#17122b';
            b.mass = Math.max(b.mass, 12000);
            b.baseMass = b.mass;
            b.baseRadius = Math.max(2.5, b.baseRadius * 0.35);
            b.radius = radiusFor(b);
            b.massive = true;
            b.temperature = 0;
            b.blastHeated = false;
            b.collapseTime = undefined;
            this.flashes.push({ x: b.x, y: b.y, z: b.z, r: b.radius * 12, life: 1.8, max: 1.8, color: '#9b72ff' });
            continue;
          }
        } else if ((b.extremeHeatTime ?? 0) >= 4) {
          this.supernova(b);
          b.name = b.name.replace(/\\s*\\(Black Hole\\)$/i, '') + ' (Supernova Remnant)';
          b.color = '#b8e7ff';
          b.collapseTime = 1.8;
          b.extremeHeatTime = 0;
        }
      }

      if (b.kind !== 'planet') continue;
      const cap = b.habitable ? 1e10 * suitability(b.temperature) * Math.cbrt(b.mass / 0.03) : 0;
      if (cap <= 0) { b.population *= Math.exp(-3 * yrs); if (b.population < 1) b.population = 0; continue; }
      if (b.population < 1000) b.population = 1000;
      const rate = b.population > cap ? 2 : 0.6;
      b.population = Math.max(0, b.population + rate * b.population * (1 - b.population / cap) * yrs);
    }
  }

  /** Fragment a body into fast-moving impact ejecta */
  explode(b: Body, n: number) {
    if (this.debris.length + n > MAX_DEBRIS) this.debris.splice(0, this.debris.length + n - MAX_DEBRIS);
    const palette = [b.color, b.color, shade(b.color, 1.5), shade(b.color, 0.55), '#ffd27a', '#ffffff'];
    const base = 2 + Math.sqrt(b.radius) * 2.5;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
      const sp = base * (0.3 + Math.random() * 1.2);
      const off = b.radius * Math.random();
      const life = 2.5 + Math.random() * 5;
      this.debris.push({
        x: b.x + dx * off, y: b.y + dy * off, z: b.z + dz * off,
        vx: b.vx + dx * sp, vy: b.vy + dy * sp, vz: b.vz + dz * sp,
        life, max: life,
        color: palette[(Math.random() * palette.length) | 0],
        size: (0.25 + Math.random() * 0.7) * Math.max(0.6, Math.min(b.radius, 6) / 3),
      });
    }
  }

  destroy(b: Body) {
    if (b.kind === 'blackhole') {
      // A shattered event horizon pinches into a tiny, unstable wormhole instead of vanishing.
      this.explode(b, Math.min(420, Math.round(80 + b.radius * 22)));
      this.flashes.push({ x: b.x, y: b.y, z: b.z, r: b.radius * 9, life: 1.8, max: 1.8, color: '#8af7ff' });
      b.kind = 'wormhole'; b.name = 'Unstable Wormhole'; b.mass = Math.max(0.02, b.mass * 0.00001);
      b.baseMass = b.mass; b.radius = Math.max(1.2, Math.min(3.2, b.radius * 0.18)); b.baseRadius = b.radius;
      b.color = '#76f4ff'; b.wormholeTime = 0; b.temperature = 0; b.dragging = false;
      return;
    }
    this.explode(b, b.kind === 'asteroid' ? 12 : Math.min(600, Math.round(60 + b.radius * 55)));
    this.flashes.push({ x: b.x, y: b.y, z: b.z, r: b.radius * 1.5, life: 1.2, max: 1.2, color: b.color });
    if (b.kind === 'sun') this.supernova(b);
    b.alive = false;
    b.dragging = false;
  }

  /** A shattered sun goes supernova: blinding flashes, a wall of debris and a blast wave that wipes out nearby worlds */
  supernova(b: Body) {
    const heatFactor = Math.max(0.5, Math.min(8, (b.temperature || 5800) / 5800));
    const sizeFactor = Math.max(1, Math.sqrt(b.radius / 14));
    const maxR = Math.min(250000, (4000 + b.radius * 180) * sizeFactor * heatFactor);
    const speed = maxR / 7;
    this.shockwaves.push({ x: b.x, y: b.y, z: b.z, r: b.radius, speed, maxR, color: '#ffb347', sourceId: b.id, hit: new Set() });
    this.flashes.push({ x: b.x, y: b.y, z: b.z, r: b.radius * 18, life: 1.5, max: 1.5, color: '#ffb347' });
    const n = this.simple ? 120 : this.ultra ? 900 : 360;
    if (this.debris.length + n > MAX_DEBRIS) this.debris.splice(0, this.debris.length + n - MAX_DEBRIS);
    const palette = ['#ffffff', '#ffe9a8', '#ffd27a', '#ff9a3d', '#ff5a2a', b.color];
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
      const sp = speed * (0.2 + Math.random() * 0.9);
      const off = b.radius * Math.random();
      const life = 3 + Math.random() * 6;
      this.debris.push({
        x: b.x + dx * off, y: b.y + dy * off, z: b.z + dz * off,
        vx: dx * sp, vy: dy * sp, vz: dz * sp,
        life, max: life,
        color: palette[(Math.random() * palette.length) | 0],
        size: 0.7 + Math.random() * 1.8,
      });
    }
  }

  /** Hotter stars launch directed plasma storms more frequently; worlds inside the cone absorb heat. */
  private updateSolarStorms(dt: number) {
    const suns = this.bodies.filter((b) => b.alive && b.kind === 'sun');
    this.stormClock += dt;
    for (const sun of suns) {
      const temp = Math.max(1500, sun.temperature || 5500);
      // Shift the star's visible photosphere toward blue-white as its surface temperature rises.
      if (!sun.blastHeated) sun.color = temp >= 18000 ? '#65baff' : temp >= 10000 ? '#a9d8ff' : temp >= 7000 ? '#fff0d4' : temp >= 4500 ? '#ffd166' : '#ff6a3d';
      const rate = Math.max(0.012, Math.min(0.22, (temp / 5800) * 0.035));
      if (Math.random() < rate * dt && this.solarStorms.length < 18) {
        const a = Math.random() * Math.PI * 2, elev = (Math.random() - 0.5) * 0.7;
        const dx = Math.cos(a) * Math.cos(elev), dy = Math.sin(elev), dz = Math.sin(a) * Math.cos(elev);
        const intensity = Math.max(0.6, Math.min(5, temp / 5800));
        this.solarStorms.push({ x:sun.x, y:sun.y, z:sun.z, dx, dy, dz, speed: 110 + temp * 0.018, distance:0, width: 22 + intensity * 9, intensity, life: 18 + intensity * 5, maxLife: 18 + intensity * 5, sourceId:sun.id, color: temp >= 10000 ? '#63baff' : '#ff9b52', hit:new Set() });
        this.flashes.push({x:sun.x,y:sun.y,z:sun.z,r:sun.radius*2.2,life:0.45,max:0.45,color:temp>=10000?'#77caff':'#ffb45e'});
      }
    }
    for (let i=this.solarStorms.length-1;i>=0;i--) {
      const storm=this.solarStorms[i];
      storm.distance += storm.speed * dt;
      storm.life -= dt;
      const fx=storm.x+storm.dx*storm.distance, fy=storm.y+storm.dy*storm.distance, fz=storm.z+storm.dz*storm.distance;
      for (const b of this.bodies) {
        if (!b.alive || (b.kind!=='planet' && b.kind!=='moon') || storm.hit.has(b.id)) continue;
        const rx=b.x-storm.x, ry=b.y-storm.y, rz=b.z-storm.z;
        const along=rx*storm.dx+ry*storm.dy+rz*storm.dz;
        if (along < Math.max(0,storm.distance-storm.speed*dt) || along > storm.distance+storm.width) continue;
        const lateral=Math.sqrt(Math.max(0,rx*rx+ry*ry+rz*rz-along*along));
        const coneWidth=storm.width+along*0.075;
        if (lateral > coneWidth+b.radius) continue;
        storm.hit.add(b.id);
        const heat=storm.intensity*(90+Math.random()*170);
        b.temperature=Math.min(6000,b.temperature+heat);
        b.heatBase=Math.max(b.heatBase??0,b.temperature-this.starHeat(b.x,b.y,b.z,suns));
        this.flashes.push({x:b.x,y:b.y,z:b.z,r:b.radius*3,life:0.9,max:0.9,color:storm.color});
      }
      if (storm.life<=0 || storm.distance>18000) this.solarStorms.splice(i,1);
    }
  }

  private updateShockwaves(dt: number) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.r += w.speed * dt;
      for (const t of this.bodies) {
        if (!t.alive || t.id === w.sourceId || w.hit.has(t.id)) continue;
        const d = Math.hypot(t.x - w.x, t.y - w.y, t.z - w.z);
        if (d > w.r) continue;
        w.hit.add(t.id);
        if (t.kind === 'planet' || t.kind === 'moon' || t.kind === 'asteroid') {
          this.destroy(t);
        } else if (t.kind === 'sun') {
          // A supernova shockwave flash-heats nearby stars into intensely hot blue stars.
          // Keep this as a permanent stellar transformation after the blast passes.
          t.color = '#168bff';
          t.temperature = Math.max(t.temperature, 100000);
          t.blastHeated = true;
          t.extremeHeatTime = 0;
          if (!t.dragging && d > 0) {
            const k = 3 * (1 - Math.min(1, d / w.maxR));
            t.vx += ((t.x - w.x) / d) * k; t.vy += ((t.y - w.y) / d) * k; t.vz += ((t.z - w.z) / d) * k;
          }
          this.flashes.push({ x: t.x, y: t.y, z: t.z, r: t.radius * 3.5, life: 1.1, max: 1.1, color: '#55baff' });
        }
      }
      if (w.r >= w.maxR) this.shockwaves.splice(i, 1);
    }
  }

  private updateDebris(dt: number) {
    const heavy = this.bodies.filter((b) => b.alive && b.massive && b.mass > 1);
    const arr = this.debris;
    for (let i = arr.length - 1; i >= 0; i--) {
      const d = arr[i];
      d.life -= dt;
      let dead = d.life <= 0;
      if (!dead) {
        for (const m of heavy) {
          const dx = m.x - d.x, dy = m.y - d.y, dz = m.z - d.z;
          const r2 = dx * dx + dy * dy + dz * dz + EPS2;
          if ((m.kind === 'sun' || m.kind === 'blackhole') && r2 < m.radius * m.radius) { dead = true; break; }
          const inv = (G * m.mass * dt) / (r2 * Math.sqrt(r2));
          d.vx += dx * inv; d.vy += dy * inv; d.vz += dz * inv;
        }
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      }
      if (dead) { arr[i] = arr[arr.length - 1]; arr.pop(); }
    }
  }

  /** Simulates the massive bodies (plus extras) forward and returns their future paths */
  predict(horizon: number, extra: Set<number>): Map<number, Float32Array> {
    const list = this.bodies.filter((b) => b.alive && b.parentId == null && (b.massive || extra.has(b.id)));
    const n = list.length;
    const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);
    const vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
    const dead = new Uint8Array(n);
    list.forEach((b, i) => { px[i] = b.x; py[i] = b.y; pz[i] = b.z; vx[i] = b.vx; vy[i] = b.vy; vz[i] = b.vz; });
    const h = Math.max(0.04, horizon / 2500);
    const steps = Math.min(this.simple ? 900 : this.ultra ? 3200 : 2500, Math.ceil(horizon / h));
    const rec = Math.max(1, Math.floor(steps / (this.simple ? 90 : this.ultra ? 300 : 240)));
    const cap = Math.floor(steps / rec) + 2;
    const out = list.map(() => new Float32Array(cap * 3));
    const counts = new Int32Array(n);
    const record = (i: number) => {
      const c = counts[i];
      if (c >= cap) return;
      out[i][c * 3] = px[i]; out[i][c * 3 + 1] = py[i]; out[i][c * 3 + 2] = pz[i];
      counts[i] = c + 1;
    };
    for (let i = 0; i < n; i++) record(i);
    for (let s = 1; s <= steps; s++) {
      for (let i = 0; i < n; i++) {
        if (dead[i]) continue;
        let ax = 0, ay = 0, az = 0;
        for (let j = 0; j < n; j++) {
          if (j === i || dead[j] || !list[j].massive) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
          const r2 = dx * dx + dy * dy + dz * dz + EPS2;
          const inv = (G * list[j].mass) / (r2 * Math.sqrt(r2));
          ax += dx * inv; ay += dy * inv; az += dz * inv;
        }
        vx[i] += ax * h; vy[i] += ay * h; vz[i] += az * h;
      }
      for (let i = 0; i < n; i++) {
        if (dead[i]) continue;
        px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h;
      }
      for (let i = 0; i < n; i++) {
        if (dead[i]) continue;
        for (let j = 0; j < n; j++) {
          if (j === i || dead[j] || !list[j].massive) continue;
          if (rank(list[j]) < rank(list[i]) || (rank(list[j]) === rank(list[i]) && list[j].mass <= list[i].mass)) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
          const rr = list[i].radius + list[j].radius;
          if (dx * dx + dy * dy + dz * dz < rr * rr) { record(i); dead[i] = 1; break; }
        }
      }
      if (s % rec === 0) for (let i = 0; i < n; i++) if (!dead[i]) record(i);
    }
    const map = new Map<number, Float32Array>();
    list.forEach((b, i) => map.set(b.id, out[i].subarray(0, counts[i] * 3)));
    return map;
  }
}