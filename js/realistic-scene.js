// realistic-scene.js — Three.js r128 | Unreal-grade + Orbit Controls propio

import { state } from './state.js';
import { projectilePos, monkeyPos, G } from './physics.js';

const THREE = window.THREE;

let renderer, scene, clock;
let initialized = false;

// ── Cámaras ───────────────────────────────────────────────────────────────
const cameras    = {};
let   activeCam  = 'orbit';
let   camLookTarget = new THREE.Vector3(0, 2, 0);

// ── Orbit state ───────────────────────────────────────────────────────────
const orb = {
  theta: 0,          // azimut  (horizontal)
  phi:   0.38,       // polar   (vertical, 0=top π=bottom)
  radius: 18,
  target: new THREE.Vector3(0, 2, 0),
  // drag
  dragging: false,
  button: -1,
  lastX: 0, lastY: 0,
  // velocidad inercial
  vTheta: 0, vPhi: 0,
  // pinch
  lastPinch: 0,
};
const ORB_MIN_PHI    = 0.08;
const ORB_MAX_PHI    = Math.PI * 0.72;
const ORB_MIN_RADIUS = 4;
const ORB_MAX_RADIUS = 42;

// ── Objetos ───────────────────────────────────────────────────────────────
let cannonGroup, pivotGroup;
let monkeyGroup, barMesh, ropeMesh, barAnchorGroup;
let bulletMesh, bulletLight, impactFlashLight;
let impactFlashIntensity = 0;
let platformLGroup, platformRGroup, groundMesh;
let envMap = null;

// ── Luces ─────────────────────────────────────────────────────────────────
let ambientL, sunL, fillL, rimL, muzzleFlashL, groundBounceL;

// ── Trail & partículas ────────────────────────────────────────────────────
let trailPoints = [], trailGeo, trailLine;
let particles = [], particleSystem, particleGeo;
let debrisParticles = [], debrisGeo, debrisSystem;
let glowSprites = [];
let particleSpawned = false;
const MAX_TRAIL = 150, MAX_PARTICLES = 400;

// ── Aim ───────────────────────────────────────────────────────────────────
let aimLine, parabolaLine;
let flashTimer = 0;
let impactShakeFrame = 0;

const PLATFORM_TOP_H = 0.08;
const CANNON_WHEEL_R = 0.18;
const CANNON_BODY_H  = 0.28;
const BARREL_LEN     = 0.70;
const BARREL_R       = 0.08;

function w2t(wx, wy) {
  return new THREE.Vector3(wx - state.d * 0.5, wy, 0);
}

// ── MATERIALS de alta calidad ─────────────────────────────────────────────
let MAT = {};
function buildMaterials() {
  // Metal oscuro (plataformas, cañón)
  MAT.darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1c1a18, roughness: 0.38, metalness: 0.92,
    envMapIntensity: 1.4
  });
  MAT.gunMetal = new THREE.MeshStandardMaterial({
    color: 0x28262a, roughness: 0.22, metalness: 0.96,
    envMapIntensity: 1.8
  });
  MAT.bronze = new THREE.MeshStandardMaterial({
    color: 0x1a3a6e, roughness: 0.18, metalness: 0.95,
    emissive: 0x061830, emissiveIntensity: 0.4,
    envMapIntensity: 2.0
  });
  MAT.platEdge = new THREE.MeshStandardMaterial({
    color: 0x1a3a6e, roughness: 0.12, metalness: 0.98,
    emissive: 0x0a2050, emissiveIntensity: 0.6,
    envMapIntensity: 2.2
  });
  MAT.rope = new THREE.MeshStandardMaterial({
    color: 0x8a7a5a, roughness: 0.98, metalness: 0.0,
  });
  MAT.monkeyBody = new THREE.MeshStandardMaterial({
    color: 0xc8722a, roughness: 0.72, metalness: 0.0,
    envMapIntensity: 0.3
  });
  MAT.monkeyFace = new THREE.MeshStandardMaterial({
    color: 0xf0b060, roughness: 0.82, metalness: 0.0
  });
  MAT.monkeyDark = new THREE.MeshStandardMaterial({
    color: 0x110800, roughness: 1.0
  });
  MAT.monkeyGlow = new THREE.MeshBasicMaterial({
    color: 0x1a3a6e, transparent: true, opacity: 0, depthWrite: false
  });
  // Ground — PBR with reflection
  MAT.ground = new THREE.MeshStandardMaterial({
    color: 0x14120f, roughness: 0.96, metalness: 0.12,
    envMapIntensity: 0.5
  });
  MAT.mirrorGround = new THREE.MeshStandardMaterial({
    color: 0x0c0a08, roughness: 0.04, metalness: 0.96,
    transparent: true, opacity: 0.35,
    envMapIntensity: 1.5
  });
  // Barrel
  MAT.barrel = new THREE.MeshStandardMaterial({
    color: 0x222026, roughness: 0.15, metalness: 0.98,
    envMapIntensity: 2.2
  });
  // Bullet
  MAT.bullet = new THREE.MeshStandardMaterial({
    color: 0xd4a820, emissive: 0x7a4800, emissiveIntensity: 1.6,
    roughness: 0.08, metalness: 0.98,
    envMapIntensity: 2.0
  });
}

