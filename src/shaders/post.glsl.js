// Full-screen finishing pass: filmic tonemap, gamma, vignette, dither.
// Ported from the last lines of main() in docs/shader-handoff/open-water.frag.glsl.
export const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform float uTime;
uniform float uExposure;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 col = max(texture2D(tScene, vUv).rgb, 0.0);

  // filmic tonemap, gamma, vignette, dither
  col *= uExposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.55;
  col += (hash(gl_FragCoord.xy + mod(uTime, 10.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
