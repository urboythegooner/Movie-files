import { useEffect, useRef } from 'react';
import { Sim } from '../sim/sim';

const SIZE = 168;

/** Top-down view of the whole system, log-scaled so every orbit fits */
export default function MiniMap({ sim }: { sim: Sim }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = SIZE * dpr; c.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0, frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (frame++ % 3) return;
      const w = sim.world, half = SIZE / 2, R = half - 8;
      const sun = w.bodies.find((b) => b.kind === 'sun');
      const ox = sun?.x ?? 0, oz = sun?.z ?? 0;
      let maxR = 200;
      for (const b of w.bodies) if (b.kind === 'planet') maxR = Math.max(maxR, Math.hypot(b.x - ox, b.z - oz));
      const k = Math.log(1 + maxR / 25);
      const map = (x: number, z: number) => {
        const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz) || 1;
        const m = (Math.log(1 + d / 25) / k) * R;
        return [half + (dx / d) * m, half + (dz / d) * m];
      };
      ctx.clearRect(0, 0, SIZE, SIZE);
      for (const b of w.bodies) {
        if (b.kind !== 'planet') continue;
        const [x, y] = map(b.x, b.z);
        ctx.strokeStyle = 'rgba(150,170,255,0.12)';
        ctx.beginPath(); ctx.arc(half, half, Math.hypot(x - half, y - half), 0, Math.PI * 2); ctx.stroke();
      }
      // camera view direction
      const cam = sim.camera;
      const [cx, cy] = map(cam.tx, cam.tz);
      const a = Math.atan2(-Math.cos(cam.yaw), -Math.sin(cam.yaw));
      ctx.fillStyle = 'rgba(255,192,77,0.12)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 40, a - 0.5, a + 0.5); ctx.fill();
      ctx.fillStyle = 'rgba(160,150,140,0.35)';
      for (let i = 0; i < w.bodies.length; i += 4) {
        const b = w.bodies[i];
        if (b.kind !== 'asteroid') continue;
        const [x, y] = map(b.x, b.z);
        ctx.fillRect(x, y, 1, 1);
      }
      for (const b of w.bodies) {
        if (b.kind === 'asteroid' || b.kind === 'moon') continue;
        const [x, y] = b.kind === 'sun' ? [half, half] : map(b.x, b.z);
        const s = b.kind === 'sun' ? 5 : b.kind === 'blackhole' ? 4 : Math.max(2, Math.min(4, b.radius / 2.2));
        ctx.fillStyle = b.kind === 'blackhole' ? '#000' : b.color;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        if (b.kind === 'blackhole') { ctx.strokeStyle = '#ff9a4a'; ctx.stroke(); }
        if (b.id === sim.selectedId) { ctx.strokeStyle = '#ffc04d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, s + 3, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  return (
    <div className="panel p-1.5">
      <div className="flex items-center justify-between px-1 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>Top view</span><span>log scale</span>
      </div>
      <canvas ref={ref} style={{ width: SIZE, height: SIZE }} className="block rounded-md bg-background/60" />
    </div>
  );
}