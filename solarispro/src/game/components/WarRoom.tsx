import { useState } from 'react';
import { Handshake, Skull, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { fmtPeople } from '../sim/fleet';
import { Sim } from '../sim/sim';

interface Props { sim: Sim; open: boolean; onOpenChange: (o: boolean) => void; refresh: () => void }

export default function WarRoom({ sim, open, onOpenChange, refresh }: Props) {
  const fl = sim.fleet;
  const [a, setA] = useState(''); const [b, setB] = useState('');
  const alive = fl.factions.filter((f) => f.alive);
  const civs = alive.filter((f) => !f.alien);
  const wars = [...fl.wars].map((k) => k.split('-').map(Number));
  const act = (fn: () => void) => { fn(); refresh(); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[22rem] flex-col gap-4 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-pixel text-sm text-primary">WAR ROOM</SheetTitle>
          <SheetDescription className="text-xs">Factions fight on their own once war is declared — they build warships, dogfight, besiege shields and invade.</SheetDescription>
        </SheetHeader>
        <div className="space-y-1.5">
          {alive.map((f) => {
            const st = fl.stats(f.id);
            return (
              <div key={f.id} className="rounded-md bg-muted/50 p-2 text-[10px]">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: f.color }}>
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />{f.name}{f.alien && ' 👾'}
                  {fl.inAnyWar(f.id) && <Swords className="ml-auto h-3 w-3 text-destructive" />}
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1 tabular-nums text-muted-foreground">
                  <span>🌍 {st.planets}</span><span>👥 {fmtPeople(st.pop)}</span><span>🚀 {st.ships}</span><span>⚔ {f.kills}/{f.losses}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Diplomacy</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[{ v: a, set: setA }, { v: b, set: setB }].map((s, i) => (
              <Select key={i} value={s.v} onValueChange={s.set}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={i ? 'Against…' : 'Faction…'} /></SelectTrigger>
                <SelectContent>{civs.map((f) => <SelectItem key={f.id} value={String(f.id)} className="text-xs">{f.name}</SelectItem>)}</SelectContent>
              </Select>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="destructive" disabled={!a || !b || a === b} onClick={() => act(() => fl.declareWar(+a, +b))}><Swords className="mr-1 h-3.5 w-3.5" />Declare war</Button>
            <Button size="sm" variant="secondary" disabled={!a || !b || a === b} onClick={() => act(() => fl.makePeace(+a, +b))}><Handshake className="mr-1 h-3.5 w-3.5" />Make peace</Button>
          </div>
          {civs.length < 2 && <p className="text-[10px] text-muted-foreground">Only one civilization left. Settle a new world, then declare its independence to create a rival.</p>}
          {wars.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {wars.map(([x, y]) => (
                <button key={`${x}-${y}`} onClick={() => act(() => fl.makePeace(x, y))} title="Click to make peace"
                  className="rounded border border-destructive/50 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10">
                  {fl.faction(x)?.name} ⚔ {fl.faction(y)?.name} ✕
                </button>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" className="w-full" onClick={() => act(() => fl.summonAliens())}><Skull className="mr-1 h-3.5 w-3.5" />Summon alien armada</Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Galactic news</div>
          <ScrollArea className="min-h-0 flex-1 rounded-md border border-border p-2">
            <div className="space-y-1.5">
              {fl.log.map((l) => <div key={l.id} className="text-[11px] leading-snug" style={{ color: l.color }}>{l.text}</div>)}
              {!fl.log.length && <div className="text-[11px] text-muted-foreground">Nothing has happened yet.</div>}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function BattleFeed({ sim }: { sim: Sim }) {
  const now = Date.now();
  const items = sim.fleet.log.filter((l) => now - l.at < 9000).slice(0, 4);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-12 left-1/2 flex w-[min(90vw,32rem)] -translate-x-1/2 flex-col items-center gap-1">
      {items.map((l) => (
        <div key={l.id} className="panel px-2.5 py-1 text-center text-[11px]" style={{ color: l.color, opacity: 1 - (now - l.at) / 9000 + 0.15 }}>{l.text}</div>
      ))}
    </div>
  );
}