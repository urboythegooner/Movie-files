import orbitImage from '@/assets/solaris-orbit.jpg';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, CircleHelp, FolderOpen, Play, Settings2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { deleteSave, listSaves, Prefs, savePrefs } from '../sim/saves';

type View = 'menu' | 'load' | 'settings' | 'about';
interface Props { prefs: Prefs; setPrefs: (p: Prefs) => void; onNew: () => void; onLoad: (id: string) => void }

export default function HomeScreen({ prefs, setPrefs, onNew, onLoad }: Props) {
  const [view, setView] = useState<View>('menu');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="launcher absolute inset-0 z-30 flex items-center overflow-y-auto p-4 sm:p-8">
      <img src={orbitImage} width={1920} height={1088} alt="Earth seen from orbit with sunlight illuminating its atmosphere" className="launcher-space-art pointer-events-none absolute inset-0" />
      <div className="launcher-grid pointer-events-none absolute inset-0" />
      <motion.section initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75 }}
        className="launcher-sidebar relative z-10 flex min-h-[570px] w-full max-w-[330px] flex-col justify-center px-2 py-8 sm:ml-8 sm:px-4">
        <div className="launcher-brand mb-7 flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2"><div className="launcher-brand-title">SOLARIS</div><span className="beta-chip">BETA</span></div>
            <div className="launcher-brand-sub">GRAVITY SANDBOX</div>
          </div>
        </div>
        {view === 'menu' && <>
          <div className="launcher-nav flex flex-col gap-2.5">
            <Button variant="launcher" className="horizon-button" onClick={onNew}><span className="horizon-label">START GAME</span><ChevronRight size={14} className="nav-chevron" /></Button>
            <Button variant="launcher" className="horizon-button" disabled={!listSaves().length} onClick={() => setView('load')}><span className="horizon-label">RESUME GAME</span><ChevronRight size={14} className="nav-chevron" /></Button>
            <Button variant="launcher" className="horizon-button" onClick={() => setView('settings')}><span className="horizon-label">OPTIONS</span><ChevronRight size={14} className="nav-chevron" /></Button>
            <Button variant="launcher" className="horizon-button" onClick={() => setView('about')}><span className="horizon-label">AUTHORS</span><ChevronRight size={14} className="nav-chevron" /></Button>
          </div>
          <div className="mt-6 max-w-[255px] border-t border-border/10 pt-4 text-[10px] leading-5 text-muted-foreground/75">
            <div className="font-medium tracking-normal text-foreground">YOUR UNIVERSE. YOUR RULES.</div>
            <p className="mt-1">Build worlds, bend gravity, and see what survives.</p>
          </div>
        </>}
        {view === 'load' && <div className="horizon-submenu"><LoadList onLoad={onLoad} back={() => setView('menu')} /></div>}
        {view === 'settings' && <div className="horizon-submenu"><SettingsView prefs={prefs} setPrefs={(p) => { savePrefs(p); setPrefs(p); }} back={() => setView('menu')} /></div>}
        {view === 'about' && <div className="horizon-submenu"><Header title="AUTHORS & ORIGINS" back={() => setView('menu')} /><div className="relative overflow-hidden rounded-xl border border-border/25 bg-gradient-to-br from-primary/10 via-background/80 to-accent/10 p-4"><div className="text-[9px] font-semibold tracking-normal text-foreground">THE MIND BEHIND THE COSMOS</div><h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">THE BIG R<span className="text-foreground">.</span></h2><div className="mt-1 text-[10px] tracking-normal text-foreground">CREATOR · WORLD-BUILDER · GRAVITY ARCHITECT</div><p className="mt-3 text-xs leading-5 text-foreground">One big idea. An entire universe to play with. The Big R brings SOLARIS to life—a cosmic playground where stars ignite, planets find their paths, and gravity writes the rules.</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Equal parts imagination and orbital chaos, this is a place to experiment boldly, build impossible systems, and see what happens when you take the universe into your own hands.</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg border border-border/10 bg-card/20 p-2"><div className="text-[9px] tracking-widest text-primary">THE VISION</div><div className="mt-1 text-[11px] font-semibold text-foreground">Make space playable</div></div><div className="rounded-lg border border-border/10 bg-card/20 p-2"><div className="text-[9px] tracking-widest text-primary">THE MISSION</div><div className="mt-1 text-[11px] font-semibold text-foreground">Build your own cosmos</div></div></div></div><p className="py-3 text-[10px] leading-4 text-muted-foreground">SOLARIS is an evolving beta project created by The Big R. Every universe is a new chance to make something legendary.</p></div>}
        {view === 'about' && <Button asChild variant="outline" className="mt-3 w-full">
          <a href="https://github.com/urboythegooner/Movie-files/blob/main/index.html">HTML version <ChevronRight size={14} /></a>
        </Button>}
        <div className="launcher-footer mt-auto pt-10">
          <div>CREATED BY THE BIG R</div>
          <div className="mt-1">SOLARIS · ORBITAL PHYSICS SIMULATION</div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function Feature({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return <div className="feature-tile"><div className="mb-3 text-primary/90">{icon}</div><div className="text-xs font-semibold text-foreground">{title}</div><div className="mt-1 text-[10px] leading-4 text-muted-foreground">{sub}</div></div>;
}

function Menu({ onNew, go }: { onNew: () => void; go: (v: View) => void }) {
  const has = listSaves().length > 0;
  return (
    <div className="flex flex-col gap-2.5">
      <Button size="lg" onClick={onNew} className="launcher-primary h-12 justify-between px-4 text-sm font-semibold">
        <span className="flex items-center"><Play className="mr-3 h-4 w-4" /> Create new universe</span><ChevronRight size={17} />
      </Button>
      <Button size="lg" variant="secondary" disabled={!has} onClick={() => go('load')} className="launcher-secondary h-11 justify-start px-4 text-sm">
        <FolderOpen className="mr-3 h-4 w-4" /> Continue simulation <span className="ml-auto text-[10px] opacity-60">{has ? `${listSaves().length} SAVED` : 'NO SAVES'}</span>
      </Button>
      <Button size="lg" variant="outline" onClick={() => go('settings')} className="launcher-secondary h-11 justify-start px-4 text-sm">
        <Settings2 className="mr-3 h-4 w-4" /> Graphics & simulation
      </Button>
    </div>
  );
}

function Header({ title, back }: { title: string; back: () => void }) {
  return <div className="mb-4 flex items-center gap-2"><Button size="icon" variant="ghost" aria-label="Back to main menu" className="h-8 w-8 text-muted-foreground hover:bg-card/10 hover:text-foreground" onClick={back}><ArrowLeft className="h-4 w-4" /></Button><span className="text-xs font-semibold tracking-widest text-foreground">{title}</span></div>;
}

function LoadList({ onLoad, back }: { onLoad: (id: string) => void; back: () => void }) {
  const [saves, setSaves] = useState(listSaves);
  return <div><Header title="LOAD UNIVERSE" back={back} />
    {saves.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No saved universes yet.</p>}
    <div className="max-h-72 space-y-2 overflow-y-auto">
      {saves.map((s) => <div key={s.id} className="save-row flex items-center gap-2 p-3">
        <Button variant="ghost" className="min-w-0 flex-1 flex-col items-start text-left" onClick={() => onLoad(s.id)}>
          <div className="truncate text-sm font-medium text-foreground">{s.name}{s.ultra && <span className="ml-2 text-[9px] tracking-widest text-primary">ULTRA</span>}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">{s.bodies} celestial bodies · {formatDistanceToNow(s.savedAt, { addSuffix: true })}</div>
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { deleteSave(s.id); setSaves(listSaves()); }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>)}
    </div>
  </div>;
}

const TOGGLES: [keyof Prefs, string, string][] = [['prediction', 'Future paths', 'Calculate projected future paths'], ['trails', 'Trails', 'Show recent body trajectories'], ['labels', 'Labels', 'Name bodies and display temperatures'], ['orbitAssist', 'Orbit assist on drop', 'Suggest stable velocity when placing bodies'], ['travel', 'Space travel', '']];

function SettingsView({ prefs, setPrefs, back }: { prefs: Prefs; setPrefs: (p: Prefs) => void; back: () => void }) {
  return <div><Header title="PREFERENCES" back={back} />
    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Rendering quality</Label>
    <div className="mt-2 rounded-md border border-border/25 bg-primary/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold tracking-wide text-primary">Graphics & textures</div><p className="mt-1 text-[10px] text-muted-foreground">Lower for smoother performance, higher for detail.</p></div><span className="text-xs font-bold tabular-nums text-primary">{prefs.graphicsQuality}%</span></div>
      <Slider className="mt-4" min={10} max={150} step={5} value={[prefs.graphicsQuality]} onValueChange={([v]) => setPrefs({ ...prefs, graphicsQuality: v })} />
      <div className="mt-2 flex justify-between text-[9px] text-muted-foreground"><span>SMOOTH / LOW</span><span>150% MAX DETAIL</span></div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{prefs.graphicsQuality < 35 ? "Performance mode: lighter rendering and fewer effects." : prefs.graphicsQuality < 70 ? "Balanced mode: good detail with smoother performance." : prefs.graphicsQuality <= 100 ? "Ultra detail: richer planetary textures, lighting, and visual effects." : `EXTREME ${prefs.graphicsQuality}%: denser surface textures and up to ${((prefs.graphicsQuality / 100) ** 2).toFixed(2)}× render pixel density. Higher settings may reduce FPS.`}</p>
    </div>
    <div className="mt-5 space-y-4">
      <div className="rounded-md border border-border/25 bg-primary/5 p-3">
        <div className="mb-1 flex items-center justify-between gap-2"><Label className="text-xs font-semibold text-primary">Universe size</Label><span className="text-xs tabular-nums text-primary">{prefs.universeSystems} systems</span></div>
        <p className="mb-3 text-[10px] leading-4 text-muted-foreground">Choose how many distant solar systems to generate in each new universe.</p>
        <Slider min={0} max={100} step={1} value={[prefs.universeSystems]} onValueChange={([v]) => setPrefs({ ...prefs, universeSystems: v })} />
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>0 systems</span><span>100 systems</span></div>
        <div className="mb-1 mt-4 flex items-center justify-between gap-2"><Label className="text-xs text-foreground">Planets per system</Label><span className="text-xs tabular-nums text-primary">{prefs.planetsPerSystem}</span></div>
        <Slider min={1} max={12} step={1} value={[prefs.planetsPerSystem]} onValueChange={([v]) => setPrefs({ ...prefs, planetsPerSystem: v })} />
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Up to 1,200 distant planets. Settings are saved automatically and apply when you start a new universe.</p>
      </div>
      {TOGGLES.map(([k, label, desc]) => <div key={k} className="flex items-center justify-between gap-3">
      <div><Label htmlFor={k} className="text-sm text-foreground">{label}</Label><p className="mt-1 text-[10px] text-muted-foreground">{desc}</p></div>
      <Switch id={k} checked={prefs[k] as boolean} onCheckedChange={(v) => setPrefs({ ...prefs, [k]: v })} />
    </div>)}
      {prefs.prediction && <div className="space-y-2">
        <div className="flex items-center justify-between gap-3"><Label htmlFor="prediction-horizon" className="text-xs">Prediction range</Label><span className="text-xs tabular-nums">{prefs.horizonYears.toFixed(2)} yr</span></div>
        <Slider id="prediction-horizon" min={0.1} max={3} step={0.05} value={[prefs.horizonYears]} onValueChange={([v]) => setPrefs({ ...prefs, horizonYears: v })} />
      </div>}
    </div>
  </div>;
}