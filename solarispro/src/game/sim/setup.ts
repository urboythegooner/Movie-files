import { G, World } from './engine';

export const SUN_MASS = 10000;
export const EARTH_MASS = 0.03;
export const YEAR = (2 * Math.PI * 100) / Math.sqrt((G * SUN_MASS) / 100);

const ROCK = ['#8a8278', '#a39a8e', '#6f6a63', '#b5a58f', '#7d7468'];

const PLANETS: [string, number, number, number, string, number, boolean?][] = [
  // A deliberately expanded AU scale: inner planets are clearly separated from the Sun
  // and from one another, while the gas giants retain realistic relative spacing.
  ['Mercury', 195, 0.0017, 2.0, '#b1a89c', 7],
  ['Venus', 360, 0.024, 3.2, '#e8c48a', 3.4],
  ['Earth', 500, 0.03, 3.4, '#4f8fe0', 0],
  ['Mars', 760, 0.0032, 2.5, '#d4643a', 1.85],
  ['Jupiter', 2600, 9.5, 9, '#d9a46c', 1.3],
  ['Saturn', 4750, 2.86, 7.5, '#e6cf92', 2.5, true],
  ['Uranus', 9600, 0.44, 5, '#8fd8e0', 0.8],
  ['Neptune', 15000, 0.51, 5, '#4a6cf0', 1.8],
];

function incline(x: number, y: number, z: number, i: number, o: number) {
  const y1 = y * Math.cos(i) - z * Math.sin(i);
  const z1 = y * Math.sin(i) + z * Math.cos(i);
  return [x * Math.cos(o) + z1 * Math.sin(o), y1, -x * Math.sin(o) + z1 * Math.cos(o)];
}

export const rock = () => ROCK[(Math.random() * ROCK.length) | 0];

const SPREAD: Record<string, number> = { Mercury: 195, Venus: 360, Earth: 500, Mars: 760, Jupiter: 2600, Saturn: 4750, Uranus: 9600, Neptune: 15000 };

export function createSolarSystem(world: World, spread = false, universeSystems = 5, planetsPerSystem = 4) {
  const sun = world.add({ name: 'Sun', kind: 'sun', x: 0, y: 0, z: 0, mass: SUN_MASS, radius: 14, color: '#ffc04d' });
  let mx = 0, my = 0, mz = 0;
  for (const [name, r0, mass, radius, color, incDeg, ring] of PLANETS) {
    const r = spread ? SPREAD[name] : r0;
    const th = Math.random() * Math.PI * 2, om = Math.random() * Math.PI * 2;
    const v = Math.sqrt((G * SUN_MASS) / r);
    const i = (incDeg * Math.PI) / 180;
    const [x, y, z] = incline(r * Math.cos(th), 0, r * Math.sin(th), i, om);
    const [vx, vy, vz] = incline(-Math.sin(th) * v, 0, Math.cos(th) * v, i, om);
    world.add({ name, kind: 'planet', x, y, z, vx, vy, vz, mass, radius, color, ring });
    mx += vx * mass; my += vy * mass; mz += vz * mass;
  }
  addMoons(world, spread ? 2.4 : 1);
  sun.vx = -mx / SUN_MASS; sun.vy = -my / SUN_MASS; sun.vz = -mz / SUN_MASS;
  if (spread) {
    addBelt(world, 1800, 950, 1250); addKuiper(world, 800); addComets(world);
    addDistantSystems(world, universeSystems, planetsPerSystem);
  } else addBelt(world, 750, 950, 1250);
}

