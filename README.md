# physics2cinematic

<p align="center">
  <img src="https://drive.google.com/uc?export=view&id=1jNH-e0XhGg67H1zNPxbxlTiP-Q7oohog" alt="physics2cinematic banner" width="100%"/>
</p>

<p align="center">
  <a href="https://physicsproyectil.netlify.app"><strong>🔴 DEMO EN VIVO — physicsproyectil.netlify.app</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Three.js-r128-black?style=flat-square&logo=three.js"/>
  <img src="https://img.shields.io/badge/GSAP-3.12-green?style=flat-square"/>
  <img src="https://img.shields.io/badge/Web_Audio_API-procedural-blue?style=flat-square"/>
  <img src="https://img.shields.io/badge/Netlify-deployed-00C7B7?style=flat-square&logo=netlify"/>
  <img src="https://img.shields.io/badge/UAM-Física_II_2026-8B0000?style=flat-square"/>
</p>

---

> Simulación interactiva 3D del experimento **Mono y Proyectil** — cinemática clásica visualizada con motor de renderizado en tiempo real, 4 escenarios, 5 cámaras y audio procedural sintetizado desde cero.

## El experimento

Si el cañón apunta directamente al mono en el momento del disparo, la bala y el mono caen con la misma aceleración `g = 9.81 m/s²` y siempre se encuentran — sin importar `v₀` o `d`.

```
x_p(t) = v₀cosθ · t          y_p(t) = h₁ + v₀sinθ·t − ½gt²
x_m(t) = d − ℓ               y_m(t) = h₂ − ½gt²
```

---

## Vista general

### Bienvenida

<p align="center">
  <img src="https://drive.google.com/uc?export=view&id=1QOV32o3atGY2Ua56rSoShIw2weFbsfuw" alt="Bienvenida" width="100%"/>
</p>

### Proyectil impactando al mono

<p align="center">
  <img src="https://s5.ezgif.com/tmp/ezgif-58d57733b22b5b00.gif" alt="Impacto" width="100%"/>
</p>

---

## Escenarios

<table>
  <tr>
    <td align="center"><b>Laboratorio</b></td>
    <td align="center"><b>Desierto</b></td>
  </tr>
  <tr>
    <td><img src="https://drive.google.com/uc?export=view&id=19nYqR7nsUA73LKxI5zgM7K2lO7mbVOhL" width="100%"/></td>
    <td><img src="https://drive.google.com/uc?export=view&id=1U5-YgU5_2AI9f4BuOAgbCYBo2fMb5mpN" width="100%"/></td>
  </tr>
  <tr>
    <td align="center"><b>Noche</b></td>
    <td align="center"><b>Bosque</b></td>
  </tr>
  <tr>
    <td><img src="https://drive.google.com/uc?export=view&id=1x-t1oarTP8HdqfSSTJG-aaJQi1Ug886b" width="100%"/></td>
    <td><img src="https://drive.google.com/uc?export=view&id=13XrV0TlSsIlB5DTTxXKJy1A7y_5mTp0Q" width="100%"/></td>
  </tr>
</table>

---

## Modo Pizarrón

<p align="center">
  <img src="https://drive.google.com/uc?export=view&id=1ZOHHvH5S9-pKm4SbmJIL_ILEWMRyG4Fo" alt="Modo Pizarrón" width="100%"/>
</p>

---

## Perspectivas de cámara

<table>
  <tr>
    <td><img src="https://drive.google.com/uc?export=view&id=1ebul6oPBOzLNP6pGDdGB8iiQMdKHz-BC" width="100%"/></td>
    <td><img src="https://drive.google.com/uc?export=view&id=1UGezrMfEaeoa9cp0Qx8wYsOBx48gssvy" width="100%"/></td>
  </tr>
</table>

---

## Características

**Física**
- Detección de colisión **Swept Sphere CCD** — sin tunneling a cualquier velocidad
- Loop de física a **240 Hz** con acumulador de tiempo fijo desacoplado del framerate
- Posición del mono en `x = d − ℓ` — consistente entre física y Three.js

**Modo Realista**
- PBR completo: `ACESFilmicToneMapping`, `PCFSoftShadowMap` 2048², `physicallyCorrectLights`
- IBL generado en runtime con `PMREMGenerator` — reflejos del metal cambian por escenario
- **5 cámaras**: Órbita libre · Lateral · POV Cañón · Cámara bala · POV Mono
- OrbitControls propio: drag = orbitar, clic derecho = pan, scroll = zoom, touch pinch, inercia
- Trail con vertex colors (fade azul → negro), 14 fragmentos 3D con física de rebote, partículas aditivas

**4 Escenarios**

| Escenario | Descripción |
|-----------|-------------|
| **Laboratorio** | Industrial oscuro, luz cálida, suelo con espejo parcial |
| **Desierto** | Dunas al fondo, sol naranja-rojizo bajo, niebla cálida |
| **Noche** | 800 estrellas como `Points`, luces de neón violeta, fog denso |
| **Bosque** | 8 árboles, luz solar verde-amarilla filtrada, suelo orgánico |

**Modo Pizarrón**
Canvas 2D con estética de tiza: función `chalkLine()` de doble pasada con sombra blur, fórmulas en fuente `Caveat`, vectores de velocidad en tiempo real, mono dibujado como figura de pizarra.

**Audio procedural (Web Audio API pura)**

| Evento | Síntesis |
|--------|----------|
| **Disparo** | Sub-boom 55Hz→18Hz + ruido filtrado + crack >3.5kHz + onda de presión + ring metálico |
| **Vuelo** | FM synthesis: portadora + moduladora 220Hz, profundidad 380Hz. Doppler por frame. |
| **Impacto** | Thud 90Hz→22Hz + crack + 5 micro-clicks escalonados + 3 rebotes metálicos + reverb |

`DynamicsCompressor` master + `ConvolverNode` de sala sintética de 1.8s generada proceduralmente.

---

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
│   ├── theme.css           # design tokens
│   ├── layout.css          # header, stage, escenarios
│   ├── controls.css        # sliders, botones
│   └── scene.css           # HUD, overlays
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

*Universidad Americana (UAM) · Ingeniería de Sistemas · Física Aplicada · 2026*
