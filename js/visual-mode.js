// visual-mode.js — Secuencia cinemática ÉPICA v3 — COMPLETA Y FUNCIONAL
// Duración total ~30s | Fuego real, nano-enfoques, slow-mo, explosiones, aberración cromática

import { state, setState } from './state.js';
import { projectilePos, monkeyPos, computeTheta, impactTime } from './physics.js';
import {
  triggerMuzzleFlash, spawnFragments, setScenario, updateSceneObjects
} from './realistic-scene.js';
import {
  soundFire, soundImpact,
  startFlyingSound, updateFlyingSound, stopFlyingSound
} from './audio.js';

const THREE = window.THREE;

// ── Estado ────────────────────────────────────────────────────────────────────
let visualActive = false;
let visualRafId  = null;
let visualT      = 0;
let shotFired    = false;
let impactDone   = false;

// ── Sistema de fuego (canvas 2D superpuesto) ──────────────────────────────────
let fireCanvas = null;
let fireCtx    = null;
let fireParticles = [];
let fireActive = false;
let fireRafId  = null;

// ── Preset cinemático ─────────────────────────────────────────────────────────
const CIN = { v0: 16, h1: 1.2, h2: 3.8, d: 9.5, ropeLen: 1.4 };

// ── Cámara cinemática propia ──────────────────────────────────────────────────
let cinCam = null;

// ── Secuencia de tomas ────────────────────────────────────────────────────────
let shotSequence = [];
let shotIdx      = 0;
let shotElapsed  = 0;

// ── Referencias DOM ───────────────────────────────────────────────────────────
let overlayEl, canvasEl, closeBtnEl, subtitleEl, vignetteEl;

// ── Aberración cromática ──────────────────────────────────────────────────────
let chromaActive = false;

// ─────────────────────────────────────────────────────────────────────────────
// INIT — llamado una sola vez desde main.js
// ─────────────────────────────────────────────────────────────────────────────
export function initVisualMode() {
  overlayEl  = document.getElementById('visual-overlay');
  canvasEl   = document.getElementById('realistic-canvas');
  closeBtnEl = document.getElementById('visual-close');
  subtitleEl = document.getElementById('visual-subtitle');
  vignetteEl = document.getElementById('visual-vignette');

  // Canvas de fuego 2D superpuesto al WebGL
  fireCanvas = document.getElementById('visual-fire-canvas');
  if (!fireCanvas) {
    fireCanvas = document.createElement('canvas');
    fireCanvas.id = 'visual-fire-canvas';
    fireCanvas.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none',
      'z-index:202', 'opacity:0', 'transition:opacity 0.3s'
    ].join(';');
    document.body.appendChild(fireCanvas);
  }
  fireCtx = fireCanvas.getContext('2d');
  resizeFireCanvas();
  window.addEventListener('resize', resizeFireCanvas);

  closeBtnEl?.addEventListener('click', stopVisualMode);
}

function resizeFireCanvas() {
  if (!fireCanvas) return;
  fireCanvas.width  = window.innerWidth;
  fireCanvas.height = window.innerHeight;
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE PARTÍCULAS DE FUEGO
// ─────────────────────────────────────────────────────────────────────────────

/** Explosión instantánea de fuego (disparo / impacto) */
function spawnFireBurst(cx, cy, count = 80) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.85;
    const speed = 2 + Math.random() * 7;
    fireParticles.push({
      x: cx + (Math.random() - 0.5) * 14,
      y: cy + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.sin(angle) * speed - 2,
      life: 1.0,
      decay: 0.010 + Math.random() * 0.022,
      size: 5 + Math.random() * 22,
      type: Math.random() > 0.25 ? 'fire' : 'ember',
      hue: 15 + Math.random() * 35,
    });
  }
}

/** Nube de humo que sube lentamente */
function spawnSmokePuff(cx, cy, count = 24) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 0.4 + Math.random() * 2.0;
    fireParticles.push({
      x: cx + (Math.random() - 0.5) * 22,
      y: cy + (Math.random() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.6,
      life: 1.0,
      decay: 0.004 + Math.random() * 0.009,
      size: 14 + Math.random() * 38,
      type: 'smoke',
      hue: 0,
    });
  }
}