// ── ENV MAP sintético (PMREM-like con CubeCamera) ─────────────────────────
function buildEnvMap() {
  // Usar PMREMGenerator simulado con un CubeRenderTarget
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Escena de environment simple: luz del cielo + horizonte
  const envScene = new THREE.Scene();
  // Gradiente de cielo (azul oscuro arriba, cálido abajo)
  const skyGeo  = new THREE.SphereGeometry(50, 16, 8);
  const skyMat  = new THREE.MeshBasicMaterial({
    color: 0x0a0e18, side: THREE.BackSide
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  // Luz del cielo para el env
  envScene.add(new THREE.HemisphereLight(0x1a2a4a, 0x3a2a18, 1));
  const envSun = new THREE.DirectionalLight(0xfff0d0, 3);
  envSun.position.set(5, 8, 3);
  envScene.add(envSun);

  const envRT = pmremGenerator.fromScene(envScene);
  envMap = envRT.texture;

  scene.environment = envMap;
  Object.values(MAT).forEach(m => {
    if (m.envMap !== undefined) m.envMap = envMap;
    m.needsUpdate = true;
  });

  pmremGenerator.dispose();
}

// ── PLATAFORMAS ────────────────────────────────────────────────────────────
function makePlatformGroup(h) {
  const g = new THREE.Group();

  // Pilar — cilindro facetado con tapas
  const pilGeo = new THREE.CylinderGeometry(0.07, 0.12, h, 12);
  const pil = new THREE.Mesh(pilGeo, MAT.darkMetal);
  pil.position.y = h / 2;
  pil.castShadow = true; pil.receiveShadow = true;
  g.add(pil);

  // Tope — placa gruesa
  const topGeo = new THREE.BoxGeometry(0.76, PLATFORM_TOP_H, 0.76);
  const top = new THREE.Mesh(topGeo, MAT.darkMetal);
  top.position.y = h + PLATFORM_TOP_H / 2;
  top.castShadow = true; top.receiveShadow = true;
  g.add(top);

  // Franja de acero azul (edge glow)
  const edgeGeo = new THREE.BoxGeometry(0.78, 0.018, 0.78);
  const edge = new THREE.Mesh(edgeGeo, MAT.platEdge);
  edge.position.y = h + PLATFORM_TOP_H + 0.009;
  g.add(edge);

  // Tornillos decorativos en las esquinas
  const boltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6);
  [[0.28,0.28],[0.28,-0.28],[-0.28,0.28],[-0.28,-0.28]].forEach(([bx,bz]) => {
    const bolt = new THREE.Mesh(boltGeo, MAT.gunMetal);
    bolt.position.set(bx, h + PLATFORM_TOP_H + 0.02, bz);
    g.add(bolt);
  });

  // Luz de acento azul (point light de la plataforma)
  const pl = new THREE.PointLight(0x2a5aaa, 0.6, 3.5);
  pl.position.y = h + 0.5;
  g.add(pl);

  g.userData.topY = h + PLATFORM_TOP_H;
  return g;
}

// ── CAÑÓN ──────────────────────────────────────────────────────────────────
function buildCannon() {
  cannonGroup = new THREE.Group();

  pivotGroup = new THREE.Group();
  pivotGroup.position.set(0.05, CANNON_WHEEL_R + 0.05, 0);

  // Barril principal
  const barGeo = new THREE.CylinderGeometry(BARREL_R * 0.72, BARREL_R, BARREL_LEN, 16);
  const barrel = new THREE.Mesh(barGeo, MAT.barrel);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = BARREL_LEN / 2;
  barrel.castShadow = true;
  pivotGroup.add(barrel);

  // Boca del cañón (torus + disco)
  const mouthRing = new THREE.Mesh(
    new THREE.TorusGeometry(BARREL_R + 0.012, 0.022, 10, 20),
    MAT.bronze
  );
  mouthRing.rotation.y = Math.PI / 2;
  mouthRing.position.x = BARREL_LEN - 0.01;
  pivotGroup.add(mouthRing);

  // Anillos de refuerzo
  for (let i = 0; i < 3; i++) {
    const rg = new THREE.TorusGeometry(BARREL_R + 0.01, 0.016, 8, 20);
    const rm = new THREE.Mesh(rg, MAT.bronze);
    rm.rotation.y = Math.PI / 2;
    rm.position.x = 0.09 + i * 0.2;
    pivotGroup.add(rm);
  }

  // Mirilla (small box on top)
  const sightGeo = new THREE.BoxGeometry(0.018, 0.035, 0.018);
  const sight = new THREE.Mesh(sightGeo, MAT.gunMetal);
  sight.position.set(BARREL_LEN * 0.6, BARREL_R + 0.02, 0);
  pivotGroup.add(sight);

  cannonGroup.add(pivotGroup);

  // Carrocería
  const bodyGeo = new THREE.BoxGeometry(0.54, CANNON_BODY_H, 0.38);
  const body = new THREE.Mesh(bodyGeo, MAT.darkMetal);
  body.position.set(0.05, CANNON_WHEEL_R + CANNON_BODY_H * 0.1, 0);
  body.castShadow = true;
  cannonGroup.add(body);

  // Bisagra del pivote
  const hingeGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.48, 10);
  const hinge = new THREE.Mesh(hingeGeo, MAT.bronze);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0.05, CANNON_WHEEL_R + 0.05, 0);
  cannonGroup.add(hinge);

  // Ruedas de alta calidad
  [-0.22, 0.22].forEach(z => {
    // Llanta
    const wGeo = new THREE.TorusGeometry(CANNON_WHEEL_R, 0.042, 10, 22);
    const wheel = new THREE.Mesh(wGeo, MAT.darkMetal);
    wheel.position.set(0, CANNON_WHEEL_R, z);
    wheel.castShadow = true;
    cannonGroup.add(wheel);

    // Radios (6)
    for (let s = 0; s < 6; s++) {
      const sGeo = new THREE.CylinderGeometry(0.009, 0.009, CANNON_WHEEL_R * 1.85, 6);
      const spoke = new THREE.Mesh(sGeo, MAT.gunMetal);
      spoke.rotation.z = (s / 6) * Math.PI;
      spoke.position.set(0, CANNON_WHEEL_R, z);
      cannonGroup.add(spoke);
    }

    // Hub central
    const hGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8);
    const hub = new THREE.Mesh(hGeo, MAT.bronze);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, CANNON_WHEEL_R, z);
    cannonGroup.add(hub);

    // Tornillos del hub
    for (let b = 0; b < 5; b++) {
      const ba = (b / 5) * Math.PI * 2;
      const bGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.07, 5);
      const bl = new THREE.Mesh(bGeo, MAT.gunMetal);
      bl.rotation.x = Math.PI / 2;
      bl.position.set(Math.cos(ba) * 0.025, CANNON_WHEEL_R + Math.sin(ba) * 0.025, z);
      cannonGroup.add(bl);
    }
  });

  // Eje entre ruedas
  const axleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8);
  const axle = new THREE.Mesh(axleGeo, MAT.gunMetal);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, CANNON_WHEEL_R, 0);
  cannonGroup.add(axle);

  scene.add(cannonGroup);
}

function updateCannonPose() {
  const platTopY   = state.h1 + PLATFORM_TOP_H;
  const cannonBaseX = -state.d * 0.5;
  cannonGroup.position.set(cannonBaseX, platTopY, 0);
  pivotGroup.rotation.z = state.theta;
}

