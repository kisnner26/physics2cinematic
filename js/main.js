// main.js

import { state, setState } from './state.js';
import { projectilePos, monkeyPos, computeTheta, impactTime, impactError, G } from './physics.js';
import {
  initRealistic, renderRealistic, resetTrail,
  triggerMuzzleFlash, setCamera, spawnFragments, setScenario
} from './realistic-scene.js';
import { initPhysics, renderPhysics, resetTrail2D } from './physics-scene.js';
import { updateHUD, showImpact, updateResults } from './hud.js';
import { initControls } from './controls.js';
import {
  animateLanding, transitionToApp, animateAppIn,
  animateImpact, animateFireButton
} from './animations.js';
import {
  soundFire, soundImpact, soundReset, soundModeSwitch,
  soundSlider, startFlyingSound, updateFlyingSound,
  stopFlyingSound, setAudioEnabled, isAudioEnabled
} from './audio.js';

let rafId = null;
const PLATFORM_TOP_H = 0.08;

// ── Swept sphere CCD ──────────────────────────────────────────────────────
const BODY_R     = 0.22;
const HEAD_R     = 0.175;
const HEAD_OFF_Y = 0.34;
const BULLET_R   = 0.09;
const HIT_BODY   = BODY_R + BULLET_R;
const HIT_HEAD   = HEAD_R + BULLET_R;

function sweptSphereT(p0x, p0y, p1x, p1y, cx, cy, R) {
  const dx = p1x-p0x, dy = p1y-p0y;
  const fx = p0x-cx,  fy = p0y-cy;
  const a  = dx*dx + dy*dy;
  if (a < 1e-12) return Infinity;
  const b    = 2*(fx*dx + fy*dy);
  const c    = fx*fx + fy*fy - R*R;
  const disc = b*b - 4*a*c;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2*a);
  const t1 = (-b + sq) / (2*a);
  if (t0 >= 0 && t0 <= 1) return t0;
  if (t1 >= 0 && t0 < 0) return 0;
  return Infinity;
}

function checkCollision(prevP, nextP, mono) {
  const tBody = sweptSphereT(prevP.x, prevP.y, nextP.x, nextP.y, mono.x, mono.y,            HIT_BODY);
  const tHead = sweptSphereT(prevP.x, prevP.y, nextP.x, nextP.y, mono.x, mono.y + HEAD_OFF_Y, HIT_HEAD);
  return Math.min(tBody, tHead);
}

// ── Estado global de animación ────────────────────────────────────────────
let impactPhase = false;
let accumulator = 0;          // acumulador de tiempo para fixed-step
const FIXED_DT  = 1 / 240;   // física a 240 Hz internamente

// ── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  animateLanding();
  document.getElementById('l-cta').addEventListener('click', () => {
    transitionToApp(() => {
      document.getElementById('landing').style.display = 'none';
      const app = document.getElementById('app');
      app.classList.remove('hidden');
      initApp();
    });
  });
});

function initApp() {
  initRealistic();
  initPhysics();
  initControls(onFire, onReset, onModeSwitch, onSliderChange, onCamChange, onScenarioChange);
  initMuteButton();
  animateAppIn();
  syncAll();
  state.h2_anchorY = state.h2 + PLATFORM_TOP_H;
  renderStatic();
  startIdleLoop();
}

function syncAll() {
  const anchorY   = state.h2 + PLATFORM_TOP_H;
  const monoRestY = anchorY - state.ropeLen;
  const theta     = computeTheta(state.h1, monoRestY, state.d, state.ropeLen);
  const tImp      = impactTime(state.v0, theta, state.d, state.ropeLen);
  setState({ theta, impactT: tImp, h2_anchorY: anchorY });
}

// ── MUTE ─────────────────────────────────────────────────────────────────
function initMuteButton() {
  const btn = document.getElementById('btn-mute');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = !isAudioEnabled();
    setAudioEnabled(next);
    btn.classList.toggle('muted', !next);
    const ico = document.getElementById('ico-sound');
    if (ico) ico.style.opacity = next ? '1' : '0.3';
  });
}

// ── CALLBACKS ─────────────────────────────────────────────────────────────
function onModeSwitch()          { soundModeSwitch(); }
function onSliderChange()        { syncAll(); soundSlider(); }
function onCamChange(camId)      { setCamera(camId); }
function onScenarioChange(id)    { setScenario(id); }

// ── RENDER ESTÁTICO ───────────────────────────────────────────────────────
function renderStatic() {
  const monoRestY = state.h2_anchorY - state.ropeLen;
  const dummy  = projectilePos(state.v0, state.theta, state.h1, 0);
  const dummyM = { x: state.d, y: monoRestY };
  renderRealistic(dummy, dummyM, false);
  renderPhysics(dummy, dummyM);
}

function startIdleLoop() {
  let last = null;
  function idle(ts) {
    if (!last) last = ts;
    last = ts;
    if (!state.running && !impactPhase) renderStatic();
    rafId = requestAnimationFrame(idle);
  }
  idle(performance.now());
}