/** Fuego continuo (boca del cañón post-disparo) */
function spawnContinuousFire(cx, cy, intensity = 1.0) {
  const count = Math.floor(3 + intensity * 8);
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 0.6;
    const speed = 0.8 + Math.random() * 2.8 * intensity;
    fireParticles.push({
      x: cx + (Math.random() - 0.5) * 10,
      y: cy + (Math.random() - 0.5) * 7,
      vx: Math.cos(angle) * speed * 0.35,
      vy: Math.sin(angle) * speed - 0.9,
      life: 1.0,
      decay: 0.022 + Math.random() * 0.030,
      size: 7 + Math.random() * 16 * intensity,
      type: 'fire',
      hue: 12 + Math.random() * 30,
    });
  }
}

/** Chispas brillantes (impacto metálico) */
function spawnSparks(cx, cy, count = 40) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 9;
    fireParticles.push({
      x: cx + (Math.random() - 0.5) * 6,
      y: cy + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 1.0,
      decay: 0.020 + Math.random() * 0.040,
      size: 1.5 + Math.random() * 4,
      type: 'spark',
      hue: 45 + Math.random() * 20,
    });
  }
}

/** Loop de render de partículas — corre independiente del loop principal */
function updateAndDrawFire() {
  if (!fireCtx || !fireCanvas) return;
  const W = fireCanvas.width, H = fireCanvas.height;
  fireCtx.clearRect(0, 0, W, H);

  fireParticles = fireParticles.filter(p => p.life > 0);

  for (const p of fireParticles) {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy -= 0.09;  // fuego sube, gravedad mínima
    p.vx *= 0.968;
    p.life -= p.decay;
    if (p.life <= 0) continue;

    const a = Math.max(0, p.life);
    const s = p.size * (0.35 + p.life * 0.65);

    if (p.type === 'fire') {
      const grad = fireCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      const h = p.hue;
      grad.addColorStop(0,   `hsla(${h+35},100%,98%,${a * 0.95})`);
      grad.addColorStop(0.25,`hsla(${h+15},100%,72%,${a * 0.85})`);
      grad.addColorStop(0.6, `hsla(${h},100%,44%,${a * 0.55})`);
      grad.addColorStop(0.85,`hsla(${h-15},100%,22%,${a * 0.25})`);
      grad.addColorStop(1,   `hsla(${h-25},100%,10%,0)`);
      fireCtx.beginPath();
      fireCtx.arc(p.x, p.y, s, 0, Math.PI * 2);
      fireCtx.fillStyle = grad;
      fireCtx.fill();

    } else if (p.type === 'ember') {
      fireCtx.beginPath();
      fireCtx.arc(p.x, p.y, Math.max(1.2, s * 0.22), 0, Math.PI * 2);
      fireCtx.fillStyle = `hsla(${p.hue + 45},100%,92%,${a})`;
      fireCtx.fill();
      // halo tenue
      const hg = fireCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 0.8);
      hg.addColorStop(0, `hsla(${p.hue+30},100%,80%,${a * 0.3})`);
      hg.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
      fireCtx.beginPath();
      fireCtx.arc(p.x, p.y, s * 0.8, 0, Math.PI * 2);
      fireCtx.fillStyle = hg;
      fireCtx.fill();

    } else if (p.type === 'smoke') {
      const sg = fireCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      sg.addColorStop(0, `rgba(90,80,68,${a * 0.20})`);
      sg.addColorStop(0.5,`rgba(65,55,44,${a * 0.12})`);
      sg.addColorStop(1, `rgba(40,32,24,0)`);
      fireCtx.beginPath();
      fireCtx.arc(p.x, p.y, s, 0, Math.PI * 2);
      fireCtx.fillStyle = sg;
      fireCtx.fill();

    } else if (p.type === 'spark') {
      // Chispa: línea brillante en dirección del movimiento
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const nx  = spd > 0.1 ? p.vx / spd : 0;
      const ny  = spd > 0.1 ? p.vy / spd : 0;
      const len = Math.min(spd * 2.5, 18);
      fireCtx.beginPath();
      fireCtx.moveTo(p.x - nx * len, p.y - ny * len);
      fireCtx.lineTo(p.x, p.y);
      fireCtx.strokeStyle = `hsla(${p.hue},100%,95%,${a})`;
      fireCtx.lineWidth = Math.max(0.5, s * 0.35);
      fireCtx.stroke();
    }
  }
}

function startFireLoop() {
  fireActive = true;
  if (fireCanvas) fireCanvas.style.opacity = '1';
  (function loop() {
    if (!fireActive) return;
    fireRafId = requestAnimationFrame(loop);
    updateAndDrawFire();
  })();
}

