import { createNoise3D } from 'simplex-noise';
import type { Body } from './engine';
import type { Sim } from './sim';
import { hexToRgb } from './colors';

type RGB = [number, number, number];
const maps = new Map<string, Uint8ClampedArray>();
const frames = new Map<number, { canvas: HTMLCanvasElement; key: string }>();
const W = 384, H = 192;
const mix = (a: RGB, b: RGB, k: number): RGB => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, k))) as RGB;

function terrain(b: Body) {
   const key = `${b.id}:${b.name}:${b.color}:${b.habitable}`;
  const found = maps.get(key);
  if (found) return found;
  let seed = b.id * 7919 + 137;
  const noise = createNoise3D(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  const pixels = new Uint8ClampedArray(W * H * 4);
  const gas = /jupiter|saturn|uranus|neptune|gas/i.test(b.name);
  const earth = b.name === 'Earth' || b.habitable;
  const base = hexToRgb(b.color.startsWith('#') ? b.color : '#87949f');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lon = x / W * Math.PI * 2, lat = (y / (H - 1) - 0.5) * Math.PI;
    const nx = Math.cos(lon) * Math.cos(lat), ny = Math.sin(lat), nz = Math.sin(lon) * Math.cos(lat);
    const n = noise(nx * 3, ny * 3, nz * 3) * .62 + noise(nx * 7, ny * 7, nz * 7) * .25 + noise(nx * 19, ny * 19, nz * 19) * .13;
    let color: RGB;
    if (earth) {
      color = n > .035 ? mix([41, 84, 48], [163, 148, 93], Math.max(0, n) * 2.5) : mix([9, 35, 86], [18, 112, 148], (n + .45) * 1.1);
      if (Math.abs(ny) > .91 + n * .08) color = [218, 237, 242];
      const clouds = noise(nx * 6 + .6, ny * 8, nz * 6) + .28 * noise(nx * 18, ny * 18, nz * 18);
      if (clouds > .24) color = mix(color, [240, 245, 246], Math.min(.94, (clouds - .24) * 2.3));
    } else if (gas) {
      const stripe = Math.sin(lat * 46 + n * 3.2) * .5 + Math.sin(lat * 93 + n * 1.5) * .16;
      color = mix(base, stripe > 0 ? [241, 222, 183] : [91, 62, 47], Math.abs(stripe) * .56);
      if (/neptune|uranus/i.test(b.name)) color = mix(base, stripe > 0 ? [183, 228, 239] : [17, 74, 139], Math.abs(stripe) * .28);
      if (b.name === 'Jupiter' && Math.hypot((lon - 1.3) * .7, (lat + .35) * 2) < .21) color = mix(color, [180, 77, 46], .7);
    } else {
      color = mix(base, n > 0 ? [217, 192, 159] : [37, 36, 40], Math.abs(n) * .65);
      const fine = noise(nx * 58, ny * 58, nz * 58) * .09;
      color = color.map(v => Math.max(0, Math.min(255, v * (1 + fine)))) as RGB;
    }
    const i = (y * W + x) * 4;
    pixels.set([...color, 255], i);
  }
  if (maps.size > 160) maps.clear();
  maps.set(key, pixels);
  return pixels;
}

/** Sphere normals are lit by the strongest star in world space, including its camera-depth phase. */
export function drawPhotographicSurface(ctx: CanvasRenderingContext2D, b: Body, sim: Sim, sx: number, sy: number, r: number, t: number) {
  const cam = sim.camera;
  let star: Body | undefined, energy = 0;
  for (const candidate of sim.world.bodies) {
    if (candidate.kind !== 'sun') continue;
    const e = candidate.radius ** 2 / Math.max(1, (candidate.x-b.x)**2 + (candidate.y-b.y)**2 + (candidate.z-b.z)**2);
    if (e > energy) { energy = e; star = candidate; }
  }
  const dx = (star?.x ?? 0)-b.x, dy = (star?.y ?? 0)-b.y, dz = (star?.z ?? 0)-b.z;
  const length = Math.hypot(dx,dy,dz) || 1;
  const lx = (dx*cam.rx + dy*cam.ry + dz*cam.rz)/length;
  const ly = -(dx*cam.ux + dy*cam.uy + dz*cam.uz)/length;
  const lz = -(dx*cam.fx + dy*cam.fy + dz*cam.fz)/length;
  const quality = sim.settings.graphicsQuality ?? 80;
  const size = r < 24 ? 64 : r < 70 ? 128 : r < 150 ? 256 : quality > 100 ? 512 : 384;
  const spin = t * .06 + b.id - Math.atan2(cam.pz-b.z,cam.px-b.x);
  const key = `${size}:${Math.floor(spin*40)}:${lx.toFixed(2)}:${ly.toFixed(2)}:${lz.toFixed(2)}:${b.name}:${b.color}:${b.habitable}`;
  let frame = frames.get(b.id);
  if (!frame) { frame = {canvas: document.createElement('canvas'),key:''}; frames.set(b.id,frame); }
  if (frame.key !== key) {
    frame.key = key;
    frame.canvas.width = size; frame.canvas.height = size;
    const target = frame.canvas.getContext('2d');
    if (!target) return;
    const image = target.createImageData(size,size), map = terrain(b);
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const nx=(x+.5)/size*2-1, ny=(y+.5)/size*2-1, rr=nx*nx+ny*ny;
      if (rr>1) continue;
      const nz=Math.sqrt(1-rr), lambert=nx*lx+ny*ly+nz*lz;
      const lon=((Math.atan2(nx,nz)+spin)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      const lat=Math.asin(-ny);
      const index=(Math.min(H-1,Math.floor((lat/Math.PI+.5)*H))*W+Math.floor(lon/(Math.PI*2)*W))*4;
      const light=.16+.86*Math.pow(Math.max(0,lambert),.65);
      const edge=.76+.24*Math.pow(nz,.3);
      const out=(y*size+x)*4;
      for(let c=0;c<3;c++) image.data[out+c]=Math.min(255,map[index+c]*light*edge);
      image.data[out+3]=Math.min(255,(1-rr)*size*255);
    }
    target.putImageData(image,0,0);
  }
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(frame.canvas,sx-r,sy-r,r*2,r*2);
}