// ── MONO ────────────────────────────────────────────────────────────────────
function buildMonkeySystem() {
  barAnchorGroup = new THREE.Group();
  scene.add(barAnchorGroup);

  barMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1, 10),
    MAT.darkMetal
  );
  barMesh.name = 'bar'; barMesh.rotation.z = Math.PI / 2;
  barAnchorGroup.add(barMesh);

  const tipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), MAT.bronze);
  tipMesh.name = 'barTip'; barAnchorGroup.add(tipMesh);

  ropeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.010, 1, 8),
    MAT.rope
  );
  ropeMesh.name = 'rope'; barAnchorGroup.add(ropeMesh);

  monkeyGroup = new THREE.Group(); monkeyGroup.name = 'monkey';

  // Cuerpo
  monkeyGroup.add(Object.assign(
    new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), MAT.monkeyBody),
    { castShadow: true }
  ));
  // Cabeza
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 18, 12), MAT.monkeyBody);
  head.position.set(0, 0.34, 0); head.castShadow = true;
  monkeyGroup.add(head);
  // Cara
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), MAT.monkeyFace);
  face.position.set(0, 0.31, 0.1); monkeyGroup.add(face);
  // Ojos
  [-0.055, 0.055].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), MAT.monkeyDark);
    eye.position.set(x, 0.36, 0.2); monkeyGroup.add(eye);
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    shine.position.set(x + 0.012, 0.372, 0.224); monkeyGroup.add(shine);
  });
  // Nariz
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), MAT.monkeyFace);
  nose.position.set(0, 0.30, 0.19); monkeyGroup.add(nose);
  // Orejas
  [-0.19, 0.19].forEach(x => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 8), MAT.monkeyBody);
    ear.scale.z = 0.46; ear.position.set(x, 0.34, 0.02);
    ear.castShadow = true; monkeyGroup.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 6), MAT.monkeyFace);
    inner.scale.z = 0.34; inner.position.set(x * 1.04, 0.34, 0.03);
    monkeyGroup.add(inner);
  });
  // Brazos
  const armGeo = new THREE.CylinderGeometry(0.040, 0.028, 0.40, 10);
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(armGeo, MAT.monkeyBody);
    arm.name = side < 0 ? 'armL' : 'armR';
    arm.position.set(side * 0.28, 0.07, 0);
    arm.rotation.z = side * 0.5;
    arm.castShadow = true; monkeyGroup.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), MAT.monkeyFace);
    hand.name = side < 0 ? 'handL' : 'handR';
    hand.position.set(side * 0.46, 0.25, 0);
    monkeyGroup.add(hand);
  });
  // Piernas
  const legGeo = new THREE.CylinderGeometry(0.040, 0.032, 0.34, 10);
  [-1, 1].forEach(side => {
    const leg = new THREE.Mesh(legGeo, MAT.monkeyBody);
    leg.position.set(side * 0.12, -0.27, 0);
    leg.rotation.z = side * 0.15;
    leg.castShadow = true; monkeyGroup.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), MAT.monkeyBody);
    foot.position.set(side * 0.16, -0.45, 0.04);
    monkeyGroup.add(foot);
  });
  // Cola
  const tailCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.0, -0.08, 0),
    new THREE.Vector3(0.40, 0.14, 0.10),
    new THREE.Vector3(0.34, 0.44, 0)
  );
  monkeyGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 14, 0.026, 8),
    MAT.monkeyBody
  ));
  // Glow de impacto
  const glowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 18, 12),
    MAT.monkeyGlow.clone()
  );
  glowMesh.name = 'glow'; monkeyGroup.add(glowMesh);

  barAnchorGroup.add(monkeyGroup);
}

function updateMonkeySystem(monoWorldY, dropped) {
  const anchorThreeX = state.d * 0.5;
  const anchorWorldY = state.h2_anchorY;
  barAnchorGroup.position.set(anchorThreeX, anchorWorldY, 0);
  const barLen = state.ropeLen;
  barMesh.scale.y = barLen;
  barMesh.position.set(-barLen * 0.5, 0, 0);
  const tip = barAnchorGroup.getObjectByName('barTip');
  if (tip) tip.position.set(-barLen, 0, 0);
  const ropeHeight = Math.max(0.01, anchorWorldY - monoWorldY);
  ropeMesh.scale.y = ropeHeight;
  ropeMesh.position.set(-barLen, -ropeHeight * 0.5, 0);
  monkeyGroup.position.set(-barLen, monoWorldY - anchorWorldY, 0);

  if (dropped) {
    const t = state.t;
    const armL = monkeyGroup.getObjectByName('armL');
    const armR = monkeyGroup.getObjectByName('armR');
    if (armL) armL.rotation.z =  0.55 + Math.sin(t * 7) * 0.22;
    if (armR) armR.rotation.z = -0.55 - Math.sin(t * 7) * 0.22;
    ropeMesh.visible = false;
    if (tip) tip.visible = false;
    monkeyGroup.rotation.z = Math.sin(t * 4.5) * 0.28;
  } else {
    ropeMesh.visible = true;
    if (tip) tip.visible = true;
    monkeyGroup.rotation.z = 0;
    monkeyGroup.rotation.x = 0;
    const armL = monkeyGroup.getObjectByName('armL');
    const armR = monkeyGroup.getObjectByName('armR');
    if (armL) armL.rotation.z =  0.55;
    if (armR) armR.rotation.z = -0.55;
  }
  const glow = monkeyGroup.getObjectByName('glow');
  if (glow) glow.material.opacity = state.impacted ? 0.55 : 0;
}

// ── BALA ────────────────────────────────────────────────────────────────────
function buildBullet() {
  // Bala: esfera pequeña de plomo/acero con glow interno
  const bulletGeo = new THREE.SphereGeometry(0.09, 16, 12);
  bulletMesh = new THREE.Mesh(bulletGeo, MAT.bullet);
  bulletMesh.visible = false; bulletMesh.castShadow = true;
  scene.add(bulletMesh);

  bulletLight = new THREE.PointLight(0xffc840, 0, 5.0, 2);
  scene.add(bulletLight);

  impactFlashLight = new THREE.PointLight(0xaacfff, 0, 14.0, 2);
  scene.add(impactFlashLight);

  // Halo de la bala (sprite siempre orientado a cámara)
  const spriteMat = new THREE.SpriteMaterial({
    color: 0xffe080,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const halo = new THREE.Sprite(spriteMat);
  halo.name = 'bulletHalo';
  halo.scale.set(0.8, 0.8, 1);
  scene.add(halo);
}

// ── TRAIL ────────────────────────────────────────────────────────────────────
function buildTrail() {
  const positions = new Float32Array(MAX_TRAIL * 3);
  const colors    = new Float32Array(MAX_TRAIL * 3);
  trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trailGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  trailGeo.setDrawRange(0, 0);
  trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  trailLine.visible = false; trailLine.frustumCulled = false;
  scene.add(trailLine);
}

function updateTrail(pos) {
  trailPoints.push(pos.clone());
  if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
  const posArr = trailGeo.attributes.position.array;
  const colArr = trailGeo.attributes.color.array;
  const n = trailPoints.length;
  trailPoints.forEach((p, i) => {
    posArr[i*3]=p.x; posArr[i*3+1]=p.y; posArr[i*3+2]=p.z;
    // Fade: cabeza brillante (azul eléctrico), cola desvanece
    const t = i / Math.max(n - 1, 1);
    colArr[i*3]   = t * 0.17;   // R
    colArr[i*3+1] = t * 0.42;   // G
    colArr[i*3+2] = t * 0.95;   // B
  });
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate    = true;
  trailGeo.setDrawRange(0, n);
  trailLine.visible = true;
}


// ── FRAGMENTOS 3D (shrapnel de la bala) ──────────────────────────────────────
// Array de { mesh, vx, vy, vz, rx, ry, rz, life, decay }
let fragments = [];
const FRAG_COUNT = 14;

function buildFragmentMeshes() {
  // Pre-crear y ocultar los meshes de fragmento
  // Usamos distintas geometrías para variedad visual
  const geos = [
    new THREE.TetrahedronGeometry(0.055, 0),
    new THREE.OctahedronGeometry(0.042, 0),
    new THREE.ConeGeometry(0.035, 0.09, 4),
    new THREE.BoxGeometry(0.05, 0.03, 0.04),
  ];
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd4a820,
    emissive: 0x8a4400,
    emissiveIntensity: 1.8,
    roughness: 0.08,
    metalness: 0.98,
  });
  for (let i = 0; i < FRAG_COUNT; i++) {
    const geo  = geos[i % geos.length];
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.name = `frag_${i}`;
    scene.add(mesh);
  }
}

