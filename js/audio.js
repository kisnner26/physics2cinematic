// audio.js — Motor de audio procedural de alta calidad (Web Audio API pura)
// Sin archivos externos. Todo sintetizado en runtime con capas físicamente informadas.

let ctx = null;
let masterGain = null;
let masterComp = null;   // compresor master para evitar clipping
let reverbNode = null;   // reverb de sala sintética (ConvolverNode)
let flyingOsc = null, flyingGain = null, flyingMod = null;
let enabled = true;

// ── INIT del contexto ─────────────────────────────────────────────────────
function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Compresor master — evita clipping en sonidos simultáneos
    masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -14;
    masterComp.knee.value       =  6;
    masterComp.ratio.value      =  4;
    masterComp.attack.value     =  0.003;
    masterComp.release.value    =  0.18;
    masterComp.connect(ctx.destination);

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(masterComp);

    reverbNode = buildReverb();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── REVERB sintético ──────────────────────────────────────────────────────
// Genera un impulso de sala usando ruido coloreado con decay exponencial
function buildReverb() {
  const ac = ctx;
  const sr = ac.sampleRate;
  const len = sr * 1.8;     // 1.8 s de cola de reverb
  const buf = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // Ruido con decay exponencial + ligera coloración
      const env = Math.exp(-4.5 * i / len);
      d[i] = (Math.random() * 2 - 1) * env;
    }
  }
  const conv = ac.createConvolver();
  conv.buffer = buf;
  const rvGain = ac.createGain();
  rvGain.gain.value = 0.18;  // mix seco/húmedo
  conv.connect(rvGain);
  rvGain.connect(masterGain);
  return conv;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function makeGain(val, target) {
  const g = getCtx().createGain();
  g.gain.value = val;
  g.connect(target || masterGain);
  return g;
}

// Buffer de ruido blanco de duración exacta
function noiseBuffer(duration) {
  const ac = getCtx();
  const n  = Math.ceil(ac.sampleRate * duration);
  const b  = ac.createBuffer(1, n, ac.sampleRate);
  const d  = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = b;
  return src;
}

// Filtro rápido
function makeFilter(type, freq, Q) {
  const f = getCtx().createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (Q !== undefined) f.Q.value = Q;
  return f;
}

// Oscilador simple
function makeOsc(type, freq) {
  const o = getCtx().createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

// Conectar cadena: [src, n1, n2, ...] → destino
function chain(nodes, dest) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  nodes[nodes.length - 1].connect(dest || masterGain);
  return nodes[0];
}

