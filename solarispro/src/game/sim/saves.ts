import type { Sim } from './sim';

export type SaveData = ReturnType<Sim['serialize']>;
export interface SaveMeta { id: string; name: string; savedAt: number; bodies: number; ultra: boolean }

const INDEX = 'solarpixel:saves';
const PREFS = 'solarpixel:prefs';
const key = (id: string) => `solarpixel:save:${id}`;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validMeta = (value: unknown): value is SaveMeta => isRecord(value)
  && typeof value['id'] === 'string' && value['id'].length > 0
  && typeof value['name'] === 'string'
  && typeof value['savedAt'] === 'number' && Number.isFinite(value['savedAt']) && Number.isFinite(new Date(value['savedAt']).getTime())
  && typeof value['bodies'] === 'number' && Number.isFinite(value['bodies'])
  && typeof value['ultra'] === 'boolean';

export function listSaves(): SaveMeta[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INDEX) || '[]');
    return Array.isArray(parsed) ? parsed['filter'](validMeta).sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch { return []; }
}

export function writeSave(name: string, data: SaveData, id?: string): SaveMeta {
  const safeName = name.trim().slice(0, 60) || 'Untitled Universe';
  const meta: SaveMeta = { id: id ?? crypto.randomUUID(), name: safeName, savedAt: Date.now(), bodies: data.bodies.length, ultra: data.ultra };
  // Write the universe before updating the index, so the index never points to a partial save.
  localStorage.setItem(key(meta.id), JSON.stringify(data));
  const next = [meta, ...listSaves().filter((s) => s.id !== meta.id)];
  localStorage.setItem(INDEX, JSON.stringify(next));
  return meta;
}

export function readSave(id: string): SaveData | null {
  try {
    if (typeof id !== 'string' || !id || id.length > 200) return null;
    const parsed: unknown = JSON.parse(localStorage.getItem(key(id)) || 'null');
    const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const validBody = (value: unknown) => {
      if (!isRecord(value)) return false;
      // Reject corrupt saves before they can poison the physics loop with NaN/Infinity.
      for (const field of ['id', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'mass', 'radius']) {
        if (!finite(value[field])) return false;
      }
      const bodyId = value['id'], mass = value['mass'], radius = value['radius'];
      if (!finite(bodyId) || !finite(mass) || !finite(radius)) return false;
      const optionalNumbers = ['baseMass', 'baseRadius', 'temperature', 'population', 'orbitR', 'orbitSpeed', 'orbitPhase', 'orbitTilt', 'heatBase', 'extremeHeatTime', 'collapseTime', 'wormholeTime'];
      if (optionalNumbers.some((field) => value[field] !== undefined && !finite(value[field]))) return false;
      if (value['parentId'] !== undefined && value['parentId'] !== null && !finite(value['parentId'])) return false;
      return bodyId > 0 && typeof value['name'] === 'string' && value['name'].length <= 200
        && ['sun', 'planet', 'moon', 'asteroid', 'blackhole', 'wormhole'].includes(String(value['kind']))
        && mass >= 0 && radius > 0
        && typeof value['alive'] === 'boolean' && typeof value['color'] === 'string'
        && (value['trail'] === undefined || Array.isArray(value['trail']) && value['trail'].length <= 10000 && value['trail'].every(finite));
    };
    const validCamera = parsed && isRecord(parsed) && parsed['cam'] !== undefined
      ? isRecord(parsed['cam']) && finite(parsed['cam']['yaw']) && finite(parsed['cam']['pitch']) && finite(parsed['cam']['targetDist']) && parsed['cam']['targetDist'] > 0
      : true;
    if (!isRecord(parsed) || !Array.isArray(parsed['bodies']) || parsed['bodies'].length > 10000
      || !parsed['bodies'].every(validBody)
      || !finite(parsed['time']) || parsed['time'] < 0
      || !finite(parsed['nextId']) || parsed['nextId'] < 1
      || (parsed['moonTime'] !== undefined && !finite(parsed['moonTime'])) || !validCamera) return null;
    return parsed as unknown as SaveData;
  } catch { return null; }
}

export function deleteSave(id: string) {
  try {
    localStorage.removeItem(key(id));
    localStorage.setItem(INDEX, JSON.stringify(listSaves().filter((s) => s.id !== id)));
  } catch {
    // Storage can be disabled or full; keep the UI usable even if cleanup cannot persist.
  }
}

export interface Prefs { mode: 'ultra'; prediction: boolean; horizonYears: number; trails: boolean; labels: boolean; orbitAssist: boolean; travel: boolean; universeSystems: number; planetsPerSystem: number; graphicsQuality: number; }
export const defaultPrefs: Prefs = { mode: 'ultra', prediction: true, horizonYears: 1, trails: true, labels: true, orbitAssist: true, travel: false, universeSystems: 5, planetsPerSystem: 4, graphicsQuality: 80 };
export function loadPrefs(): Prefs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFS) || '{}');
    const p = isRecord(parsed) ? parsed : {};
    const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
    return {
      mode: 'ultra',
      prediction: bool(p['prediction'], defaultPrefs.prediction),
      horizonYears: bounded(p['horizonYears'], defaultPrefs.horizonYears, 0.1, 3),
      trails: bool(p['trails'], defaultPrefs.trails),
      labels: bool(p['labels'], defaultPrefs.labels),
      orbitAssist: bool(p['orbitAssist'], defaultPrefs.orbitAssist),
      travel: bool(p['travel'], defaultPrefs.travel),
      universeSystems: Math.round(bounded(p['universeSystems'], defaultPrefs.universeSystems, 0, 100)),
      planetsPerSystem: Math.round(bounded(p['planetsPerSystem'], defaultPrefs.planetsPerSystem, 1, 12)),
      graphicsQuality: Math.round(bounded(p['graphicsQuality'], defaultPrefs.graphicsQuality, 10, 150) / 5) * 5,
    };
  } catch { return { ...defaultPrefs }; }
}
export function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* Keep in-memory settings usable if storage is unavailable. */ }
}