export function spawnFragments(pos, projVx, projVy) {
  fragments = [];
  for (let i = 0; i < FRAG_COUNT; i++) {
    const mesh = scene.getObjectByName(`frag_${i}`);
    if (!mesh) continue;

    // Velocidad base: componente de la bala + explosión radial
    const ang  = (i / FRAG_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const el   = (Math.random() - 0.3) * Math.PI;
    const spd  = 1.5 + Math.random() * 3.5;

    const vx = projVx * 0.12 + Math.cos(ang) * Math.cos(el) * spd;
    const vy = Math.abs(projVy) * 0.08 + Math.abs(Math.sin(el)) * spd * 0.7 + 0.8;
    const vz = Math.sin(ang) * Math.cos(el) * spd * 0.9;

    mesh.position.set(pos.x, pos.y, pos.z);
    // Escala aleatoria para variedad
    const s = 0.5 + Math.random() * 1.0;
    mesh.scale.set(s, s, s);
    mesh.visible = true;
    mesh.material.opacity    = 1;
    mesh.material.transparent = true;
    mesh.material.emissiveIntensity = 2.2;

    fragments.push({
      mesh, vx, vy, vz,
      rx: (Math.random() - 0.5) * 18,
      ry: (Math.random() - 0.5) * 18,
      rz: (Math.random() - 0.5) * 18,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.018,
    });
  }
}

function updateFragments() {
  if (fragments.length === 0) return;
  const G = 9.81 / 60; // por frame
  fragments.forEach(f => {
    f.vy  -= G;
    f.vx  *= 0.97;
    f.vz  *= 0.97;
    f.mesh.position.x += f.vx / 60;
    f.mesh.position.y += f.vy / 60;
    f.mesh.position.z += f.vz / 60;
    f.mesh.rotation.x += f.rx / 60;
    f.mesh.rotation.y += f.ry / 60;
    f.mesh.rotation.z += f.rz / 60;
    // Rebotar en el suelo
    if (f.mesh.position.y < 0.04) {
      f.mesh.position.y = 0.04;
      f.vy  = -f.vy * 0.28;
      f.vx *= 0.6; f.vz *= 0.6;
    }
    f.life -= f.decay;
    // Fricción rotacional gradual
    f.rx *= 0.96; f.ry *= 0.96; f.rz *= 0.96;
    f.mesh.material.opacity = Math.max(0, f.life);
    f.mesh.material.emissiveIntensity = Math.max(0, f.life * 2.0);
  });
  // Quitar los muertos
  fragments = fragments.filter(f => {
    if (f.life <= 0) { f.mesh.visible = false; return false; }
    return true;
  });
}

export function resetFragments() {
  fragments.forEach(f => { if (f.mesh) f.mesh.visible = false; });
  fragments = [];
}

// ── PARTÍCULAS ────────────────────────────────────────────────────────────────
function buildParticles() {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleSystem = new THREE.Points(particleGeo, new THREE.PointsMaterial({
    color: 0xffc840, size: 0.14, transparent: true, opacity: 0.95,
    sizeAttenuation: true, depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  particleSystem.visible = false; particleSystem.frustumCulled = false;
  scene.add(particleSystem);
}

function buildDebrisSystem() {
  const positions = new Float32Array(80 * 3);
  debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  debrisSystem = new THREE.Points(debrisGeo, new THREE.PointsMaterial({
    color: 0xaacfff, size: 0.22, transparent: true, opacity: 0,
    sizeAttenuation: true, depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  debrisSystem.visible = false; debrisSystem.frustumCulled = false;
  scene.add(debrisSystem);
}

function spawnParticles(pos) {
  particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const ang = Math.random() * Math.PI * 2;
    const el  = (Math.random() - 0.15) * Math.PI;
    const spd = 0.08 + Math.random() * 0.55;
    particles.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: Math.cos(ang)*Math.cos(el)*spd,
      vy: Math.abs(Math.sin(el))*spd*1.6 + 0.10,
      vz: Math.sin(ang)*Math.cos(el)*spd*0.9,
      life: 1.0, decay: 0.008 + Math.random()*0.016
    });
  }
  particleSystem.visible = true;
  debrisParticles = [];
  for (let i = 0; i < 80; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 0.02 + Math.random() * 0.09;
    debrisParticles.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: Math.cos(ang)*spd, vy: Math.random()*0.14+0.04,
      vz: Math.sin(ang)*spd*0.5,
      life: 1.0, decay: 0.006+Math.random()*0.010
    });
  }
  if (debrisSystem) { debrisSystem.visible = true; debrisSystem.material.opacity = 0.9; }
  impactShakeFrame = 35;
  impactFlashIntensity = 28;
}

function updateParticles() {
  if (particles.length > 0) {
    particles.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.z+=p.vz;
      p.vy-=0.005; p.vx*=0.982; p.vz*=0.982; p.life-=p.decay;
    });
    particles = particles.filter(p => p.life > 0 && p.y > -0.5);
    const arr = particleGeo.attributes.position.array;
    particles.forEach((p,i)=>{arr[i*3]=p.x;arr[i*3+1]=p.y;arr[i*3+2]=p.z;});
    for (let i=particles.length;i<MAX_PARTICLES;i++){arr[i*3]=0;arr[i*3+1]=-500;arr[i*3+2]=0;}
    particleGeo.attributes.position.needsUpdate=true;
    particleSystem.material.opacity = particles.length>0
      ? Math.max(...particles.map(p=>p.life))*0.95 : 0;
    if (particles.length===0) particleSystem.visible=false;
  }
  if (debrisParticles && debrisParticles.length > 0) {
    debrisParticles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.z+=p.vz;p.vy-=0.003;p.life-=p.decay;});
    debrisParticles = debrisParticles.filter(p=>p.life>0&&p.y>-0.5);
    if (debrisGeo) {
      const arr2 = debrisGeo.attributes.position.array;
      debrisParticles.forEach((p,i)=>{arr2[i*3]=p.x;arr2[i*3+1]=p.y;arr2[i*3+2]=p.z;});
      for(let i=debrisParticles.length;i<80;i++){arr2[i*3]=0;arr2[i*3+1]=-500;arr2[i*3+2]=0;}
      debrisGeo.attributes.position.needsUpdate=true;
      if (debrisSystem) {
        debrisSystem.material.opacity = debrisParticles.length>0
          ? Math.max(...debrisParticles.map(p=>p.life))*0.85 : 0;
        if(debrisParticles.length===0) debrisSystem.visible=false;
      }
    }
  }
  // Shake
  if (impactShakeFrame > 0 && monkeyGroup) {
    const intensity = impactShakeFrame / 35;
    monkeyGroup.position.x += (Math.random()-0.5)*0.30*intensity;
    monkeyGroup.position.y += (Math.random()-0.5)*0.30*intensity;
    impactShakeFrame--;
    monkeyGroup.traverse(child => {
      if (child.isMesh && child.material && !Array.isArray(child.material)
          && child.material.emissive && child.name !== 'glow') {
        child.material.emissive.set(0x1a3a6e);
        child.material.emissiveIntensity = intensity * 0.9;
      }
    });
  }
  // Flash
  if (impactFlashIntensity > 0 && impactFlashLight) {
    impactFlashLight.intensity = impactFlashIntensity;
    impactFlashIntensity *= 0.70;
    if (impactFlashIntensity < 0.05) impactFlashIntensity = 0;
  } else if (impactFlashLight) { impactFlashLight.intensity = 0; }
}

