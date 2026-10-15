let audio: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!audio) {
      const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      audio = new AudioCtor();
      master = audio.createGain();
      master.gain.value = 0.22;
      master.connect(audio.destination);
    }
    if (audio.state === 'suspended') void audio.resume();
  } catch { /* Audio is optional; simulation remains usable without it. */ }
}

function tone(freq: number, endFreq: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
  if (!audio || !master || audio.state !== 'running') return;
  const now = audio.currentTime + delay;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(25, freq), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain); gain.connect(master);
  osc.start(now); osc.stop(now + duration + 0.03);
}

function noise(duration: number, volume: number, lowpass: number) {
  if (!audio || !master || audio.state !== 'running') return;
  const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 1.8;
  const src = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  filter.type = 'lowpass'; filter.frequency.value = lowpass;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  src.buffer = buffer; src.connect(filter); filter.connect(gain); gain.connect(master);
  src.start(); src.stop(audio.currentTime + duration + 0.02);
}

let lastImpactAt = 0;
export function playImpact(strength: number, kind: string) {
  if (!audio || audio.state !== 'running') return;
  const now = performance.now();
  if (now - lastImpactAt < 110) return;
  lastImpactAt = now;
  const s = Math.max(0.12, Math.min(1, strength));
  if (s > 0.48 || kind === 'sun' || kind === 'blackhole') {
    noise(0.75 + s * 0.7, 0.24 * s, 420 + s * 900);
    tone(95 + s * 35, 28, 0.9, 'sawtooth', 0.22 * s);
    tone(680, 55, 0.55, 'sine', 0.12 * s, 0.025);
    tone(1500, 180, 0.22, 'triangle', 0.07 * s, 0.04);
  } else {
    noise(0.16 + s * 0.22, 0.08 + s * 0.1, 1200 + s * 2400);
    tone(240 + s * 180, 65 + s * 35, 0.22 + s * 0.15, 'triangle', 0.09 + s * 0.06);
  }
}