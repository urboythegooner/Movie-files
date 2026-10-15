import { Aperture, CircleHelp, Keyboard, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function FeatureMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);
  if (!open) return null;
  const shortcuts = [
    ['1 / 2 / 3 / 4', 'Select, asteroid spray, black hole, planet'],
    ['I', 'Open the object inventory'],
    ['Space', 'Pause / resume physics'],
    ['G', 'Toggle slow motion'],
    ['P', 'Toggle future orbital paths'],
    ['F', 'Follow selected body'],
    ['W', 'Open the War Room when space travel is enabled'],
    ['Delete', 'Shatter selected object'],
    ['Ctrl + B', 'Toggle cinematic clean-screen mode'],
    ['Right-drag', 'Orbit the camera'],
    ['Middle-drag', 'Pan across space'],
    ['Scroll', 'Zoom in and out'],
    ['Double-click', 'Open body facts'],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-card/65 p-4 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="panel game-modal w-full max-w-2xl p-5 sm:p-7" role="dialog" aria-modal="true" aria-label="Sandbox field guide">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="game-eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> FIELD GUIDE / 001</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Master the sandbox.</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Build a system, bend gravity, watch worlds collide, and shape your own corner of the universe.</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Close guide"><X className="h-4 w-4" /></Button>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="game-feature"><Aperture className="mb-2 h-5 w-5 text-orange-200" /><strong>Build anything</strong><span>Drop worlds, exotic stars, black holes, and asteroid clusters from Inventory.</span></div>
          <div className="game-feature"><Sparkles className="mb-2 h-5 w-5 text-primary" /><strong>Experiment</strong><span>Drag bodies, alter mass and climate, create asteroid belts, or trigger chaotic encounters.</span></div>
          <div className="game-feature"><CircleHelp className="mb-2 h-5 w-5 text-primary" /><strong>Explore</strong><span>Follow a world, inspect its facts, toggle trails, or enable space travel and factions.</span></div>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-foreground"><Keyboard className="h-4 w-4 text-primary" /> Controls</div>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {shortcuts.map(([key, description]) => <div key={key} className="flex items-start gap-3 border-t border-border/[.08] py-2.5"><kbd className="min-w-[86px] rounded-md border border-border/15 bg-card/[.05] px-2 py-1 text-center font-mono text-[10px] text-primary">{key}</kbd><span className="text-xs leading-relaxed text-muted-foreground">{description}</span></div>)}
        </div>
        <div className="mt-5 flex justify-end"><Button className="game-cta" onClick={onClose}>Back to universe <span aria-hidden="true">↗</span></Button></div>
      </section>
    </div>
  );
}