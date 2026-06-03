// physics.js — física con resistencia del aire opcional

export const G = 9.81; // m/s²

// Bola de espuma (foam ball ~70mm diámetro, como en el video del MIT)
// m = 0.028 kg, Cd = 0.47, r = 0.035 m, A = π·r² = 0.00385 m²
// k = 0.5 · 0.47 · 1.225 · 0.00385 / 0.028 = 0.0396 m⁻¹
export const BALL_MASS_KG = 0.028;    // 28 g — bola de espuma realista
export const DRAG_K       = 0.0396;   // coef. cuadrático m⁻¹

/**
 * Ángulo θ que apunta al mono en reposo.
 * Con drag la trayectoria real se curva más, pero el experimento
 * sigue funcionando porque ambos caen con la misma g.
 * El θ analítico (sin drag) es suficiente para el demo.
 */
export function computeTheta(h1, monoY, d, ropeLen = 0) {
  return Math.atan2(monoY - h1, d - ropeLen);
}

/**
 * Posición del proyectil.
 * useDrag=false → solución analítica exacta (modo ideal, siempre impacta).
 * useDrag=true  → integración RK4 con resistencia cuadrática del aire.
 *   Con drag, el impacto sigue ocurriendo porque AMBOS caen con la misma g;
 *   la trayectoria real se curva pero el encuentro se garantiza geométricamente
 *   solo en ausencia de drag. Con drag real puede haber leve error — se muestra
 *   en el HUD como demostración educativa.
 */
export function projectilePos(v0, theta, h1, t, useDrag = false) {
  const vx0 = v0 * Math.cos(theta);
  const vy0 = v0 * Math.sin(theta);

  if (!useDrag || DRAG_K === 0) {
    // Solución analítica exacta
    return {
      x:  vx0 * t,
      y:  h1 + vy0 * t - 0.5 * G * t * t,
      vx: vx0,
      vy: vy0 - G * t,
    };
  }

  // RK4 numérico con drag cuadrático
  const dt    = 0.001;
  const steps = Math.round(t / dt);
  let x = 0, y = h1, vx = vx0, vy = vy0;

  function accel(vx, vy) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    const drag  = DRAG_K * speed;
    return { ax: -drag * vx, ay: -G - drag * vy };
  }

  for (let i = 0; i < steps; i++) {
    const k1 = accel(vx, vy);
    const k2 = accel(vx + k1.ax*dt*0.5, vy + k1.ay*dt*0.5);
    const k3 = accel(vx + k2.ax*dt*0.5, vy + k2.ay*dt*0.5);
    const k4 = accel(vx + k3.ax*dt,     vy + k3.ay*dt);
    vx += (k1.ax + 2*k2.ax + 2*k3.ax + k4.ax) * dt / 6;
    vy += (k1.ay + 2*k2.ay + 2*k3.ay + k4.ay) * dt / 6;
    x  += vx * dt;
    y  += vy * dt;
  }
  return { x, y, vx, vy };
}

/**
 * Mono: caída libre exacta desde monoRestY.
 * La caída es SIEMPRE libre (sin drag en el mono) para mantener
 * la demostración del principio: ambos aceleran igual con g.
 */
export function monkeyPos(d, monoRestY, t, ropeLen = 0) {
  return {
    x: d - ropeLen,
    y: monoRestY - 0.5 * G * t * t,
  };
}

export function impactTime(v0, theta, d, ropeLen = 0) {
  const vx = v0 * Math.cos(theta);
  return (d - ropeLen) / vx;
}

export function trajectoryY(x, v0, theta, h1) {
  const cosT = Math.cos(theta);
  return h1 + x * Math.tan(theta) - (G / (2 * v0 * v0 * cosT * cosT)) * x * x;
}

export function impactError(v0, theta, h1, monoRestY, d, ropeLen = 0, useDrag = false) {
  const t  = impactTime(v0, theta, d, ropeLen);
  const py = projectilePos(v0, theta, h1, t, useDrag).y;
  const my = monkeyPos(d, monoRestY, t, ropeLen).y;
  return Math.abs(py - my) / Math.max(Math.abs(my), 0.001) * 100;
}