// ── DISPARO DE CAÑÓN ──────────────────────────────────────────────────────
// Capas: 1) sub-boom 2) cuerpo del disparo (ruido filtrado) 3) crack inicial
//        4) reverb de cañón 5) presión aérea (lowshelf boost)
export function soundFire() {
  if (!enabled) return;
  const ac  = getCtx();
  const now = ac.currentTime;

  // ── 1. SUB-BOOM: oscilador de golpe grave ────────────────────────────
  // Emula la expansión de gas al disparar
  const sub  = makeOsc('sine', 55);
  const sub2 = makeOsc('triangle', 38);
  const subG = makeGain(0);

  subG.gain.setValueAtTime(0, now);
  subG.gain.linearRampToValueAtTime(0.85, now + 0.004);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  sub.frequency.setValueAtTime(55, now);
  sub.frequency.exponentialRampToValueAtTime(18, now + 0.55);
  sub2.frequency.setValueAtTime(38, now);
  sub2.frequency.exponentialRampToValueAtTime(12, now + 0.55);

  const subMix = makeGain(1);
  sub.connect(subMix); sub2.connect(subMix);
  subMix.connect(subG); subG.connect(masterGain);
  subG.connect(reverbNode);

  sub.start(now); sub2.start(now);
  sub.stop(now + 0.6); sub2.stop(now + 0.6);

  // ── 2. CUERPO DEL DISPARO: ruido filtrado en banda media ────────────
  // Simula la columna de gas y la explosión de pólvora
  const body   = noiseBuffer(0.35);
  const bodyLP = makeFilter('lowpass',  1800, 0.6);
  const bodyHP = makeFilter('highpass', 80,   0.5);
  const bodyG  = makeGain(0);

  bodyG.gain.setValueAtTime(0, now);
  bodyG.gain.linearRampToValueAtTime(1.1, now + 0.006);
  bodyG.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  chain([body, bodyHP, bodyLP, bodyG], masterGain);
  bodyG.connect(reverbNode);
  body.start(now);
  body.stop(now + 0.35);

  // ── 3. CRACK INICIAL: ruido de alta frecuencia (boca del cañón) ─────
  const crack    = noiseBuffer(0.04);
  const crackHP  = makeFilter('highpass', 3500, 1.2);
  const crackPeak = makeFilter('peaking', 6000, 2);
  crackPeak.gain.value = 8;
  const crackG   = makeGain(0);

  crackG.gain.setValueAtTime(0, now);
  crackG.gain.linearRampToValueAtTime(0.7, now + 0.001);
  crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  chain([crack, crackHP, crackPeak, crackG], masterGain);
  crack.start(now); crack.stop(now + 0.04);

  // ── 4. ONDA DE PRESIÓN: shelving boost bajo ──────────────────────────
  const pressure   = noiseBuffer(0.12);
  const pressureLS = makeFilter('lowshelf', 200);
  pressureLS.gain.value = 14;
  const pressureG  = makeGain(0);

  pressureG.gain.setValueAtTime(0, now + 0.008);
  pressureG.gain.linearRampToValueAtTime(0.5, now + 0.018);
  pressureG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  chain([pressure, pressureLS, pressureG], masterGain);
  pressureG.connect(reverbNode);
  pressure.start(now + 0.008);
  pressure.stop(now + 0.12);

  // ── 5. RING metálico del cañón ───────────────────────────────────────
  const ring  = makeOsc('sine', 320);
  const ring2 = makeOsc('sine', 480);
  const ringG = makeGain(0);

  ringG.gain.setValueAtTime(0, now + 0.01);
  ringG.gain.linearRampToValueAtTime(0.06, now + 0.02);
  ringG.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  ring.connect(ringG); ring2.connect(ringG);
  ringG.connect(masterGain); ringG.connect(reverbNode);
  ring.start(now + 0.01); ring2.start(now + 0.01);
  ring.stop(now + 0.7); ring2.stop(now + 0.7);
}

// ── SILBIDO EN VUELO ──────────────────────────────────────────────────────
// Síntesis FM: portadora + moduladora para el silbido real de proyectil supersónico
// Con ruido de arrastre de aire y variación de Doppler
export function startFlyingSound(v0) {
  if (!enabled) return;
  stopFlyingSound();
  const ac  = getCtx();
  const now = ac.currentTime;

  // Portadora principal del silbido
  flyingOsc = makeOsc('sine', 1200 + v0 * 18);

  // Moduladora FM: crea el timbre característico del silbido de bala
  flyingMod = makeOsc('sine', 220);
  const modDepth = ac.createGain();
  modDepth.gain.value = 380;
  flyingMod.connect(modDepth);
  modDepth.connect(flyingOsc.frequency);

  // Filtro de paso de banda: enfoca el silbido
  const flyBP = makeFilter('bandpass', 1400, 4);

  flyingGain = ac.createGain();
  flyingGain.gain.setValueAtTime(0, now);
  flyingGain.gain.linearRampToValueAtTime(0.14, now + 0.06);

  flyingOsc.connect(flyBP);
  flyBP.connect(flyingGain);
  flyingGain.connect(masterGain);

  flyingMod.start(now);
  flyingOsc.start(now);

  // Ruido de arrastre de aire (whoosh)
  const whoosh    = noiseBuffer(0.2);
  const whooshBP  = makeFilter('bandpass', 800, 1.5);
  const whooshG   = makeGain(0);
  whooshG.gain.setValueAtTime(0, now);
  whooshG.gain.linearRampToValueAtTime(0.07, now + 0.08);
  chain([whoosh, whooshBP, whooshG], masterGain);
  whoosh.start(now);
  whoosh.stop(now + 0.2);
}

