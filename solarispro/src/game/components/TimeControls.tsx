import { Cpu, Pause, Play, Turtle, Orbit, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings } from '../sim/sim';

interface Props { s: Settings; update: (p: Partial<Settings>) => void }

export default function TimeControls({ s, update }: Props) {
  return (
    <div className="panel flex items-center gap-2 p-1.5">
      <Button size="icon" variant="ghost" className="h-8 w-8" title="Pause (Space)" onClick={() => update({ paused: !s.paused })}>
        {s.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
      <Button
        size="sm"
        variant={s.slow ? 'default' : 'ghost'}
        className="h-8 gap-1.5 px-2 text-xs"
        title="Slow motion (G)"
        onClick={() => update({ slow: !s.slow })}
      >
        <Turtle className="h-4 w-4" /> G
      </Button>
      <Button size="sm" variant={s.gravityEnabled ? 'secondary' : 'ghost'} className="h-8 gap-1 px-2 text-[10px]" title="Toggle Newtonian gravity" onClick={() => update({ gravityEnabled: !s.gravityEnabled })}><Orbit className="h-3.5 w-3.5" /> GRAVITY</Button>
      <Button size="sm" variant={s.collisionsEnabled ? 'secondary' : 'ghost'} className="h-8 gap-1 px-2 text-[10px]" title="Toggle collision detection" onClick={() => update({ collisionsEnabled: !s.collisionsEnabled })}><Zap className="h-3.5 w-3.5" /> IMPACTS</Button>
      <div className="hidden w-28 items-center gap-2 pr-2 sm:flex">
        <Slider min={0.1} max={20} step={0.1} value={[s.timeScale]} onValueChange={([v]) => update({ timeScale: v })} />
        <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">{s.timeScale.toFixed(1)}×</span>
      </div>
      <div className="hidden items-center gap-1 border-l border-border/10 pl-2 md:flex" aria-label="Time speed presets">
        {[1, 5, 10, 20].map((speed) => (
          <Button key={speed} size="sm" variant={Math.abs(s.timeScale - speed) < 0.05 ? 'secondary' : 'ghost'}
            className={`h-7 min-w-8 px-1.5 text-[10px] ${Math.abs(s.timeScale - speed) < 0.05 ? 'border border-border/20 bg-card/10' : 'text-muted-foreground'}`}
            title={`Set simulation speed to ${speed}×`} onClick={() => update({ timeScale: speed })}>{speed}×</Button>
        ))}
      </div>
    </div>
  );
}