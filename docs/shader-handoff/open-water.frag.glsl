precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCam;
uniform float uSun;
uniform float uWave;

const vec3 ORB_BASE = vec3(0.0, 1.9, 0.0);
const float ORB_R = 1.15;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
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

// Sum of sharpened, mutually dragging wave trains. Returns 0..1.
float waveH(vec2 p, int n) {
  float h = 0.0, a = 1.0, f = 0.22, sp = 1.3, tot = 0.0, ang = 0.0;
  for (int i = 0; i < 26; i++) {
    if (i >= n) break;
    vec2 d = vec2(sin(ang), cos(ang));
    float x = dot(d, p) * f + uTime * sp;
    float w = exp(sin(x) - 1.0);
    p += d * (-w * cos(x)) * a * 0.32;
    h += w * a; tot += a;
    a *= 0.82; f *= 1.18; sp *= 1.07; ang += 1232.399963;
  }
  return h / tot;
}
float surf(vec2 p, int n) { return (waveH(p, n) - 1.0) * uWave; }

float marchWater(vec3 ro, vec3 rd) {
  float t = max(-ro.y / rd.y, 0.0);
  vec3 p = ro + rd * t;
  for (int i = 0; i < 56; i++) {
    float h = surf(p.xz, 11);
    float d = p.y - h;
    if (d < 0.004 * (1.0 + t * 0.05)) break;
    t += d * 0.9;
    p = ro + rd * t;
  }
  return t;
}
vec3 waterN(vec2 p, float t) {
  float e = 0.012 + t * 0.0012;
  float h = surf(p, 24);
  vec3 n = normalize(vec3(h - surf(p + vec2(e, 0), 24), e, h - surf(p + vec2(0, e), 24)));
  return normalize(mix(n, vec3(0, 1, 0), smoothstep(40.0, 420.0, t) * 0.85));
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

float hitOrb(vec3 ro, vec3 rd, vec3 c) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - ORB_R * ORB_R);
  if (h < 0.0) return -1.0;
  return -b - sqrt(h);
}

vec3 shadeWater(vec3 ro, vec3 rd, float t, vec3 orb, float withOrb) {
  vec3 p = ro + rd * t;
  vec3 n = waterN(p.xz, t);
  vec3 sd = sunDir();
  float day = smoothstep(-0.12, 0.32, sd.y);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 R = reflect(rd, n);
  R.y = abs(R.y);
  vec3 refl = sky(R, 1.0);
  if (withOrb > 0.5) {
    float to = hitOrb(p, R, orb);
    if (to > 0.0) {
      vec3 on = normalize(p + R * to - orb);
      vec3 R2 = reflect(R, on);
      float edge = smoothstep(0.0, 0.35, dot(on, -R));
      refl = mix(refl, sky(vec3(R2.x, abs(R2.y), R2.z), 0.0) * 0.8, edge);
    }
  }
  float crest = clamp((p.y + uWave) / uWave, 0.0, 1.0);
  vec3 amb = sky(vec3(0, 1, 0), 0.0);
  vec3 body = vec3(0.004, 0.035, 0.07) * (0.25 + day) + amb * 0.05;
  body += vec3(0.02, 0.28, 0.24) * crest * crest * (0.08 + day * 0.55) * (0.4 + 0.6 * max(dot(n, sd), 0.0));
  vec3 col = mix(body, refl, fres);
  vec3 haze = sky(normalize(vec3(rd.x, 0.012, rd.z)), 0.0);
  return mix(col, haze, 1.0 - exp(-t * 0.0045));
}

vec3 scene(vec3 ro, vec3 rd, vec3 orb, float withOrb) {
  if (rd.y < -0.0005) {
    float t = marchWater(ro, rd);
    return shadeWater(ro, rd, t, orb, withOrb);
  }
  return sky(rd, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 orb = ORB_BASE + vec3(0.0, 0.28 * sin(uTime * 0.7), 0.0);

  float yaw = uCam.x, pit = uCam.y;
  vec3 ta = vec3(0.0, 1.5, 0.0);
  vec3 ro = ta + 8.5 * vec3(sin(yaw) * cos(pit), sin(pit), cos(yaw) * cos(pit));
  ro.y = max(ro.y, 0.45);
  vec3 f = normalize(ta - ro);
  vec3 r = normalize(cross(f, vec3(0, 1, 0)));
  vec3 u = cross(r, f);
  vec3 rd = normalize(f * 1.7 + r * uv.x + u * uv.y);

  vec3 col;
  float to = hitOrb(ro, rd, orb);
  float tw = rd.y < -0.0005 ? marchWater(ro, rd) : 1e9;
  if (to > 0.0 && to < tw) {
    vec3 p = ro + rd * to;
    vec3 n = normalize(p - orb);
    vec3 R = reflect(rd, n);
    float fr = 0.82 + 0.18 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    col = scene(p, R, orb, 0.0) * fr * vec3(0.96, 0.97, 1.0);
  } else if (tw < 1e8) {
    col = shadeWater(ro, rd, tw, orb, 1.0);
  } else {
    col = sky(rd, 1.0);
  }

  // filmic tonemap, gamma, vignette, dither
  col *= 1.05;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  vec2 v = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - dot(v, v) * 0.55;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
