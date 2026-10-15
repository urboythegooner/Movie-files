import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CATEGORIES, SpawnSpec } from '../sim/catalog';
import CustomPlanetForm from './CustomPlanetForm';
import CustomStarForm from './CustomStarForm';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onPick: (s: SpawnSpec) => void }

function Swatch({ s }: { s: SpawnSpec }) {
  const size = s.kind === 'asteroid' ? 14 : Math.min(44, 14 + Math.sqrt(s.radius) * 8);
  const bh = s.kind === 'blackhole';
  const star = s.kind === 'sun';
  return (
    <div className="relative grid h-12 w-12 place-items-center">
      {s.ring && <div className="absolute h-3 w-14 -rotate-12 rounded-[50%] border-2 border-[#e6cf92]/70" />}
      <div
        className={s.kind === 'asteroid' ? 'rotate-12 rounded-sm' : 'rounded-full'}
        style={{
          width: size, height: size,
          background: bh ? '#000' : `radial-gradient(circle at 35% 35%, #fff8 0%, ${s.color} 45%, #0008 100%)`,
          boxShadow: bh ? '0 0 0 2px #ffb070, 0 0 14px #ff9040' : star ? `0 0 18px ${s.color}` : 'none',
        }}
      />
    </div>
  );
}

export default function InventoryDialog({ open, onOpenChange, onPick }: Props) {
  const [tab, setTab] = useState('solar');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-border bg-card/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm text-primary">INVENTORY</DialogTitle>
          <DialogDescription className="text-xs">Pick something, then click in space to place it. Keep clicking to place more. Press Esc when you're done.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap">
            {CATEGORIES.map((c) => <TabsTrigger key={c.id} value={c.id} className="text-xs">{c.label}</TabsTrigger>)}
            <TabsTrigger value="custom" className="text-xs">Custom Planet</TabsTrigger>
            <TabsTrigger value="star" className="text-xs">Custom Star</TabsTrigger>
          </TabsList>
          {CATEGORIES.map((c) => (
            <TabsContent key={c.id} value={c.id}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {c.items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPick(s)}
                    className="group flex flex-col items-center gap-1 rounded-lg border border-border bg-muted/40 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-accent"
                  >
                    <Swatch s={s} />
                    <span className="text-[11px] font-medium text-foreground">{s.count ? `${s.name} ×${s.count}` : s.name}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground">{s.desc}</span>
                  </button>
                ))}
              </div>
            </TabsContent>
          ))}
          <TabsContent value="custom"><CustomPlanetForm onPick={onPick} /></TabsContent>
          <TabsContent value="star"><CustomStarForm onPick={onPick} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}