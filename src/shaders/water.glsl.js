// Water surface and lighting.
// Ported from docs/shader-handoff/open-water.frag.glsl (waveH, surf, waterN, shadeWater).
// Changes from the ocean demo, as the handoff asks:
//  - no ray-march: the pond is a mesh, so the fragment's world position is the hit point
//  - the chrome orb branch is gone
//  - fewer wave iterations, and the pattern is scaled down so ocean swell reads as pond ripples
//  - the body colour is nudged from open-ocean navy toward pond green
// Requires SKY_GLSL to be included first (uTime, sunDir, sky).
export const WATER_GLSL = /* glsl */ `
uniform float uWave;         // ripple height in metres
uniform float uRippleScale;  // how much smaller than the ocean pattern

const int WAVE_ITERS = 9;

// Sum of sharpened, mutually dragging wave trains. Returns 0..1.
float waveH(vec2 p) {
  float h = 0.0, a = 1.0, f = 0.22, sp = 1.3, tot = 0.0, ang = 0.0;
  for (int i = 0; i < WAVE_ITERS; i++) {
    vec2 d = vec2(sin(ang), cos(ang));
    float x = dot(d, p) * f + uTime * sp;
    float w = exp(sin(x) - 1.0);
    p += d * (-w * cos(x)) * a * 0.32;
    h += w * a; tot += a;
    a *= 0.82; f *= 1.18; sp *= 1.07; ang += 1232.399963;
  }
  return h / tot;
}
float surf(vec2 p) { return (waveH(p * uRippleScale) - 1.0) * uWave; }

vec3 waterN(vec2 p, float t) {
  float e = 0.02 + t * 0.0012;
  float h = surf(p);
  vec3 n = normalize(vec3(h - surf(p + vec2(e, 0)), e, h - surf(p + vec2(0, e))));
  return normalize(mix(n, vec3(0, 1, 0), smoothstep(40.0, 420.0, t) * 0.85));
}

vec3 shadeWater(vec3 p, vec3 rd, float t) {
  vec3 n = waterN(p.xz, t);
  vec3 sd = sunDir();
  float day = smoothstep(-0.12, 0.32, sd.y);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 R = reflect(rd, n);
  R.y = abs(R.y);
  vec3 refl = sky(R, 1.0);
  float crest = clamp((surf(p.xz) + uWave) / uWave, 0.0, 1.0);
  vec3 amb = sky(vec3(0, 1, 0), 0.0);
  vec3 body = vec3(0.010, 0.050, 0.055) * (0.25 + day) + amb * 0.05;
  body += vec3(0.02, 0.28, 0.24) * crest * crest * (0.08 + day * 0.55) * (0.4 + 0.6 * max(dot(n, sd), 0.0));
  return mix(body, refl, fres);
}
`;
