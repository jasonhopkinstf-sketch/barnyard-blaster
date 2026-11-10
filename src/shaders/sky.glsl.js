// Sky, sun, moon, stars and cloud deck.
// Ported from docs/shader-handoff/open-water.frag.glsl. sky(), sunDir(), noise() and fbm()
// are verbatim; the uniform declarations moved here so the chunk can be shared by the sky
// dome and the pond, and hash() was replaced (see the note on it below).
export const SKY_GLSL = /* glsl */ `
uniform float uTime;
uniform float uSun;

// The one deliberate change from the original: hash() is only ever called on noise lattice
// points, and it is now an exact integer hash. The original float hash
//   p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y);
// is so sensitive to rounding that some GPU compilers (seen on Windows / ANGLE) gave a cell
// corner two different values depending on which cell asked, which cut the cloud deck into
// hard-edged straight strips. Integer maths has no rounding, so every cell agrees.
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p + 0.5))) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  n ^= n >> 15u;
  return float(n) * (1.0 / 4294967295.0);
}
float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

vec3 sunDir() {
  float e = mix(-0.36, 1.05, uSun);
  return normalize(vec3(0.18, sin(e), -cos(e)));
}

vec3 sky(vec3 rd, float detail) {
  vec3 sd = sunDir();
  float e = sd.y;
  float day = smoothstep(-0.12, 0.32, e);
  float dusk = smoothstep(-0.28, 0.02, e) * (1.0 - smoothstep(0.02, 0.42, e));
  float night = 1.0 - smoothstep(-0.3, 0.04, e);

  float y = max(rd.y, 0.0);
  float hz = pow(1.0 - y, 5.0);
  vec3 zen = mix(vec3(0.008, 0.012, 0.035), vec3(0.09, 0.26, 0.62), day);
  vec3 hor = mix(vec3(0.02, 0.03, 0.07), vec3(0.60, 0.74, 0.92), day);
  zen = mix(zen, vec3(0.10, 0.10, 0.30), dusk * 0.7);
  float toward = pow(max(dot(normalize(rd.xz + 1e-4), normalize(sd.xz)), 0.0), 2.0);
  hor = mix(hor, mix(vec3(0.55, 0.25, 0.35), vec3(1.25, 0.48, 0.12), toward), dusk);
  vec3 col = mix(zen, hor, hz);

  vec3 sunCol = mix(vec3(1.0, 0.33, 0.08), vec3(1.0, 0.94, 0.84), smoothstep(0.0, 0.4, e));
  float up = smoothstep(-0.16, 0.0, e);
  float s = max(dot(rd, sd), 0.0);
  col += sunCol * up * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.45);

  if (detail > 0.5) {
    col += sunCol * up * smoothstep(0.99935, 0.9997, s) * 30.0;

    // stars and moon
    vec3 q = rd * 190.0;
    float st = step(0.9965, hash3(floor(q)));
    float tw = 0.6 + 0.4 * sin(uTime * 3.0 + hash3(floor(q) + 7.0) * 40.0);
    col += st * tw * smoothstep(0.5, 0.05, length(fract(q) - 0.5)) * night * smoothstep(0.0, 0.2, rd.y) * 1.6;
    vec3 md = normalize(vec3(-0.45, 0.42, -0.78));
    float m = max(dot(rd, md), 0.0);
    col += vec3(0.75, 0.82, 1.0) * night * (smoothstep(0.9993, 0.9996, m) * 3.0 + pow(m, 300.0) * 0.35 + pow(m, 20.0) * 0.05);
  }

  // cloud deck
  if (rd.y > 0.005) {
    vec2 uv = rd.xz / (rd.y + 0.09) * 0.9 + vec2(uTime * 0.012, uTime * 0.02);
    float d = smoothstep(0.42, 0.82, fbm(uv));
    float d2 = smoothstep(0.42, 0.82, fbm(uv + normalize(sd.xz) * 0.22));
    float lit = clamp(0.55 + (d - d2) * 1.6, 0.0, 1.0);
    vec3 shade = hor * 0.55 + vec3(0.015, 0.02, 0.04);
    vec3 bright = vec3(1.0) * day + sunCol * dusk * 1.6 + vec3(0.10, 0.12, 0.18) * night;
    bright += sunCol * up * pow(s, 10.0) * 1.2;
    vec3 cc = mix(shade, bright, lit);
    col = mix(col, cc, d * smoothstep(0.005, 0.22, rd.y) * 0.9);
  }
  return col;
}
`;
