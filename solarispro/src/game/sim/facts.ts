export interface PlanetFacts { type: string; day: string; year: string; moons: string; temp: number; pop: number; habitable: boolean; facts: string[] }

export const FACTS: Record<string, PlanetFacts> = {
  Sun: { type: 'G-type star', day: '25–35 days', year: '—', moons: '8 planets', temp: 5500, pop: 0, habitable: false, facts: ['Holds 99.86% of the solar system’s mass.', 'Light from it takes about 8 minutes to reach Earth.', 'Its core reaches about 15 million °C.'] },
  Mercury: { type: 'Rocky planet', day: '59 Earth days', year: '88 days', moons: '0', temp: 167, pop: 0, habitable: false, facts: ['Smallest planet and closest to the Sun.', 'Swings from 430 °C in the day to −180 °C at night.', 'Has almost no atmosphere.'] },
  Venus: { type: 'Rocky planet', day: '243 Earth days', year: '225 days', moons: '0', temp: 464, pop: 0, habitable: false, facts: ['Hottest planet because of a runaway greenhouse effect.', 'Spins backwards compared to most planets.', 'A day there is longer than its year.'] },
  Earth: { type: 'Rocky planet', day: '24 hours', year: '365 days', moons: '1', temp: 15, pop: 8.1e9, habitable: true, facts: ['The only known world with life.', '71% of the surface is covered in water.', 'Its magnetic field shields life from solar wind.'] },
  Mars: { type: 'Rocky planet', day: '24.6 hours', year: '687 days', moons: '2', temp: -65, pop: 0, habitable: false, facts: ['Home to Olympus Mons, the tallest volcano in the solar system.', 'Its red color comes from iron oxide (rust).', 'Several rovers are exploring it right now.'] },
  Jupiter: { type: 'Gas giant', day: '10 hours', year: '12 years', moons: '95', temp: -110, pop: 0, habitable: false, facts: ['Largest planet: over 1,300 Earths could fit inside.', 'The Great Red Spot is a storm bigger than Earth.', 'Its gravity shields the inner planets from comets.'] },
  Saturn: { type: 'Gas giant', day: '10.7 hours', year: '29 years', moons: '146', temp: -140, pop: 0, habitable: false, facts: ['Its rings are mostly ice and rock.', 'It is less dense than water.', 'Has more known moons than any other planet.'] },
  Uranus: { type: 'Ice giant', day: '17 hours', year: '84 years', moons: '28', temp: -195, pop: 0, habitable: false, facts: ['Rotates on its side, tilted about 98°.', 'Coldest planetary atmosphere in the solar system.', 'Methane gives it a blue-green color.'] },
  Neptune: { type: 'Ice giant', day: '16 hours', year: '165 years', moons: '16', temp: -200, pop: 0, habitable: false, facts: ['Has the fastest winds: over 2,000 km/h.', 'Found by math before it was seen.', 'One year there is 165 Earth years.'] },
};

export const DEFAULT_FACTS: PlanetFacts = { type: 'Custom world', day: 'Unknown', year: 'Depends on orbit', moons: '0', temp: 15, pop: 0, habitable: false, facts: ['A world you created in this sandbox.', 'Make it habitable and keep it near 15 °C to grow a population.', 'Raise its mass to make it pull harder on its neighbors.'] };

const MOON: Record<string, string> = {
  Moon: 'Stabilizes Earth’s tilt and drives the ocean tides.', Phobos: 'Slowly spiraling into Mars; it will break apart in ~50 million years.',
  Deimos: 'One of the smallest moons, just 12 km across.', Io: 'The most volcanic place in the solar system.',
  Europa: 'Hides a salty ocean under its ice. A top spot to look for life.', Ganymede: 'Largest moon in the solar system, bigger than Mercury.',
  Callisto: 'One of the most heavily cratered surfaces known.', Enceladus: 'Sprays geysers of water ice into space.',
  Rhea: 'An icy moon that may have faint rings of its own.', Titan: 'Has a thick atmosphere and lakes of liquid methane.',
  Titania: 'Largest moon of Uranus, covered in huge canyons.', Oberon: 'An old, icy, cratered moon of Uranus.',
  Triton: 'Orbits backwards and has nitrogen geysers.',
};

export const factsFor = (name: string): PlanetFacts =>
  FACTS[name] ?? (MOON[name] ? { ...DEFAULT_FACTS, type: 'Moon', day: 'Tidally locked', year: '—', moons: '—', temp: -150, facts: [MOON[name], 'Shown farther out than in real life so you can see it next to its planet.'] } : DEFAULT_FACTS);

/** How livable a temperature is, 0..1 */
export const suitability = (t: number) => Math.max(0, 1 - Math.abs(t - 15) / 55);