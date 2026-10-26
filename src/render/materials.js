// Toon (2-band) + inverted-hull outline shaders. Colours come from a palette uniform indexed by
// the per-vertex `aPal` attribute (x = palette index, y = tintable flag), see TECH.md §3.
import * as THREE from 'three';
import { PALETTE, SHADOW_TINT, HEX } from './palette.js';

const tmpColor = new THREE.Color();

export function linearRGB(hex, out = new THREE.Vector3()) {
  tmpColor.set(hex); // sets in linear working space (ColorManagement)
  return out.set(tmpColor.r, tmpColor.g, tmpColor.b);
}

// one shared palette array; mutate in place to recolour everything (e.g. per-level grade)
export const paletteUniform = { value: PALETTE.map(([, h]) => linearRGB(h)) };

export const shared = {
  uLightDir: { value: new THREE.Vector3(-0.45, 0.8, 0.4).normalize() }, // world space
  uShadowTint: { value: linearRGB(SHADOW_TINT) },
  uFogColor: { value: linearRGB('#FFF6E6') },
  uFogNear: { value: 1e6 },
  uFogFar: { value: 2e6 },
  uResolution: { value: new THREE.Vector2(390, 844) },
  uFocalPx: { value: 800 },
  uOutlinePx: { value: 2.5 },
  uInk: { value: linearRGB(HEX.ink) },
};

const PAL_COUNT = PALETTE.length;

const toonVertex = /* glsl */ `
#include <common>
attribute vec2 aPal;
#ifdef USE_INSTANCING
attribute float aTint;
#else
uniform float uTint;
#endif
uniform vec3 uPalette[${PAL_COUNT}];
uniform vec3 uLightDir;
varying vec3 vColor;
varying float vNdl;
varying float vFogDepth;
void main() {
  float idx = aPal.x;
#ifdef USE_INSTANCING
  float t = aTint;
#else
  float t = uTint;
#endif
  if (aPal.y > 0.5 && t > 0.5) idx = t - 1.0;
  vColor = uPalette[int(idx + 0.5)];
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
#endif
  vec4 wp = modelMatrix * p;
  vec3 wn = normalize(mat3(modelMatrix) * n);
  vNdl = dot(wn, uLightDir);
  vec4 mv = viewMatrix * wp;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const toonFragment = /* glsl */ `
