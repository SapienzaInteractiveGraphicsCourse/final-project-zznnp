# Time Attack: Spielberg Track Day - >> 🕹️ [Live demo](https://sapienzainteractivegraphicscourse.github.io/final-project-zznnp/) <<

A browser-based racing simulator built with Three.js, Cannon-es, and Tween.js. Drive a Ferrari around the Red Bull Ring (Spielberg) circuit in Austria. Complete hot laps, beat sector records, and experience a immersive pit-to-track workflow.

## Features

- **Raycast Vehicle Physics** — 4-wheel suspension, speed-dependent steering, downforce, and braking
- **Lap Timing System** — 3 sectors with live split timing, track record comparison, and personal bests saved to localStorage
- **Walking Mode** — Exit the car and walk around the pit area with camera-relative controls
- **Cinematic Main Menu** — Camera fly-through of 6 pre-defined shots around the circuit
- **Procedural Character Animation** — Walk/run/idle bone animation driven by Tween.js
- **Smoke Particles** — Tire smoke on hard braking with a pool-based particle system
- **Positional Audio** — Engine pitch and tire screech synced to car speed
- **FPS Counter** — Color-coded performance monitor
- **Camera Settings** — Adjustable third-person camera distance and height via sliders
- **Free Camera Mode** — Dev fly-cam with pointer lock for track inspection

## Controls

| Key | Action |
|---|---|
| `W` / `Arrow Up` | Accelerate |
| `S` / `Arrow Down` | Reverse / Brake |
| `A` / `Arrow Left` | Steer left |
| `D` / `Arrow Right` | Steer right |
| `Space` | Brake |
| `E` | Enter / Exit car |
| `Shift` | Run (walking) / Speed boost (free cam) |
| `R` | Reset position |
| `V` | Toggle free camera |
| `Escape` | Pause |

## Tech Stack

| Library | Version | CDN |
|---|---|---|
| [Three.js](https://threejs.org/) | r128 | `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` |
| [Cannon-es](https://github.com/pmndrs/cannon-es) | 0.20.0 | `cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm` |
| [Tween.js](https://github.com/tweenjs/tween.js) | 18.6.4 | `cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js` |

## Project Structure

```
├── index.html              ← Entry point
├── style.css               ← All UI styling
├── README.md
├── data/
│   └── records.json        ← Track record times
├── audio/                  ← Sound effects (OGG)
│   ├── 843123__fnakez__engine-idle-cut.ogg
│   └── 536769__egomassive__tire.ogg
├── obj/                    ← 3D models (GLB)
│   ├── laferrari_threejs.glb
│   ├── circuit_spielberg_light.glb
│   └── racer.glb
├── src/                    ← Core engine
│   ├── main.js             ← Game class, loop, camera
│   ├── input.js            ← Keyboard / mouse state
│   ├── state.js            ← Game state enum
│   ├── ui.js               ← Loading screen helpers
│   ├── record.js           ← Lap timing, localStorage
│   └── smoke.js            ← Particle system
├── 3d/                     ← Scene objects
│   ├── scene.js            ← Track, lighting, checkpoints
│   ├── player.js           ← Player car
│   └── racer.js            ← Walking character
├── cannon/                 ← Physics
│   ├── world.js            ← CANNON.World setup
│   └── bodies.js           ← Physics sync utility
└── tween/                  ← Animations
    ├── animations.js       ← Cinematic loop, race start
    ├── racer_animation.js  ← Bone animation controller
    └── camera_shots.js     ← Cinematic camera paths
```

## Resources

### 3D Models

| Asset | Source |
|---|---|
| Ferrari LaFerrari | https://www.fab.com/listings/89e9c354-93bb-4b46-bc00-07400fcddb9e  |
| Red Bull Ring (Spielberg) | https://www.fab.com/listings/56f70e1c-caa9-4f55-acc8-d629456722ec |
| Racer character | https://www.fab.com/listings/0e2804ed-d50a-46b5-90fe-92f4bd8a31f6 |

### Audio

| Asset | Source |
|---|---|
| Engine idle sound | https://freesound.org/people/fnakez/sounds/843123/ |
| Tire screech sound | https://freesound.org/people/egomassive/sounds/536769/ |