/** Distant star systems become visible as you zoom out. Their planets orbit their own star. */
export function addDistantSystems(world: World, systemCount = 5, planetsPerSystem = 4) {
  const systems = [
    { name: 'Kepler Reach', x: 9200, z: -6800, mass: 7600, color: '#ffb86b', planets: [['Cinder', 22, 0.025, 1.9, '#d98d66'], ['Aurelia', 34, 0.06, 2.7, '#e7c58b'], ['Morrow', 49, 0.12, 3.2, '#7198d9'], ['Vesper', 68, 0.2, 2.8, '#b9a0d9']] as [string, number, number, number, string][] },
    { name: 'Azure Expanse', x: -15800, z: -12600, mass: 9200, color: '#8bc9ff', planets: [['Nix', 24, 0.03, 2.1, '#8fa8c8'], ['Pelagia', 38, 0.09, 3.3, '#3f9fba'], ['Thalassa', 56, 0.16, 3.1, '#6e8ee0'], ['Glacien', 76, 0.23, 2.6, '#d5e7ef']] as [string, number, number, number, string][] },
    { name: 'Ember Veil', x: 22400, z: 14600, mass: 11000, color: '#ff8067', planets: [['Pyra', 25, 0.035, 2.2, '#d35c45'], ['Solara', 41, 0.08, 3.4, '#d6a46e'], ['Brontes', 61, 0.18, 4.1, '#c08a66'], ['Umber', 83, 0.24, 2.7, '#8b7a72']] as [string, number, number, number, string][] },
    { name: 'Violet Crown', x: -9200, z: 23800, mass: 6800, color: '#c5a0ff', planets: [['Luma', 20, 0.025, 1.8, '#d7c4f4'], ['Orchid', 33, 0.07, 2.8, '#b17ed2'], ['Serein', 52, 0.14, 3.4, '#77a8c8'], ['Noctis', 72, 0.21, 3.0, '#666c9f']] as [string, number, number, number, string][] },
    { name: 'Far Lantern', x: 43800, z: -32000, mass: 8500, color: '#ffe1a0', planets: [['Pico', 23, 0.03, 1.7, '#b9b4a9'], ['Eos', 37, 0.075, 2.9, '#f0d29a'], ['Caldera', 57, 0.15, 3.6, '#bd7358'], ['Aster', 79, 0.22, 3.0, '#9cb5d8']] as [string, number, number, number, string][] },
  ];
  const palette = ['#ffb86b', '#8bc9ff', '#ff8067', '#c5a0ff', '#ffe1a0', '#82e0c4', '#f28fda', '#b8c7ff'];
  const planetPalette = ['#d98d66', '#7198d9', '#b9d4e6', '#e7c58b', '#8fc9a8', '#c27bff', '#d6a46e', '#6e8ee0', '#e6dccb'];
  for (let i = systems.length; i < Math.min(100, systemCount); i++) {
    const angle = i * 2.399963229728653;
    const distance = 56000 + (i - 5) * 18000;
    systems.push({
      name: `Frontier ${String(i + 1).padStart(3, '0')}`,
      x: Math.cos(angle) * distance, z: Math.sin(angle) * distance,
      mass: 5200 + (i * 977) % 7000, color: palette[i % palette.length],
      planets: Array.from({ length: Math.max(1, planetsPerSystem) }, (_, p) => [
        `F${i + 1}-${p + 1}`, 34 + p * 28, 0.025 + p * 0.035, 1.8 + (p % 4) * 0.55,
        planetPalette[(i + p) % planetPalette.length],
      ] as [string, number, number, number, string]),
    });
  }
  for (const [systemIndex, system] of systems.slice(0, Math.min(100, systemCount)).entries()) {
    // Equal-area golden-angle spacing leaves large gaps even at 100 systems.
    // Start well outside the Solar System's planets, belts, and Oort cloud.
    const systemAngle = systemIndex * 2.399963229728653;
    const systemDistance = 120000 * Math.sqrt(systemIndex + 1);
    system.x = Math.cos(systemAngle) * systemDistance;
    system.z = Math.sin(systemAngle) * systemDistance;
    if (system.planets.length > planetsPerSystem) system.planets = system.planets.slice(0, planetsPerSystem);
    while (system.planets.length < planetsPerSystem) {
      const p = system.planets.length;
      system.planets.push([`${system.name.split(' ')[0]}-${p + 1}`, 34 + p * 28, 0.025 + p * 0.035, 1.8 + (p % 4) * 0.55, planetPalette[(p + systems.indexOf(system)) % planetPalette.length]]);
    }
    // Stars carry an explicit surface temperature so the thermal model can estimate their output.
    const star = world.add({ name: system.name, kind: 'sun', x: system.x, y: 0, z: system.z, mass: system.mass, radius: 11 + system.mass / 1800, color: system.color });
    star.temperature = system.mass > 9500 ? 6200 : system.mass > 8000 ? 5400 : system.mass > 7000 ? 4800 : 3900;
    for (let i = 0; i < system.planets.length; i++) {
      const [name, orbit, mass, radius, color] = system.planets[i];
      // Keep orbital distances in world units (not multiplied by the star's drawn radius).
      const orbitalDistance = orbit * 40;
      const x = star.x + orbitalDistance, z = star.z;
      const v = Math.sqrt((G * star.mass) / orbitalDistance);
      world.add({
        name, kind: 'planet', x, y: 0, z,
        vx: 0, vy: 0, vz: v, mass, radius, color, parentId: star.id, orbitR: orbitalDistance,
        orbitSpeed: (i % 2 ? -1 : 1) * (0.18 / Math.sqrt(orbit / 25)),
        orbitPhase: Math.random() * Math.PI * 2, orbitTilt: (Math.random() - 0.5) * 0.16,
      });
    }
  }
  world.placeMoons();
}

