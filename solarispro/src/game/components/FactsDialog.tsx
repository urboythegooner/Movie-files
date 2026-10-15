import { Thermometer, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Sim } from '../sim/sim';
import { factsFor, suitability } from '../sim/facts';

export function fmtPop(p: number) {
  if (p >= 1e9) return `${(p / 1e9).toFixed(2)} billion`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(1)} million`;
  if (p >= 1e3) return `${(p / 1e3).toFixed(1)}k`;
  return Math.round(p).toString();
}

function climate(t: number) {
  if (t > 100) return 'Scorching';
  if (t > 40) return 'Hot';
  if (t >= -10) return 'Temperate';
  if (t > -80) return 'Freezing';
  return 'Frozen';
}

interface Props { sim: Sim; id: number | null; onClose: () => void; refresh: () => void }

export default function FactsDialog({ sim, id, onClose, refresh }: Props) {
  const b = sim.world.byId(id);
  const f = b ? factsFor(b.name) : null;
  const isPlanet = b?.kind === 'planet';
  return (
    <Dialog open={!!b} onOpenChange={(o) => !o && onClose()}>
      {b && f && (
        <DialogContent className="max-w-md border-border bg-card/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-pixel flex items-center gap-3 text-sm">
              <span className="h-4 w-4 rounded-sm" style={{ background: b.kind === 'blackhole' ? '#000' : b.color, boxShadow: `0 0 10px ${b.color}` }} />
              {b.name}
            </DialogTitle>
            <DialogDescription className="text-xs">{b.kind === 'blackhole' ? 'Black hole' : f.type}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
            {[['Day', f.day], ['Year', f.year], ['Moons', f.moons]].map(([l, v]) => (
              <div key={l} className="rounded-md bg-muted/60 px-2 py-1.5">
                <div className="uppercase tracking-wider">{l}</div>
                <div className="mt-0.5 text-[11px] text-foreground">{v}</div>
              </div>
            ))}
          </div>

          <ul className="space-y-1.5 text-xs text-foreground/90">
            {f.facts.map((t) => <li key={t} className="flex gap-2"><span className="text-primary">▸</span>{t}</li>)}
          </ul>

          {isPlanet && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs"><Users className="h-4 w-4 text-primary" /> Population</div>
                <div className="font-pixel text-[11px] tabular-nums text-foreground">{fmtPop(b.population)}</div>
              </div>
              <label className="flex cursor-pointer items-center justify-between text-xs">
                <span>Habitable <span className="text-muted-foreground">(life can grow here)</span></span>
                <Switch checked={b.habitable} onCheckedChange={(v) => { b.habitable = v; refresh(); }} />
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /> Temperature</span>
                  <span className="tabular-nums">{Math.round(b.temperature)} °C · <span className="text-muted-foreground">{climate(b.temperature)}</span></span>
                </div>
                <Slider min={-250} max={600} step={1} value={[b.temperature]} onValueChange={([v]) => { b.temperature = v; refresh(); }} />
                <p className="text-[10px] text-muted-foreground">
                  {b.habitable
                    ? suitability(b.temperature) > 0
                      ? `Livability ${Math.round(suitability(b.temperature) * 100)}%. Populations grow fastest near 15 °C.`
                      : 'Too extreme to live here. The population is dying off.'
                    : 'Turn on habitable to let a population grow.'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}