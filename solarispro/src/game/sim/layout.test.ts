import { describe, expect, it } from 'vitest';
import { World } from './engine';
import { addDistantSystems, addKuiper, createSolarSystem } from './setup';

describe('Solar-system layout', () => {
  it('keeps the eight planets in solar-system order', () => {
    const world = new World();
    createSolarSystem(world);
    const planets = world.bodies.filter(b => b.kind === 'planet').sort((a, b) => Math.hypot(a.x, a.y, a.z) - Math.hypot(b.x, b.y, b.z));
    expect(planets.map(b => b.name)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
  });

  it('places the Kuiper belt outside Neptune', () => {
    const world = new World();
    addKuiper(world, 40);
    for (const b of world.bodies) expect(Math.hypot(b.x, b.y, b.z)).toBeGreaterThan(15000);
  });

  it('does not multiply distant planet orbits by stellar radius', () => {
    const world = new World();
    addDistantSystems(world, 2, 4);
    for (const b of world.bodies.filter(b => b.kind === 'planet')) {
      const parent = world.bodies.find(p => p.id === b.parentId);
      expect(parent).toBeDefined();
      if (!parent) continue;
      expect(Math.hypot(b.x - parent.x, b.y - parent.y, b.z - parent.z)).toBeCloseTo(b.orbitR, 6);
    }
  });

  it('preserves moon distances as planet-radius multiples', () => {
    const world = new World();
    createSolarSystem(world);
    const moon = world.bodies.find(b => b.name === 'Moon');
    const earth = world.bodies.find(b => b.name === 'Earth');
    expect(moon).toBeDefined();
    expect(earth).toBeDefined();
    if (!moon || !earth) return;
    expect(Math.hypot(moon.x - earth.x, moon.y - earth.y, moon.z - earth.z)).toBeCloseTo(earth.radius * moon.orbitR, 6);
  });

  it('keeps all 100 distant systems widely separated from the Sun and one another', () => {
    const world = new World();
    createSolarSystem(world);
    addDistantSystems(world, 100, 12);
    const stars = world.bodies.filter(b => b.kind === 'sun');
    expect(stars).toHaveLength(101);
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        expect(Math.hypot(stars[i].x - stars[j].x, stars[i].z - stars[j].z)).toBeGreaterThanOrEqual(100000);
      }
    }
    for (const star of stars.slice(1)) {
      const planets = world.bodies.filter(b => b.kind === 'planet' && b.parentId === star.id);
      expect(planets).toHaveLength(12);
      for (const planet of planets) {
        const distance = Math.hypot(planet.x - star.x, planet.y - star.y, planet.z - star.z);
        expect(distance).toBeCloseTo(planet.orbitR, 6);
        expect(planet.orbitR).toBeGreaterThanOrEqual(800);
        expect(distance).toBeLessThan(15000);
      }
    }
  });
});