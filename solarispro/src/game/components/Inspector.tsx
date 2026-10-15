import { Bomb, Crosshair, Info, Moon, X, Flame, Stars } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import FleetCommand from './FleetCommand';
import { fmtPop } from './FactsDialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Sim } from '../sim/sim';
import { EARTH_MASS } from '../sim/setup';

function fmtMass(m: number) {
  const e = m / EARTH_MASS;
  if (e >= 1000) return `${(e / 1000).toFixed(1)}k`;
  if (e >= 10) return e.toFixed(0);
  if (e >= 0.1) return e.toFixed(2);
  return e.toExponential(1);
}

export default function Inspector({ sim, refresh, onFacts }: { sim: Sim; refresh: () => void; onFacts: (id: number) => void }) {
  const b = sim.selected;
  if (!b) return null;
  const sun = sim.world.bodies.find((x) => x.kind === 'sun');
  const dist = sun ? Math.hypot(b.x - sun.x, b.y - sun.y, b.z - sun.z) / 100 : 0;
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  const log = Math.log10(b.mass / EARTH_MASS);
  const following = sim.followId === b.id;
  const setMass = (m: number) => { sim.world.setMass(b, m); refresh(); };

  return (
    <motion.aside initial={{ x: 36, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 36, opacity: 0 }} transition={{ type: "spring", stiffness: 360, damping: 34 }} className="object-drawer panel game-panel fixed bottom-0 right-0 top-0 z-30 flex w-[min(360px,94vw)] flex-col gap-4 overflow-y-auto border-l border-border/15 p-4 sm:p-5" aria-label="Selected object inspector">
      <div className="flex items-center justify-between border-b border-border/10 pb-3">
        <div><div className="game-eyebrow">OBJECT INSPECTOR</div><div className="mt-1 text-[10px] tracking-normal text-muted-foreground">LIVE PROPERTIES</div></div>
        <div className="flex items-center gap-3"><span className="game-live-dot" title="Object selected" /><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Close inspector" onClick={() => sim.select(null)}><X className="h-4 w-4" /></Button></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ background: b.kind === 'blackhole' ? '#000' : b.color, boxShadow: `0 0 8px ${b.color}` }} />
        <div className="min-w-0 flex-1">
          <NameEdit key={b.id} name={b.name} onSave={(n) => { b.name = n; refresh(); }} />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.kind === 'blackhole' ? 'black hole' : b.kind}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <Stat label="Mass" value={`${fmtMass(b.mass)} M⊕`} />
        <Stat label="Speed" value={speed.toFixed(1)} />
        <Stat label="Dist" value={`${dist.toFixed(2)} AU`} />
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mass</div>
        <Slider min={-3} max={6.5} step={0.01} value={[log]} onValueChange={([v]) => setMass(EARTH_MASS * 10 ** v)} />
        <div className="flex gap-1">
          {[0.1, 0.5, 2, 10].map((f) => (
            <Button key={f} size="sm" variant="secondary" className="h-6 flex-1 px-0 text-[10px]" onClick={() => setMass(b.mass * f)}>×{f}</Button>
          ))}
        </div>
      </div>
      {b.kind === 'sun' && (
        <div className="space-y-3 rounded-md border border-orange-300/20 bg-orange-300/5 p-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-200"><Stars className="h-3.5 w-3.5" /> Star controls</div>
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>Star radius</span><span className="text-orange-100">{Math.round(b.radius)} units</span></div>
          <Slider min={3} max={2000} step={1} value={[b.radius]} onValueChange={([v]) => { b.baseRadius = v; b.radius = v; refresh(); }} />
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>Surface temperature</span><span className="text-orange-100">{Math.round(b.temperature || 5800).toLocaleString()} K</span></div>
          <Slider min={1000} max={100000} step={500} value={[Math.max(1000, Math.min(100000, b.temperature || 5800))]} onValueChange={([v]) => { b.temperature = v; refresh(); }} />
        </div>
      )}
      {b.kind === 'planet' && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{Math.round(b.temperature)} °C{b.habitable ? ' · habitable' : ''}</span>
          <span className="tabular-nums text-foreground">👥 {fmtPop(b.population)}</span>
        </div>
      )}
      {sim.settings.travel && (b.kind === 'planet' || b.kind === 'moon') && <FleetCommand key={b.id} sim={sim} b={b} refresh={refresh} />}
      {(b.kind === 'planet' || b.kind === 'moon') && <HeatBar t={b.temperature} />}
      {(b.kind === 'planet' || b.kind === 'moon') && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>Climate control</span><span className="text-foreground">{(b.heatBase ?? 0) > 0 ? '+' : ''}{Math.round(b.heatBase ?? 0)} °C</span></div>
          <Slider min={-300} max={1200} step={5} value={[b.heatBase ?? 0]} onValueChange={([v]) => { b.heatBase = v; refresh(); }} />
          <div className="flex gap-1">
            {[['❄ Freeze', -250], ['Mild', 0], ['🔥 Heat', 400], ['🌋 Melt', 1000]].map(([l, v]) => (
              <Button key={l} size="sm" variant="secondary" className="h-6 flex-1 px-0 text-[10px]" onClick={() => { b.heatBase = v as number; refresh(); }}>{l}</Button>
            ))}
          </div>
        </div>
      )}
      {b.kind === 'planet' && (
        <Button size="sm" variant="secondary" className="h-8 w-full gap-1 text-[11px]" onClick={() => { const m = sim.addMoon(b); toast(`${m.name} now orbits ${b.name}`); refresh(); }}>
          <Moon className="h-3.5 w-3.5" /> Add moon ({sim.world.bodies.filter((x) => x.alive && x.parentId === b.id).length})
        </Button>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        <Button size="sm" variant="secondary" className="h-8 gap-1 text-[11px]" onClick={() => onFacts(b.id)}>
          <Info className="h-3.5 w-3.5" /> Facts
        </Button>
        <Button size="sm" variant={following ? 'default' : 'secondary'} className="h-8 gap-1 text-[11px]" onClick={() => { sim.followId = following ? null : b.id; refresh(); }}>
          <Crosshair className="h-3.5 w-3.5" /> {following ? 'On' : 'Follow'}
        </Button>
        <Button size="sm" variant="destructive" className="h-8 gap-1 text-[11px]" onClick={() => sim.destroySelected()}>
          <Bomb className="h-3.5 w-3.5" /> Shatter
        </Button>
      </div>
    </motion.aside>
  );
}