// ── AIM LINE ──────────────────────────────────────────────────────────────────
function buildAimLine() {
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,1,1,0], 3));
  aimLine = new THREE.Line(ag, new THREE.LineDashedMaterial({
    color: 0x4a8aff, transparent: true, opacity: 0.18,
    dashSize: 0.28, gapSize: 0.18, depthWrite: false
  }));
  aimLine.computeLineDistances(); scene.add(aimLine);

  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(62*3), 3));
  parabolaLine = new THREE.Line(pg, new THREE.LineDashedMaterial({
    color: 0x6aaeff, transparent: true, opacity: 0.14,
    dashSize: 0.18, gapSize: 0.13, depthWrite: false
  }));
  parabolaLine.frustumCulled = false; scene.add(parabolaLine);
}

function updateAimLine() {
  // La línea de mira apunta al mono (en d-ropeLen), no a la plataforma (d)
  const monoXPhys = state.d - state.ropeLen;
  const monoRestY = state.h2_anchorY - state.ropeLen;
  const s = w2t(0, state.h1), e = w2t(monoXPhys, monoRestY);
  const ap = aimLine.geometry.attributes.position.array;
  ap[0]=s.x;ap[1]=s.y;ap[2]=0;ap[3]=e.x;ap[4]=e.y;ap[5]=0;
  aimLine.geometry.attributes.position.needsUpdate=true;
  aimLine.computeLineDistances();
  const pv = parabolaLine.geometry.attributes.position.array;
  for (let i=0;i<=60;i++) {
    const t=(i/60)*state.impactT*1.06;
    const p=projectilePos(state.v0,state.theta,state.h1,t);
    const v=w2t(p.x,p.y);
    pv[i*3]=v.x;pv[i*3+1]=v.y;pv[i*3+2]=0;
  }
  parabolaLine.geometry.attributes.position.needsUpdate=true;
  parabolaLine.computeLineDistances();
}

// ── SUELO ──────────────────────────────────────────────────────────────────

// ── ESCENARIOS ────────────────────────────────────────────────────────────────
// Cada escenario define: bg color, fog, luces, suelo, skyGradient
const SCENARIOS = {
  lab: {
    name: 'Laboratorio',
    bg:      0x080706,
    fogColor: 0x080706, fogDensity: 0.026,
    ambientColor: 0x0a0e18, ambientInt: 0.30,
    hemiSky: 0x1a2a4a, hemiGnd: 0x3a2818, hemiInt: 0.80,
    sunColor: 0xfff0d8, sunInt: 3.2, sunPos: [12, 22, 8],
    fillColor: 0x4060a0, fillInt: 0.50,
    rimColor:  0xffc880, rimInt:  0.90,
    groundColor:  0x14120f, mirrorColor: 0x0c0a08,
    gridColor1: 0x1e1c1a, gridColor2: 0x181614,
    platEdge: 0x1a3a6e, platGlow: 0x2a5aaa,
  },
  desert: {
    name: 'Desierto',
    bg:      0x1a1008,
    fogColor: 0x3a2010, fogDensity: 0.018,
    ambientColor: 0x2a1808, ambientInt: 0.50,
    hemiSky: 0x6a4020, hemiGnd: 0x4a2810, hemiInt: 1.20,
    sunColor: 0xffa040, sunInt: 4.5, sunPos: [20, 16, -4],
    fillColor: 0xa06030, fillInt: 0.40,
    rimColor:  0xff8020, rimInt:  1.20,
    groundColor:  0x3a2010, mirrorColor: 0x2a1808,
    gridColor1: 0x4a2e16, gridColor2: 0x3a2010,
    platEdge: 0xc85010, platGlow: 0xa04020,
  },
  night: {
    name: 'Noche',
    bg:      0x01020a,
    fogColor: 0x020510, fogDensity: 0.038,
    ambientColor: 0x050818, ambientInt: 0.15,
    hemiSky: 0x080c28, hemiGnd: 0x080408, hemiInt: 0.40,
    sunColor: 0x4080ff, sunInt: 1.2, sunPos: [-8, 20, 10],
    fillColor: 0x2040c0, fillInt: 0.30,
    rimColor:  0x8040ff, rimInt:  0.80,
    groundColor:  0x04060e, mirrorColor: 0x020408,
    gridColor1: 0x0a1028, gridColor2: 0x060820,
    platEdge: 0x4020d0, platGlow: 0x6030ff,
  },
  forest: {
    name: 'Bosque',
    bg:      0x060c06,
    fogColor: 0x0a1408, fogDensity: 0.032,
    ambientColor: 0x081008, ambientInt: 0.35,
    hemiSky: 0x182818, hemiGnd: 0x0a1808, hemiInt: 0.90,
    sunColor: 0xd0f090, sunInt: 2.8, sunPos: [6, 18, -12],
    fillColor: 0x204820, fillInt: 0.40,
    rimColor:  0x60a030, rimInt:  0.70,
    groundColor:  0x0c1a0a, mirrorColor: 0x081008,
    gridColor1: 0x162814, gridColor2: 0x0e1e0c,
    platEdge: 0x204a18, platGlow: 0x30801a,
  },
};

let currentScenarioId = 'lab';
let scenarioObjects = []; // objetos 3D del escenario (árboles, dunas, etc.)

export function setScenario(id) {
  const sc = SCENARIOS[id];
  if (!sc || !scene) return;
  currentScenarioId = id;

  // Fondo y niebla
  scene.background = new THREE.Color(sc.bg);
  scene.fog = new THREE.FogExp2(sc.fogColor, sc.fogDensity);

  // Luces
  if (ambientL) { ambientL.color.set(sc.ambientColor); ambientL.intensity = sc.ambientInt; }
  if (sunL) {
    sunL.color.set(sc.sunColor); sunL.intensity = sc.sunInt;
    sunL.position.set(...sc.sunPos);
  }
  if (fillL) { fillL.color.set(sc.fillColor); fillL.intensity = sc.fillInt; }
  if (rimL)  { rimL.color.set(sc.rimColor);  rimL.intensity  = sc.rimInt; }

  // Suelo
  if (groundMesh) groundMesh.material.color.set(sc.groundColor);
  if (MAT.mirrorGround) MAT.mirrorGround.color.set(sc.mirrorColor);
  if (MAT.platEdge) { MAT.platEdge.color.set(sc.platEdge); MAT.platEdge.emissive.set(sc.platEdge); }

  // Limpiar objetos del escenario anterior
  scenarioObjects.forEach(o => scene.remove(o));
  scenarioObjects = [];

  // Añadir elementos propios del escenario
  _buildScenarioProps(id, sc);

  // Rebuild env map con los nuevos colores de luz
  _rebuildEnvMap(sc);
}

