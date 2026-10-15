import { Kind } from './engine';
import { EARTH_MASS } from './setup';

export interface SpawnSpec {
  id: string;
  name: string;
  kind: Kind;
  mass: number;
  radius: number;
  color: string;
  ring?: boolean;
  habitable?: boolean;
  temperature?: number;
  orbit: boolean;
  count?: number;
  desc: string;
}

const E = EARTH_MASS;

export const CATEGORIES: { id: string; label: string; items: SpawnSpec[] }[] = [
  {
    id: 'solar', label: 'Solar System', items: [
      { id: 'sun', name: 'Sun', kind: 'sun', mass: 10000, radius: 14, color: '#ffc04d', orbit: false, desc: 'Our star' },
      { id: 'mercury', name: 'Mercury', kind: 'planet', mass: 0.0017, radius: 2, color: '#b1a89c', orbit: true, desc: 'Tiny & scorched' },
      { id: 'venus', name: 'Venus', kind: 'planet', mass: 0.024, radius: 3.2, color: '#e8c48a', orbit: true, desc: 'Greenhouse hell' },
      { id: 'earth', name: 'Earth', kind: 'planet', mass: 0.03, radius: 3.4, color: '#4f8fe0', orbit: true, desc: 'Home' },
      { id: 'moon', name: 'Moon', kind: 'planet', mass: 0.0004, radius: 1.1, color: '#cfcac2', orbit: true, desc: 'Free-floating moon' },
      { id: 'mars', name: 'Mars', kind: 'planet', mass: 0.0032, radius: 2.5, color: '#d4643a', orbit: true, desc: 'The red planet' },
      { id: 'jupiter', name: 'Jupiter', kind: 'planet', mass: 9.5, radius: 9, color: '#d9a46c', orbit: true, desc: 'King of planets' },
      { id: 'saturn', name: 'Saturn', kind: 'planet', mass: 2.86, radius: 7.5, color: '#e6cf92', ring: true, orbit: true, desc: 'Ringed giant' },
      { id: 'uranus', name: 'Uranus', kind: 'planet', mass: 0.44, radius: 5, color: '#8fd8e0', orbit: true, desc: 'Sideways ice giant' },
      { id: 'neptune', name: 'Neptune', kind: 'planet', mass: 0.51, radius: 5, color: '#4a6cf0', orbit: true, desc: 'Windy & blue' },
      { id: 'pluto', name: 'Pluto', kind: 'planet', mass: 0.00007, radius: 1.4, color: '#d9c4a8', orbit: true, desc: 'Dwarf planet' },
      { id: 'ceres', name: 'Ceres', kind: 'planet', mass: 0.00003, radius: 1.0, color: '#9c9890', orbit: true, desc: 'Belt dwarf' },
      { id: 'eris', name: 'Eris', kind: 'planet', mass: 0.00008, radius: 1.3, color: '#e8e4dc', orbit: true, desc: 'Far dwarf planet' },
    ],
  },
  {
    id: 'stars', label: 'Stars & Exotic', items: [
      { id: 'reddwarf', name: 'Red Dwarf', kind: 'sun', mass: 3000, radius: 8, color: '#ff6a3d', temperature: 3000, orbit: true, desc: 'Small cool star' },
      { id: 'bluegiant', name: 'Blue Giant', kind: 'sun', mass: 40000, radius: 26, color: '#8fc4ff', temperature: 25000, orbit: false, desc: 'Huge & hot' },
      { id: 'whitedwarf', name: 'White Dwarf', kind: 'sun', mass: 6000, radius: 3, color: '#eef6ff', temperature: 10000, orbit: true, desc: 'Dead star core' },
      { id: 'neutron', name: 'Neutron Star', kind: 'sun', mass: 14000, radius: 2, color: '#bfe4ff', temperature: 30000, orbit: true, desc: 'City-sized, super dense' },
      { id: 'bh', name: 'Black Hole', kind: 'blackhole', mass: 3000, radius: 6, color: '#c58bff', orbit: false, desc: 'Eats everything' },
      { id: 'smbh', name: 'Supermassive Black Hole', kind: 'blackhole', mass: 60000, radius: 20, color: '#c58bff', orbit: false, desc: 'End of the world' },
      { id: 'minibh', name: 'Micro Black Hole', kind: 'blackhole', mass: 200, radius: 3, color: '#c58bff', orbit: true, desc: 'Small but hungry' },
    ],
  },
  {
    id: 'types', label: 'Planet Types', items: [
      { id: 'lava', name: 'Lava World', kind: 'planet', mass: E * 1.5, radius: 3.6, color: '#e2481f', temperature: 900, orbit: true, desc: 'Molten surface' },
      { id: 'ocean', name: 'Ocean World', kind: 'planet', mass: E * 1.2, radius: 3.8, color: '#2a78d8', habitable: true, temperature: 18, orbit: true, desc: 'Endless seas' },
      { id: 'desert', name: 'Desert World', kind: 'planet', mass: E * 0.8, radius: 3.2, color: '#d8b06a', temperature: 55, orbit: true, desc: 'Dunes everywhere' },
      { id: 'ice', name: 'Ice World', kind: 'planet', mass: E * 0.9, radius: 3.4, color: '#d4ecf7', temperature: -180, orbit: true, desc: 'Frozen solid' },
      { id: 'jungle', name: 'Jungle World', kind: 'planet', mass: E * 1.1, radius: 3.5, color: '#3c9a48', habitable: true, temperature: 28, orbit: true, desc: 'Lush & alive' },
      { id: 'superearth', name: 'Super-Earth', kind: 'planet', mass: E * 6, radius: 5, color: '#5aa0a8', habitable: true, temperature: 15, orbit: true, desc: 'Big rocky world' },
      { id: 'hotjupiter', name: 'Hot Jupiter', kind: 'planet', mass: 8, radius: 9.5, color: '#c8603a', temperature: 1200, orbit: true, desc: 'Roasting gas giant' },
      { id: 'ringed', name: 'Ringed Giant', kind: 'planet', mass: 3, radius: 7, color: '#b49ae0', ring: true, orbit: true, desc: 'Purple with rings' },
      { id: 'rogue', name: 'Rogue Planet', kind: 'planet', mass: E * 3, radius: 4, color: '#4a4f66', temperature: -230, orbit: false, desc: 'Drifts with no star' },
    ],
  },
  {
    id: 'small', label: 'Small Stuff', items: [
      { id: 'asteroid', name: 'Asteroid', kind: 'asteroid', mass: 0.00005, radius: 1, color: '#8a8278', orbit: true, desc: 'One space rock' },
      { id: 'cluster', name: 'Asteroid', kind: 'asteroid', mass: 0.00005, radius: 0.9, color: '#a39a8e', orbit: true, count: 60, desc: 'Cloud of 60 rocks' },
      { id: 'bigrock', name: 'Big Asteroid', kind: 'asteroid', mass: 0.002, radius: 2.2, color: '#7d7468', orbit: true, desc: 'Has its own gravity' },
      { id: 'comet', name: 'Comet', kind: 'asteroid', mass: 0.00005, radius: 1.2, color: '#dff4ff', orbit: true, desc: 'Icy, with a tail (Ultra)' },
      { id: 'dyson', name: 'Space Station', kind: 'asteroid', mass: 0.00001, radius: 0.8, color: '#e6ecff', orbit: true, desc: 'Tiny orbiting base' },
    ],
  },
];