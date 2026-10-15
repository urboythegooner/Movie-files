import { createNoise3D } from 'simplex-noise';
import type { Body } from './engine';
import type { Camera } from './camera';
import type { Sim } from './sim';

type Vec = [number, number, number];
type RGB = [number, number, number];
const TAU = Math.PI * 2;
const stellarFrames = new Map<number, { canvas: HTMLCanvasElement; key: string }>();
const stellarMaps = new Map<string, Uint8ClampedArray>();
const MAP_W = 512, MAP_H = 256;
const palettes = {
  solar: [[116, 32, 5], [241, 133, 24], [255, 230, 139]],
  red: [[87, 12, 8], [231, 63, 24], [255, 166, 87]],
  blue: [[21, 67, 136], [93, 170, 240], [225, 244, 255]],
} satisfies Record<string, RGB[]>;

/** Stable object-local axes, never derived from the viewer. */
export function cosmicAxes(id: number): { u: Vec; v: Vec; n: Vec } {
  const tilt = 0.38 + (id % 7) * 0.09, yaw = id * 2.399963;
  const u: Vec = [Math.cos(yaw), 0, Math.sin(yaw)];
  const v: Vec = [-Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
  return { u, v, n: [-Math.sin(yaw) * Math.sin(tilt), -Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt)] };
}

/** Convert a visible sphere normal into world space; pitch and yaw both matter. */
export function sphereWorldNormal(cam: Camera, x: number, y: number, z: number): Vec {
  return [x * cam.rx - y * cam.ux - z * cam.fx, x * cam.ry - y * cam.uy - z * cam.fy, x * cam.rz - y * cam.uz - z * cam.fz];
}

function stellarTexture(b: Body) {
  const kind = /blue|white|neutron/i.test(b.name) ? 'blue' : /red/i.test(b.name) ? 'red' : 'solar';
  const key = `${b.id}:${kind}`;
  const cached = stellarMaps.get(key);
  if (cached) return cached;
  let seed = b.id * 7919 + 17;
  const noise = createNoise3D(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  const map = new Uint8ClampedArray(MAP_W * MAP_H * 3), colors = palettes[kind];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const lat = (y / (MAP_H - 1) - 0.5) * Math.PI, lon = x / MAP_W * TAU;
    const nx = Math.cos(lat) * Math.cos(lon), ny = Math.sin(lat), nz = Math.cos(lat) * Math.sin(lon);
    const coarse = noise(nx * 5, ny * 5, nz * 5);
    const cells = noise(nx * 48, ny * 48, nz * 48);
    const fine = noise(nx * 115, ny * 115, nz * 115);
    let heat = Math.max(0, Math.min(1, 0.57 + coarse * 0.16 + cells * 0.26 + fine * 0.08));
    // Persistent sunspot groups on the sphere, rather than dots stuck to the screen.
    if (coarse < -0.48 && Math.abs(ny) < 0.68) heat *= 0.23;
    const index = heat < 0.5 ? 0 : 1, blend = heat < 0.5 ? heat * 2 : (heat - 0.5) * 2;
    for (let c = 0; c < 3; c++) map[(y * MAP_W + x) * 3 + c] = colors[index][c] * (1 - blend) + colors[index + 1][c] * blend;
  }
  if (stellarMaps.size >= 128) stellarMaps.clear();
  stellarMaps.set(key, map);
  return map;
}

export function drawStellarSphere(ctx: CanvasRenderingContext2D, sim: Sim, b: Body, sx: number, sy: number, r: number) {
  const cam = sim.camera;
  const size = r < 20 ? 64 : r < 75 ? 128 : r < 180 ? 256 : sim.settings.graphicsQuality > 100 ? 512 : 384;
  const spin = sim.world.time * 0.025 + b.id * 0.71;
  const key = `${size}:${cam.yaw.toFixed(3)}:${cam.pitch.toFixed(3)}:${spin.toFixed(2)}:${b.name}`;
  let frame = stellarFrames.get(b.id);
  if (!frame) {
    if (stellarFrames.size >= 128) stellarFrames.clear();
    frame = { canvas: document.createElement('canvas'), key: '' }; stellarFrames.set(b.id, frame);
  }
  if (frame.key !== key) {
    frame.canvas.width = frame.canvas.height = size;
    const target = frame.canvas.getContext('2d');
    if (!target) return;
    const image = target.createImageData(size, size), map = stellarTexture(b);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size * 2 - 1, ny = (y + 0.5) / size * 2 - 1, d = nx * nx + ny * ny;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d), normal = sphereWorldNormal(cam, nx, ny, nz);
      const lon = ((Math.atan2(normal[2], normal[0]) - spin) % TAU + TAU) % TAU;
      const lat = Math.asin(Math.max(-1, Math.min(1, normal[1])));
      const texel = (Math.min(MAP_H - 1, Math.floor((lat / Math.PI + 0.5) * MAP_H)) * MAP_W + Math.floor(lon / TAU * MAP_W)) * 3;
      const out = (y * size + x) * 4, limb = 0.42 + 0.58 * Math.pow(nz, 0.48);
      for (let c = 0; c < 3; c++) image.data[out + c] = map[texel + c] * limb;
      image.data[out + 3] = Math.min(255, (1 - d) * size * 255);
    }
    target.putImageData(image, 0, 0); frame.key = key;
  }
  ctx.drawImage(frame.canvas, sx - r, sy - r, r * 2, r * 2);
}

