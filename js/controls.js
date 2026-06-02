// controls.js

import { state, setState } from './state.js';
import { computeTheta, impactTime } from './physics.js';
import { animateModeSwitch, animateFireButton } from './animations.js';

const PLATFORM_TOP_H = 0.08;

// Escenarios disponibles
const SCENARIOS = [
  { id: 'lab',    label: 'LABORATORIO', icon: '⬡', color: '#1a3a6e' },
  { id: 'desert', label: 'DESIERTO',    icon: '◇', color: '#c85010' },
  { id: 'night',  label: 'NOCHE',       icon: '◈', color: '#6030ff' },
  { id: 'forest', label: 'BOSQUE',      icon: '◉', color: '#30801a' },
];
let currentScenario = 'lab';

export function initControls(onFire, onReset, onModeSwitch, onSliderChange, onCamChange, onScenarioChange) {
  wireSlider('slider-v0',   'val-v0',   v => setState({ v0: v }),      1, onSliderChange);
  wireSlider('slider-h1',   'val-h1',   v => setState({ h1: v }),      1, onSliderChange);
  wireSlider('slider-h2',   'val-h2',   v => setState({ h2: v }),      1, onSliderChange);
  wireSlider('slider-d',    'val-d',    v => setState({ d: v }),       1, onSliderChange);
  wireSlider('slider-rope', 'val-rope', v => setState({ ropeLen: v }), 2, onSliderChange);

  syncTheta();

  document.getElementById('btn-fire').addEventListener('click', () => {
    animateFireButton(document.getElementById('btn-fire'));
    onFire();
  });
  document.getElementById('btn-reset').addEventListener('click', onReset);

  // Mode nav
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!mode || mode === state.mode) return;
      const incoming = document.getElementById(`scene-${mode}`);
      const outgoing = document.getElementById(`scene-${state.mode}`);
      if (!incoming || !outgoing) return;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setState({ mode });
      animateModeSwitch(incoming, outgoing);
      const camNav = document.getElementById('cam-nav');
      const scNav  = document.getElementById('scenario-nav');
      const show = mode === 'realistic';
      if (camNav) { camNav.style.display = show ? 'flex' : 'none'; }
      if (scNav)  { scNav.style.display  = show ? 'flex' : 'none'; }
      if (onModeSwitch) onModeSwitch();
    });
  });

  // Camera nav
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const camLabels = {
        orbit:  'VISTA ÓRBITA',
        side:   'VISTA LATERAL',
        cannon: 'POV CAÑÓN',
        bullet: 'CÁMARA BALA',
        monkey: 'SER EL MONO'
      };
      const label = document.getElementById('cam-label');
      if (label) label.textContent = camLabels[btn.dataset.cam] || '';
      if (onCamChange) onCamChange(btn.dataset.cam);
    });
  });

  // Scenario nav
  buildScenarioNav(onScenarioChange);

  // Back button
  document.getElementById('btn-back')?.addEventListener('click', () => {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('landing').style.display = 'flex';
    gsap.fromTo('.landing', { opacity: 0 }, { opacity: 1, duration: 0.4 });
  });
}

function buildScenarioNav(onScenarioChange) {
  const nav = document.getElementById('scenario-nav');
  if (!nav) return;
  nav.innerHTML = '';

  SCENARIOS.forEach(sc => {
    const btn = document.createElement('button');
    btn.className = 'scenario-btn' + (sc.id === currentScenario ? ' active' : '');
    btn.dataset.scenario = sc.id;
    btn.setAttribute('aria-label', sc.label);
    btn.innerHTML = `
      <span class="sc-icon">${sc.icon}</span>
      <span class="sc-label">${sc.label}</span>
      <span class="sc-dot" style="background:${sc.color}"></span>
    `;

    btn.addEventListener('click', () => {
      if (sc.id === currentScenario) return;
      currentScenario = sc.id;

      // Animar salida del canvas
      gsap.to('#scene-realistic canvas', {
        opacity: 0, duration: 0.22, ease: 'power2.in',
        onComplete: () => {
          if (onScenarioChange) onScenarioChange(sc.id);
          gsap.to('#scene-realistic canvas', { opacity: 1, duration: 0.45, ease: 'power2.out' });
        }
      });

      // Actualizar activo con pequeña animación GSAP
      document.querySelectorAll('.scenario-btn').forEach(b => {
        b.classList.remove('active');
        gsap.to(b, { x: 0, duration: 0.2, ease: 'power2.out' });
      });
      btn.classList.add('active');
      gsap.fromTo(btn, { x: 8 }, { x: -3, duration: 0.35, ease: 'back.out(2)' });
    });

    nav.appendChild(btn);
  });

  // Animación de entrada: solo transform, opacity parte de 1
  gsap.fromTo('.scenario-btn',
    { x: 18, opacity: 0 },
    { x: 0,  opacity: 1, duration: 0.45, ease: 'expo.out', stagger: 0.08, delay: 0.3 }
  );
}

function wireSlider(sliderId, valId, setter, decimals, onChange) {
  const slider = document.getElementById(sliderId);
  const valEl  = document.getElementById(valId);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    setter(v);
    if (valEl) valEl.textContent = v.toFixed(decimals);
    syncTheta();
    if (onChange) onChange();
  });
}

function syncTheta() {
  const anchorY   = state.h2 + PLATFORM_TOP_H;
  const monoRestY = anchorY - state.ropeLen;
  const theta = computeTheta(state.h1, monoRestY, state.d, state.ropeLen);
  const tImp  = impactTime(state.v0, theta, state.d, state.ropeLen);
  setState({ theta, impactT: tImp, h2_anchorY: anchorY });
  const fTheta = document.getElementById('f-theta');
  if (fTheta) fTheta.textContent = `θ = ${(theta * 180 / Math.PI).toFixed(2)}°`;
}