function stopFireLoop() {
  fireActive = false;
  cancelAnimationFrame(fireRafId);
  fireRafId  = null;
  fireParticles = [];
  if (fireCtx && fireCanvas) fireCtx.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
  if (fireCanvas) fireCanvas.style.opacity = '0';
}

// ─────────────────────────────────────────────────────────────────────────────
// Proyección 3D → pantalla para colocar fuego encima del canvas WebGL
// ─────────────────────────────────────────────────────────────────────────────
function worldToScreen(worldVec3) {
  if (!cinCam || !canvasEl) return null;
  const v = worldVec3.clone();
  v.project(cinCam);
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width  + rect.left,
    y: (-v.y * 0.5 + 0.5) * rect.height + rect.top,
  };
}

function getMuzzleScreenPos() {
  if (!cinCam) return { x: window.innerWidth * 0.22, y: window.innerHeight * 0.55 };
  const p = worldToScreen(new THREE.Vector3(-CIN.d * 0.5 + 0.70, CIN.h1 + 0.35, 0));
  return p || { x: window.innerWidth * 0.22, y: window.innerHeight * 0.55 };
}

function getBulletScreenPos(proj) {
  if (!proj || !cinCam) return null;
  return worldToScreen(new THREE.Vector3(proj.x - CIN.d * 0.5, proj.y, 0));
}

