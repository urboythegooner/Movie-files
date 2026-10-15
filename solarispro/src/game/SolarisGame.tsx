import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, LogOut, Minus, Plus, Save, Swords, Minimize2, Maximize2, Volume2, VolumeX, Move, RotateCcw } from 'lucide-react';
import WarRoom, { BattleFeed } from './components/WarRoom';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import HomeScreen from './components/HomeScreen';
import LoadingScreen from './components/LoadingScreen';
import SaveDialog from './components/SaveDialog';
import { listSaves, loadPrefs, Prefs, readSave, writeSave } from './sim/saves';
import { Button } from '@/components/ui/button';
import SpaceCanvas from './components/SpaceCanvas';
import Toolbar, { toolHint } from './components/Toolbar';
import TimeControls from './components/TimeControls';
import Inspector from './components/Inspector';
import FactsDialog from './components/FactsDialog';
import InventoryDialog from './components/InventoryDialog';
import FeatureMenu from './components/FeatureMenu';
import { SpawnSpec } from './sim/catalog';
import { Settings, Sim, Tool } from './sim/sim';
import { YEAR } from './sim/setup';

const KEY_TOOLS: Record<string, Tool> = { '1': 'select', '2': 'asteroid', '3': 'blackhole', '4': 'planet' };

export default function App() {
  const sim = useMemo(() => new Sim(), []);
  const [, setTick] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [minimized, setMinimized] = useState({ controls: false, toolbar: false });
  const toggleMinimized = (key: keyof typeof minimized) => setMinimized((m) => ({ ...m, [key]: !m[key] }));
  const [factsId, setFactsId] = useState<number | null>(null);
  const [invOpen, setInvOpen] = useState(false);
  const [warOpen, setWarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [home, setHome] = useState(true);
  const [loadingMode, setLoadingMode] = useState<null | 'new' | 'load'>(null);
  const [loadingSaveId, setLoadingSaveId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [slot, setSlot] = useState<{ id: string; name: string } | null>(null);
  const [saveMode, setSaveMode] = useState<null | 'save' | 'quit'>(null);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const applyPrefs = (p: Prefs) => Object.assign(sim.settings, {
    ultra: p.graphicsQuality >= 55, simple: p.graphicsQuality < 35, graphicsQuality: p.graphicsQuality, prediction: p.prediction, trails: p.trails,
    labels: p.labels, orbitAssist: p.orbitAssist, travel: p.travel, horizonYears: p.horizonYears, universeSystems: p.universeSystems, planetsPerSystem: p.planetsPerSystem, paused: false, slow: false, tool: 'select',
  });
  const startNew = () => { if (loadingMode) return; setLoadingSaveId(null); setLoadingMode('new'); };
  const loadGalaxy = (id: string) => {
    if (loadingMode) return;
    if (!readSave(id)) { toast.error('That save could not be read'); return; }
    setLoadingSaveId(id); setLoadingMode('load');
  };
  const finishLoading = () => {
    const mode = loadingMode;
    const saveId = loadingSaveId;
    if (mode === 'new') {
      applyPrefs(prefs); sim.reset(); setSlot(null); setFactsId(null); setHome(false);
    } else if (mode === 'load' && saveId) {
      const d = readSave(saveId);
      if (!d) { setLoadingMode(null); toast.error('That save could not be read'); return; }
      applyPrefs(prefs); sim.load(d);
      setSlot({ id: saveId, name: listSaves().find((x) => x.id === saveId)?.name ?? 'Galaxy' }); setHome(false); toast.success('Galaxy loaded');
    }
    setLoadingMode(null); setLoadingSaveId(null);
  };
  const quitHome = () => { setSaveMode(null); setInvOpen(false); setFactsId(null); sim.select(null); setHome(true); };
  const doSave = (name: string) => {
    try {
      const m = writeSave(name, sim.serialize(), slot?.name === name ? slot.id : undefined);
      setSlot({ id: m.id, name }); toast.success(`Saved "${name}"`);
      if (saveMode === 'quit') quitHome(); else setSaveMode(null);
    } catch { toast.error('Not enough storage space to save this galaxy'); }
  };
  const setUltra = useCallback((_v: boolean) => {
    // Graphics shortcuts must never reset the user's current universe.
    Object.assign(sim.settings, { ultra: true, simple: false, graphicsQuality: Math.max(80, sim.settings.graphicsQuality), timeScale: Math.min(sim.settings.timeScale, 20) });
    refresh();
  }, [sim, refresh]);
  const update = useCallback((p: Partial<Settings>) => { Object.assign(sim.settings, p); refresh(); }, [sim, refresh]);

  const homeRef = useRef(home);
  homeRef.current = home;
  useEffect(() => {
    document.documentElement.classList.add('dark');
    sim.onSelect = refresh;
    sim.onOpenFacts = setFactsId;
    sim.onWormhole = () => {
      // Never attempt to close the browser tab: wormholes are clickable game objects.
      toast('Wormhole detected', { description: 'Wormhole transit is still experimental. Your universe is safe.' });
    };
    const id = setInterval(refresh, 300);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.target as HTMLElement).closest('input,textarea,select,button,[role="button"],[contenteditable="true"]') || homeRef.current) return;
      const k = e.key.toLowerCase();
      if (k === 'i' && !e.ctrlKey && !e.metaKey) { setInvOpen((o) => !o); return; }
      if (k === 'w' && sim.settings.travel) { setWarOpen((o) => !o); return; }
      if (k === 'b' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setHidden((h) => !h); return; }
      if (k === 'g') update({ slow: !sim.settings.slow });
      else if (k === ' ') { e.preventDefault(); update({ paused: !sim.settings.paused }); }
      else if (k === 'u') setUltra(true);
      else if (k === 'p') update({ prediction: !sim.settings.prediction });
      else if (k === 'h' || k === '?') { setHelpOpen((o) => !o); return; }
      else if (k === 'f' && sim.selectedId != null) { sim.followId = sim.followId === sim.selectedId ? null : sim.selectedId; refresh(); }
      else if (k === 'delete' || k === 'backspace') { if (sim.selected) { e.preventDefault(); sim.destroySelected(); refresh(); } }
      else if (k === 'escape') { if (sim.settings.tool === 'place') { sim.pending = null; update({ tool: 'select' }); } else sim.select(null); }
      else if (KEY_TOOLS[k]) update({ tool: KEY_TOOLS[k] });
    };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey); };
  }, [sim, refresh, update, setUltra]);

  const w = sim.world;
  const asteroids = w.bodies.filter((b) => b.kind === 'asteroid').length;
  const s = sim.settings;

  return (
    <div className="sandbox-ui relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <SpaceCanvas sim={sim} />
      <Toaster />
      <FeatureMenu open={helpOpen && !home} onClose={() => setHelpOpen(false)} />
      <AnimatePresence>{home && <HomeScreen prefs={prefs} setPrefs={setPrefs} onNew={startNew} onLoad={loadGalaxy} />}</AnimatePresence>
      <AnimatePresence>{loadingMode && <LoadingScreen onComplete={finishLoading} />}</AnimatePresence>
      <SaveDialog open={saveMode != null} quit={saveMode === 'quit'} defaultName={slot?.name ?? `Galaxy ${new Date().toLocaleDateString()}`}
        onOpenChange={(o) => !o && setSaveMode(null)} onSave={doSave} onQuitNoSave={quitHome} />
      <InventoryDialog
        open={invOpen}
        onOpenChange={setInvOpen}
        onPick={(spec: SpawnSpec) => { sim.pending = spec; update({ tool: 'place' }); setInvOpen(false); }}
      />
      {s.tool === 'place' && sim.pending && (
        <div className="panel pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 px-3 py-2 text-xs">
          Placing <span className="font-semibold text-primary">{sim.pending.name}</span>: click in space · Esc to stop
        </div>
      )}
      {s.travel && !home && <WarRoom sim={sim} open={warOpen} onOpenChange={setWarOpen} refresh={refresh} />}
      {s.travel && !home && !hidden && <BattleFeed sim={sim} />}
      <FactsDialog sim={sim} id={factsId} onClose={() => setFactsId(null)} refresh={refresh} />
      {home ? null : hidden ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60">Ctrl+B to show menus</div>
      ) : (<>

      <div className="pointer-events-none absolute inset-x-0 top-16 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto">
          <h1 className="font-pixel text-sm text-primary sm:text-lg">SOLARIS <span className="ml-1 text-[9px] font-medium tracking-normal text-muted-foreground">SANDBOX</span></h1>
          <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] tabular-nums text-muted-foreground">
            <span>{w.bodies.length - asteroids} bodies</span>
            <span>{asteroids} asteroids</span>
            <span>{w.debris.length} debris fragments</span>{s.travel && <span className="text-primary">🚀 {sim.fleet.ships.length} ships</span>}
            <span>yr {(w.time / YEAR).toFixed(2)}</span>
            <span>{Math.round(sim.fps)} fps</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setSaveMode('save')}><Save className="mr-1 h-3.5 w-3.5" />Save</Button>
            <Button size="sm" variant="outline" className="h-7 w-8 px-0" title={sim.soundEnabled ? 'Mute impact sounds' : 'Enable impact sounds'} aria-label={sim.soundEnabled ? 'Mute impact sounds' : 'Enable impact sounds'} onClick={() => { sim.soundEnabled = !sim.soundEnabled; refresh(); }}>{sim.soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}</Button>
            <Button size="sm" variant="outline" className="h-7 w-8 px-0" title="Field guide and keyboard shortcuts (H)" aria-label="Field guide and keyboard shortcuts" onClick={() => setHelpOpen(true)}><CircleHelp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSaveMode('quit')}><LogOut className="mr-1 h-3.5 w-3.5" />Save &amp; quit</Button>
            {s.travel && <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setWarOpen(true)}><Swords className="mr-1 h-3.5 w-3.5" />War Room</Button>}
          </div>
        </div>
        <div className={`pointer-events-auto flex flex-col items-end gap-2 transition-transform duration-300 ${minimized.controls ? 'translate-x-[calc(100%-2.25rem)]' : 'translate-x-0'}`}>
          <div className="flex items-start gap-1">
            <div className={`overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-in-out ${minimized.controls ? 'max-w-0 -translate-x-3 opacity-0' : 'max-w-[min(72vw,32rem)] translate-x-0 opacity-100'}`}>
              <TimeControls s={s} update={update} />
            </div>
            <Button size="icon" variant="secondary" className="h-8 w-8 shrink-0" title={minimized.controls ? 'Restore controls' : 'Minimize controls'} onClick={() => toggleMinimized('controls')}>
              {minimized.controls ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {s.slow && (
        <div className="font-pixel pointer-events-none absolute left-1/2 top-40 -translate-x-1/2 animate-pulse text-[10px] text-foreground">SLOW MOTION</div>
      )}
      {s.paused && (
        <div className="font-pixel pointer-events-none absolute left-1/2 top-44 -translate-x-1/2 text-[10px] text-foreground">PAUSED</div>
      )}

      <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 items-start gap-1">
        <div className={`overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-in-out ${minimized.toolbar ? 'max-w-0 -translate-y-3 opacity-0' : 'max-w-[min(92vw,58rem)] translate-y-0 opacity-100'}`}>
          <Toolbar tool={s.tool} moveMode={sim.panMode} onToggleMove={() => { sim.panMode = !sim.panMode; refresh(); }} onChange={(t) => { sim.pending = null; update({ tool: t }); }} onInventory={() => setInvOpen(true)} />
        </div>
        <Button size="icon" variant="secondary" className="h-8 w-8 shrink-0 rounded-b-lg rounded-t-none border-t-0 shadow-lg transition-transform duration-300" title={minimized.toolbar ? 'Pull out build menu' : 'Pull build menu into top bookmark'} aria-label={minimized.toolbar ? 'Open build menu' : 'Close build menu'} onClick={() => toggleMinimized('toolbar')}>
          {minimized.toolbar ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
        </Button>
      </div>

      <Button size="sm" variant="secondary" className="absolute bottom-3 left-3 h-8 gap-1.5 text-xs" onClick={() => { sim.reset(); refresh(); }}>
        <RotateCcw className="h-3.5 w-3.5" /> Reset galaxy
      </Button>

      <AnimatePresence mode="wait">
        {sim.selected && <Inspector key={sim.selected.id} sim={sim} refresh={refresh} onFacts={setFactsId} />}
      </AnimatePresence>

      <div className="panel absolute bottom-3 right-3 flex flex-col gap-1 p-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => sim.zoomBy(0.7)}><Plus className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => sim.zoomBy(1.4)}><Minus className="h-4 w-4" /></Button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-center text-[10px] text-muted-foreground lg:block">
        {toolHint(s.tool)} · right-drag rotate · scroll zoom · G slow-mo · Space pause · Del shatter · double-click planet for facts · I inventory · Ctrl+B hide menus
      </div>
      </>)}
    </div>
  );
}