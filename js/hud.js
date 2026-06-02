// hud.js

export function updateHUD(t, proj, mono) {
  const elT    = document.getElementById('hud-t');
  const elVyP  = document.getElementById('hud-vy-proj');
  const elVyM  = document.getElementById('hud-vy-mono');
  if (elT)   elT.textContent   = t.toFixed(3) + ' s';
  if (elVyP) elVyP.textContent = proj.vy.toFixed(3) + ' m/s';
  if (elVyM) elVyM.textContent = (-9.81 * t).toFixed(3) + ' m/s';
}

export function showImpact(show) {
  // handled by animateImpact() in animations.js
}

export function updateResults(theta, timp, err) {
  const elTheta = document.getElementById('res-theta');
  const elTimp  = document.getElementById('res-timp');
  const elErr   = document.getElementById('res-err');
  if (elTheta) elTheta.textContent = (theta * 180 / Math.PI).toFixed(2);
  if (elTimp)  elTimp.textContent  = timp.toFixed(3);
  if (elErr) {
    elErr.textContent = err.toFixed(4);
    elErr.style.color = parseFloat(err) <= 0.1 ? '#2a7a3a' : '#8a2a2a';
  }
  const rg = document.getElementById('result-group');
  if (rg) rg.classList.add('visible');
}
