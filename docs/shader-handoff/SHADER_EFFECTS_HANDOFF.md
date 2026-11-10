# Shader effects handoff

Context for whoever (person or coding agent) integrates these effects into the game.
It summarises a separate design conversation, so nothing else from that conversation is needed.

## What exists

`open-water.frag.glsl` is a working WebGL1 (GLSL ES 1.00) fragment shader, drawn on one full-screen triangle.
It renders an ocean, sky, clouds, sun, moon, stars and a chrome sphere, entirely procedurally (no textures, no meshes).

Uniforms:

| Uniform | Type | Meaning |
|---|---|---|
| `uRes` | vec2 | Render target size in pixels |
| `uTime` | float | Seconds since start |
| `uCam` | vec2 | Orbit camera yaw and pitch, radians |
| `uSun` | float | Time of day, 0 (night) to 1 (high noon) |
| `uWave` | float | Swell height in metres, about 0.2 to 2.4 |

Functions worth reusing:

- `sky(rd, detail)`: sky colour for a view direction, with day, dusk and night blending, sun, moon, stars and a lit cloud deck.
- `waveH` / `surf`: animated ocean height at an xz position.
- `marchWater`, `waterN`, `shadeWater`: ray-march the ocean surface, get its normal, and shade it (Fresnel reflection of the sky, subsurface tint on crests, distance haze).
- The last lines of `main`: filmic tonemap, gamma, vignette and dither.

## How to use it in a first-person shooter

Agreed approach: keep the game's level, characters, collision and gameplay on ordinary meshes in the engine. Do not ray-march the level. Use the shader code for these pieces only:

1. **Sky**: port `sky()` into the engine's skybox or sky-dome shader. Drive `uSun` from the game's time of day.
2. **Water**: either apply `waveH` as vertex displacement on a water mesh and reuse the `shadeWater` lighting in its fragment shader, or ray-march the water only for pixels where the depth buffer shows nothing closer.
3. **Post-processing**: move the tonemap, vignette and dither into the engine's post-process pass.

Things to change when porting:

- Replace the orbit camera in `main` with the game camera: build `ro` and `rd` from the engine's inverse view-projection matrix.
- Composite against scene depth so meshes occlude water and sky correctly.
- The sphere (`hitOrb`, `ORB_*`) is a demo prop. Remove it.
- The demo spends the whole GPU on this one shader. In a game, cut `marchWater` steps (56) and `waveH` iterations (11 for marching, 24 for normals) until it fits the frame budget.

## Not yet decided

- Which engine and shading language the game uses. The GLSL will need translating for HLSL, WGSL or a node-based material system.
- Which of the three pieces the game actually wants.
