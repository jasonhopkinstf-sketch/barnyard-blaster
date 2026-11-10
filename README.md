# 🐔 Barnyard Blaster

A fast, cartoony first-person shooter set on a farm. Critters are raiding your crops. You have eggs. Lots of eggs.

Built with [Three.js](https://threejs.org/) as plain ES modules. No bundler, no build step, no external assets: the farm is made of boxes, spheres and cones, and every sound effect is synthesized with Web Audio.

## Play

- **Mouse** look, **Click** fire (hold to auto-fire the egg launcher)
- **W A S D** move, **Shift** sprint, **Space** jump
- **1 / 2 / 3** or **scroll** to switch weapons
- **Esc** pauses

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
src/world.js            builds the farm: barn, silo, tractor, windmill, fences, crops, trees
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
