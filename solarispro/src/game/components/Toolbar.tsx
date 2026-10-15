import { Backpack, Disc3, Globe, MousePointer2, Sparkles, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tool } from '../sim/sim';
import { Button } from '@/components/ui/button';

const TOOLS: { id: Tool; label: string; icon: typeof Globe; key: string; hint: string }[] = [
  { id: 'select', label: 'Grab', icon: MousePointer2, key: '1', hint: 'Drag planets · drag space to rotate' },
  { id: 'asteroid', label: 'Asteroids', icon: Sparkles, key: '2', hint: 'Click or drag to spray asteroids' },
  { id: 'blackhole', label: 'Black hole', icon: Disc3, key: '3', hint: 'Click to drop a black hole' },
  { id: 'planet', label: 'Planet', icon: Globe, key: '4', hint: 'Click to add an orbiting planet' },
];

export default function Toolbar({ tool, moveMode, onToggleMove, onChange, onInventory }: { tool: Tool; moveMode: boolean; onToggleMove: () => void; onChange: (t: Tool) => void; onInventory: () => void }) {
  return (
    <div className="panel game-toolbar flex flex-row items-center gap-1 p-1.5">
      <div className="px-2 py-1">
        <div className="game-eyebrow">BUILD MODE</div>
        <div className="mt-0.5 text-[10px] font-semibold tracking-wide text-foreground/90">TOOLS</div>
      </div>
      {TOOLS.map((t) => (
        <Button variant="ghost"
          key={t.id}
          title={`${t.hint} (${t.key})`}
          onClick={() => onChange(t.id)}
          className={cn(
            'group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors',
            tool === t.id ? 'border border-border/25 bg-card/[0.09] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md' : 'text-muted-foreground hover:bg-card/[0.06] hover:text-foreground',
          )}
        >
          <t.icon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t.label}</span>
          <kbd className="ml-auto hidden text-[10px] opacity-60 sm:inline">{t.key}</kbd>
        </Button>
      ))}
      <div className="my-0.5 h-px bg-border" />
      <Button variant="ghost"
        title="Move camera: drag space to pan around the universe"
        onClick={onToggleMove}
        className={cn("group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors", moveMode ? "border border-border/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card/[0.06] hover:text-foreground")}
      >
        <Move className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{moveMode ? "Moving" : "Move camera"}</span>
      </Button>
      <Button variant="ghost"
        title="Inventory: spawn planets, stars and more (I)"
        onClick={onInventory}
        className={cn('flex items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-xs transition-colors', tool === 'place' ? 'border-border/25 bg-card/[0.09] text-foreground backdrop-blur-md' : 'text-muted-foreground hover:bg-card/[0.06] hover:text-foreground')}
      >
        <Backpack className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Inventory</span>
        <kbd className="ml-auto hidden text-[10px] opacity-60 sm:inline">I</kbd>
      </Button>
    </div>
  );
}

export const toolHint = (t: Tool) => TOOLS.find((x) => x.id === t)?.hint ?? 'Click in space to place · Esc to stop';