export function updateFlyingSound(vx, vy) {
  if (!flyingOsc || !flyingGain || !enabled) return;
  const ac    = getCtx();
  const speed = Math.sqrt(vx * vx + vy * vy);
  // Doppler: pitch baja conforme desacelera
  flyingOsc.frequency.setTargetAtTime(300 + speed * 14, ac.currentTime, 0.06);
}

export function stopFlyingSound() {
  if (!flyingOsc) return;
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    if (flyingGain) {
      flyingGain.gain.cancelScheduledValues(now);
      flyingGain.gain.setTargetAtTime(0, now, 0.04);
    }
    flyingOsc.stop(now + 0.12);
    if (flyingMod) flyingMod.stop(now + 0.12);
  } catch (_) {}
  flyingOsc = null; flyingGain = null; flyingMod = null;
}

// ── IMPACTO ───────────────────────────────────────────────────────────────
// Capas: 1) golpe de cuerpo (thud) 2) metal aplastado 3) fragmentos/cascada
//        4) grito del mono (FM vocal) 5) reverb de eco
export function soundImpact() {
  if (!enabled) return;
  stopFlyingSound();
  const ac  = getCtx();
  const now = ac.currentTime;

  // ── 1. THUD: golpe físico grave ──────────────────────────────────────
  const thud    = makeOsc('sine', 90);
  const thudSub = makeOsc('triangle', 45);
  const thudG   = makeGain(0);

  thudG.gain.setValueAtTime(0, now);
  thudG.gain.linearRampToValueAtTime(1.0, now + 0.003);
  thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  thud.frequency.setValueAtTime(90, now);
  thud.frequency.exponentialRampToValueAtTime(22, now + 0.45);
  thudSub.frequency.setValueAtTime(45, now);
  thudSub.frequency.exponentialRampToValueAtTime(15, now + 0.45);

  thud.connect(thudG); thudSub.connect(thudG);
  thudG.connect(masterGain); thudG.connect(reverbNode);
  thud.start(now); thudSub.start(now);
  thud.stop(now + 0.5); thudSub.stop(now + 0.5);

  // ── 2. CRACK de deformación: ataque agudo ────────────────────────────
  const snap    = noiseBuffer(0.08);
  const snapHP  = makeFilter('highpass', 2800, 1.0);
  const snapPK  = makeFilter('peaking', 5000, 3);
  snapPK.gain.value = 10;
  const snapG   = makeGain(0);

  snapG.gain.setValueAtTime(0, now);
  snapG.gain.linearRampToValueAtTime(0.9, now + 0.002);
  snapG.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  chain([snap, snapHP, snapPK, snapG], masterGain);
  snap.start(now); snap.stop(now + 0.08);

  // ── 3. FRAGMENTOS: cascada de micro-clicks ────────────────────────────
  for (let i = 0; i < 5; i++) {
    const delay   = 0.04 + i * 0.028 + Math.random() * 0.02;
    const frag    = noiseBuffer(0.018);
    const fragBP  = makeFilter('bandpass', 1500 + Math.random() * 2000, 3);
    const fragG   = makeGain(0);
    fragG.gain.setValueAtTime(0, now + delay);
    fragG.gain.linearRampToValueAtTime(0.22 - i * 0.03, now + delay + 0.002);
    fragG.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.018);
    chain([frag, fragBP, fragG], masterGain);
    fragG.connect(reverbNode);
    frag.start(now + delay);
    frag.stop(now + delay + 0.02);
  }

  // ── 4. REBOTE METÁLICO de fragmentos ─────────────────────────────────
  [0.12, 0.22, 0.34].forEach((t, i) => {
    const bounce  = makeOsc('sine', 400 + i * 180);
    const bounceG = makeGain(0);
    bounceG.gain.setValueAtTime(0, now + t);
    bounceG.gain.linearRampToValueAtTime(0.06 - i * 0.015, now + t + 0.003);
    bounceG.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18);
    bounce.frequency.setValueAtTime(400 + i * 180, now + t);
    bounce.frequency.exponentialRampToValueAtTime(80, now + t + 0.18);
    bounce.connect(bounceG);
    bounceG.connect(masterGain);
    bounceG.connect(reverbNode);
    bounce.start(now + t);
    bounce.stop(now + t + 0.2);
  });

  // ── 5. SILENCIO TRAS IMPACTO: tail de reverb sutil ───────────────────
  const tail    = noiseBuffer(0.5);
  const tailLP  = makeFilter('lowpass', 400, 0.5);
  const tailG   = makeGain(0);
  tailG.gain.setValueAtTime(0, now + 0.08);
  tailG.gain.linearRampToValueAtTime(0.08, now + 0.12);
  tailG.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  chain([tail, tailLP, tailG], reverbNode);
  tail.start(now + 0.08);
  tail.stop(now + 0.5);
}

