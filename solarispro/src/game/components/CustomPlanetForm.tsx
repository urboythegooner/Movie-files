import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SpawnSpec } from '../sim/catalog';
import { EARTH_MASS } from '../sim/setup';

export default function CustomPlanetForm({ onPick }: { onPick: (s: SpawnSpec) => void }) {
  const [name, setName] = useState('My Planet');
  const [color, setColor] = useState('#5ad19a');
  const [massLog, setMassLog] = useState(0);
  const [size, setSize] = useState(4);
  const [ring, setRing] = useState(false);
  const [habitable, setHabitable] = useState(true);
  const [temp, setTemp] = useState(15);
  const [orbit, setOrbit] = useState(true);
  const mass = EARTH_MASS * 10 ** massLog;
  const valid = name.trim().length > 0 && name.length <= 30;

  const place = () => onPick({
    id: 'custom', name: name.trim(), kind: 'planet', mass, radius: size, color, ring, habitable, temperature: temp, orbit, desc: 'Custom',
  });

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
            {!valid && <p className="text-[10px] text-destructive">Give your planet a name.</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent" />
          </div>
        </div>
        <Field label="Mass" value={`${(10 ** massLog).toPrecision(2)} Earths`}>
          <Slider min={-3} max={3.5} step={0.01} value={[massLog]} onValueChange={([v]) => setMassLog(v)} />
        </Field>
        <Field label="Size" value={size.toFixed(1)}>
          <Slider min={1} max={16} step={0.1} value={[size]} onValueChange={([v]) => setSize(v)} />
        </Field>
        <Field label="Temperature" value={`${temp} °C`}>
          <Slider min={-250} max={1000} step={1} value={[temp]} onValueChange={([v]) => setTemp(v)} />
        </Field>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <label className="flex items-center gap-2"><Switch checked={ring} onCheckedChange={setRing} /> Rings</label>
          <label className="flex items-center gap-2"><Switch checked={habitable} onCheckedChange={setHabitable} /> Habitable</label>
          <label className="flex items-center gap-2"><Switch checked={orbit} onCheckedChange={setOrbit} /> Orbit</label>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
        <div className="relative grid h-28 w-full place-items-center">
          {ring && <div className="absolute rounded-[50%] border-[3px] border-[#e6cf92]/70" style={{ width: size * 13, height: size * 3.5, transform: 'rotate(-12deg)' }} />}
          <div className="rounded-full" style={{ width: size * 6, height: size * 6, background: `radial-gradient(circle at 35% 35%, #fff9 0%, ${color} 45%, #000a 100%)`, boxShadow: habitable ? '0 0 0 2px rgba(110,240,160,0.5)' : temp > 250 ? '0 0 16px #ff5020' : 'none' }} />
        </div>
        <div className="font-pixel text-center text-[9px] text-foreground">{name || '—'}</div>
        <Button className="w-full" disabled={!valid} onClick={place}>Place in space</Button>
      </div>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs"><Label className="text-xs">{label}</Label><span className="tabular-nums text-muted-foreground">{value}</span></div>
      {children}
    </div>
  );
}