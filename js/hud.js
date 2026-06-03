// hud.js
import { BALL_MASS_KG, G } from './physics.js';

export function updateHUD(t, proj, mono) {
  const elT      = document.getElementById('hud-t');
  const elVyP    = document.getElementById('hud-vy-proj');
  const elVyM    = document.getElementById('hud-vy-mono');
  const elProjX  = document.getElementById('hud-proj-x');
  const elProjY  = document.getElementById('hud-proj-y');
  const elMonoX  = document.getElementById('hud-mono-x');
  const elMonoY  = document.getElementById('hud-mono-y');
  const elDeltaVy = document.getElementById('hud-delta-vy');
  const elFallP  = document.getElementById('hud-fall-proj');
  const elFallM  = document.getElementById('hud-fall-mono');

  const vyMono = -(G * t);

  if (elT)     elT.textContent     = t.toFixed(3) + ' s';
  if (elVyP)   elVyP.textContent   = proj.vy.toFixed(3) + ' m/s';
  if (elVyM)   elVyM.textContent   = vyMono.toFixed(3) + ' m/s';
  if (elProjX) elProjX.textContent = proj.x.toFixed(3) + ' m';
  if (elProjY) elProjY.textContent = proj.y.toFixed(3) + ' m';
  if (elMonoX) elMonoX.textContent = mono.x.toFixed(3) + ' m';
  if (elMonoY) elMonoY.textContent = mono.y.toFixed(3) + ' m';

  // ΔVy — debería ser ≈ 0 si drag está apagado
  if (elDeltaVy) {
    const delta = Math.abs(proj.vy - vyMono);
    elDeltaVy.textContent = delta.toFixed(4) + ' m/s';
    elDeltaVy.style.color = delta < 0.05 ? '#4caf82' : '#e07060';
  }

  // Caída acumulada (cuánto cayeron desde su posición inicial)
  if (elFallP && t > 0) {
    elFallP.textContent = (0.5 * G * t * t).toFixed(3) + ' m';
  }
  if (elFallM && t > 0) {
    elFallM.textContent = (0.5 * G * t * t).toFixed(3) + ' m';
  }
}

export function showImpact(show) {
  // handled by animateImpact() in animations.js
}

export function updateResults(theta, timp, err, useDrag) {
  const elTheta = document.getElementById('res-theta');
  const elTimp  = document.getElementById('res-timp');
  const elErr   = document.getElementById('res-err');
  const elMass  = document.getElementById('res-mass');
  const elDrag  = document.getElementById('res-drag');

  if (elTheta) elTheta.textContent = (theta * 180 / Math.PI).toFixed(2);
  if (elTimp)  elTimp.textContent  = timp.toFixed(3);
  if (elErr) {
    elErr.textContent = err.toFixed(4);
    elErr.style.color = parseFloat(err) <= 0.5 ? '#4caf82' : '#e07060';
  }
  if (elMass) elMass.textContent = (BALL_MASS_KG * 1000).toFixed(0) + ' g';
  if (elDrag) {
    elDrag.textContent = useDrag ? 'CON DRAG' : 'IDEAL';
    elDrag.style.color = useDrag ? '#e07060' : '#4caf82';
  }

  const rg = document.getElementById('result-group');
  if (rg) rg.classList.add('visible');
}
