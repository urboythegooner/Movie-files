import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SpawnSpec } from '../sim/catalog';
import { starColor } from '../sim/fleetRender';

const kindOf = (k: number) => (k < 3500 ? 'Red dwarf' : k < 5000 ? 'Orange star' : k < 6500 ? 'Yellow star' : k < 8000 ? 'White star' : k < 12000 ? 'Blue-white star' : 'Blue giant');

export default function CustomStarForm({ onPick }: { onPick: (s: SpawnSpec) => void }) {
  const [name, setName] = useState('My Star');
  const [temp, setTemp] = useState(5500);
  const [massLog, setMassLog] = useState(4);
  const [size, setSize] = useState(14);
  const [orbit, setOrbit] = useState(false);
  const color = starColor(temp);
  const valid = name.trim().length > 0;
  const place = () => onPick({ id: 'customstar', name: name.trim(), kind: 'sun', mass: 10 ** massLog, radius: size, color, temperature: temp, orbit, desc: 'Custom star' });

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          {!valid && <p className="text-[10px] text-destructive">Give your star a name.</p>}
        </div>
        <Row label="Surface temperature" value={`${temp.toLocaleString()} K · ${kindOf(temp)}`}>
          <Slider min={2000} max={40000} step={100} value={[temp]} onValueChange={([v]) => setTemp(v)} />
        </Row>
        <Row label="Mass" value={`${(10 ** massLog / 10000).toPrecision(2)} Suns`}>
          <Slider min={2.5} max={5} step={0.01} value={[massLog]} onValueChange={([v]) => setMassLog(v)} />
        </Row>
        <Row label="Size" value={size.toFixed(1)}>
          <Slider min={2} max={40} step={0.5} value={[size]} onValueChange={([v]) => setSize(v)} />
        </Row>
        <p className="text-[10px] text-muted-foreground">Hotter and bigger stars heat nearby planets much more.</p>
        <label className="flex items-center gap-2 text-xs"><Switch checked={orbit} onCheckedChange={setOrbit} /> Orbit the nearest heavy object</label>
      </div>
      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
        <div className="grid h-28 w-full place-items-center">
          <div className="rounded-full" style={{ width: 20 + size * 2, height: 20 + size * 2, background: `radial-gradient(circle, #fff 0%, ${color} 55%, ${color} 100%)`, boxShadow: `0 0 ${20 + size}px ${color}` }} />
        </div>
        <div className="font-pixel text-center text-[9px] text-foreground">{name || '—'}</div>
        <Button className="w-full" disabled={!valid} onClick={place}>Place in space</Button>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs"><Label className="text-xs">{label}</Label><span className="tabular-nums text-muted-foreground">{value}</span></div>
      {children}
    </div>
  );
}