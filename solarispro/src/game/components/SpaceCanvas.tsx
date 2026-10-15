import { useEffect, useRef } from 'react';
import { Sim } from '../sim/sim';
import { render } from '../sim/render';
import { playImpact, unlockAudio } from '../sim/audio';

export default function SpaceCanvas({ sim }: { sim: Sim }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let curDpr = 0;
    let ultraScale = 2, lastAdapt = 0;
    const targetDpr = () => {
      const quality = sim.settings.graphicsQuality ?? 80;
      // Above 100%, raise backing-canvas resolution proportionally: 150% = 2.25x the 100% pixel density.
      const qualityScale = quality > 100 ? 1.5 * (quality / 100) : quality < 35 ? 0.65 : quality < 55 ? 0.85 : quality < 80 ? 1.1 : 1.5;
      return Math.min(qualityScale, sim.settings.ultra ? ultraScale : sim.settings.simple ? 0.65 : 1);
    };
    const resize = () => {
      const dpr = targetDpr();
      curDpr = dpr;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const activateAudio = () => unlockAudio();
    document.addEventListener('pointerdown', activateAudio, { passive: true });
    const previousImpact = sim.onImpact;
    sim.onImpact = (strength, kind) => {
      previousImpact?.(strength, kind);
      if (sim.soundEnabled) playImpact(strength, kind);
    };
    window.addEventListener('resize', resize);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      sim.fps = sim.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
      if (sim.settings.ultra && now - lastAdapt > 4000) {
        lastAdapt = now;
        if (sim.fps < 28 && ultraScale > 1) ultraScale = Math.max(1, ultraScale - 0.25);
        else if (sim.fps > 57 && ultraScale < (sim.settings.graphicsQuality > 100 ? 1.5 * (sim.settings.graphicsQuality / 100) : 1.5)) ultraScale = Math.min(sim.settings.graphicsQuality > 100 ? 1.5 * (sim.settings.graphicsQuality / 100) : 1.5, ultraScale + 0.25);
      }
      if (targetDpr() !== curDpr) resize();
      const w = window.innerWidth, h = window.innerHeight;
      sim.tick(dt);
      sim.camera.update(w, h);
      ctx.save();
      if (sim.shakeTime > 0.001 && sim.shakeStrength > 0.08) {
        const envelope = Math.min(1, sim.shakeTime * 7);
        const amount = sim.shakeStrength * envelope;
        ctx.translate((Math.random() - 0.5) * amount * 2, (Math.random() - 0.5) * amount * 2);
      }
      render(ctx, sim, w, h, now / 1000);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      document.removeEventListener('pointerdown', activateAudio);
      sim.onImpact = previousImpact;
    };
  }, [sim]);

  const cursor = sim.settings.tool === 'select' ? 'cursor-grab' : 'cursor-crosshair';

  return (
    <canvas
      ref={ref}
      className={`fixed inset-0 h-full w-full touch-none ${cursor}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        sim.pointerDown(e.pointerId, e.button, e.clientX, e.clientY);
      }}
      onPointerMove={(e) => sim.pointerMove(e.pointerId, e.clientX, e.clientY)}
      onPointerUp={(e) => sim.pointerUp(e.pointerId, e.button)}
      onPointerCancel={(e) => sim.pointerUp(e.pointerId, -1)}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => sim.zoomBy(Math.exp(e.deltaY * 0.0012))}
      aria-label="Solar system simulation. Drag to rotate, middle-click and drag to pan, and use the scroll wheel to zoom."
    />
  );
}