uniform vec3 uShadowTint;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFlash;
varying vec3 vColor;
varying float vNdl;
varying float vFogDepth;
void main() {
  float lit = smoothstep(0.02, 0.07, vNdl);
  vec3 col = vColor * mix(uShadowTint, vec3(1.0), lit);
  col = mix(col, vec3(1.0), uFlash);
  float f = smoothstep(uFogNear, uFogFar, vFogDepth);
  col = mix(col, uFogColor, f);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const outlineVertex = /* glsl */ `
#include <common>
attribute vec2 aPal;
attribute vec3 aOutN;
#ifdef USE_INSTANCING
attribute float aTint;
#else
uniform float uTint;
#endif
uniform vec3 uPalette[${PAL_COUNT}];
uniform vec3 uInk;
uniform vec2 uResolution;
uniform float uFocalPx;
uniform float uOutlinePx;
uniform float uObjSize;
#ifdef SIZE_ATTR
attribute float aSize;
#endif
varying vec3 vColor;
varying float vFogDepth;
void main() {
  float idx = aPal.x;
#ifdef SIZE_ATTR
  float objSize = aSize;
#else
  float objSize = uObjSize;
#endif
#ifdef USE_INSTANCING
  float t = aTint;
#else
  float t = uTint;
#endif
  if (aPal.y > 0.5 && t > 0.5) idx = t - 1.0;
  vColor = mix(uInk, uPalette[int(idx + 0.5)], 0.15);
  vec4 p = vec4(position, 1.0);
  vec3 n = aOutN;
  float s = 1.0;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
  s = length(instanceMatrix[0].xyz);
#endif
  vec4 mv = modelViewMatrix * p;
  vec3 nv = normalize(mat3(modelViewMatrix) * n);
  vec4 clip = projectionMatrix * mv;
  vec2 nc = (projectionMatrix * vec4(nv, 0.0)).xy;
  float l = length(nc);
  nc = l > 1e-5 ? nc / l : vec2(0.0);
  // constant pixel width, but never thicker than ~4% of the object's projected size
  float px = min(uOutlinePx, objSize * s * 0.04 * uFocalPx / max(clip.w, 1e-4));
  clip.xy += nc * px * 2.0 / uResolution * clip.w;
  vFogDepth = -mv.z;
  gl_Position = clip;
}
`;

const outlineFragment = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vColor;
varying float vFogDepth;
void main() {
  float f = smoothstep(uFogNear, uFogFar, vFogDepth);
  gl_FragColor = vec4(mix(vColor, uFogColor, f), 1.0);
  #include <colorspace_fragment>
}
`;

export function makeToonMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPalette: paletteUniform,
      uLightDir: shared.uLightDir,
      uShadowTint: shared.uShadowTint,
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uTint: { value: opts.tint || 0 },
      uFlash: opts.flash || { value: 0 },
    },
    vertexShader: toonVertex,
    fragmentShader: toonFragment,
  });
}

export function makeOutlineMaterial(objSize, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPalette: paletteUniform,
      uInk: shared.uInk,
      uResolution: shared.uResolution,
      uFocalPx: shared.uFocalPx,
      uOutlinePx: opts.outlinePx || shared.uOutlinePx,
      uObjSize: { value: objSize },
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uTint: { value: opts.tint || 0 },
    },
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    side: THREE.BackSide,
    defines: opts.sizeAttr ? { SIZE_ATTR: 1 } : {},
  });
}

// Shared materials for instanced world objects (one per process; uniforms per type would cost a
// program switch each, so the outline object size is per material instance but programs are shared).
export const toonMaterial = makeToonMaterial();

// Ball core with a skin pattern (object-space, so it rolls with the ball).
export function makeCoreMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Vector3(0.5, 0.4, 0.9) },
      uB: { value: new THREE.Vector3(0.3, 0.2, 0.7) },
      uPattern: { value: 0 },
      uFlash: { value: 0 },
      uLightDir: shared.uLightDir,
      uShadowTint: shared.uShadowTint,
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
    },
    vertexShader: /* glsl */ `
      uniform vec3 uLightDir;
      varying vec3 vObj;
      varying float vNdl;
      varying float vFogDepth;
      void main() {
        vObj = normalize(position);
        vec3 wn = normalize(mat3(modelMatrix) * normal);
        vNdl = dot(wn, uLightDir);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uA;
      uniform vec3 uB;
      uniform int uPattern;
      uniform float uFlash;
      uniform vec3 uShadowTint;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vObj;
      varying float vNdl;
      varying float vFogDepth;
      float aa(float e, float x) { float w = fwidth(x) * 0.8; return smoothstep(e - w, e + w, x); }
      void main() {
        vec3 p = normalize(vObj);
        float u = atan(p.z, p.x) / 6.2831853 + 0.5;
        float v = asin(clamp(p.y, -1.0, 1.0)) / 3.14159265 + 0.5;
        float m = 0.0;
        vec3 col = uA;
        if (uPattern == 0) { // fluff: thin wavy fibres, like lint
          float n = sin(p.x * 11.0 + sin(p.y * 8.0) * 1.6 + p.z * 4.0) + sin(p.z * 12.0 + sin(p.x * 7.0) * 1.4);
          m = 1.0 - aa(0.09, abs(n));
        } else if (uPattern == 1) { // dots
          vec2 g = vec2(u * 16.0, v * 8.0);
          g.x += mod(floor(g.y), 2.0) * 0.5;
          vec2 f = fract(g) - 0.5;
          f.x *= cos((v - 0.5) * 3.14159) * 2.0;
          m = 1.0 - aa(0.25, length(f));
        } else if (uPattern == 2) { // stripes
          m = aa(0.5, fract(v * 7.0));
        } else if (uPattern == 3) { // chips
          vec2 g = vec2(u * 12.0, v * 7.0);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5 + 0.25 * vec2(sin(id.x * 12.9 + id.y * 4.1), cos(id.y * 7.3 + id.x));
          m = 1.0 - aa(0.13, max(abs(f.x), abs(f.y * 1.4)));
        } else if (uPattern == 4) { // checks
          m = mod(floor(u * 16.0) + floor(v * 8.0), 2.0);
        } else if (uPattern == 5) { // stars
          vec2 g = vec2(u * 14.0, v * 7.0);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5 + 0.2 * vec2(sin(id.x * 3.7 + id.y), cos(id.y * 5.1 - id.x));
          float r = length(f);
          float a = atan(f.y, f.x);
          float star = 0.13 + 0.07 * cos(a * 5.0);
          m = 1.0 - aa(star, r);
        } else if (uPattern == 6) { // rainbow bands
          float b = floor(v * 6.0);
          vec3 c0 = vec3(0.87, 0.06, 0.03), c1 = vec3(1.0, 0.25, 0.01), c2 = vec3(1.0, 0.58, 0.03);
          vec3 c3 = vec3(0.05, 0.41, 0.11), c4 = vec3(0.04, 0.1, 0.67), c5 = vec3(0.2, 0.08, 0.63);
          col = b < 1.0 ? c5 : b < 2.0 ? c4 : b < 3.0 ? c3 : b < 4.0 ? c2 : b < 5.0 ? c1 : c0;
        } else if (uPattern == 7) { // shine
          m = aa(0.6, fract((p.x + p.y) * 3.0));
        }
        col = mix(col, uB, m);
        float lit = smoothstep(0.02, 0.07, vNdl);
        col = col * mix(uShadowTint, vec3(1.0), lit);
        col = mix(col, vec3(1.0), uFlash);
        float f = smoothstep(uFogNear, uFogFar, vFogDepth);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