/** Main asteroid belt between Mars and Jupiter */
export function addBelt(world: World, n: number, inner = 180, outer = 235) {
  for (let k = 0; k < n; k++) {
    const r = inner + Math.random() * (outer - inner);
    const th = Math.random() * Math.PI * 2, om = Math.random() * Math.PI * 2;
    const i = (Math.random() - 0.5) * 0.14;
    const v = Math.sqrt((G * SUN_MASS) / r) * (1 + (Math.random() - 0.5) * 0.06);
    const [x, y, z] = incline(r * Math.cos(th), 0, r * Math.sin(th), i, om);
    const [vx, vy, vz] = incline(-Math.sin(th) * v, 0, Math.cos(th) * v, i, om);
    world.add({ name: 'Asteroid', kind: 'asteroid', x, y, z, vx, vy, vz, mass: 0.00005, radius: 0.5 + Math.random() * 0.6, color: rock() });
  }
}

/** A cloud of asteroids falling into the inner system */
export function addSwarm(world: World, n: number) {
  const a = Math.random() * Math.PI * 2;
  const cx = Math.cos(a) * 800, cy = (Math.random() - 0.5) * 80, cz = Math.sin(a) * 800;
  for (let k = 0; k < n; k++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const rr = Math.cbrt(Math.random()) * 45;
    world.add({
      name: 'Asteroid', kind: 'asteroid',
      x: cx + s * Math.cos(t) * rr, y: cy + u * rr, z: cz + s * Math.sin(t) * rr,
      vx: -Math.cos(a) * 4.5 - Math.sin(a) * 2.2 + (Math.random() - 0.5) * 0.4,
      vy: -cy * 0.004,
      vz: -Math.sin(a) * 4.5 + Math.cos(a) * 2.2 + (Math.random() - 0.5) * 0.4,
      mass: 0.00005, radius: 0.6 + Math.random() * 0.8, color: rock(),
    });
  }
}

export interface Star { x: number; y: number; z: number; b: number; s: number; c: string; tw: number; ph: number }

export function makeStars(n: number): Star[] {
  const cols = ['#ffffff', '#ffffff', '#cfe0ff', '#ffe9c4', '#ffd0d0', '#b8ccff'];
  const tilt = 0.9;
  return Array.from({ length: n }, (_, k) => {
    let x: number, y: number, z: number;
    const t = Math.random() * Math.PI * 2;
    if (k % 5 < 2) {
      // galactic band
      const h = (Math.random() + Math.random() - 1) * 0.18;
      const bx = Math.cos(t), by = h, bz = Math.sin(t);
      x = bx; y = by * Math.cos(tilt) - bz * Math.sin(tilt); z = by * Math.sin(tilt) + bz * Math.cos(tilt);
    } else {
      const u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u);
      x = s * Math.cos(t); y = u; z = s * Math.sin(t);
    }
    const l = Math.hypot(x, y, z);
    return {
      x: x / l, y: y / l, z: z / l,
      b: 0.25 + Math.random() ** 3 * 0.75,
      s: Math.random() < 0.08 ? 2 : 1,
      c: cols[(Math.random() * cols.length) | 0],
      tw: 0.5 + Math.random() * 2.5, ph: Math.random() * 10,
    };
  });
}

