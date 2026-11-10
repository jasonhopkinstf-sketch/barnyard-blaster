# 🐔 Barnyard Blaster

A fast, cartoony first-person shooter set on a farm. Critters are raiding your crops. You have eggs. Lots of eggs.

Built with [Three.js](https://threejs.org/) as plain ES modules. No bundler, no build step, no external assets: the farm is made of boxes, spheres and cones, the sky and pond are procedural shaders, and every sound effect is synthesized with Web Audio.

## The look

The sky, water and final image treatment come from a hand-written GLSL shader (`docs/shader-handoff/`), integrated the way its handoff notes describe: the level and critters stay ordinary meshes, and three pieces of the shader are reused.

- **Sky**: a procedural dome with a sun, moon, twinkling stars and a drifting, sun-lit cloud deck, blending through day, dusk and night.
- **Duck pond**: animated ripples with Fresnel reflection of that sky, sun and moon glitter, and distance haze. It is shallow: you and ground critters wade through it slowly, crows fly over.
- **Post pass**: filmic tonemap, gamma, vignette and dither over the whole frame.

Time of day follows the waves. Wave 1 is mid-afternoon, the sun sinks each wave, wave 4 is sunset, the wave 5 boss arrives under the moon, then dawn breaks and the cycle repeats. The sun and moon lights, ambient light and fog are driven from the same value as the sky shader, so the farm always matches the sky.

Add `?post=0` to the URL to bypass the post pass. In the browser console, `barnyard.day.set(0.3)` jumps to sunset and `barnyard.day.set(0.08)` to night.

## Play

The whole game is playable from the keyboard, so it works on a laptop trackpad as well as with a mouse.

- **W A S D** move, **Shift** sprint, **Space** jump
- **Q / E** or **Left / Right arrows** turn, **Up / Down arrows** look up and down
- **F**, **Enter** or **Click** fire (hold to auto-fire the egg launcher)
- **Mouse** looks around; on a trackpad a **two-finger swipe** looks around too (**I** flips its direction)
- **1 / 2 / 3** pick a weapon, **R** or the mouse wheel cycles
- **- / =** lower or raise look sensitivity (remembered)
- **Esc** pauses

Shots get a little aim assist: if a critter is within a few degrees of the crosshair, the shot goes to it. Where the browser cannot capture the mouse (some embedded previews), resting the pointer at the left or right edge of the window keeps you turning.

Protect the three crop patches (corn, pumpkins, carrots) from waves of crows, rabbits and raccoons. Every fifth wave brings a boss boar that charges you. Lose all three patches or all your health and the farm falls.

| Weapon | Behaviour |
|---|---|
| Egg Launcher | Fast, infinite ammo, low damage |
| Corn Cannon | Shotgun spread of kernels, short range, limited ammo |
| Tomato Tosser | Lobbed shot with splash damage, very limited ammo |

Kills in quick succession build a combo multiplier (up to x8). Critters drop corn, tomatoes and milk (health). Clearing a wave gives a bonus and spawns a couple of pickups near you. Your best score is kept in `localStorage`.

## Run locally

Any static file server works. The repo includes a dependency-free one:

```bash
npm run dev
```

Then open <http://localhost:3000>. Alternatives: `python -m http.server 3000` or `npx serve .`.

## Run in a Claude Code cloud session

The game is pure static files, so a cloud sandbox only needs Node:

```bash
npm run dev
```

and open the forwarded port 3000.

## Project layout

```
index.html              HUD markup, overlays, import map for three
styles.css              HUD and menu styling
server.mjs              tiny static server (npm run dev)
vendor/three.*.js       vendored Three.js (pinned; refresh with npm run vendor)
src/main.js             bootstrap, game loop, menu / playing / paused / game-over states
src/world.js            builds the farm: barn, silo, tractor, windmill, fences, crops, trees, lights
src/sky.js              sky dome using the sky shader
src/water.js            duck pond mesh and material using the water shader
src/post.js             render target + full-screen finishing pass
src/daycycle.js         time of day per wave; drives sky, lights, fog and window glow
src/shaders/            GLSL chunks ported from docs/shader-handoff (sky, water, post)
src/player.js           pointer-lock look, WASD / sprint / jump, collision, health
src/weapons.js          three weapons, projectiles, view models, impacts
src/enemies.js          crow / rabbit / raccoon / boar models, AI, damage, death bursts
src/waves.js            wave composition, spawn pacing, pickups
src/effects.js          particle bursts
src/hud.js              DOM HUD updates, banners, hit marker, damage flash
src/audio.js            Web Audio synthesized sound effects
src/collision.js        AABB helpers
```

## Deploy

Pushing to `main` runs the GitHub Pages workflow in `.github/workflows/pages.yml`, which publishes the repo root as a static site.
