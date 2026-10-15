import { Body, World } from './engine';

export type ShipClass = 'shuttle' | 'colony' | 'freighter' | 'fighter' | 'cruiser' | 'dreadnought';
interface Spec { label: string; desc: string; speed: number; hp: number; shield: number; dmg: number; range: number; rate: number; crew: number; size: number; cost: number; troops: number; missiles: boolean }

export const SHIPS: Record<ShipClass, Spec> = {
  shuttle: { label: 'Shuttle', desc: 'Fast, small. Carries 500 settlers to found or grow a colony.', speed: 1.0, hp: 20, shield: 0, dmg: 0, range: 0, rate: 0, crew: 500, size: 0.9, cost: 5, troops: 0, missiles: false },
  colony: { label: 'Colony Ark', desc: 'Slow generation ship with a spinning habitat ring. Carries 2 million people.', speed: 0.38, hp: 140, shield: 50, dmg: 0, range: 0, rate: 0, crew: 2e6, size: 2.4, cost: 40, troops: 0, missiles: false },
  freighter: { label: 'Freighter', desc: 'Hauls cargo between friendly worlds, boosting their industry.', speed: 0.5, hp: 80, shield: 20, dmg: 0, range: 0, rate: 0, crew: 2000, size: 1.8, cost: 15, troops: 0, missiles: false },
  fighter: { label: 'Fighter Wing', desc: 'Quick interceptor with rapid lasers. Great at dogfights.', speed: 1.2, hp: 30, shield: 10, dmg: 4, range: 30, rate: 0.25, crew: 20, size: 0.8, cost: 8, troops: 0, missiles: false },
  cruiser: { label: 'Battlecruiser', desc: 'Lasers + homing missiles. Carries troops to invade worlds.', speed: 0.65, hp: 240, shield: 120, dmg: 14, range: 48, rate: 0.6, crew: 3000, size: 2.6, cost: 45, troops: 5000, missiles: true },
  dreadnought: { label: 'Dreadnought', desc: 'A flying fortress. Huge shields, heavy guns, an invasion army.', speed: 0.4, hp: 750, shield: 420, dmg: 30, range: 64, rate: 0.9, crew: 40000, size: 4.2, cost: 140, troops: 50000, missiles: true },
};
export const SHIP_ORDER: ShipClass[] = ['shuttle', 'colony', 'freighter', 'fighter', 'cruiser', 'dreadnought'];
export const isArmed = (c: ShipClass) => SHIPS[c].dmg > 0;

export interface Faction { id: number; name: string; color: string; capital: number | null; alive: boolean; alien: boolean; kills: number; losses: number; built: number; build: number; peaceClock: number; waves: number }
export interface Colony { planetId: number; faction: number; defense: number; maxDef: number; pop: number; founded: number; siege: number; cd: number }
export interface Ship {
  id: number; cls: ShipClass; faction: number; name: string;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  hp: number; shield: number; target: number | null; passengers: number;
  cd: number; shots: number; hit: number; lastHit: number; trail: number[]; trailClock: number;
  orbiting: boolean; orbitA: number; alive: boolean; age: number; ang: number;
}
export interface Bolt { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: string; dmg: number; faction: number; missile: boolean; ship?: Ship; planet?: number; trail: number[] }
export interface LogEntry { id: number; at: number; text: string; color: string; kind: 'war' | 'colony' | 'battle' | 'info' | 'peace' }