function NameEdit({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  const commit = () => { const n = v.trim().slice(0, 30); if (n) onSave(n); else setV(name); setEdit(false); };
  if (edit) return <Input autoFocus value={v} maxLength={30} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(name); setEdit(false); } }} className="h-6 px-1.5 text-xs" />;
  return <button title="Click to rename" onClick={() => { setV(name); setEdit(true); }} className="font-pixel block w-full truncate text-left text-[11px] leading-tight text-foreground hover:text-primary">{name} <span className="text-[9px] text-muted-foreground">✎</span></button>;
}

function HeatBar({ t }: { t: number }) {
  const label = t > 700 ? 'Molten' : t > 200 ? 'Scorching' : t > 60 ? 'Hot' : t > 0 ? 'Mild' : t > -100 ? 'Cold' : 'Frozen';
  const pct = Math.max(0, Math.min(100, ((t + 250) / 1250) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>Surface heat</span><span className="text-foreground">{Math.round(t)} °C · {label}</span></div>
      <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#7cc8ff,#bfe4ff 20%,#8dffb0 30%,#ffd86a 45%,#ff8a3a 65%,#ff3a2a)' }}>
        <div className="absolute -top-0.5 h-3 w-1 rounded-sm bg-foreground shadow" style={{ left: `calc(${pct}% - 2px)` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <div className="uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 truncate text-[11px] tabular-nums text-foreground">{value}</div>
    </div>
  );
}