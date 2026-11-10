import * as THREE from 'three';
import { POST_VERT, POST_FRAG } from './shaders/post.glsl.js';

// Minimal post pipeline: render the scene into a linear half-float MSAA target, then draw one
// full-screen triangle that applies the filmic tonemap, gamma, vignette and dither.
// Add ?post=0 to the URL to bypass it (falls back to the renderer's built-in tonemapping).
export const POST_ENABLED = new URLSearchParams(window.location.search).get('post') !== '0';

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = POST_ENABLED;
    if (!this.enabled) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      return;
    }
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthBuffer: true,
    });
    this.uniforms = {
      tScene: { value: this.target.texture },
      uTime: { value: 0 },
      uExposure: { value: 1.05 },
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const tri = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
    }));
    tri.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(tri);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize() {
    if (!this.enabled) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x, size.y);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    if (!this.enabled) { r.render(scene, camera); return; }
    this.uniforms.uTime.value = time;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
  }
}