const NAMES = ['Valiant', 'Resolute', 'Aurora', 'Tempest', 'Nemesis', 'Odyssey', 'Vanguard', 'Hyperion', 'Sentinel', 'Andromeda', 'Fury', 'Halcyon', 'Ironclad', 'Pegasus', 'Leviathan', 'Zenith', 'Solace', 'Warden', 'Eclipse', 'Kestrel', 'Bastion', 'Harbinger'];
const COLORS = ['#7dff8a', '#ffd34d', '#ff5ad1', '#4de8ff', '#b98aff', '#ff9f43', '#f2f2f2', '#ff4d6d'];
const SUFFIX = ['Republic', 'Free State', 'Dominion', 'Collective', 'Hegemony', 'Federation', 'Syndicate', 'Commonwealth'];
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
type P = { x: number; y: number; z: number };
const d3 = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const SPEED = 60;
const MAX_SHIPS = 180;
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const fmtPeople = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${Math.round(n)}`);

export class Fleet {
  ready = false;
  factions: Faction[] = [];
  colonies = new Map<number, Colony>();
  ships: Ship[] = [];
  bolts: Bolt[] = [];
  wars = new Set<string>();
  log: LogEntry[] = [];
  time = 0;
  private nid = 1;
  private w!: World;

  init(w: World) {
    this.ready = true; this.w = w;
    const find = (n: string) => w.bodies.find((b) => b.alive && b.name === n);
    const home = find('Earth') ?? w.bodies.filter((b) => b.alive && b.kind === 'planet').sort((a, b) => b.population - a.population)[0];
    if (!home) return;
    const terra = this.addFaction(home.name === 'Earth' ? 'Terran Union' : `${home.name} Union`, '#5aa0ff', home);
    const moon = find('Moon');
    if (moon) this.claim(moon, terra, 3e5);
    const mars = find('Mars');
    if (mars) this.addFaction('Martian Free State', '#ff6a3d', mars, 2.5e6);
    this.post('Fleets online. Pick a populated world to launch ships, or open the War Room (W).', '#9fb4ff', 'info');
  }

  // ---------- queries ----------
  faction(id: number | undefined) { return this.factions.find((f) => f.id === id); }
  factionOf(planetId: number) { const c = this.colonies.get(planetId); return c ? this.faction(c.faction) : undefined; }
  atWar(a: number, b: number) {
    if (a === b) return false;
    const fa = this.faction(a), fb = this.faction(b);
    if (!fa?.alive || !fb?.alive) return false;
    return fa.alien || fb.alien || this.wars.has(key(a, b));
  }
  inAnyWar(id: number) { return this.factions.some((o) => this.atWar(id, o.id)); }
  popOf(b: Body) { const c = this.colonies.get(b.id); return c && !b.habitable ? c.pop : b.population; }
  stats(fid: number) {
    let planets = 0, pop = 0;
    for (const c of this.colonies.values()) if (c.faction === fid) { planets++; const b = this.w.byId(c.planetId); if (b) pop += this.popOf(b); }
    const own = this.ships.filter((s) => s.faction === fid);
    const power = own.reduce((a, s) => a + (isArmed(s.cls) ? SHIPS[s.cls].cost : 0), 0);
    return { planets, pop, ships: own.length, power };
  }

  // ---------- diplomacy ----------
  addFaction(name: string, color: string, home: Body, pop = 0) {
    const f: Faction = { id: this.nid++, name, color, capital: null, alive: true, alien: false, kills: 0, losses: 0, built: 0, build: 0, peaceClock: 6 + Math.random() * 6, waves: 0 };
    this.factions.push(f);
    this.claim(home, f, pop);
    f.capital = home.id;
    return f;
  }

  claim(b: Body, f: Faction, pop = 0) {
    const c: Colony = { planetId: b.id, faction: f.id, defense: 0, maxDef: 0, pop: 0, founded: this.time, siege: 0, cd: 0 };
    if (b.habitable) b.population += pop; else c.pop = Math.max(pop, 1, b.population);
    c.maxDef = 40 + Math.log10(Math.max(10, this.popOf(b) || pop)) * 12;
    c.defense = c.maxDef * 0.6;
    this.colonies.set(b.id, c);
    if (f.capital == null) f.capital = b.id;
    return c;
  }

  declareWar(a: number, b: number) {
    const fa = this.faction(a), fb = this.faction(b);
    if (!fa || !fb || a === b || this.wars.has(key(a, b))) return;
    this.wars.add(key(a, b));
    fa.build += 30; fb.build += 20;
    this.post(`⚔ ${fa.name} declared war on ${fb.name}!`, '#ff5a5a', 'war');
  }

  makePeace(a: number, b: number) {
    if (!this.wars.delete(key(a, b))) return;
    this.post(`🕊 ${this.faction(a)?.name} and ${this.faction(b)?.name} signed a peace treaty`, '#8dffb0', 'peace');
  }

  independence(planetId: number) {
    const c = this.colonies.get(planetId), b = this.w.byId(planetId), old = this.faction(c?.faction);
    if (!c || !b || !old || old.capital === planetId) return null;
    const used = new Set(this.factions.map((f) => f.color));
    const f: Faction = { id: this.nid++, name: `${b.name} ${pick(SUFFIX)}`, color: COLORS.find((x) => !used.has(x)) ?? pick(COLORS), capital: planetId, alive: true, alien: false, kills: 0, losses: 0, built: 0, build: 10, peaceClock: 8, waves: 0 };
    this.factions.push(f);
    c.faction = f.id;
    this.post(`🏳 ${b.name} broke away from ${old.name} as the ${f.name}`, f.color, 'colony');
    return f;
  }

  summonAliens() {
    const name = pick(['Vorthak Armada', 'Krell Hive', 'Zyx Collective', 'Ossuary Swarm']);
    const f: Faction = { id: this.nid++, name, color: '#9dff3a', capital: null, alive: true, alien: true, kills: 0, losses: 0, built: 0, build: 6, peaceClock: 0, waves: 4 };
    this.factions.push(f);
    this.post(`👾 Unknown signals detected… the ${name} has entered the system!`, f.color, 'war');
  }

  // ---------- ships ----------
  private makeShip(cls: ShipClass, f: Faction, x: number, y: number, z: number, vx: number, vy: number, vz: number, target: number | null) {
    const sp = SHIPS[cls];
    const prefix = f.name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase();
    const name = sp.size >= 2.4 ? `${prefix}S ${pick(NAMES)}` : `${sp.label} ${prefix}-${this.nid}`;
    const s: Ship = { id: this.nid++, cls, faction: f.id, name, x, y, z, vx, vy, vz, hp: sp.hp, shield: sp.shield, target, passengers: sp.crew, cd: 0.5, shots: 0, hit: 0, lastHit: 9, trail: [], trailClock: 0, orbiting: false, orbitA: Math.random() * 6.28, alive: true, age: 0, ang: 0 };
    this.ships.push(s);
    f.built++;
    return s;
  }

  launch(from: Body, to: Body | undefined, cls: ShipClass, auto = false): Ship | string {
    const c = this.colonies.get(from.id), f = this.faction(c?.faction);
    if (!c || !f) return 'Nobody lives here to launch a ship';
    if (!to || to.id === from.id) return 'Pick a destination first';
    if (this.ships.length >= MAX_SHIPS) return 'Space traffic is maxed out — wait for some ships to land';
    const sp = SHIPS[cls];
    if (this.popOf(from) <= sp.crew) return `${from.name} needs more than ${fmtPeople(sp.crew)} people for that`;
    this.addPop(from, -sp.crew);
    const d = d3(from, to) || 1, dx = (to.x - from.x) / d, dy = (to.y - from.y) / d, dz = (to.z - from.z) / d;
    const off = from.radius + 1.5, v = SPEED * sp.speed * 0.3;
    const s = this.makeShip(cls, f, from.x + dx * off, from.y + dy * off, from.z + dz * off, from.vx + dx * v, from.vy + dy * v, from.vz + dz * v, to.id);
    this.w.flashes.push({ x: s.x, y: s.y, z: s.z, r: 1.5 + sp.size, life: 0.6, max: 0.6, color: f.color });
    if (!auto || sp.size >= 2.4) this.post(`🚀 ${s.name} launched from ${from.name} → ${to.name}`, f.color, 'info');
    return s;
  }

  private addPop(b: Body, n: number) {
    const c = this.colonies.get(b.id);
    if (c && !b.habitable) { c.pop = Math.max(0, c.pop + n); b.population = c.pop; } else b.population = Math.max(0, b.population + n);
  }

  post(text: string, color: string, kind: LogEntry['kind']) {
    this.log.unshift({ id: this.nid++, at: Date.now(), text, color, kind });
    if (this.log.length > 60) this.log.length = 60;
  }

  // ---------- simulation ----------
  step(w: World, dt: number) {
    this.w = w;
    if (!this.ready || dt <= 0) return;
    this.time += dt;
    const byId = new Map(w.bodies.filter((b) => b.alive).map((b) => [b.id, b]));
    this.stepColonies(byId, dt);
    for (const f of this.factions) if (f.alive) { this.checkAlive(f, byId); if (f.alive) this.ai(f, dt, byId); }
    const hazards = w.bodies.filter((b) => b.alive && (b.kind === 'sun' || b.kind === 'blackhole'));
    for (const s of this.ships) if (s.alive) this.stepShip(s, dt, byId, hazards);
    this.stepBolts(dt, byId);
    this.ships = this.ships.filter((s) => s.alive);
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  private stepColonies(byId: Map<number, Body>, dt: number) {
    for (const [pid, c] of this.colonies) {
      const b = byId.get(pid), f = this.faction(c.faction);
      if (!b) { this.colonies.delete(pid); this.post(`💥 ${f?.name ?? 'A civilization'} lost a world — it was destroyed`, '#ff8a5a', 'battle'); continue; }
      if (!b.habitable) {
        const cap = 5e7 * Math.cbrt(b.mass / 0.03);
        c.pop = Math.max(0, c.pop + 0.04 * c.pop * (1 - c.pop / cap) * dt);
        b.population = c.pop;
      }
      c.siege = Math.max(0, c.siege - dt);
      c.defense = Math.min(c.maxDef, c.defense + (c.siege > 0 ? 0.5 : 4) * dt);
      if (!f || c.defense <= 0 || !this.inAnyWar(f.id)) continue;
      c.cd -= dt;
      if (c.cd > 0) continue;
      let foe: Ship | null = null, best = b.radius + 45;
      for (const s of this.ships) { if (!this.atWar(f.id, s.faction)) continue; const d = d3(s, b); if (d < best) { best = d; foe = s; } }
      if (foe) { c.cd = 0.7; this.fire(b, foe, f.color, 6 + c.maxDef * 0.05, f.id, false, b.radius + 0.5); }
    }
  }

  private checkAlive(f: Faction, byId: Map<number, Body>) {
    const own = [...this.colonies.values()].filter((c) => c.faction === f.id);
    if (f.capital == null || !own.some((c) => c.planetId === f.capital)) {
      const next = own.sort((a, b) => (byId.get(b.planetId)?.population ?? 0) - (byId.get(a.planetId)?.population ?? 0))[0];
      if (f.capital != null && next) this.post(`👑 ${f.name} moved its capital to ${byId.get(next.planetId)?.name}`, f.color, 'info');
      f.capital = next?.planetId ?? null;
    }
    const ships = this.ships.some((s) => s.faction === f.id);
    if (own.length || ships || (f.alien && f.waves > 0)) return;
    f.alive = false;
    for (const k of [...this.wars]) if (k.split('-').includes(String(f.id))) this.wars.delete(k);
    this.post(f.alien ? `🎉 The ${f.name} has been wiped out!` : `☠ The ${f.name} has fallen`, f.color, 'war');
  }

  private nearestColony(from: P, test: (c: Colony) => boolean, byId: Map<number, Body>) {
    let best: Body | undefined, bd = Infinity;
    for (const c of this.colonies.values()) {
      if (!test(c)) continue;
      const b = byId.get(c.planetId);
      if (!b) continue;
      const d = d3(from, b);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  private ai(f: Faction, dt: number, byId: Map<number, Body>) {
    if (f.alien) {
      f.build += dt;
      if (f.waves > 0 && f.build >= 7) { f.build = 0; f.waves--; this.alienWave(f, byId); }
      return;
    }
    const own = [...this.colonies.values()].filter((c) => c.faction === f.id).map((c) => byId.get(c.planetId)).filter((b): b is Body => b !== undefined);
    if (!own.length) return;
    const industry = own.reduce((a, b) => a + Math.max(0.5, Math.log10(this.popOf(b) + 10) - 2) * (b.id === f.capital ? 1.5 : 1), 0);
    const enemies = this.factions.filter((o) => this.atWar(f.id, o.id));
    if (enemies.length) {
      f.build += industry * dt;
      const r = Math.random(), cls: ShipClass = r < 0.45 ? 'fighter' : r < 0.85 ? 'cruiser' : 'dreadnought';
      if (f.build < SHIPS[cls].cost) return;
      const src = pick(own.filter((b) => this.popOf(b) > SHIPS[cls].crew * 1.5)) ?? own[0];
      const tgt = this.nearestColony(src, (c) => this.atWar(f.id, c.faction), byId) ?? src;
      const res = this.launch(src, tgt === src ? own.find((b) => b !== src) ?? this.anyNear(src, byId) : tgt, cls, true);
      f.build -= typeof res === 'string' ? SHIPS[cls].cost * 0.5 : SHIPS[cls].cost;
      return;
    }
    f.peaceClock -= dt;
    if (f.peaceClock > 0) return;
    f.peaceClock = 9 + Math.random() * 12;
    const src = pick(own);
    if (Math.random() < 0.45 && own.length >= 2) { this.launch(src, pick(own.filter((b) => b !== src)), 'freighter', true); return; }
    let best: Body | undefined, bd = Infinity;
    for (const b of byId.values()) {
      if ((b.kind !== 'planet' && b.kind !== 'moon') || this.colonies.has(b.id) || b.temperature > 600) continue;
      const d = d3(src, b);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) this.launch(src, best, this.popOf(src) > 5e6 && Math.random() < 0.5 ? 'colony' : 'shuttle', true);
  }

  private anyNear(src: Body, byId: Map<number, Body>) {
    let best: Body | undefined, bd = Infinity;
    for (const b of byId.values()) { if (b === src || (b.kind !== 'planet' && b.kind !== 'moon')) continue; const d = d3(src, b); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  private alienWave(f: Faction, byId: Map<number, Body>) {
    const sun = [...byId.values()].find((b) => b.kind === 'sun');
    const cx = sun?.x ?? 0, cz = sun?.z ?? 0;
    let far = 300;
    for (const b of byId.values()) if (b.kind === 'planet') far = Math.max(far, Math.hypot(b.x - cx, b.z - cz));
    const R = Math.min(2600, far * 1.15), a = Math.random() * Math.PI * 2;
    const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
    let tgt: Body | undefined, pop = -1;
    for (const c of this.colonies.values()) { const b = byId.get(c.planetId); if (b && this.popOf(b) > pop) { pop = this.popOf(b); tgt = b; } }
    const n = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) this.makeShip(i === 0 && f.waves === 0 ? 'dreadnought' : i < 2 ? 'cruiser' : 'fighter', f, x + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 10, z + (Math.random() - 0.5) * 30, 0, 0, 0, tgt?.id ?? null);
    this.w.flashes.push({ x, y: 0, z, r: 30, life: 1.5, max: 1.5, color: f.color });
    this.post(`👾 An alien wave of ${n} ships warped in${tgt ? `, heading for ${tgt.name}` : ''}!`, f.color, 'war');
  }

  private stepShip(s: Ship, dt: number, byId: Map<number, Body>, hazards: Body[]) {
    const sp = SHIPS[s.cls], armed = sp.dmg > 0;
    s.age += dt; s.hit = Math.max(0, s.hit - dt); s.lastHit += dt;
    if (s.lastHit > 2) s.shield = Math.min(sp.shield, s.shield + sp.shield * 0.08 * dt);
    for (const h of hazards) {
      const d = d3(s, h);
      if (h.kind === 'sun' && d < h.radius * 1.05) return this.kill(s, null, 'burned up in', h.name);
      if (h.kind === 'blackhole' && d < h.radius * 3) return this.kill(s, null, 'was spaghettified by', h.name);
    }
    let tgt = s.target != null ? byId.get(s.target) : undefined;
    if (!tgt) {
      tgt = (armed ? this.nearestColony(s, (c) => this.atWar(s.faction, c.faction), byId) : undefined) ?? this.nearestColony(s, (c) => c.faction === s.faction, byId);
      s.target = tgt?.id ?? null; s.orbiting = false;
    }
    let foe: Ship | null = null;
    if (armed) {
      let bd = sp.range * 1.6;
      for (const o of this.ships) { if (!o.alive || !this.atWar(s.faction, o.faction)) continue; const d = d3(s, o); if (d < bd) { bd = d; foe = o; } }
    }
    s.cd -= dt;
    const fc = this.faction(s.faction)?.color ?? '#fff';
    let dvx = 0, dvy = 0, dvz = 0, steer = true;
    if (foe) {
      s.orbiting = false;
      const d = d3(s, foe) || 1, ux = (foe.x - s.x) / d, uy = (foe.y - s.y) / d, uz = (foe.z - s.z) / d, v = SPEED * sp.speed;
      if (d > sp.range * 0.7) { dvx = foe.vx + ux * v; dvy = foe.vy + uy * v; dvz = foe.vz + uz * v; }
      else { dvx = foe.vx - uz * v * 0.8 - ux * v * 0.2; dvy = foe.vy; dvz = foe.vz + ux * v * 0.8 - uz * v * 0.2; }
      if (s.cd <= 0 && d < sp.range) {
        s.shots++; s.cd = sp.rate * (0.8 + Math.random() * 0.4);
        const missile = sp.missiles && s.shots % 3 === 0;
        this.fire(s, foe, fc, missile ? sp.dmg * 2.5 : sp.dmg, s.faction, missile, sp.range);
      }
    } else if (tgt) {
      const orbitR = tgt.radius + 3 + sp.size * 1.6;
      if (s.orbiting || d3(s, tgt) < orbitR + 2) {
        if (!s.orbiting) { s.orbiting = true; s.orbitA = Math.atan2(s.z - tgt.z, s.x - tgt.x); }
        if (!this.arrive(s, tgt, dt, fc)) return;
        s.orbitA += (dt * 1.4) / (1 + sp.size * 0.3);
        const nx = tgt.x + Math.cos(s.orbitA) * orbitR, nz = tgt.z + Math.sin(s.orbitA) * orbitR, ny = tgt.y + Math.sin(s.orbitA * 2) * orbitR * 0.15;
        s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; s.vz = (nz - s.z) / dt;
        s.x = nx; s.y = ny; s.z = nz; steer = false;
      } else {
        const d = d3(s, tgt), v = SPEED * sp.speed;
        dvx = tgt.vx + ((tgt.x - s.x) / d) * v; dvy = tgt.vy + ((tgt.y - s.y) / d) * v; dvz = tgt.vz + ((tgt.z - s.z) / d) * v;
      }
    }
    if (steer) {
      const k = Math.min(1, dt * (2 + 2 / sp.size));
      s.vx += (dvx - s.vx) * k; s.vy += (dvy - s.vy) * k; s.vz += (dvz - s.vz) * k;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    }
    s.trailClock += dt;
    if (s.trailClock > 0.05) { s.trailClock = 0; s.trail.push(s.x, s.y, s.z); if (s.trail.length > 54) s.trail.splice(0, 3); }
    if (Math.hypot(s.x, s.z) > 9000) s.alive = false;
  }

  /** Handle a ship reaching / orbiting its target. Returns false if the ship is gone. */
  private arrive(s: Ship, tgt: Body, dt: number, fc: string) {
    const c = this.colonies.get(tgt.id), f = this.faction(s.faction), sp = SHIPS[s.cls];
    if (!f) return false;
    if (sp.dmg === 0) {
      if (!c) {
        if (tgt.kind !== 'planet' && tgt.kind !== 'moon') { s.target = null; s.orbiting = false; return true; }
        this.claim(tgt, f, s.passengers);
        this.post(`🏠 ${f.name} founded a colony on ${tgt.name} (${fmtPeople(s.passengers)} settlers)`, f.color, 'colony');
      } else if (c.faction === s.faction || !this.atWar(s.faction, c.faction)) {
        this.addPop(tgt, s.passengers);
        if (s.cls === 'freighter') { const owner = this.faction(c.faction); if (owner) owner.build += 15; c.defense = Math.min(c.maxDef, c.defense + 10); }
      } else { this.kill(s, null, 'was shot down over', tgt.name); return false; }
      s.alive = false;
      return false;
    }
    if (c && this.atWar(s.faction, c.faction)) {
      c.siege = 3;
      if (s.cd <= 0) { s.cd = sp.rate * 1.2; s.shots++; this.fire(s, tgt, fc, sp.dmg, s.faction, sp.missiles && s.shots % 3 === 0, sp.range, tgt.id); }
      if (c.defense <= 0) {
        this.addPop(tgt, -this.popOf(tgt) * 0.03 * dt * (sp.dmg / 14));
        if (sp.troops > 0) this.capture(c, s, tgt);
      }
    } else if (s.age > 3) {
      const next = this.nearestColony(s, (o) => this.atWar(s.faction, o.faction), new Map(this.w.bodies.filter((b) => b.alive).map((b) => [b.id, b])));
      if (next && next.id !== tgt.id) { s.target = next.id; s.orbiting = false; }
    }
    return true;
  }

  private capture(c: Colony, s: Ship, tgt: Body) {
    const old = this.faction(c.faction), f = this.faction(s.faction);
    if (!f) return;
    c.faction = s.faction; c.defense = c.maxDef * 0.3; c.siege = 0;
    this.addPop(tgt, -this.popOf(tgt) * 0.25);
    if (old?.capital === tgt.id) old.capital = null;
    if (f.capital == null) f.capital = tgt.id;
    this.w.flashes.push({ x: tgt.x, y: tgt.y, z: tgt.z, r: tgt.radius * 2, life: 1.4, max: 1.4, color: f.color });
    this.post(`🏴 ${f.name} invaded and captured ${tgt.name}${old ? ` from ${old.name}` : ''}!`, f.color, 'war');
  }

  private fire(from: P & { vx: number; vy: number; vz: number }, to: P & { vx: number; vy: number; vz: number }, color: string, dmg: number, faction: number, missile: boolean, range: number, planet?: number) {
    const speed = missile ? 80 : 340, d = d3(from, to) || 1, lead = missile ? 0 : d / speed;
    const tx = to.x + to.vx * lead, ty = to.y + to.vy * lead, tz = to.z + to.vz * lead;
    const dd = Math.hypot(tx - from.x, ty - from.y, tz - from.z) || 1;
    const jit = missile ? 0 : (Math.random() - 0.5) * 0.02;
    this.bolts.push({
      x: from.x, y: from.y, z: from.z,
      vx: ((tx - from.x) / dd + jit) * speed, vy: ((ty - from.y) / dd) * speed, vz: ((tz - from.z) / dd - jit) * speed,
      life: missile ? 6 : range / speed + 0.35, color, dmg, faction, missile, ship: planet == null ? (to as Ship) : undefined, planet, trail: [],
    });
  }

  private stepBolts(dt: number, byId: Map<number, Body>) {
    for (const b of this.bolts) {
      b.life -= dt;
      if (b.missile && b.ship?.alive) {
        const t = b.ship, d = d3(b, t) || 1, sp = Math.hypot(b.vx, b.vy, b.vz), k = Math.min(1, dt * 3);
        b.vx += ((t.x - b.x) / d * sp - b.vx) * k; b.vy += ((t.y - b.y) / d * sp - b.vy) * k; b.vz += ((t.z - b.z) / d * sp - b.vz) * k;
      }
      if (b.missile) { b.trail.push(b.x, b.y, b.z); if (b.trail.length > 30) b.trail.splice(0, 3); }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.ship) {
        if (!b.ship.alive) { if (!b.missile) continue; b.life = Math.min(b.life, 0.3); continue; }
        if (d3(b, b.ship) < SHIPS[b.ship.cls].size + (b.missile ? 1.5 : 2.5)) { this.damage(b.ship, b.dmg, b.faction, b); b.life = 0; }
      } else if (b.planet != null) {
        const p = byId.get(b.planet);
        if (!p) { b.life = 0; continue; }
        if (d3(b, p) < p.radius + 0.6) {
          const c = this.colonies.get(p.id);
          if (c) { c.defense = Math.max(0, c.defense - b.dmg * 0.35); c.siege = 3; }
          this.sparks(b, b.color, b.missile ? 14 : 5, 4);
          if (b.missile) this.w.flashes.push({ x: b.x, y: b.y, z: b.z, r: 1.5, life: 0.5, max: 0.5, color: '#ffb347' });
          b.life = 0;
        }
      }
    }
  }

  private damage(s: Ship, dmg: number, by: number, at: P) {
    s.hit = 0.25; s.lastHit = 0;
    const absorbed = Math.min(s.shield, dmg);
    s.shield -= absorbed; s.hp -= dmg - absorbed;
    this.sparks(at, absorbed > 0 ? '#9fd8ff' : '#ffb347', 3, 3);
    if (s.hp <= 0) this.kill(s, by);
  }

  private kill(s: Ship, by: number | null, verb?: string, where?: string) {
    if (!s.alive) return;
    s.alive = false;
    const sp = SHIPS[s.cls], f = this.faction(s.faction);
    if (f) f.losses++;
    const killer = by != null ? this.faction(by) : undefined;
    if (killer) killer.kills++;
    this.sparks(s, f?.color ?? '#fff', Math.round(18 + sp.size * 40), 3 + sp.size * 2);
    this.sparks(s, '#ffd27a', Math.round(10 + sp.size * 20), 2 + sp.size);
    this.w.flashes.push({ x: s.x, y: s.y, z: s.z, r: sp.size * 2.2, life: 0.9, max: 0.9, color: '#ffcf6a' });
    if (verb) this.post(`☄ ${s.name} ${verb} ${where}`, '#ffb347', 'battle');
    else if (sp.size >= 2.4) this.post(`💥 ${s.name} was destroyed${killer ? ` by the ${killer.name}` : ''}`, killer?.color ?? '#ffb347', 'battle');
  }

  private sparks(at: P, color: string, n: number, speed: number) {
    const d = this.w.debris;
    if (d.length > 8600) return;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = Math.sqrt(1 - u * u), sp = speed * (0.3 + Math.random());
      const life = 0.6 + Math.random() * 1.6;
      d.push({ x: at.x, y: at.y, z: at.z, vx: r * Math.cos(th) * sp, vy: u * sp, vz: r * Math.sin(th) * sp, life, max: life, color: Math.random() < 0.3 ? '#ffffff' : color, size: 0.2 + Math.random() * 0.35 });
    }
  }
}