import orbitImage from '@/assets/solaris-orbit .svg';
import ringsImage from '@/assets/solaris-rings .svg';
import nebulaImage from '@/assets/solaris-nebula .svg';
import galaxyImage from '@/assets/solaris-galaxy .svg';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const SCENES = [
  { image: orbitImage, title: 'Exploring the cosmos', caption: 'Earth from the dark side of the sun', position: 'center' },
  { image: ringsImage, title: 'A universe of possibilities', caption: 'Ring light across a gas giant', position: 'center' },
  { image: nebulaImage, title: 'Your universe is taking shape', caption: 'Starlight forming in the dust', position: 'center' },
  { image: galaxyImage, title: 'Almost there', caption: 'The long way home', position: 'center' },
];

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [scene, setScene] = useState(0);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    const started = Date.now();
    const progress = window.setInterval(() => {
      const next = Math.min(100, ((Date.now() - started) / 2400) * 100);
      setElapsed(next);
      setScene(Math.min(SCENES.length - 1, Math.floor(next / 25)));
      if (next >= 100) {
        window.clearInterval(progress);
        completeRef.current();
      }
    }, 100);
    return () => window.clearInterval(progress);
  }, []);
  return (
    <motion.div className="solar-loading fixed inset-0 z-[80] flex items-end overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .55 }}>
      <div className="absolute inset-0 bg-background" />
      {SCENES.map((s, i) => (
        <motion.div key={i} className="solar-loading-scene absolute inset-0" aria-hidden={i !== scene}
          style={{ backgroundImage: `url("${s.image}")`, backgroundPosition: s.position }}
          animate={{ opacity: i === scene ? 1 : 0, scale: i === scene ? 1 : 1.05 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }} />
      ))}
      <div className="solar-loading-shade absolute inset-0" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-6 pb-9 pt-7 sm:px-12 sm:pb-12">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold tracking-normal text-foreground drop-shadow-lg">SOLARIS <span className="ml-1 text-[9px] font-medium tracking-normal text-foreground/65">BETA</span></div>
          <div className="text-right"><div className="text-[10px] font-semibold tracking-normal text-foreground/85">THE BIG R <span className="text-primary">✦</span></div><div className="mt-1 text-[8px] tracking-normal text-foreground/55">COSMIC VISIONARY · GRAVITY ARCHITECT</div></div>
        </div>
        <div className="mt-[29vh] max-w-xl sm:mt-[26vh]">
          <AnimatePresence mode="wait">
            <motion.h1 key={SCENES[scene].title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .35 }}
              className="text-3xl font-light leading-tight tracking-normal text-foreground drop-shadow-lg sm:text-5xl">{SCENES[scene].title}</motion.h1>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p key={SCENES[scene].caption} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .5, delay: .12 }}
              className="mt-3 text-xs tracking-normal text-foreground/70 drop-shadow-lg">{SCENES[scene].caption}</motion.p>
          </AnimatePresence>
          <div className="mt-6 flex items-center gap-2">
            {SCENES.map((s, i) => (
              <span key={i} className={`solar-loading-thumb ${i === scene ? 'is-active' : ''}`} aria-hidden="true">
                <img src={s.image} alt="" width={160} height={91} loading="lazy" />
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between text-xs text-foreground/75">
            <span>Entering sandbox</span><span className="font-mono tabular-nums">{Math.floor(elapsed)}%</span>
          </div>
          <div className="solar-loading-track mt-3"><motion.div className="solar-loading-progress" style={{ width: `${elapsed}%` }} /></div>
        </div>
      </div>
    </motion.div>
  );
}