// ── RESET ────────────────────────────────────────────────────────────────
// Mecanismo de click + pequeño whoosh de "aire escapando"
export function soundReset() {
  if (!enabled) return;
  const ac  = getCtx();
  const now = ac.currentTime;

  // Click mecánico
  const click   = noiseBuffer(0.025);
  const clickBP = makeFilter('bandpass', 2200, 2);
  const clickG  = makeGain(0);
  clickG.gain.setValueAtTime(0, now);
  clickG.gain.linearRampToValueAtTime(0.22, now + 0.001);
  clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  chain([click, clickBP, clickG], masterGain);
  click.start(now); click.stop(now + 0.03);

  // Tono de confirmación breve
  const tone  = makeOsc('sine', 660);
  const tone2 = makeOsc('sine', 880);
  const toneG = makeGain(0);
  toneG.gain.setValueAtTime(0, now + 0.01);
  toneG.gain.linearRampToValueAtTime(0.05, now + 0.02);
  toneG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  tone.connect(toneG); tone2.connect(toneG);
  toneG.connect(masterGain);
  tone.start(now + 0.01); tone2.start(now + 0.01);
  tone.stop(now + 0.15); tone2.stop(now + 0.15);
}

// ── HOVER ─────────────────────────────────────────────────────────────────
export function soundTick() {
  if (!enabled) return;
  const ac  = getCtx();
  const now = ac.currentTime;
  const o   = makeOsc('sine', 1100);
  const g   = makeGain(0);
  g.gain.setValueAtTime(0.035, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 0.03);
}

// ── CAMBIO DE MODO ────────────────────────────────────────────────────────
export function soundModeSwitch() {
  if (!enabled) return;
  const ac  = getCtx();
  const now = ac.currentTime;

  // Dos tonos rápidos (up)
  [0, 0.09].forEach((t, i) => {
    const freq = 420 + i * 220;
    const o    = makeOsc('triangle', freq);
    const g    = makeGain(0);
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.08, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);
    o.connect(g); g.connect(masterGain);
    o.start(now + t); o.stop(now + t + 0.14);
  });
}

// ── SLIDER ────────────────────────────────────────────────────────────────
// Throttle: no más de un sonido cada 40ms
let lastSlider = 0;
export function soundSlider() {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastSlider < 40) return;
  lastSlider = now;
  const ac   = getCtx();
  const t    = ac.currentTime;
  const o    = makeOsc('sine', 520 + Math.random() * 80);
  const g    = makeGain(0);
  g.gain.setValueAtTime(0.025, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + 0.04);
}

// ── TOGGLE ────────────────────────────────────────────────────────────────
export function setAudioEnabled(val) {
  enabled = val;
  if (!val) stopFlyingSound();
  if (masterGain) {
    const ac = getCtx();
    masterGain.gain.setTargetAtTime(val ? 0.72 : 0, ac.currentTime, 0.05);
  }
}

export function isAudioEnabled() { return enabled; }
