import { useState } from 'react';
import { Anchor, Flag, Package, Plane, Rocket, Ship as ShipIcon, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Body } from '../sim/engine';
import { fmtPeople, SHIP_ORDER, ShipClass, SHIPS } from '../sim/fleet';
import { Sim } from '../sim/sim';

const ICONS: Record<ShipClass, typeof Rocket> = { shuttle: Rocket, colony: Anchor, freighter: Package, fighter: Plane, cruiser: ShipIcon, dreadnought: Swords };

export default function FleetCommand({ sim, b, refresh }: { sim: Sim; b: Body; refresh: () => void }) {
  const fl = sim.fleet;
  const [target, setTarget] = useState<string>('');
  const c = fl.colonies.get(b.id), f = fl.faction(c?.faction);
  const dests = sim.world.bodies.filter((x) => x.alive && x.id !== b.id && (x.kind === 'planet' || x.kind === 'moon'));
  const pop = fl.popOf(b);

  const launch = (cls: ShipClass) => {
    const res = fl.launch(b, sim.world.byId(Number(target)), cls);
    if (typeof res === 'string') toast.error(res);
    else toast(`${res.name} launched`, { description: `${fmtPeople(res.passengers)} aboard` });
    refresh();
  };

  if (!c || !f) {
    return (
      <div className="rounded-md border border-dashed border-border p-2 text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground">Unclaimed world.</span> Send a Shuttle or Colony Ark here from a populated planet to settle it.
      </div>
    );
  }
  const enemy = (id: number) => { const o = fl.factionOf(id); return o && fl.atWar(f.id, o.id); };
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: f.color }}><Flag className="h-3 w-3" />{f.name}{f.capital === b.id && ' ★'}</span>
        <span className="tabular-nums text-muted-foreground">{fmtPeople(pop)} people</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground"><span>Planetary shield</span><span>{c.siege > 0 ? 'UNDER SIEGE' : `${Math.round((c.defense / c.maxDef) * 100)}%`}</span></div>
        <Progress value={(c.defense / c.maxDef) * 100} className="h-1.5" />
      </div>
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Choose destination…" /></SelectTrigger>
        <SelectContent>
          {dests.map((d) => {
            const o = fl.factionOf(d.id);
            return (
              <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                {d.name} <span style={{ color: o?.color }} className="opacity-80">· {o ? `${o.name}${enemy(d.id) ? ' ⚔' : ''}` : 'unclaimed'}</span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-3 gap-1">
        {SHIP_ORDER.map((cls) => {
          const sp = SHIPS[cls], Icon = ICONS[cls];
          return (
            <Button key={cls} size="sm" variant="secondary" disabled={!target || pop <= sp.crew} title={`${sp.desc} Crew: ${fmtPeople(sp.crew)}`}
              className="h-auto flex-col gap-0.5 px-1 py-1.5 text-[9px]" onClick={() => launch(cls)}>
              <Icon className="h-3.5 w-3.5" />{sp.label}
            </Button>
          );
        })}
      </div>
      {f.capital !== b.id && (
        <Button size="sm" variant="outline" className="h-7 w-full text-[10px]" onClick={() => { const n = fl.independence(b.id); if (n) toast(`${n.name} declared independence!`); refresh(); }}>
          Declare independence
        </Button>
      )}
    </div>
  );
}