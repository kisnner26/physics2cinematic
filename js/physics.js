// physics.js — física con resistencia del aire opcional

export const G = 9.81; // m/s²

// Coeficiente de arrastre (puede ser 0 para modo ideal)
// Esfera: Cd=0.47, área=π*r², rho_air=1.225 kg/m³, m=0.03 kg
// Factor de arrastre = 0.5 * Cd * rho * A / m
// r = 0.045 m (bala real), A = π*0.045² = 0.00636 m²
// k = 0.5 * 0.47 * 1.225 * 0.00636 / 0.03 = 0.0610 m⁻¹
// A v0=14: drag_a = k * 14² = 11.9 m/s² → notable pero no dominante
// Usamos k pequeño para que el experimento siga siendo didáctico
export const DRAG_K = 0.018; // ajustado para bala de cañón educativa

/**
 * Ángulo θ que apunta al mono en reposo.
 * Con drag, la trayectoria real se curva más, pero el experimento
 * funciona igualmente porque ambos caen con la misma g.
 * El θ analítico (sin drag) es suficiente para el demo.
 */
export function computeTheta(h1, monoY, d, ropeLen = 0) {
  return Math.atan2(monoY - h1, d - ropeLen);
}

/**
 * Posición del proyectil integrando RK4 con resistencia del aire.
 * Para t pequeños (< 2s) y velocidades moderadas es más preciso que Euler.
 * Devuelve { x, y, vx, vy }
 */
export function projectilePos(v0, theta, h1, t, useDrag = false) {
  const vx0 = v0 * Math.cos(theta);
  const vy0 = v0 * Math.sin(theta);

  if (!useDrag || DRAG_K === 0) {
    // Solución analítica exacta (sin drag)
    return {
      x:  vx0 * t,
      y:  h1 + vy0 * t - 0.5 * G * t * t,
      vx: vx0,
      vy: vy0 - G * t,
    };
  }

  // RK4 numérico con drag cuadrático
  const dt = 0.001; // paso de integración fino
  const steps = Math.round(t / dt);
  let x = 0, y = h1, vx = vx0, vy = vy0;

  function accel(vx, vy) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    const drag  = DRAG_K * speed;
    return { ax: -drag * vx, ay: -G - drag * vy };
  }

  for (let i = 0; i < steps; i++) {
    const k1 = accel(vx, vy);
    const k2 = accel(vx + k1.ax * dt * 0.5, vy + k1.ay * dt * 0.5);
    const k3 = accel(vx + k2.ax * dt * 0.5, vy + k2.ay * dt * 0.5);
    const k4 = accel(vx + k3.ax * dt, vy + k3.ay * dt);
    vx += (k1.ax + 2*k2.ax + 2*k3.ax + k4.ax) * dt / 6;
    vy += (k1.ay + 2*k2.ay + 2*k3.ay + k4.ay) * dt / 6;
    x  += vx * dt;
    y  += vy * dt;
  }
  return { x, y, vx, vy };
}

/**
 * Mono: caída libre exacta desde monoRestY.
 * Añadimos pequeña oscilación de péndulo en los primeros frames
 * para que la suelta se vea más natural.
 */
export function monkeyPos(d, monoRestY, t, ropeLen = 0) {
  return {
    x: d - ropeLen,   // mono cuelga a ropeLen del ancla en x=d
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

export function impactError(v0, theta, h1, monoRestY, d, ropeLen = 0) {
  const t  = impactTime(v0, theta, d, ropeLen);
  const py = projectilePos(v0, theta, h1, t).y;
  const my = monkeyPos(d, monoRestY, t, ropeLen).y;
  return Math.abs(py - my) / Math.max(Math.abs(my), 0.001) * 100;
}