// ── FIRE ─────────────────────────────────────────────────────────────────
function onFire() {
  if (state.running || impactPhase) return;
  resetTrail(); resetTrail2D();
  document.getElementById('result-group').classList.remove('visible');
  impactPhase = false; accumulator = 0;
  syncAll();
  setState({ running: true, t: 0, impacted: false });
  soundFire(); triggerMuzzleFlash();
  setTimeout(() => startFlyingSound(state.v0), 80);
  cancelAnimationFrame(rafId);

  const monoRestY = state.h2_anchorY - state.ropeLen;
  let prevP    = projectilePos(state.v0, state.theta, state.h1, 0);
  let lastTime = null;

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    // Frame delta clampeado: nunca más de 50ms (tab inactivo, etc.)
    const frameDelta = Math.min((ts - lastTime) / 1000, 0.050);
    lastTime = ts;

    accumulator += frameDelta;

    let hitP = null, hitM = null, hitT = 0;

    // Fixed-step loop: hasta 12 pasos por frame (safety cap)
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 12 && !hitP) {
      steps++;
      accumulator -= FIXED_DT;
      const nextT = state.t + FIXED_DT;
      const nextP = projectilePos(state.v0, state.theta, state.h1, nextT);
      const monoT = monkeyPos(state.d, monoRestY, nextT, state.ropeLen);

      const frac = checkCollision(prevP, nextP, monoT);
      if (frac !== Infinity) {
        const exactT = state.t + frac * FIXED_DT;
        hitP = projectilePos(state.v0, state.theta, state.h1, exactT);
        hitM = monkeyPos(state.d, monoRestY, exactT, state.ropeLen);
        hitT = exactT;
        setState({ t: exactT, impactT: exactT });
        accumulator = 0;
        break;
      }

      prevP = nextP;
      setState({ t: nextT });

      if (nextP.y < -3 || nextP.x > state.d * 1.9) {
        const fp = projectilePos(state.v0, state.theta, state.h1, state.t);
        const fm = monkeyPos(state.d, monoRestY, state.t, state.ropeLen);
        updateFlyingSound(fp.vx, fp.vy);
        updateHUD(state.t, fp, fm);
        setState({ running: false });
        stopFlyingSound();
        startIdleLoop();
        return;
      }
    }

    const proj = projectilePos(state.v0, state.theta, state.h1, state.t);
    const mono = monkeyPos(state.d, monoRestY, state.t, state.ropeLen);
    updateFlyingSound(proj.vx, proj.vy);
    updateHUD(state.t, proj, mono);

    if (hitP) {
      setState({ impacted: true, running: false });
      stopFlyingSound();
      triggerImpact(hitP, hitM, hitT, monoRestY);
      return;
    }

    renderRealistic(proj, mono, true);
    renderPhysics(proj, mono);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}

// ── IMPACTO ───────────────────────────────────────────────────────────────
function triggerImpact(proj, mono, hitT, monoRestY) {
  const err = impactError(state.v0, state.theta, state.h1, monoRestY, state.d, state.ropeLen);
  soundImpact(); animateImpact();
  updateResults(state.theta, state.impactT, err);
  renderRealistic(proj, mono, true);
  renderPhysics(proj, mono);

  // Spawn fragmentos en el punto exacto de contacto superficial
  const THREE = window.THREE;
  const bPos3 = new THREE.Vector3(proj.x - state.d * 0.5, proj.y, 0);
  spawnFragments(bPos3, proj.vx, proj.vy);

  impactPhase = true;

  // Física post-impacto: colisión elástica parcial
  const nx = (mono.x - proj.x), ny = (mono.y - proj.y);
  const nLen = Math.sqrt(nx*nx + ny*ny) || 1;
  const nnx = nx/nLen, nny = ny/nLen;
  const mvy   = -(G * hitT);
  const vRel  = (proj.vx - 0)*nnx + (proj.vy - mvy)*nny;
  const MASS_B = 0.030, MASS_M = 5.0, E = 0.22;
  const j     = -(1+E) * vRel / (1/MASS_B + 1/MASS_M);

  // Mono: velocidad horizontal recibida del impulso
  const monoVxPost = (j / MASS_M) * nnx;

  let postFrame = 0;
  const MAX_FRAMES = 90;   // ~1.5s de animación post-impacto a 60fps
  let postLast  = null;
  // El mono sigue caída libre + pequeño impulso horizontal
  let monoXOffset = 0;

  function postLoop(ts) {
    if (!postLast) postLast = ts;
    const dt = Math.min((ts - postLast) / 1000, 0.033);
    postLast = ts; postFrame++;

    const elapsed  = hitT + postFrame * dt;
    const curMono  = monkeyPos(state.d, monoRestY, elapsed, state.ropeLen);

    // Pequeño drift horizontal del mono (impulso recibido)
    monoXOffset += monoVxPost * dt * 0.15;
    const monoWithDrift = {
      x: curMono.x + monoXOffset,
      y: curMono.y,
    };

    // Bala ya oculta — renderRealistic solo necesita mover el mono
    const dummyProj = { x: state.d * 3, y: -20, vx: 0, vy: 0 };
    renderRealistic(dummyProj, monoWithDrift, true);
    renderPhysics(dummyProj, monoWithDrift);

    if (postFrame < MAX_FRAMES) {
      rafId = requestAnimationFrame(postLoop);
    } else {
      impactPhase = false;
      startIdleLoop();
    }
  }
  cancelAnimationFrame(rafId);
  setTimeout(() => { rafId = requestAnimationFrame(postLoop); }, 50);
}

// ── RESET ─────────────────────────────────────────────────────────────────
function onReset() {
  cancelAnimationFrame(rafId); stopFlyingSound();
  resetTrail(); resetTrail2D();
  impactPhase = false; accumulator = 0;
  setState({ running: false, t: 0, impacted: false });
  document.getElementById('result-group').classList.remove('visible');
  soundReset(); syncAll(); renderStatic(); startIdleLoop();
}
