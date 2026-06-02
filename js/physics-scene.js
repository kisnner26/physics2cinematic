// physics-scene.js — PIZARRÓN de clase con chalk
// Estética: fondo pizarrón verde oscuro, trazos de tiza imperfectos, letra Caveat

import { state } from './state.js';
import { projectilePos, monkeyPos, G } from './physics.js';

let canvas, ctx, W, H;
let initialized2 = false;
let trailPts2D = [];

const BOARD  = '#0e1a14';
const BOARD2 = '#122018';
const CW     = '#f0ece4';   // chalk blanco
const CY     = '#e8d48a';   // chalk amarillo (proyectil)
const CB     = '#7ab8d4';   // chalk azul (mono)
const CR     = '#d47a6a';   // chalk rojo (acento)
const CGREEN = '#7ac47a';   // chalk verde (ejes)
const FONT_H = "'Caveat', cursive";
const FONT_M = "'Space Mono', monospace";

function margin() { return { x: 80, y: 56, r: 60, b: 80 }; }

function toScreen(wx, wy) {
  const m = margin();
  const worldW = state.d * 1.3 + 0.5;
  const worldH = Math.max((state.h2_anchorY || state.h2) * 1.6 + 0.5, 4);
  const drawW  = W - m.x - m.r;
  const drawH  = H - m.y - m.b;
  return {
    sx: m.x + (wx / worldW) * drawW,
    sy: H - m.b - (wy / worldH) * drawH
  };
}

export function initPhysics() {
  canvas = document.getElementById('physics-canvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  initialized2 = true;
}

function resize() {
  canvas = document.getElementById('physics-canvas');
  ctx = canvas.getContext('2d');
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}

export function resetTrail2D() {
  trailPts2D = [];
}

// ── Chalk helpers ─────────────────────────────────────────────────────────
// Dibuja línea con textura de tiza (ligeramente imperfecta)
function chalkLine(x1, y1, x2, y2, color, width = 1.5, alpha = 0.88) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  // Ligera textura broken-line para simular tiza
  ctx.setLineDash([]);
  ctx.shadowBlur = 3;
  ctx.shadowColor = color;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  // Segunda pasada más fina y offseteada para textura
  ctx.globalAlpha = alpha * 0.3;
  ctx.lineWidth = width * 0.5;
  ctx.beginPath(); ctx.moveTo(x1+0.5, y1-0.5); ctx.lineTo(x2+0.5, y2-0.5); ctx.stroke();
  ctx.restore();
}