type Patch = { points: number[]; depth: number; color: string };
function localPoint(b: Body, u: Vec, v: Vec, n: Vec, a: number, radius: number, height = 0): Vec {
  const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
  return [b.x + u[0] * x + v[0] * y + n[0] * height, b.y + u[1] * x + v[1] * y + n[1] * height, b.z + u[2] * x + v[2] * y + n[2] * height];
}

function projectedPatch(cam: Camera, vertices: Vec[], color: string): Patch | null {
  const points: number[] = []; let depth = 0;
  for (const p of vertices) {
    const z = cam.project(...p);
    if (z <= 0) return null;
    points.push(cam.sx, cam.sy); depth += z;
  }
  return { points, depth: depth / vertices.length, color };
}

function paintPatches(ctx: CanvasRenderingContext2D, patches: Patch[]) {
  for (const patch of patches) {
    ctx.fillStyle = ctx.strokeStyle = patch.color;
    ctx.lineWidth = 0.45;
    ctx.beginPath(); ctx.moveTo(patch.points[0], patch.points[1]);
    for (let i = 2; i < patch.points.length; i += 2) ctx.lineTo(patch.points[i], patch.points[i + 1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

/** Actual inclined annulus/torus vertices, perspective projected and depth sorted. */
export function drawExoticObject(ctx: CanvasRenderingContext2D, sim: Sim, b: Body, sx: number, sy: number, r: number, centerDepth: number) {
  const cam = sim.camera, wormhole = b.kind === 'wormhole', { u, v, n } = cosmicAxes(b.id);
  const patches: Patch[] = [], segments = r > 35 ? 112 : 64, bands = wormhole ? 20 : 16;
  const time = sim.world.time * 0.1;
  const coreRadius = Math.max(r, 1.8);
  ctx.save();
  // Only optical bloom is screen-space; the luminous material is world-oriented.
  const halo = ctx.createRadialGradient(sx, sy, coreRadius, sx, sy, coreRadius * 4.5);
  halo.addColorStop(0, wormhole ? 'rgba(85,220,240,0.14)' : 'rgba(255,162,66,0.12)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sx, sy, coreRadius * 4.5, 0, TAU); ctx.fill();
  for (let j = 0; j < bands; j++) for (let i = 0; i < segments; i++) {
    const a = i / segments * TAU, a1 = (i + 1) / segments * TAU;
    const q = j / bands, q1 = (j + 1) / bands;
    let vertices: Vec[];
    if (wormhole) {
      // Thick toroidal mouth: the far wall and near wall have real thickness.
      const point = (angle: number, cross: number) => localPoint(b, u, v, n, angle, b.radius * (1.45 + Math.cos(cross * TAU) * 0.42), Math.sin(cross * TAU) * b.radius * 0.42);
      vertices = [point(a, q), point(a1, q), point(a1, q1), point(a, q1)];
    } else {
      const inner = b.radius * (1.25 + q * 3.1), outer = b.radius * (1.25 + q1 * 3.1);
      vertices = [localPoint(b, u, v, n, a, inner), localPoint(b, u, v, n, a1, inner), localPoint(b, u, v, n, a1, outer), localPoint(b, u, v, n, a, outer)];
    }
    const turbulence = 0.5 + 0.5 * Math.sin(a * 31 + q * 53 - time * 2 + Math.sin(a * 7 + q * 19) * 2);
    const strand = 0.5 + 0.5 * Math.sin(q * 180 + a * 3 - time);
    const hot = (0.55 + turbulence * 0.3 + strand * 0.15) * (wormhole ? 0.55 + Math.sin(q * TAU) * 0.28 : 1 - q * 0.65);
    const color = wormhole ? `rgb(${Math.round(35 + hot * 115)},${Math.round(65 + hot * 180)},${Math.round(110 + hot * 140)})` : `rgb(${Math.round(95 + hot * 160)},${Math.round(25 + hot * 195)},${Math.round(8 + hot * 100)})`;
    const patch = projectedPatch(cam, vertices, color);
    if (patch) patches.push(patch);
  }
  patches.sort((a, b) => b.depth - a.depth);
  paintPatches(ctx, patches.filter(p => p.depth >= centerDepth));
  if (wormhole) {
    // Recessed throat spans the object's local plane, not a camera-facing ellipse.
    const vertices = Array.from({ length: segments }, (_, i) => localPoint(b, u, v, n, i / segments * TAU, b.radius * 1.15));
    const throat = projectedPatch(cam, vertices, 'rgb(2,7,15)');
    if (throat) paintPatches(ctx, [throat]);
  } else {
    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.beginPath(); ctx.arc(sx, sy, coreRadius, 0, TAU); ctx.fill();
    // A spherical shadow remains circular; its accretion disk does not.
    ctx.strokeStyle = 'rgba(255,229,175,0.72)'; ctx.lineWidth = Math.max(0.7, r * 0.018); ctx.stroke();
  }
  paintPatches(ctx, patches.filter(p => p.depth < centerDepth));
  ctx.restore();
}