// [planet, name, orbit (× planet radius), radius, color, speed (rad/s)]
const MOONS: [string, string, number, number, string, number][] = [
  ['Earth', 'Moon', 3.2, 1.1, '#cfcac2', 0.9],
  ['Mars', 'Phobos', 2.2, 0.6, '#9a8576', 2.4],
  ['Mars', 'Deimos', 3.4, 0.5, '#b09a88', 1.4],
  ['Jupiter', 'Io', 1.8, 1.0, '#e8d35a', 1.6],
  ['Jupiter', 'Europa', 2.4, 0.9, '#e6dccb', 1.1],
  ['Jupiter', 'Ganymede', 3.1, 1.3, '#a99a86', 0.75],
  ['Jupiter', 'Callisto', 4.0, 1.2, '#7b6e62', 0.5],
  ['Saturn', 'Enceladus', 2.7, 0.6, '#f4f8ff', 1.5],
  ['Saturn', 'Rhea', 3.3, 0.8, '#c9c2b8', 1.0],
  ['Saturn', 'Titan', 4.2, 1.3, '#e0a548', 0.6],
  ['Uranus', 'Titania', 2.6, 0.8, '#b8b0a8', 1.0],
  ['Uranus', 'Oberon', 3.4, 0.8, '#a1968c', 0.7],
  ['Neptune', 'Triton', 2.8, 1.0, '#d8c8c4', -0.9],
];

export function addMoons(world: World, spread = 1) {
  for (const [pn, name, orbitR, radius, color, speed] of MOONS) {
    const p = world.bodies.find((b) => b.name === pn);
    if (!p) continue;
    world.add({ name, kind: 'moon', x: p.x, y: p.y, z: p.z, mass: 0.0004, radius, color, parentId: p.id, orbitR: orbitR * spread, orbitSpeed: speed / Math.sqrt(spread), orbitPhase: Math.random() * 6.28, orbitTilt: (Math.random() - 0.5) * 0.3 });
  }
  world.placeMoons();
}

const ICE = ['#b9d4e6', '#d6e2ea', '#9fb6c9', '#c9c0d8'];

/** Icy Kuiper belt beyond Neptune (Ultra only) */
export function addKuiper(world: World, n: number) {
  addBelt(world, n, 16500, 22000);
  for (const b of world.bodies.slice(-n)) { b.color = ICE[(Math.random() * ICE.length) | 0]; b.name = 'Kuiper Object'; }
  const pluto = world.bodies[world.bodies.length - 1];
  pluto.name = 'Pluto'; pluto.radius = 1.6; pluto.color = '#d9c4a8';
}

/** A few comets on long, stretched orbits (Ultra only) */
export function addComets(world: World) {
  const names = ['Comet Halley', 'Comet Hale-Bopp', 'Comet Encke', 'Comet NEOWISE', 'Comet Swift-Tuttle'];
  names.forEach((name, i) => {
    const r = 900 + i * 350, th = Math.random() * Math.PI * 2;
    const v = Math.sqrt((G * SUN_MASS) / r) * (0.3 + Math.random() * 0.15);
    const inc = (Math.random() - 0.5) * 0.8;
    world.add({
      name, kind: 'asteroid', x: r * Math.cos(th), y: r * Math.sin(th) * Math.sin(inc), z: r * Math.sin(th) * Math.cos(inc),
      vx: -Math.sin(th) * v, vy: Math.cos(th) * v * Math.sin(inc), vz: Math.cos(th) * v * Math.cos(inc),
      mass: 0.00005, radius: 1.2, color: '#dff4ff',
    });
  });
}