function chalkDot(sx, sy, r, color, alpha = 0.9) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 8; ctx.shadowColor = color;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function chalkArrow(x1, y1, x2, y2, color, width = 1.5, alpha = 0.88) {
  const dx = x2-x1, dy = y2-y1;
  const len = Math.sqrt(dx*dx+dy*dy);
  if (len < 6) return;
  const ux = dx/len, uy = dy/len;
  const hs = 9;
  chalkLine(x1, y1, x2, y2, color, width, alpha);
  ctx.save();
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  ctx.shadowBlur = 4; ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux*hs + uy*hs*0.4, y2 - uy*hs - ux*hs*0.4);
  ctx.lineTo(x2 - ux*hs - uy*hs*0.4, y2 - uy*hs + ux*hs*0.4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function chalkText(text, sx, sy, color, size = 15, align = 'left', alpha = 0.9) {
  ctx.save();
  ctx.font = `${size}px ${FONT_H}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 4; ctx.shadowColor = color;
  ctx.fillText(text, sx, sy);
  ctx.restore();
}

function chalkFormula(text, sx, sy, color = CW, size = 13, alpha = 0.85) {
  ctx.save();
  ctx.font = `${size}px ${FONT_H}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 3; ctx.shadowColor = color;
  ctx.fillText(text, sx, sy);
  ctx.restore();
}

// Dibujar arco de ángulo theta
function drawThetaArc(ox, oy, r, theta, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
  ctx.shadowBlur = 3; ctx.shadowColor = color;
  // En canvas: y invertida, ángulo va de 0 hacia -theta (porque y está invertido)
  ctx.beginPath();
  ctx.arc(ox, oy, r, -theta, 0);
  ctx.stroke();
  ctx.restore();
}

// Mono dibujado en tiza (stick figure estilizado)
function drawMonkeyChalk(sx, sy, scale, color, isImpacted) {
  const s = scale;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = isImpacted ? 1.0 : 0.88;
  ctx.shadowBlur = 6; ctx.shadowColor = color;

  // Cuerpo (oval)
  ctx.beginPath();
  ctx.ellipse(sx, sy, s*0.22, s*0.28, 0, 0, Math.PI*2);
  ctx.stroke();

  // Cabeza
  ctx.beginPath();
  ctx.arc(sx, sy - s*0.42, s*0.18, 0, Math.PI*2);
  ctx.stroke();

  // Brazos extendidos (colgando)
  ctx.beginPath();
  ctx.moveTo(sx - s*0.32, sy - s*0.10);
  ctx.lineTo(sx - s*0.55, sy + s*0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + s*0.32, sy - s*0.10);
  ctx.lineTo(sx + s*0.55, sy + s*0.22);
  ctx.stroke();

  // Piernas
  ctx.beginPath();
  ctx.moveTo(sx - s*0.12, sy + s*0.28);
  ctx.lineTo(sx - s*0.20, sy + s*0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + s*0.12, sy + s*0.28);
  ctx.lineTo(sx + s*0.20, sy + s*0.58);
  ctx.stroke();

  // Cola
  ctx.beginPath();
  ctx.moveTo(sx + s*0.22, sy);
  ctx.quadraticCurveTo(sx + s*0.55, sy - s*0.15, sx + s*0.42, sy - s*0.45);
  ctx.stroke();

  // Orejas
  ctx.beginPath();
  ctx.arc(sx - s*0.24, sy - s*0.38, s*0.07, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx + s*0.24, sy - s*0.38, s*0.07, 0, Math.PI*2);
  ctx.stroke();

  // Ojos
  ctx.fillStyle = color;
  ctx.globalAlpha = isImpacted ? 1.0 : 0.75;
  ctx.beginPath(); ctx.arc(sx - s*0.065, sy - s*0.44, s*0.03, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + s*0.065, sy - s*0.44, s*0.03, 0, Math.PI*2); ctx.fill();

  if (isImpacted) {
    // X en los ojos
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 1.0;
    const ex = [sx - s*0.065, sx + s*0.065];
    ex.forEach(ex0 => {
      ctx.beginPath(); ctx.moveTo(ex0-s*0.04,sy-s*0.48); ctx.lineTo(ex0+s*0.04,sy-s*0.40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex0+s*0.04,sy-s*0.48); ctx.lineTo(ex0-s*0.04,sy-s*0.40); ctx.stroke();
    });
  }
  ctx.restore();
}

// Cañón dibujado en tiza
function drawCannonChalk(sx, sy, theta, scale) {
  const s = scale;
  ctx.save();
  ctx.translate(sx, sy);
  // Rueda
  ctx.strokeStyle = CW; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
  ctx.shadowBlur = 4; ctx.shadowColor = CW;
  ctx.beginPath(); ctx.arc(0, 0, s*0.18, 0, Math.PI*2); ctx.stroke();
  // Radios
  for (let i = 0; i < 6; i++) {
    const a = (i/6)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*s*0.18, Math.sin(a)*s*0.18); ctx.stroke();
  }
  // Cuerpo
  ctx.fillStyle = CW; ctx.globalAlpha = 0.15;
  ctx.fillRect(-s*0.28, -s*0.14, s*0.40, s*0.20);
  ctx.globalAlpha = 0.8;
  ctx.strokeRect(-s*0.28, -s*0.14, s*0.40, s*0.20);
  // Barril (rotado según theta)
  ctx.save();
  ctx.rotate(-theta); // canvas y-invertida
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s*0.55, 0);
  ctx.stroke();
  // Boca del cañón
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s*0.50, -s*0.035);
  ctx.lineTo(s*0.50, s*0.035);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ── RENDER PIZARRÓN ──────────────────────────────────────────────────────────
