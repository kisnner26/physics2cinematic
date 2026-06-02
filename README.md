```markdown
# physics2cinematic

> Simulación interactiva 3D del experimento **Mono y Proyectil** — cinemática clásica visualizada con motor de renderizado en tiempo real.

![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=flat-square&logo=three.js)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-procedural-blue?style=flat-square)
![GSAP](https://img.shields.io/badge/GSAP-3.12-green?style=flat-square)
![UAM](https://img.shields.io/badge/UAM-Física_II_2026-wine?style=flat-square)

---

## ¿Qué es el experimento?

El experimento del Mono y el Proyectil demuestra que **la gravedad actúa igual sobre todos los cuerpos en caída libre**, independientemente de su velocidad horizontal. Si el cañón apunta directamente al mono en reposo en el momento del disparo, la bala y el mono caen con la misma aceleración `g = 9.81 m/s²` y siempre se encuentran — sin importar la velocidad inicial o la distancia.

```
x_p(t) = v₀cosθ · t          y_p(t) = h₁ + v₀sinθ·t − ½gt²
x_m(t) = d − ℓ               y_m(t) = h₂ − ½gt²
```

---

## Características

### Motor de física
- **Detección de colisión Swept Sphere CCD** — el segmento de trayectoria de la bala entre sub-frames se intersecta analíticamente con las esferas del cuerpo y cabeza del mono. Elimina el tunneling incluso a velocidades altas.
- **Loop de física a 240 Hz** con acumulador de tiempo fijo (`FIXED_DT = 1/240 s`) desacoplado del framerate de renderizado.
- **Posición del mono corregida** — el mono cuelga a `ℓ` metros del ancla, su posición real es `x = d − ℓ`, consistente entre física y Three.js.
- Integración analítica exacta (sin drag) para didáctica; parámetros de resistencia del aire disponibles via `DRAG_K`.

### Modo Realista (Three.js r128)
- Renderizado PBR con `ACESFilmicToneMapping`, `PCFSoftShadowMap` a 2048², `physicallyCorrectLights` y `sRGBEncoding`.
- **IBL real** generado en runtime con `PMREMGenerator` — los reflejos del metal del cañón y la bala cambian con cada escenario.
- **5 modos de cámara**: Órbita libre · Vista lateral · POV Cañón · Cámara bala · Ser el mono (POV first-person del mono mirando la bala entrante).
- **OrbitControls propio**: drag izquierdo = orbitar, drag derecho = pan, scroll = zoom, touch pinch, inercia suave al soltar.
- Trail de la bala con **vertex colors** — fade de azul eléctrico en la cabeza a negro en la cola.
- **14 fragmentos 3D** (TetrahedronGeometry, OctahedronGeometry, ConeGeometry, BoxGeometry) con velocidad radial, rotación propia, gravedad, rebote en suelo y fade out al impactar.
- Partículas aditivas (`AdditiveBlending`) y halo sprite en la bala durante el vuelo.
- Tone mapping dinámico: la exposición sube brevemente en el frame del impacto.

### 4 Escenarios
| Escenario | Descripción |
|-----------|-------------|
| **Laboratorio** | Industrial oscuro, luz cálida, suelo con espejo parcial |
| **Desierto** | Dunas al fondo, sol naranja-rojizo bajo, niebla cálida |
| **Noche** | 800 estrellas como `Points`, luces de neón violeta, fog denso |
| **Bosque** | 8 árboles (cono + cilindro), luz solar verde-amarilla, suelo orgánico |

Cada escenario reconstruye el env map con `PMREMGenerator` — los reflejos del metal cambian acorde.

### Modo Pizarrón (Canvas 2D)
- Fondo pizarrón `#0e1a14` con textura de tiza envejecida.
- Todo dibujado con función `chalkLine()` — doble pasada, sombra blur, imperfección simulada.
- Mono estilizado como figura de pizarra, cañón con rueda y barril rotado según θ.
- Ejes con marcas, trayectoria parabólica punteada, fórmulas en fuente `Caveat`.
- Vectores de velocidad `vx` y `vy` del proyectil en tiempo real.
- Flash de impacto con rayos en tiza roja.

### Audio procedural (Web Audio API pura)
Sin archivos de audio externos. Todo sintetizado en runtime:

| Evento | Síntesis |
|--------|----------|
| **Disparo** | Sub-boom (55Hz→18Hz) + ruido filtrado + crack boca del cañón (>3.5kHz) + onda de presión + ring metálico |
| **Vuelo** | FM synthesis: portadora sine + moduladora 220Hz, profundidad 380Hz + whoosh de arrastre de aire. Doppler actualizado por frame. |
| **Impacto** | Thud grave (90Hz→22Hz) + crack de deformación + 5 micro-clicks escalonados + 3 rebotes metálicos + tail de reverb |
| **UI** | Ticks, swooshes y confirmaciones con throttle en slider |

`DynamicsCompressor` master + `ConvolverNode` de sala sintética (impulso de 1.8s generado proceduralmente).

### UI/UX
- **Landing animada** con GSAP — tipografía Playfair Display, fórmulas en Space Mono, SVG decorativo de la trayectoria.
- Paleta monocromática papel/boceto: fondo `#f4f0e8`, tinta grafito, acento azul bolígrafo `#1a3a6e`.
- Panel flotante de escenarios con `backdrop-filter: blur(8px)` sobre el canvas 3D.
- HUD de parámetros físicos en tiempo real (t, Vy proyectil, Vy mono).
- Parámetros ajustables: `v₀`, `h₁`, `h₂`, `d`, `ℓ`.

---

## Stack técnico

```
Three.js r128      — renderizado 3D WebGL
GSAP 3.12          — animaciones de UI y transiciones
Web Audio API      — motor de audio procedural
Vanilla JS (ESM)   — sin frameworks, módulos nativos
CSS custom props   — design system completo
```

---

## Correr localmente

```bash
git clone https://github.com/kisnner26/physics2cinematic.git
cd physics2cinematic
python3 -m http.server 8080
# abrir http://localhost:8080
```

> Requiere servidor HTTP por el uso de ES modules. No funciona abriendo `index.html` directamente.

---

## Estructura

```
physics2cinematic/
├── index.html
├── css/
│   ├── theme.css          # design tokens (paleta, tipografía)
│   ├── layout.css         # header, stage, controles, escenarios
│   ├── controls.css       # sliders, botones, resultados
│   └── scene.css          # HUD, impact banner, cam label
└── js/
    ├── main.js            # loop principal, física, impacto
    ├── physics.js         # ecuaciones cinemáticas + swept sphere
    ├── realistic-scene.js # Three.js, cámaras, escenarios, fragmentos
    ├── physics-scene.js   # pizarrón Canvas 2D
    ├── audio.js           # síntesis procedural Web Audio API
    ├── controls.js        # sliders, modos, cámaras, escenarios
    ├── animations.js      # GSAP sequences
    ├── hud.js             # actualizaciones de UI en vuelo
    └── state.js           # estado global compartido
```

---

*Universidad Americana (UAM) · Ingeniería de Sistemas · Física II · 2026*
```
