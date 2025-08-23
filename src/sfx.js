// [C4-STEP-6] Simple SFX via WebAudio (ohne Assets)

let ctx = null;
let enabled = true;

export function setSfxEnabled(on){ enabled = !!on; }
export function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// kleine Hüllkurve
function blip({ freq=440, dur=0.08, type='sine', gain=0.05 }) {
  if (!enabled) return;
  ensureAudio();
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function sfxPlace()   { blip({ freq: 520, dur: 0.06, type:'triangle', gain:0.06 }); }
export function sfxLanded()  { blip({ freq: 280, dur: 0.07, type:'sine', gain:0.06 }); }
export function sfxInvalid() { blip({ freq: 180, dur: 0.10, type:'square', gain:0.05 }); }
export function sfxWin()     { blip({ freq: 680, dur: 0.14, type:'sawtooth', gain:0.07 }); setTimeout(()=> blip({freq:900,dur:0.12,type:'sawtooth',gain:0.06}), 110); }
export function sfxDraw()    { blip({ freq: 240, dur: 0.12, type:'sine', gain:0.05 }); }
export function sfxTurnAI()  { blip({ freq: 360, dur: 0.06, type:'sine', gain:0.05 }); }