function _buildScenarioProps(id, sc) {
  if (id === 'desert') {
    // Dunas: esferas achatadas de fondo
    const duneMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e14, roughness: 1.0, metalness: 0.0
    });
    [[-12, 0, -18], [8, 0, -22], [-4, 0, -30], [18, 0, -16]].forEach(([x, y, z]) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(5 + Math.random()*3, 10, 6), duneMat);
      d.scale.y = 0.28; d.position.set(x, -1, z);
      scene.add(d); scenarioObjects.push(d);
    });
    // Sol visible (sprite)
    const solMat = new THREE.SpriteMaterial({
      color: 0xffa040, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sol = new THREE.Sprite(solMat);
    sol.scale.set(8, 8, 1);
    sol.position.set(30, 25, -40);
    scene.add(sol); scenarioObjects.push(sol);
  }

  if (id === 'night') {
    // Estrellas (Points)
    const starPositions = [];
    for (let i = 0; i < 800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(Math.random() * 2 - 1);
      const r     = 60 + Math.random() * 20;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        Math.abs(r * Math.cos(phi)) + 5,
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xd0e0ff, size: 0.22, transparent: true, opacity: 0.9,
      sizeAttenuation: true, depthWrite: false
    }));
    scene.add(stars); scenarioObjects.push(stars);

    // Luces de neón en las plataformas (extra point lights)
    const neon1 = new THREE.PointLight(0x4020ff, 2.0, 8, 2);
    neon1.position.set(-state.d * 0.5, state.h1 + 1, 0);
    scene.add(neon1); scenarioObjects.push(neon1);
    const neon2 = new THREE.PointLight(0x8040ff, 2.0, 8, 2);
    neon2.position.set(state.d * 0.5, state.h2 + 1, 0);
    scene.add(neon2); scenarioObjects.push(neon2);
  }

  if (id === 'forest') {
    // Árboles simplificados (cono + cilindro)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 1.0 });
    const leafMat  = new THREE.MeshStandardMaterial({
      color: 0x1a4010, roughness: 0.9, metalness: 0.0,
      transparent: true, opacity: 0.9
    });
    const treePositions = [
      [-16, -22], [-20, -15], [14, -18], [18, -25],
      [-12, -30], [8, -28], [-8, -20], [22, -12],
    ];
    treePositions.forEach(([x, z]) => {
      const h = 3 + Math.random() * 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, h, 7), trunkMat);
      trunk.position.set(x, h/2, z);
      scene.add(trunk); scenarioObjects.push(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.2 + Math.random()*0.8, h*1.1, 7), leafMat);
      leaves.position.set(x, h * 1.2, z);
      scene.add(leaves); scenarioObjects.push(leaves);
    });
  }
}

function _rebuildEnvMap(sc) {
  if (!renderer) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envS = new THREE.Scene();
  envS.add(new THREE.HemisphereLight(sc.hemiSky, sc.hemiGnd, sc.hemiInt));
  const eS = new THREE.DirectionalLight(sc.sunColor, sc.sunInt * 0.5);
  eS.position.set(...sc.sunPos); envS.add(eS);
  const rt = pmrem.fromScene(envS);
  envMap = rt.texture;
  scene.environment = envMap;
  Object.values(MAT).forEach(m => {
    if (m.envMap !== undefined) { m.envMap = envMap; m.needsUpdate = true; }
  });
  pmrem.dispose();
}

function buildGround() {
  // Suelo principal PBR
  const geo = new THREE.PlaneGeometry(120, 120, 1, 1);
  groundMesh = new THREE.Mesh(geo, MAT.ground);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Plano espejo
  const mir = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    MAT.mirrorGround
  );
  mir.rotation.x = -Math.PI / 2;
  mir.position.y = 0.001;
  scene.add(mir);

  // Grid muy sutil
  const grid = new THREE.GridHelper(80, 80, 0x1e1c1a, 0x181614);
  grid.position.y = 0.002;
  scene.add(grid);

  // Líneas de dirección azul tenue
  const lv = [];
  for (let i = -40; i <= 40; i += 4) {
    lv.push(i, 0.003, -40, i, 0.003, 40);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3));
  scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
    color: 0x1a3a6e, transparent: true, opacity: 0.04
  })));
}

// ── LUCES "Unreal" ─────────────────────────────────────────────────────────
function buildLights() {
  // Luz ambiental tenue (IBL simulada)
  ambientL = new THREE.AmbientLight(0x0a0e18, 0.3);
  scene.add(ambientL);

  // Hemisfera (skylight)
  const hemi = new THREE.HemisphereLight(0x1a2a4a, 0x3a2818, 0.8);
  scene.add(hemi);

  // Sol principal — luz direccional cálida
  sunL = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sunL.position.set(12, 22, 8);
  sunL.castShadow = true;
  sunL.shadow.mapSize.width = sunL.shadow.mapSize.height = 2048;
  sunL.shadow.camera.left  = -28; sunL.shadow.camera.right = 28;
  sunL.shadow.camera.top   =  20; sunL.shadow.camera.bottom = -6;
  sunL.shadow.camera.near  = 0.5; sunL.shadow.camera.far  = 100;
  sunL.shadow.bias = -0.0008;
  sunL.shadow.normalBias = 0.02;
  scene.add(sunL);

  // Fill — luz fría lateral
  fillL = new THREE.DirectionalLight(0x4060a0, 0.5);
  fillL.position.set(-14, 8, 6);
  scene.add(fillL);

  // Rim — contra-luz cálida
  rimL = new THREE.DirectionalLight(0xffc880, 0.9);
  rimL.position.set(2, 4, -18);
  scene.add(rimL);

  // Rebote del suelo
  groundBounceL = new THREE.PointLight(0x2a1a0a, 0.4, 12, 2);
  groundBounceL.position.set(0, 0.1, 0);
  scene.add(groundBounceL);

  // Muzzle flash
  muzzleFlashL = new THREE.PointLight(0xffc840, 0, 6, 2);
  scene.add(muzzleFlashL);
}

// ── MUZZLE FLASH ──────────────────────────────────────────────────────────────
export function triggerMuzzleFlash() {
  muzzleFlashL.intensity = 9;
  flashTimer = 12;
}
function tickMuzzleFlash() {
  if (flashTimer > 0) {
    muzzleFlashL.intensity *= 0.60;
    flashTimer--;
    if (flashTimer === 0) muzzleFlashL.intensity = 0;
  }
}