function getMonkeyScreenPos(mono) {
  if (!mono || !cinCam) return null;
  return worldToScreen(new THREE.Vector3(mono.x - CIN.d * 0.5, mono.y + 0.3, 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// ABERRACIÓN CROMÁTICA — efecto visual al impacto / disparo
// ─────────────────────────────────────────────────────────────────────────────
function triggerChromaticAberration(intensity = 1.0, duration = 0.35) {
  if (chromaActive) return;
  chromaActive = true;

  const px = Math.round(intensity * 7);
  if (canvasEl) {
    canvasEl.style.transform  = `scale(1.003) translateX(${px}px)`;
    canvasEl.style.filter     = `saturate(${1 + intensity * 0.5})`;
  }

  // Flash rojo tenue en overlay
  const ov = document.createElement('div');
  ov.style.cssText = [
    'position:fixed','inset:0','pointer-events:none',
    `z-index:205`,`background:rgba(255,60,0,${intensity * 0.09})`,
    'mix-blend-mode:screen'
  ].join(';');
  document.body.appendChild(ov);

  setTimeout(() => {
    if (canvasEl) { canvasEl.style.transform = ''; canvasEl.style.filter = ''; }
    document.body.removeChild(ov);
    chromaActive = false;
  }, duration * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA BLANCA (corte de toma)
// ─────────────────────────────────────────────────────────────────────────────
function flashCut(hard = false) {
  const fl = document.getElementById('visual-flash');
  if (!fl) return;
  fl.style.transition = 'none';
  fl.style.opacity = hard ? '1' : '0.6';
  requestAnimationFrame(() => {
    fl.style.transition = `opacity ${hard ? 0.40 : 0.20}s ease`;
    fl.style.opacity = '0';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN épico con pulso de vignette
// ─────────────────────────────────────────────────────────────────────────────
function runCountdown(cb) {
  const counts = ['3', '2', '1', '¡FUEGO!'];
  let i = 0;
  showSubtitle(counts[0], 'countdown');
  pulseVignette(true);

  const iv = setInterval(() => {
    i++;
    if (i >= counts.length) {
      clearInterval(iv);
      hideSubtitle();
      setTimeout(cb, 80);
      return;
    }
    showSubtitle(counts[i], i === counts.length - 1 ? 'fire' : 'countdown');
    if (i < counts.length - 1) pulseVignette(true);
  }, 900);
}

function pulseVignette(hard = false) {
  if (!vignetteEl) return;
  vignetteEl.style.transition = 'opacity 0.10s';
  vignetteEl.style.opacity = hard ? '0.98' : '0.80';
  setTimeout(() => {
    vignetteEl.style.transition = 'opacity 0.65s';
    vignetteEl.style.opacity = '0.45';
  }, hard ? 100 : 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
export function startVisualMode() {
  if (visualActive) return;
  visualActive = true;

  setState({ running: false, t: 0, impacted: false });
  stopFlyingSound();

  overlayEl.classList.add('active');
  document.getElementById('app').classList.add('visual-running');

  setState({ v0: CIN.v0, h1: CIN.h1, h2: CIN.h2, d: CIN.d, ropeLen: CIN.ropeLen, useDrag: false });

  const PLAT_TOP  = 0.08;
  const anchorY   = CIN.h2 + PLAT_TOP;
  const monoRestY = anchorY - CIN.ropeLen;
  const theta     = computeTheta(CIN.h1, monoRestY, CIN.d, CIN.ropeLen);
  setState({ theta, h2_anchorY: anchorY });

  setScenario('night');

  const canvas = document.getElementById('realistic-canvas');
  const aspect = canvas.offsetWidth / canvas.offsetHeight;
  cinCam = new THREE.PerspectiveCamera(35, aspect, 0.005, 400);

  visualT    = 0;
  shotFired  = false;
  impactDone = false;
  shotIdx    = 0;
  shotElapsed = 0;

  buildShotSequence();
  startFireLoop();

  runCountdown(() => {
    setState({ running: true, t: 0, impacted: false });
    soundFire();
    triggerMuzzleFlash();
    setTimeout(() => startFlyingSound(CIN.v0), 80);
    shotFired = true;

    // Ráfagas de fuego en el disparo (4 oleadas)
    const mp = getMuzzleScreenPos();
    for (let burst = 0; burst < 5; burst++) {
      setTimeout(() => {
        spawnFireBurst(mp.x, mp.y, 70 - burst * 8);
        if (burst < 3) spawnSmokePuff(mp.x, mp.y, 18 - burst * 3);
        triggerChromaticAberration(1.0 - burst * 0.18, 0.14);
      }, burst * 45);
    }

    startVisualLoop();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECUENCIA DE TOMAS — 11 tomas épicas, ~30 s total
// Cada toma: { label, duration(s), fov, dof, slowmo?, setup(cam), update(cam,proj,mono,pct) }
// ─────────────────────────────────────────────────────────────────────────────
function buildShotSequence() {
  const d   = CIN.d;
  const h1  = CIN.h1;
  const h2  = CIN.h2;

  // convierte coordenadas de física a mundo Three.js
  function bToW(bx, by) { return new THREE.Vector3(bx - d * 0.5, by, 0); }

  shotSequence = [

    // ── TOMA 0 (2.8s): ESTABLECIMIENTO — gran angular nocturno, push-in lento ─
    {
      label: 'ESTABLECIMIENTO',
      duration: 2.8,
      fov: 22,
      dof: 0,
      setup(cam) {
        cam.position.set(-d * 0.5 - 7, h1 + 3.0, 10);
        cam.lookAt(0, 2, 0);
      },
      update(cam, proj, mono, pct) {
        cam.position.z  = 10 - pct * 2.5;
        cam.position.y  = h1 + 3.0 - pct * 0.6;
        cam.position.x  = -d * 0.5 - 7 + pct * 2.2;
        cam.lookAt(new THREE.Vector3(0, 2.2, 0));
      }
    },

    // ── TOMA 1 (2.0s): POV CAÑÓN — fuego + shake de retroceso ───────────────
    {
      label: 'DISPARO',
      duration: 2.0,
      fov: 88,
      dof: 0,
      setup(cam) {
        cam.position.set(-d * 0.5 + 0.05, h1 + 0.28, 0.45);
      },
      update(cam, proj, mono, pct) {
        const shake = Math.max(0, 1 - pct * 3.0) * 0.07;
        cam.position.x = -d * 0.5 + 0.05 + (Math.random() - 0.5) * shake;
        cam.position.y = h1 + 0.28     + (Math.random() - 0.5) * shake;
        cam.position.z = 0.45 + pct * 0.4;

        // fuego continuo en la boca del cañón
        if (pct < 0.55) {
          const mp = getMuzzleScreenPos();
          spawnContinuousFire(mp.x, mp.y, (1 - pct * 1.6) * 1.2);
        }
        if (proj) cam.lookAt(bToW(proj.x, proj.y));
        else cam.lookAt(new THREE.Vector3(d * 0.5, h2, 0));
      }
    },

    // ── TOMA 2 (1.8s): NANO-PROYECTIL — super telephoto, slow-mo 35% ─────────
    {
      label: 'MACRO · PROYECTIL',
      duration: 1.8,
      fov: 12,
      dof: 0.9,
      slowmo: 0.35,
      setup(cam) { cam.position.set(0, h1 + 1.4, 2.0); },
      update(cam, proj, mono, pct) {
        if (!proj) return;
        const bw = bToW(proj.x, proj.y);
        // sigue la bala a distancia muy corta
        const target = new THREE.Vector3(bw.x - 0.9 - pct * 0.4, bw.y + 0.12, 1.5 - pct * 0.3);
        cam.position.lerp(target, 0.20);
        cam.lookAt(bw);

        // aberración cromática sutil por velocidad
        if (Math.random() > 0.86) triggerChromaticAberration(0.28, 0.07);

        // chispas visibles a lo largo de la bala si es slow-mo muy extremo
        const bs = getBulletScreenPos(proj);
        if (bs && Math.random() > 0.92) {
          spawnSparks(bs.x, bs.y, 2);
        }
      }
    },

    // ── TOMA 3 (2.2s): LATERAL BAJO — bala sobrevolando el suelo ────────────
    {
      label: 'LATERAL BAJO',
      duration: 2.2,
      fov: 54,
      dof: 0,
      setup(cam) { cam.position.set(-d * 0.1, 0.22, 5.8); },
      update(cam, proj, mono, pct) {
        if (!proj) return;
        const bw = bToW(proj.x, proj.y);
        cam.position.x += (bw.x * 0.6 - cam.position.x) * 0.08;
        cam.position.y  = 0.22 + pct * 0.6;
        cam.rotation.z  = Math.sin(pct * Math.PI) * 0.055; // dutch tilt
        cam.lookAt(new THREE.Vector3(bw.x + 0.6, bw.y + 0.08, 0));
      }
    },

    // ── TOMA 4 (3.0s): ULTRA SLOW-MO — seguimiento cinematográfico 14% ───────
    {
      label: '● CÁMARA LENTA',
      duration: 3.0,
      fov: 68,
      dof: 1.3,
      slowmo: 0.14,
      setup(cam) { cam.position.set(0, h1 + 1.9, 3.9); },
      update(cam, proj, mono, pct) {
        if (!proj) return;
        const bw    = bToW(proj.x, proj.y);
        const tgt   = new THREE.Vector3(bw.x - 1.7, bw.y + 0.30, 3.3 - pct * 1.0);
        cam.position.lerp(tgt, 0.11);
        cam.lookAt(bw);

        // ruido sutil de grano (simula película)
        if (canvasEl && Math.random() > 0.5) {
          const br = 0.94 + Math.random() * 0.06;
          canvasEl.style.filter = `contrast(1.10) brightness(${br})`;
        }
      }
    },

    // ── TOMA 5 (2.2s): NANO MONO — close-up extremo cara del mono ────────────
    {
      label: 'MACRO · MONO',
      duration: 2.2,
      fov: 16,
      dof: 1.1,
      slowmo: 0.22,
      setup(cam) { /* se posiciona en update */ },
      update(cam, proj, mono, pct) {
        const mw = mono
          ? bToW(mono.x, mono.y)
          : new THREE.Vector3(d * 0.5, h2 - CIN.ropeLen, 0);
        // como lente 600mm a 45°
        cam.position.set(
          mw.x + 4.0 - pct * 0.6,
          mw.y + 0.45,
          1.1 + pct * 0.35
        );
        cam.lookAt(new THREE.Vector3(mw.x, mw.y + 0.38, 0));
      }
    },

    // ── TOMA 6 (1.6s): CONVERGENCIA — perspectiva de tensión máxima ──────────
    {
      label: 'CONVERGENCIA',
      duration: 1.6,
      fov: 58,
      dof: 0,
      slowmo: 0.20,
      setup(cam) { cam.position.set(0, 3.6, 7.2); },
      update(cam, proj, mono, pct) {
        if (!proj || !mono) return;
        const bw  = bToW(proj.x, proj.y);
        const mw  = bToW(mono.x, mono.y);
        const mid = bw.clone().lerp(mw, 0.5);
        cam.position.set(
          mid.x + 2.8 - pct * 1.8,
          mid.y + 1.9,
          6.8 - pct * 2.2
        );
        cam.lookAt(mid);
        // vignette intensa al acercarse
        if (vignetteEl) vignetteEl.style.opacity = (0.48 + pct * 0.45).toString();
      }
    },

    // ── TOMA 7 (4.0s): IMPACTO — orbital dramático + fuego post-impacto ──────
    {
      label: 'IMPACTO',
      duration: 4.0,
      fov: 52,
      dof: 0,
      setup(cam) { cam.position.set(2.5, 2.8, 7.5); },
      update(cam, proj, mono, pct) {
        const mw    = mono
          ? bToW(mono.x, mono.y)
          : new THREE.Vector3(d * 0.5, 2.0, 0);
        const angle = pct * Math.PI * 1.8;
        const r     = 7.2 - pct * 2.8;
        cam.position.set(
          mw.x + Math.sin(angle) * r,
          mw.y + 1.6 - pct * 1.1,
          Math.cos(angle) * r
        );
        cam.lookAt(mw);

        // fuego y humo post-impacto durante primero 35%
        if (pct < 0.35 && impactDone) {
          const cx = window.innerWidth  * 0.5 + (Math.random() - 0.5) * 100;
          const cy = window.innerHeight * 0.38 + (Math.random() - 0.5) * 70;
          spawnContinuousFire(cx, cy, (0.35 - pct) / 0.35 * 1.6);
          if (Math.random() > 0.65) spawnSmokePuff(cx, cy, 6);
          if (Math.random() > 0.80) spawnSparks(cx, cy, 6);
        }
      }
    },

    // ── TOMA 8 (1.8s): REPLAY NANO — bala en slow-mo extremo hacia mono ──────
    {
      label: '◀ REPLAY',
      duration: 1.8,
      fov: 20,
      dof: 0.7,
      slowmo: 0.10, // 10% velocidad = matrix-style
      setup(cam) { cam.position.set(d * 0.1, h1 + 1.8, 1.5); },
      update(cam, proj, mono, pct) {
        if (!proj) return;
        const bw   = bToW(proj.x, proj.y);
        const side = new THREE.Vector3(bw.x + 0.05, bw.y + 0.06, 1.2 - pct * 0.6);
        cam.position.lerp(side, 0.18);
        cam.lookAt(bw);

        // halo de distorsión de calor alrededor de la bala
        const bs = getBulletScreenPos(proj);
        if (bs && Math.random() > 0.80) {
          spawnContinuousFire(bs.x, bs.y + 5, 0.3);
        }
        if (Math.random() > 0.90) triggerChromaticAberration(0.22, 0.06);
      }
    },

    // ── TOMA 9 (3.2s): CAÍDA LIBRE — dolly-down siguiendo el mono ────────────
    {
      label: 'CAÍDA LIBRE',
      duration: 3.2,
      fov: 38,
      dof: 0,
      setup(cam) { cam.position.set(d * 0.5 + 5.5, h2 + 1.8, 5.2); },
      update(cam, proj, mono, pct) {
        const mw = mono
          ? bToW(mono.x, mono.y)
          : new THREE.Vector3(d * 0.5, h2 - 2.8, 0);
        cam.position.y += (mw.y + 2.0 - cam.position.y) * 0.050;
        cam.position.x  = d * 0.5 + 5.5 - pct * 2.2;
        cam.position.z  = 5.2 - pct * 0.9;
        cam.lookAt(new THREE.Vector3(mw.x, mw.y + 0.45, 0));

        // humo residual cayendo con el mono
        const ms = getMonkeyScreenPos(mono);
        if (ms && pct > 0.2 && Math.random() > 0.92) {
          spawnSmokePuff(ms.x, ms.y - 10, 3);
        }
        if (pct > 0.3 && Math.random() > 0.94) triggerChromaticAberration(0.18, 0.09);
      }
    },

    // ── TOMA 10 (4.5s): CIERRE ÉPICO — pull-back revelador de toda la escena ─
    {
      label: 'CIERRE',
      duration: 4.5,
      fov: 26,
      dof: 0,
      setup(cam) {
        cam.position.set(-1.5, 4.2, 12);
        cam.lookAt(0, 1.5, 0);
      },
      update(cam, proj, mono, pct) {
        // dolly-out exponencial + arco lateral dramático
        cam.position.z  = 12 + pct * pct * 14;
        cam.position.y  = 4.2 - pct * 1.0;
        cam.position.x  = -1.5 + Math.sin(pct * Math.PI * 0.9) * 1.8;
        cam.lookAt(new THREE.Vector3(0, 1.2, 0));

        // fuego residual muy tenue al inicio del cierre
        if (pct < 0.12) {
          const cx = window.innerWidth  * 0.5;
          const cy = window.innerHeight * 0.45;
          spawnContinuousFire(cx, cy, (0.12 - pct) / 0.12 * 0.5);
        }

        // fade final a oscuro
        if (pct > 0.88 && canvasEl) {
          const darkness = (pct - 0.88) / 0.12;
          canvasEl.style.filter = `brightness(${1 - darkness * 0.7})`;
        }
      }
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VISUAL LOOP
// ─────────────────────────────────────────────────────────────────────────────
function startVisualLoop() {
  const PLAT_TOP  = 0.08;
  const anchorY   = CIN.h2 + PLAT_TOP;
  const monoRestY = anchorY - CIN.ropeLen;
  const impT      = impactTime(CIN.v0, state.theta, CIN.d, CIN.ropeLen);

  // Aplicar primera toma
  const firstShot = shotSequence[0];
  if (firstShot) {
    cinCam.fov = firstShot.fov || 50;
    cinCam.updateProjectionMatrix();
    firstShot.setup?.(cinCam);
  }

  let lastTs = null;

  function loop(ts) {
    if (!visualActive) return;
    visualRafId = requestAnimationFrame(loop);

    if (!lastTs) lastTs = ts;
    const rawDt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    const shot   = shotSequence[shotIdx];
    if (!shot) { endVisualMode(); return; }

    const slowmo = shot.slowmo || 1.0;
    const physDt = rawDt * slowmo;

    // ── Avanzar física ────────────────────────────────────────────────────
    if (state.running && !impactDone) {
      const STEPS = 8;
      const fStep = physDt / STEPS;
      for (let s = 0; s < STEPS; s++) {
        const nextT = visualT + fStep;
        const nextP = projectilePos(CIN.v0, state.theta, CIN.h1, nextT, false);
        if (nextP.y < -5 || nextP.x > CIN.d * 2) {
          setState({ running: false });
          stopFlyingSound();
          break;
        }
        visualT = nextT;
        setState({ t: visualT });

        if (nextT >= impT - fStep && !impactDone) {
          // ── IMPACTO ────────────────────────────────────────────────────
          impactDone = true;
          setState({ impacted: true, running: false });
          stopFlyingSound();
          soundImpact();
          triggerChromaticAberration(1.8, 0.45);

          const ip    = projectilePos(CIN.v0, state.theta, CIN.h1, impT, false);
          const bPos3 = new THREE.Vector3(ip.x - CIN.d * 0.5, ip.y, 0);
          spawnFragments(bPos3, ip.vx, ip.vy);

          // Explosión masiva en pantalla
          const is = getBulletScreenPos(ip) || { x: window.innerWidth * 0.6, y: window.innerHeight * 0.45 };
          spawnFireBurst(is.x, is.y, 120);
          spawnSparks(is.x, is.y, 60);
          spawnSmokePuff(is.x, is.y, 30);
          // oleadas adicionales
          for (let w = 1; w <= 3; w++) {
            setTimeout(() => {
              spawnFireBurst(is.x + (Math.random()-0.5)*40, is.y + (Math.random()-0.5)*30, 60);
              spawnSparks(is.x, is.y, 20);
            }, w * 80);
          }

          showSubtitle('IMPACTO CONFIRMADO', 'impact');
          setTimeout(() => hideSubtitle(), 2400);
          flashCut(true);
          goToShot(7); // saltar a toma IMPACTO
          break;
        }
      }
    } else if (impactDone) {
      visualT += physDt;
      setState({ t: visualT });
    }

    // ── Posiciones actuales ───────────────────────────────────────────────
    const proj = projectilePos(CIN.v0, state.theta, CIN.h1, Math.min(visualT, impT), false);
    const mono = monkeyPos(CIN.d, monoRestY, visualT, CIN.ropeLen);

    if (state.running && !impactDone) {
      updateFlyingSound(proj.vx, proj.vy);
    }

    // ── Actualizar toma ───────────────────────────────────────────────────
    shotElapsed += rawDt;
    const shotPct = Math.min(shotElapsed / shot.duration, 1);

    shot.update?.(cinCam, state.running || impactDone ? proj : null, mono, shotPct);

    // Etiqueta de toma
    if (shotElapsed < 0.50 && shot.label) showTakeLabel(shot.label);
    else if (shotElapsed > shot.duration - 0.40) fadeTakeLabel();

    if (shotPct >= 1) nextShot();

    // ── DoF simulado (CSS blur) ───────────────────────────────────────────
    const dofBlur = (shot.dof || 0) * (1 - Math.abs(shotPct - 0.5) * 2) * 2.4;
    if (canvasEl && !chromaActive && !(shot.slowmo && shot.slowmo < 0.4)) {
      if (dofBlur > 0.12) canvasEl.style.filter = `blur(${dofBlur.toFixed(2)}px)`;
      else if (!canvasEl.style.filter.includes('brightness')) canvasEl.style.filter = '';
    }

    // ── Vignette ──────────────────────────────────────────────────────────
    if (!impactDone || shotIdx !== 7) {
      const vi = slowmo < 0.20 ? 0.85 : slowmo < 0.40 ? 0.70 : 0.44;
      updateVignette(vi);
    }

    // ── Indicador slow-mo ─────────────────────────────────────────────────
    const smEl = document.getElementById('visual-slowmo');
    if (smEl) smEl.style.opacity = slowmo < 0.40 ? '1' : '0';

    // ── Render ────────────────────────────────────────────────────────────
    renderWithCinCam(window.__threeRenderer, window.__threeScene, proj, mono, cinCam);
  }

  visualRafId = requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────────────────────────────
function renderWithCinCam(renderer, scene, proj, mono, cam) {
  if (!renderer || !scene || !cam) return;
  const dropped = state.running || impactDone;
  updateSceneObjects(
    proj || { x: 0, y: CIN.h1, vx: 0, vy: 0 },
    mono || { x: CIN.d, y: CIN.h2 - CIN.ropeLen },
    dropped
  );
  renderer.render(scene, cam);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gestión de tomas
// ─────────────────────────────────────────────────────────────────────────────
function nextShot() {
  shotIdx++;
  shotElapsed = 0;
  const shot = shotSequence[shotIdx];
  if (!shot) { endVisualMode(); return; }
  cinCam.fov = shot.fov || 50;
  cinCam.updateProjectionMatrix();
  shot.setup?.(cinCam);
  if (canvasEl) { canvasEl.style.filter = ''; canvasEl.style.transform = ''; }
  flashCut(false);
}

function goToShot(idx) {
  if (idx >= shotSequence.length) return;
  shotIdx     = idx;
  shotElapsed = 0;
  const shot  = shotSequence[idx];
  cinCam.fov  = shot.fov || 50;
  cinCam.updateProjectionMatrix();
  shot.setup?.(cinCam);
  if (canvasEl) { canvasEl.style.filter = ''; canvasEl.style.transform = ''; }
  flashCut(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// FX helpers DOM
// ─────────────────────────────────────────────────────────────────────────────
function updateVignette(intensity) {
  if (!vignetteEl) return;
  vignetteEl.style.opacity = Math.min(1, intensity).toString();
}

function showSubtitle(text, type = 'normal') {
  if (!subtitleEl) return;
  subtitleEl.textContent = text;
  subtitleEl.className   = `visual-subtitle visual-subtitle--${type} visible`;
}

function hideSubtitle() {
  if (!subtitleEl) return;
  subtitleEl.classList.remove('visible');
}

function showTakeLabel(text) {
  const el = document.getElementById('visual-take-label');
  if (!el) return;
  el.textContent   = text;
  el.style.opacity = '0.62';
}

function fadeTakeLabel() {
  const el = document.getElementById('visual-take-label');
  if (el) el.style.opacity = '0';
}

// ─────────────────────────────────────────────────────────────────────────────
// FIN / STOP
// ─────────────────────────────────────────────────────────────────────────────
function endVisualMode() {
  showSubtitle('UAM · FÍSICA Aplicada · 2026', 'end');
  setTimeout(() => stopVisualMode(), 3000);
}

export function stopVisualMode() {
  if (!visualActive) return;
  visualActive = false;

  cancelAnimationFrame(visualRafId);
  visualRafId = null;

  stopFireLoop();
  stopFlyingSound();

  setState({ running: false, t: 0, impacted: false });

  if (canvasEl) { canvasEl.style.filter = ''; canvasEl.style.transform = ''; }
  overlayEl?.classList.remove('active');
  document.getElementById('app')?.classList.remove('visual-running');
  hideSubtitle();
  fadeTakeLabel();

  const smEl = document.getElementById('visual-slowmo');
  if (smEl) smEl.style.opacity = '0';

  setScenario('lab');
  setState({ v0: 14, h1: 1.0, h2: 3.0, d: 8.0, ropeLen: 1.2 });
}

export function isVisualActive() { return visualActive; }
