
/* ---------- audio: synthesized sfx + reverb + generative cathedral ambience + haptics ---------- */
let actx = null, muted = false, musicOn = true, master = null, sfxBus = null, musBus = null, verbIn = null, ambience = null;

function makeImpulse(sec, decay) {
  const len = Math.floor(actx.sampleRate * sec), buf = actx.createBuffer(2, len, actx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}
function ensureAudio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = actx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      master.connect(comp); comp.connect(actx.destination);
      sfxBus = actx.createGain(); sfxBus.connect(master);
      musBus = actx.createGain(); musBus.gain.value = 0; musBus.connect(master);
      const conv = actx.createConvolver(); conv.buffer = makeImpulse(2.8, 2.6);
      const wet = actx.createGain(); wet.gain.value = 0.55; conv.connect(wet); wet.connect(master);
      verbIn = actx.createGain(); verbIn.connect(conv);
    } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  if (actx && musicOn && !ambience) startAmbience();
}
document.addEventListener('visibilitychange', () => { if (!actx) return; if (document.hidden) actx.suspend().catch(() => {}); else actx.resume().catch(() => {}); });
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, ensureAudio, { passive: true }));

function setMuted(v) {
  muted = v;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, actx.currentTime, 0.05);
}
function setMusic(v) {
  musicOn = v;
  if (!actx) return;
  if (v && !ambience) startAmbience();
  musBus.gain.setTargetAtTime(v ? 1 : 0, actx.currentTime, 0.4);
}
function buzz(p) { try { if (!muted && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

/* wet: 0..1 amount sent to the cathedral reverb */
function tone(f, d, type, gain, to, delay, wet, bus) {
  if (!actx || muted) return;
  const t = actx.currentTime + (delay || 0);
  const o = actx.createOscillator(), a = actx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(gain || 0.1, t + Math.min(0.012, d / 3)); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(a); a.connect(bus || sfxBus);
  if (wet && verbIn) { const s = actx.createGain(); s.gain.value = wet; a.connect(s); s.connect(verbIn); }
  o.start(t); o.stop(t + d + 0.05);
}
function noise(d, gain, fc, o) {
  if (!actx || muted) return;
  o = o || {};
  const t = actx.currentTime + (o.delay || 0);
  const len = Math.floor(actx.sampleRate * d), buf = actx.createBuffer(1, len, actx.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, o.curve || 1.4);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(fc, t); f.Q.value = o.q || 0.7;
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d);
  const a = actx.createGain(); a.gain.value = gain;
  src.connect(f); f.connect(a); a.connect(o.bus || sfxBus);
  if (o.wet && verbIn) { const s = actx.createGain(); s.gain.value = o.wet; a.connect(s); s.connect(verbIn); }
  src.start(t);
}
const bell = (f, d, g, delay, wet) => { tone(f, d, 'sine', g, null, delay, wet == null ? 0.9 : wet); tone(f * 2.76, d * 0.5, 'sine', g * 0.35, null, delay, wet == null ? 0.9 : wet); tone(f * 5.4, d * 0.25, 'sine', g * 0.12, null, delay, 0.6); };

const sfx = {
  click() { tone(760, 0.05, 'sine', 0.05); buzz(6); },
  select() { tone(520, 0.08, 'sine', 0.06, null, 0, 0.3); tone(780, 0.12, 'sine', 0.035, null, 0.045, 0.4); buzz(8); },
  move() {
    noise(0.16, 0.07, 900, { type: 'bandpass', q: 1.2, to: 400 });
    tone(150, 0.16, 'triangle', 0.2, 55, 0.06, 0.15);
    noise(0.07, 0.12, 380, { delay: 0.07 });
    buzz(12);
  },
  castle() { sfx.move(); setTimeout(sfx.move, 170); },
  capture() {
    tone(95, 0.8, 'sine', 0.42, 28, 0, 0.35);                 // sub boom
    noise(0.8, 0.3, 2400, { to: 160, wet: 0.5, curve: 1.8 }); // stone crash
    noise(0.12, 0.28, 6500, { type: 'highpass', curve: 3 });   // crack
    tone(420, 0.7, 'sawtooth', 0.05, 1500, 0.02, 0.6);         // magic whoosh
    for (let i = 0; i < 9; i++) tone(700 + Math.random() * 1900, 0.05, 'square', 0.025, null, 0.22 + i * 0.06 + Math.random() * 0.05); // debris clatter
    bell(1568, 1.1, 0.03, 0.12); bell(2093, 0.9, 0.02, 0.3);
    buzz([40, 30, 70]);
  },
  check() { bell(262, 2.2, 0.1, 0, 1); bell(392, 1.8, 0.06, 0.12, 1); tone(110, 0.7, 'sine', 0.2, 80, 0, 0.3); buzz([60, 50, 60]); },
  promote() { [523, 659, 784, 1046, 1568].forEach((f, i) => bell(f, 1.0, 0.06, i * 0.09, 0.8)); buzz([20, 30, 20, 30, 60]); },
  win() {
    [262, 330, 392, 523].forEach((f, i) => { tone(f, 2.4, 'triangle', 0.08, null, i * 0.16, 0.9); tone(f * 2, 2.2, 'sine', 0.04, null, i * 0.16, 0.9); });
    [784, 988, 1175, 1568].forEach((f, i) => bell(f, 1.4, 0.05, 0.7 + i * 0.12, 0.9));
    noise(1.6, 0.05, 5000, { type: 'highpass', delay: 0.6, wet: 0.7, curve: 0.8 });
    buzz([80, 60, 80, 60, 200]);
  },
  lose() { [330, 311, 262, 196].forEach((f, i) => tone(f, 1.6, 'triangle', 0.08, f * 0.97, i * 0.3, 0.9)); tone(65, 2.2, 'sine', 0.2, 50, 0.3, 0.4); buzz([200, 80, 120]); },
  end() { [392, 494, 587, 784].forEach((f, i) => tone(f, 1.2, 'triangle', 0.07, null, i * 0.12, 0.8)); },
  error() { tone(180, 0.18, 'square', 0.04, 120); buzz(30); }
};

/* generative ambience: low drone, cold wind, fire crackle, sparse bells in D minor pentatonic */
function startAmbience() {
  if (!actx || ambience) return;
  ambience = { on: true };
  const t = actx.currentTime;
  musBus.gain.setTargetAtTime(1, t, 1.2);
  // drone
  const dg = actx.createGain(); dg.gain.value = 0.05; const dl = actx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 260; dl.Q.value = 2;
  [[55, 'sawtooth', 0], [55.4, 'sawtooth', 0], [82.4, 'triangle', 0], [110.3, 'sine', 0]].forEach(([f, ty]) => { const o = actx.createOscillator(); o.type = ty; o.frequency.value = f; o.connect(dl); o.start(t); });
  const lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90; lfo.connect(lg); lg.connect(dl.frequency); lfo.start(t);
  dl.connect(dg); dg.connect(musBus);
  // wind
  const wl = Math.floor(actx.sampleRate * 4), wb = actx.createBuffer(1, wl, actx.sampleRate), wd = wb.getChannelData(0);
  for (let i = 0; i < wl; i++) wd[i] = Math.random() * 2 - 1;
  const ws = actx.createBufferSource(); ws.buffer = wb; ws.loop = true;
  const wf = actx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.8;
  const wg = actx.createGain(); wg.gain.value = 0.035;
  const wl2 = actx.createOscillator(), wlg = actx.createGain(); wl2.frequency.value = 0.11; wlg.gain.value = 0.02; wl2.connect(wlg); wlg.connect(wg.gain); wl2.start(t);
  const wl3 = actx.createOscillator(), wlg3 = actx.createGain(); wl3.frequency.value = 0.05; wlg3.gain.value = 180; wl3.connect(wlg3); wlg3.connect(wf.frequency); wl3.start(t);
  ws.connect(wf); wf.connect(wg); wg.connect(musBus); ws.start(t);
  // crackle + bells
  const scale = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440];
  const crackle = () => {
    if (!ambience) return;
    if (!muted && musicOn && !document.hidden) noise(0.03 + Math.random() * 0.04, 0.05 + Math.random() * 0.06, 2500 + Math.random() * 3000, { type: 'highpass', bus: musBus, curve: 3 });
    setTimeout(crackle, 120 + Math.random() * 700);
  };
  const melody = () => {
    if (!ambience) return;
    if (!muted && musicOn && !document.hidden) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      bellBus(n, 3.2, 0.03);
      if (Math.random() < 0.4) bellBus(scale[Math.floor(Math.random() * scale.length)] * 2, 2.6, 0.02, 0.5);
    }
    setTimeout(melody, 3200 + Math.random() * 4800);
  };
  const bellBus = (f, d, g, delay) => { tone(f, d, 'sine', g, null, delay, 1, musBus); tone(f * 2.76, d * 0.4, 'sine', g * 0.3, null, delay, 0.8, musBus); };
  crackle(); setTimeout(melody, 1800);
}