export function renderPhysics(proj, mono) {
  if (!initialized2) return;
  if (W !== canvas.offsetWidth || H !== canvas.offsetHeight) {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  // Fondo pizarrón con textura sutil
  ctx.fillStyle = BOARD;
  ctx.fillRect(0, 0, W, H);
  // Textura del pizarrón: ruido sutil de tiza vieja
  ctx.save();
  ctx.globalAlpha = 0.025;
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = CW;
    ctx.fillRect(Math.random()*W, Math.random()*H, Math.random()*3+0.5, 0.5);
  }
  ctx.restore();

  const m = margin();
  const origin = toScreen(0, 0);

  // ── EJES ─────────────────────────────────────────────────────────────────
  const axisEndX = toScreen(state.d * 1.25, 0);
  const axisEndY = toScreen(0, (state.h2_anchorY || state.h2) * 1.55);

  chalkArrow(origin.sx - 10, origin.sy, axisEndX.sx + 10, axisEndY.sy, CGREEN, 1.8, 0.5);
  // Eje X
  chalkArrow(origin.sx - 10, origin.sy, axisEndX.sx + 10, origin.sy, CGREEN, 1.8, 0.5);
  chalkText('x (m)', axisEndX.sx + 14, origin.sy, CGREEN, 13, 'left', 0.6);
  chalkText('y (m)', origin.sx, axisEndY.sy - 12, CGREEN, 13, 'center', 0.6);

  // Marcas del eje X
  for (let x = 0; x <= Math.floor(state.d * 1.2); x += Math.max(1, Math.floor(state.d/8))) {
    const p = toScreen(x, 0);
    chalkLine(p.sx, p.sy-4, p.sx, p.sy+4, CGREEN, 1, 0.4);
    chalkText(String(x), p.sx, p.sy+14, CGREEN, 11, 'center', 0.5);
  }
  // Marcas del eje Y
  const maxY = (state.h2_anchorY || state.h2) * 1.5;
  for (let y = 0; y <= Math.floor(maxY); y++) {
    const p = toScreen(0, y);
    chalkLine(p.sx-4, p.sy, p.sx+4, p.sy, CGREEN, 1, 0.4);
    chalkText(String(y), p.sx-12, p.sy, CGREEN, 11, 'right', 0.5);
  }

  // ── PLATAFORMAS ────────────────────────────────────────────────────────────
  // Plataforma cañón (h1)
  const platL_top = toScreen(0, state.h1);
  const platL_bot = toScreen(0, 0);
  chalkLine(platL_bot.sx, platL_bot.sy, platL_top.sx, platL_top.sy, CW, 1.8, 0.6);  // pilar
  chalkLine(platL_top.sx - 14, platL_top.sy, platL_top.sx + 14, platL_top.sy, CW, 2.5, 0.7); // tope
  // Etiqueta h1
  const midH1 = toScreen(-0.22, state.h1 * 0.5);
  chalkArrow(midH1.sx, origin.sy, midH1.sx, platL_top.sy, CY, 1.3, 0.6);
  chalkText('h₁=' + state.h1.toFixed(1), midH1.sx - 8, (origin.sy + platL_top.sy)*0.5, CY, 13, 'right', 0.75);

  // Plataforma mono (h2)
  const platR_top  = toScreen(state.d, state.h2);
  const platR_bot  = toScreen(state.d, 0);
  const anchorYVal = state.h2_anchorY || (state.h2 + 0.08);
  const anchorPt   = toScreen(state.d, anchorYVal);
  const barLeftPt  = toScreen(state.d - state.ropeLen, anchorYVal);
  chalkLine(platR_bot.sx, platR_bot.sy, platR_top.sx, platR_top.sy, CW, 1.8, 0.6);
  chalkLine(platR_top.sx - 14, platR_top.sy, platR_top.sx + 14, platR_top.sy, CW, 2.5, 0.7);
  // Barra horizontal
  chalkLine(anchorPt.sx, anchorPt.sy, barLeftPt.sx, barLeftPt.sy, CW, 1.5, 0.5);
  // Cuerda
  const monoRestY = anchorYVal - state.ropeLen;
  const monoRestPt = toScreen(state.d - state.ropeLen, monoRestY);
  chalkLine(barLeftPt.sx, barLeftPt.sy, monoRestPt.sx, monoRestPt.sy, CW, 1.2, 0.45);
  // h2 label
  const midH2x = toScreen(state.d + 0.3, state.h2 * 0.5);
  chalkArrow(midH2x.sx, origin.sy, midH2x.sx, platR_top.sy, CB, 1.3, 0.6);
  chalkText('h₂=' + state.h2.toFixed(1), midH2x.sx + 6, (origin.sy + platR_top.sy)*0.5, CB, 13, 'left', 0.75);

  // d label
  const dMid = toScreen(state.d * 0.5, -0.35);
  chalkArrow(toScreen(0,-0.35).sx, dMid.sy, toScreen(state.d,-0.35).sx, dMid.sy, CW, 1.2, 0.5);
  chalkText('d=' + state.d.toFixed(1) + ' m', dMid.sx, dMid.sy - 1, CW, 13, 'center', 0.65);

  // ── TRAYECTORIA PARABÓLICA ─────────────────────────────────────────────────
  if (state.theta !== 0) {
    ctx.save();
    ctx.strokeStyle = CY; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.35;
    ctx.setLineDash([6, 5]);
    ctx.shadowBlur = 4; ctx.shadowColor = CY;
    ctx.beginPath();
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = (i/steps) * state.impactT * 1.05;
      const p = projectilePos(state.v0, state.theta, state.h1, t);
      const s = toScreen(p.x, p.y);
      i === 0 ? ctx.moveTo(s.sx, s.sy) : ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── TRAIL DEL PROYECTIL ────────────────────────────────────────────────────
  if (trailPts2D.length > 1) {
    ctx.save();
    ctx.strokeStyle = CY; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.75;
    ctx.lineCap = 'round'; ctx.shadowBlur = 6; ctx.shadowColor = CY;
    ctx.beginPath();
    trailPts2D.forEach((p, i) => {
      const s = toScreen(p.x, p.y);
      i === 0 ? ctx.moveTo(s.sx, s.sy) : ctx.lineTo(s.sx, s.sy);
    });
    ctx.stroke();
    ctx.restore();
  }

  // ── MONO ────────────────────────────────────────────────────────────────────
  const monoPt = toScreen(state.d - state.ropeLen, mono.y);
  const monoScale = Math.max(24, Math.min(42, W * 0.035));
  drawMonkeyChalk(monoPt.sx, monoPt.sy, monoScale, state.impacted ? CR : CB, state.impacted);

  // Línea de caída del mono
  if (state.t > 0.01 && !state.impacted) {
    const monoRestPtDyn = toScreen(state.d - state.ropeLen, monoRestY);
    chalkLine(monoPt.sx, monoPt.sy, monoPt.sx, monoRestPtDyn.sy, CB, 1.2, 0.35);
    chalkText('↓ ½gt²', monoPt.sx + 6, (monoPt.sy + monoRestPtDyn.sy)*0.5, CB, 12, 'left', 0.6);
  }

  // ── CAÑÓN ────────────────────────────────────────────────────────────────────
  const cannonPt = toScreen(0, state.h1);
  const cannonScale = Math.max(24, Math.min(38, W * 0.03));
  drawCannonChalk(cannonPt.sx, cannonPt.sy, state.theta, cannonScale);

  // Ángulo θ
  const thetaR = Math.min(cannonScale * 0.7, 28);
  drawThetaArc(cannonPt.sx, cannonPt.sy, thetaR, state.theta, CY);
  chalkText('θ', cannonPt.sx + thetaR * 0.6, cannonPt.sy + 6, CY, 15, 'left', 0.8);

  // Línea de mira (aim)
  if (state.theta !== 0) {
    const aimEnd = toScreen(state.d - state.ropeLen, mono.y);
    chalkLine(cannonPt.sx, cannonPt.sy, aimEnd.sx, aimEnd.sy, CY, 1, 0.18);
  }

  // ── PROYECTIL ────────────────────────────────────────────────────────────────
  if (state.running || state.t > 0) {
    const projPt = toScreen(proj.x, proj.y);
    chalkDot(projPt.sx, projPt.sy, 8, CY, 0.95);

    // Vectores de velocidad
    const vscale = 5;
    const vxEnd = toScreen(proj.x + proj.vx * 0.08, proj.y);
    const vyEnd = toScreen(proj.x, proj.y + proj.vy * 0.08);
    chalkArrow(projPt.sx, projPt.sy, vxEnd.sx, vxEnd.sy, CY, 1.2, 0.7);
    chalkArrow(projPt.sx, projPt.sy, projPt.sx, vyEnd.sy, CY, 1.2, 0.7);
    chalkText('vₓ', vxEnd.sx + 4, vxEnd.sy, CY, 12, 'left', 0.7);
    chalkText('vᵧ', projPt.sx + 3, vyEnd.sy, CY, 12, 'left', 0.7);

    // Actualizar trail
    trailPts2D.push({ x: proj.x, y: proj.y });
    if (trailPts2D.length > 80) trailPts2D.shift();
  }

  // ── FÓRMULAS (esquina superior derecha) ────────────────────────────────────
  const fx = W - m.r - 10;
  const formulas = [
    { text: 'Proyectil:', color: CY, size: 14 },
    { text: `x = v₀cosθ · t`, color: CW, size: 12 },
    { text: `y = h₁ + v₀sinθ·t − ½gt²`, color: CW, size: 12 },
    { text: '', color: CW, size: 8 },
    { text: 'Mono:', color: CB, size: 14 },
    { text: `y = h₂ − ½gt²`, color: CW, size: 12 },
    { text: '', color: CW, size: 8 },
    { text: `θ = ${(state.theta*180/Math.PI).toFixed(2)}°`, color: CY, size: 13 },
    { text: `v₀ = ${state.v0.toFixed(1)} m/s`, color: CW, size: 12 },
    { text: `g = 9.81 m/s²`, color: CW, size: 12 },
  ];
  if (state.impactT > 0) {
    formulas.push({ text: `t* = ${state.impactT.toFixed(3)} s`, color: CR, size: 13 });
  }
  let fy = m.y;
  formulas.forEach(f => {
    if (f.text) chalkFormula(f.text, fx - 160, fy, f.color, f.size, 0.8);
    fy += (f.size || 12) + 5;
  });

  // ── t ACTUAL ─────────────────────────────────────────────────────────────────
  if (state.t > 0) {
    const tLabel = `t = ${state.t.toFixed(3)} s`;
    chalkText(tLabel, W/2, H - m.b + 22, state.impacted ? CR : CW, 18, 'center', 0.9);
  }

  // ── IMPACTO flash ────────────────────────────────────────────────────────────
  if (state.impacted) {
    const ip = toScreen(proj.x, proj.y);
    ctx.save();
    ctx.strokeStyle = CR; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.7;
    const lines = 8;
    for (let i = 0; i < lines; i++) {
      const a = (i/lines) * Math.PI*2;
      const r1 = 8, r2 = 18 + Math.random()*8;
      ctx.beginPath();
      ctx.moveTo(ip.sx + Math.cos(a)*r1, ip.sy + Math.sin(a)*r1);
      ctx.lineTo(ip.sx + Math.cos(a)*r2, ip.sy + Math.sin(a)*r2);
      ctx.stroke();
    }
    chalkText('¡IMPACTO!', ip.sx, ip.sy - 28, CR, 18, 'center', 0.95);
    ctx.restore();
  }
}

// reset FX dummy (compatible con main.js)
function resetImpactFX() {}