// ── ORBIT CONTROLS ─────────────────────────────────────────────────────────
function initOrbitControls(canvas) {
  // Mouse down
  canvas.addEventListener('mousedown', e => {
    if (activeCam !== 'orbit') return;
    orb.dragging = true;
    orb.button   = e.button;
    orb.lastX    = e.clientX;
    orb.lastY    = e.clientY;
    orb.vTheta   = 0; orb.vPhi = 0;
    canvas.style.cursor = e.button === 2 ? 'move' : 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!orb.dragging || activeCam !== 'orbit') return;
    const dx = e.clientX - orb.lastX;
    const dy = e.clientY - orb.lastY;
    orb.lastX = e.clientX; orb.lastY = e.clientY;

    if (orb.button === 0) {
      // Orbit
      const speed = 0.005;
      orb.vTheta  = -dx * speed;
      orb.vPhi    =  dy * speed;
      orb.theta  += orb.vTheta;
      orb.phi     = Math.max(ORB_MIN_PHI, Math.min(ORB_MAX_PHI, orb.phi + orb.vPhi));
    } else if (orb.button === 2) {
      // Pan
      const cam  = cameras.orbit;
      const panSpeed = orb.radius * 0.001;
      const right = new THREE.Vector3();
      const up    = new THREE.Vector3(0, 1, 0);
      right.crossVectors(
        new THREE.Vector3().subVectors(orb.target, cam.position).normalize(),
        up
      ).normalize();
      orb.target.addScaledVector(right, -dx * panSpeed);
      orb.target.addScaledVector(up,     dy * panSpeed);
    }
  });

  window.addEventListener('mouseup', () => {
    orb.dragging = false;
    const canvas2 = document.getElementById('realistic-canvas');
    if (canvas2) canvas2.style.cursor = 'grab';
  });

  // Scroll → zoom
  canvas.addEventListener('wheel', e => {
    if (activeCam !== 'orbit') return;
    e.preventDefault();
    const delta  = e.deltaY > 0 ? 1.08 : 0.93;
    orb.radius   = Math.max(ORB_MIN_RADIUS, Math.min(ORB_MAX_RADIUS, orb.radius * delta));
  }, { passive: false });

  // Context menu off (para poder usar clic derecho como pan)
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Touch — orbit + pinch
  let lastTouches = [];
  canvas.addEventListener('touchstart', e => {
    if (activeCam !== 'orbit') return;
    e.preventDefault();
    lastTouches = Array.from(e.touches);
    orb.dragging = true; orb.button = 0;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      orb.lastPinch = Math.sqrt(dx*dx+dy*dy);
    } else {
      orb.lastX = e.touches[0].clientX;
      orb.lastY = e.touches[0].clientY;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (!orb.dragging || activeCam !== 'orbit') return;
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const delta = orb.lastPinch / dist;
      orb.radius = Math.max(ORB_MIN_RADIUS, Math.min(ORB_MAX_RADIUS, orb.radius * delta));
      orb.lastPinch = dist;
    } else if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - orb.lastX;
      const dy = e.touches[0].clientY - orb.lastY;
      orb.lastX = e.touches[0].clientX; orb.lastY = e.touches[0].clientY;
      const speed = 0.005;
      orb.theta += -dx * speed;
      orb.phi   = Math.max(ORB_MIN_PHI, Math.min(ORB_MAX_PHI, orb.phi + dy * speed));
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => { orb.dragging = false; });
  canvas.style.cursor = 'grab';
}

function applyOrbitCamera() {
  // Inercia suave
  if (!orb.dragging) {
    orb.vTheta *= 0.88;
    orb.vPhi   *= 0.88;
    if (Math.abs(orb.vTheta) > 0.0001) orb.theta += orb.vTheta;
    if (Math.abs(orb.vPhi)   > 0.0001) {
      orb.phi = Math.max(ORB_MIN_PHI, Math.min(ORB_MAX_PHI, orb.phi + orb.vPhi));
    }
  }

  // Convertir esféricas → cartesianas
  const r   = orb.radius;
  const x   = orb.target.x + r * Math.sin(orb.phi) * Math.sin(orb.theta);
  const y   = orb.target.y + r * Math.cos(orb.phi);
  const z   = orb.target.z + r * Math.sin(orb.phi) * Math.cos(orb.theta);
  cameras.orbit.position.set(x, y, z);
  cameras.orbit.lookAt(orb.target);
}

// ── CÁMARAS ────────────────────────────────────────────────────────────────
function buildCameras(canvas) {
  const aspect = canvas.offsetWidth / canvas.offsetHeight;
  cameras.orbit  = new THREE.PerspectiveCamera(44, aspect, 0.05, 300);
  cameras.side   = new THREE.PerspectiveCamera(42, aspect, 0.05, 300);
  cameras.cannon = new THREE.PerspectiveCamera(70, aspect, 0.01, 300);
  cameras.bullet = new THREE.PerspectiveCamera(75, aspect, 0.01, 300);
  cameras.monkey = new THREE.PerspectiveCamera(95, aspect, 0.01, 300);
  initOrbitControls(canvas);
}

export function setCamera(camId) {
  activeCam = camId;
  const canvas = document.getElementById('realistic-canvas');
  if (canvas) canvas.style.cursor = camId === 'orbit' ? 'grab' : 'default';
}

function updateCameras(proj, mono) {
  const bPos = proj ? w2t(proj.x, proj.y) : new THREE.Vector3(0, 1.5, 0);
  const mPos = mono ? w2t(mono.x, mono.y) : new THREE.Vector3(state.d * 0.5, 1.5, 0);

  switch (activeCam) {
    case 'orbit':
      applyOrbitCamera();
      // Actualizar target suavemente durante el vuelo
      if (state.running && proj) {
        orb.target.lerp(new THREE.Vector3(bPos.x * 0.4, bPos.y * 0.3 + 1.5, 0), 0.03);
      }
      break;

    case 'side': {
      const midX = state.running && proj ? bPos.x * 0.3 : 0;
      cameras.side.position.set(midX, 3.5, 20);
      cameras.side.lookAt(midX, 2.0, 0);
      break;
    }

    case 'cannon': {
      const muzzleLocal = new THREE.Vector3(BARREL_LEN + 0.05, 0, 0.01);
      pivotGroup.localToWorld(muzzleLocal);
      cameras.cannon.position.copy(muzzleLocal);
      cameras.cannon.lookAt(mPos.x, mPos.y + 0.2, 0);
      break;
    }

    case 'bullet': {
      if (state.running && proj) {
        const vn  = new THREE.Vector3(proj.vx, proj.vy, 0).normalize();
        const behind = new THREE.Vector3(
          bPos.x - vn.x * 1.8,
          bPos.y - vn.y * 1.8 + 0.4,
          3.0
        );
        cameras.bullet.position.lerp(behind, 0.22);
        cameras.bullet.lookAt(bPos.x + vn.x * 2, bPos.y + vn.y * 2, 0);
      } else {
        cameras.bullet.position.lerp(new THREE.Vector3(-3.5, 2.5, 5), 0.05);
        cameras.bullet.lookAt(0, 1.5, 0);
      }
      break;
    }

    case 'monkey': {
      // POV desde los ojos del mono
      const eyePos = new THREE.Vector3(mPos.x, mPos.y + 0.34, 0.22);
      cameras.monkey.position.copy(eyePos);
      if (state.running && proj) {
        cameras.monkey.lookAt(bPos.x, bPos.y, 0);
      } else {
        cameras.monkey.lookAt(-state.d * 0.5, state.h1, 0.2);
      }
      break;
    }
  }
  return cameras[activeCam] || cameras.orbit;
}

