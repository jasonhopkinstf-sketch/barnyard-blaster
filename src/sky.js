import * as THREE from 'three';
import { SKY_GLSL } from './shaders/sky.glsl.js';

// Procedural sky on a dome centred on the camera. The dome's local vertex position is the
// view direction, which replaces the orbit camera of the original full-screen demo.
// The uniforms object is shared (by reference) with the pond so both see one sun and clock.
export function createSky(scene) {
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: 0.8 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // pin to the far plane so every mesh occludes the sky
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${SKY_GLSL}
      void main() {
        gl_FragColor = vec4(sky(normalize(vDir), 1.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = 1000; // draw after the other opaque meshes: only uncovered pixels pay for the shader
  scene.add(dome);

  return {
    uniforms,
    dome,
    update(camera, time) {
      camera.getWorldPosition(dome.position);
      uniforms.uTime.value = time;
    },
  };
}
