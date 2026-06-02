# physics2cinematic

> Simulación interactiva 3D del experimento **Mono y Proyectil** — cinemática clásica con motor de renderizado en tiempo real.

![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=flat-square&logo=three.js) ![GSAP](https://img.shields.io/badge/GSAP-3.12-green?style=flat-square) ![Web Audio API](https://img.shields.io/badge/Web_Audio_API-procedural-blue?style=flat-square) ![UAM](https://img.shields.io/badge/UAM-Física_II_2026-8B0000?style=flat-square)

## El experimento

Si el cañón apunta directamente al mono en el momento del disparo, la bala y el mono caen con la misma aceleración `g = 9.81 m/s²` y siempre se encuentran — sin importar `v₀` o `d`.

## Características

**Física**
- Detección de colisión **Swept Sphere CCD** — sin tunneling a cualquier velocidad
- Loop de física a **240 Hz** con acumulador de tiempo fijo desacoplado del framerate
- Posición del mono en `x = d − ℓ` — consistente entre física y Three.js

**Modo realista**
- PBR completo: `ACESFilmicToneMapping`, `PCFSoftShadowMap` 2048², `physicallyCorrectLights`
- IBL generado en runtime con `PMREMGenerator`
- **5 cámaras**: Órbita libre · Lateral · POV Cañón · Cámara bala · POV Mono
- OrbitControls propio: drag = orbitar, clic derecho = pan, scroll = zoom, touch pinch, inercia
- Trail con vertex colors (fade azul → negro), 14 fragmentos 3D con física de rebote, partículas aditivas

**4 escenarios** — Laboratorio · Desierto · Noche · Bosque  
Cada uno reconstruye el env map, luces y props 3D propios.

**Modo pizarrón**  
Canvas 2D con estética de tiza: ruido de textura, función `chalkLine()` de doble pasada, formulas en `Caveat`, vectores de velocidad en tiempo real.

**Audio procedural (Web Audio API pura)**  
Sin archivos externos. Disparo en 5 capas (sub-boom 55 Hz, ruido filtrado, crack, presión, ring metálico), vuelo con síntesis FM + Doppler por frame, impacto con thud + fragmentos + reverb. `DynamicsCompressor` + `ConvolverNode` de sala sintética.

## Stack

```
Three.js r128  ·  GSAP 3.12  ·  Web Audio API  ·  Vanilla JS ESM  ·  CSS custom properties
```

## Correr localmente

```bash
git clone https://github.com/kisnner26/physics2cinematic.git
cd physics2cinematic
python3 -m http.server 8080
```

Abrir `http://localhost:8080` — requiere servidor HTTP por ES modules.

## Estructura

```
├── index.html
├── css/
│   ├── theme.css       # design tokens
│   ├── layout.css      # header, stage, escenarios
│   ├── controls.css    # sliders, botones
│   └── scene.css       # HUD, overlays
└── js/
    ├── main.js             # loop principal, física, impacto
    ├── physics.js          # cinemática + swept sphere
    ├── realistic-scene.js  # Three.js, cámaras, escenarios, fragmentos
    ├── physics-scene.js    # pizarrón Canvas 2D
    ├── audio.js            # síntesis Web Audio API
    ├── controls.js         # sliders, modos, cámaras, escenarios
    ├── animations.js       # GSAP sequences
    ├── hud.js              # UI en tiempo real
    └── state.js            # estado global
```

---

*Universidad Americana (UAM) · Ingeniería de Sistemas · Física II · 2026*