// ── PLATAFORMAS DINÁMICAS ──────────────────────────────────────────────────────
let lastH1=-1,lastH2=-1,lastD=-1,lastRope=-1;
function syncPlatforms() {
  if (state.h1===lastH1&&state.h2===lastH2&&state.d===lastD&&state.ropeLen===lastRope) return;
  lastH1=state.h1;lastH2=state.h2;lastD=state.d;lastRope=state.ropeLen;
  if (platformLGroup) scene.remove(platformLGroup);
  if (platformRGroup) scene.remove(platformRGroup);
  platformLGroup = makePlatformGroup(state.h1);
  platformLGroup.position.x = -state.d * 0.5; scene.add(platformLGroup);
  platformRGroup = makePlatformGroup(state.h2);
  platformRGroup.position.x = state.d * 0.5; scene.add(platformRGroup);
  state.h2_anchorY = state.h2 + PLATFORM_TOP_H;
  // Reset orbit target cuando cambia la escena
  orb.target.set(0, Math.max(state.h1, state.h2) * 0.5, 0);
}

// ── POST-PROCESSING SIMULADO (sin WebGL2 ni librerías extra) ─────────────────
// Ajustar tone mapping y exposición dinámicamente
let targetExposure = 1.1;
function updateToneMapping() {
  if (state.impacted && impactFlashIntensity > 2) {
    targetExposure = 1.5;
  } else {
    targetExposure = 1.1;
  }
  renderer.toneMappingExposure += (targetExposure - renderer.toneMappingExposure) * 0.08;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
export function initRealistic() {
  const canvas = document.getElementById('realistic-canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: false,
  });
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;

  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080706);
  scene.fog = new THREE.FogExp2(0x080706, 0.026);

  buildMaterials();
  buildCameras(canvas);
  buildLights();
  buildGround();
  buildCannon();
  buildMonkeySystem();
  buildBullet();
  buildTrail();
  buildParticles();
  buildDebrisSystem();
  buildAimLine();
  buildFragmentMeshes();
  buildEnvMap();

  state.h2_anchorY = state.h2 + PLATFORM_TOP_H;

  window.addEventListener('resize', () => {
    const c = document.getElementById('realistic-canvas');
    renderer.setSize(c.offsetWidth, c.offsetHeight);
    const aspect = c.offsetWidth / c.offsetHeight;
    Object.values(cameras).forEach(cam => {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    });
  });

  initialized = true;

  // Exponer al modo visual
  window.__threeRenderer = renderer;
  window.__threeScene    = scene;
}

export function resetTrail() {
  trailPoints = [];
  if (trailGeo) trailGeo.setDrawRange(0, 0);
  if (trailLine) trailLine.visible = false;
  if (bulletMesh) bulletMesh.visible = false;
  if (bulletLight) bulletLight.intensity = 0;
  particles = []; particleSpawned = false;
  impactFlashIntensity = 0;
  if (impactFlashLight) impactFlashLight.intensity = 0;
  if (particleSystem) particleSystem.visible = false;
  if (debrisSystem) debrisSystem.visible = false;
  resetFragments();
  if (monkeyGroup) {
    const glow = monkeyGroup.getObjectByName('glow');
    if (glow) glow.material.opacity = 0;
    monkeyGroup.rotation.z = 0;
    monkeyGroup.traverse(child => {
      if (child.isMesh && child.material && !Array.isArray(child.material)
          && child.material.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = 0;
        if (child.material.emissive) child.material.emissive.set(0x000000);
      }
    });
  }
  const halo = scene.getObjectByName('bulletHalo');
  if (halo) halo.material.opacity = 0;
}

// ── RENDER ────────────────────────────────────────────────────────────────────
export function renderRealistic(proj, mono, dropped) {
  if (!initialized) return;
  clock.getDelta();

  syncPlatforms();
  updateCannonPose();

  const monoRestY  = state.h2_anchorY - state.ropeLen;
  const monoWorldY = (state.running || state.t > 0) ? mono.y : monoRestY;
  updateMonkeySystem(monoWorldY, dropped);

  updateAimLine();
  tickMuzzleFlash();
  updateToneMapping();

  const muzzleLocal = new THREE.Vector3(BARREL_LEN, 0, 0);
  pivotGroup.localToWorld(muzzleLocal);
  muzzleFlashL.position.copy(muzzleLocal);

  const activeCamObj = updateCameras(proj, mono);

  if (state.running || state.t > 0) {
    const bPos = w2t(proj.x, proj.y);
    bulletMesh.position.copy(bPos);
    bulletMesh.visible = !state.impacted;   // OCULTAR al impactar
    bulletLight.position.copy(bPos);
    bulletLight.intensity = state.impacted ? 0 : 3.5;
    bulletMesh.rotation.x += 0.18;
    bulletMesh.rotation.y += 0.12;

    // Halo de la bala
    const halo = scene.getObjectByName('bulletHalo');
    if (halo) {
      halo.position.copy(bPos);
      halo.material.opacity = state.impacted ? 0 : 0.55;
    }

    updateTrail(bPos);
    updateParticles();
    updateFragments();

    if (state.impacted && !particleSpawned) {
      spawnParticles(bPos);
      particleSpawned = true;
      if (impactFlashLight) impactFlashLight.position.copy(bPos);
    }
  }

  renderer.render(scene, activeCamObj);
}

// ── UPDATE SCENE OBJECTS (sin render — para el modo visual) ───────────────────
export function updateSceneObjects(proj, mono, dropped) {
  if (!initialized) return;

  syncPlatforms();
  updateCannonPose();

  const monoRestY  = state.h2_anchorY - state.ropeLen;
  const monoWorldY = (state.running || state.t > 0) ? mono.y : monoRestY;
  updateMonkeySystem(monoWorldY, dropped);

  tickMuzzleFlash();
  updateToneMapping();

  const muzzleLocal = new THREE.Vector3(BARREL_LEN, 0, 0);
  pivotGroup.localToWorld(muzzleLocal);
  muzzleFlashL.position.copy(muzzleLocal);

  if (state.running || state.t > 0) {
    const bPos = w2t(proj.x, proj.y);
    bulletMesh.position.copy(bPos);
    bulletMesh.visible = !state.impacted;
    bulletLight.position.copy(bPos);
    bulletLight.intensity = state.impacted ? 0 : 3.5;
    bulletMesh.rotation.x += 0.18;
    bulletMesh.rotation.y += 0.12;

    const halo = scene.getObjectByName('bulletHalo');
    if (halo) {
      halo.position.copy(bPos);
      halo.material.opacity = state.impacted ? 0 : 0.55;
    }

    updateTrail(bPos);
    updateParticles();
    updateFragments();

    if (state.impacted && !particleSpawned) {
      spawnParticles(bPos);
      particleSpawned = true;
      if (impactFlashLight) impactFlashLight.position.copy(bPos);
    }
  }
}
