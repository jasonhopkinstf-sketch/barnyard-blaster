import * as THREE from 'three';
import { SKY_GLSL } from './shaders/sky.glsl.js';
import { WATER_GLSL } from './shaders/water.glsl.js';

// The duck pond: centre and half-sizes of its ellipse on the ground plane.
export const POND = { x: 29, z: 4, rx: 8, rz: 6.5 };

// Normalised elliptical distance: < 1 is inside the pond (grow it with margin, in metres).
export function pondDistance(x, z, margin = 0) {
  const dx = (x - POND.x) / (POND.rx + margin), dz = (z - POND.z) / (POND.rz + margin);
  return Math.sqrt(dx * dx + dz * dz);
}

export function buildPond(scene, skyUniforms) {
  const group = new THREE.Group();
  group.position.set(POND.x, 0, POND.z);
  scene.add(group);

  // Mud rim that shows through the shallow, feathered edge of the water.
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshLambertMaterial({ color: 0x5f4a30 }));
  mud.rotation.x = -Math.PI / 2;
  mud.scale.set(POND.rx + 1.0, POND.rz + 1.0, 1);
  mud.position.y = 0.03;
  mud.receiveShadow = true;
  group.add(mud);

  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: skyUniforms.uTime, // shared with the sky by reference
    uSun: skyUniforms.uSun,
    uWave: { value: 0.07 },
    uRippleScale: { value: 9.0 },
    uRadii: { value: new THREE.Vector2(POND.rx, POND.rz) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true, // lets three keep fogColor / fogNear / fogFar in sync with scene.fog
    vertexShader: /* glsl */ `
      uniform vec2 uRadii;
      varying vec3 vWorld;
      varying vec2 vLocal;
      void main() {
        vLocal = position.xz / uRadii;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vWorld;
      varying vec2 vLocal;
      ${SKY_GLSL}
      ${WATER_GLSL}
      void main() {
        // noise-wobbled ellipse so the shoreline is not a perfect oval
        float r = length(vLocal) + (noise(vWorld.xz * 0.55) - 0.5) * 0.2;
        if (r > 1.0) discard;

        vec3 toFrag = vWorld - cameraPosition;
        float t = length(toFrag);
        vec3 col = shadeWater(vWorld, toFrag / t, t);

        // shallow edge: a faint foam line, and the mud showing through
        float day = smoothstep(-0.12, 0.32, sunDir().y);
        col += vec3(0.22, 0.24, 0.24) * (0.15 + day) * smoothstep(0.90, 0.99, r);
        float alpha = mix(0.97, 0.3, smoothstep(0.72, 1.0, r));

        col = mix(col, fogColor, smoothstep(fogNear, fogFar, t));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const geo = new THREE.PlaneGeometry((POND.rx + 1.5) * 2, (POND.rz + 1.5) * 2);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, material);
  water.position.y = 0.08;
  group.add(water);

  return {
    uniforms,
    // True where the player or a critter is wading.
    contains(x, z) { return pondDistance(x, z) < 0.88; },
  };
}
