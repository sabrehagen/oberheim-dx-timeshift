import * as THREE from 'three';

/** One shared clock uniform for every animated material (cheap: no per-frame allocations). */
export const sharedTime = { value: 0 };

const vert = /* glsl */ `
  uniform float uLength;
  varying float vDist;
  varying float vAcross;
  void main() {
    vDist = uv.x * uLength;
    vAcross = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSpacing;
  uniform float uOpacity;
  uniform float uDir;
  uniform vec3 uColor;
  varying float vDist;
  varying float vAcross;
  void main() {
    float ph = fract((vDist - uDir * uTime * uSpeed) / uSpacing);
    float head = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.32, ph));
    float base = 0.38;
    float a = uOpacity * (base + (1.0 - base) * head);
    vec3 col = uColor * (0.7 + 1.8 * head);
    gl_FragColor = vec4(col, a);
  }
`;

export interface PulseOptions {
  color: THREE.ColorRepresentation;
  length: number;
  speed?: number;
  spacing?: number;
  depthTest?: boolean;
}

/** Glowing material with pulses travelling along a tube (uv.x = 0..1 along the path). */
export function pulseMaterial(o: PulseOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uLength: { value: o.length },
      uSpeed: { value: o.speed ?? 40 },
      uSpacing: { value: o.spacing ?? 28 },
      uOpacity: { value: 1 },
      uDir: { value: 1 },
      uColor: { value: new THREE.Color(o.color) },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: THREE.AdditiveBlending,
  });
}

const ribbonFrag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec4 uMaskA;
  uniform vec4 uMaskB;
  uniform vec4 uMaskC;
  uniform vec4 uMaskD;
  uniform float uPulse;
  uniform float uLength;
  varying float vDist;
  varying float vAcross;
  float maskFor(float i) {
    if (i < 4.0) return uMaskA[int(i)];
    if (i < 8.0) return uMaskB[int(i - 4.0)];
    if (i < 12.0) return uMaskC[int(i - 8.0)];
    return uMaskD[int(i - 12.0)];
  }
  void main() {
    float x = vAcross * 16.0;
    float i = floor(x);
    float f = fract(x);
    float edge = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.88, 1.0, f));
    vec3 grey = vec3(0.62, 0.63, 0.66);
    vec3 col = (i < 0.5) ? vec3(0.78, 0.16, 0.14) : grey;
    col *= 0.55 + 0.45 * edge;
    float m = maskFor(clamp(i, 0.0, 15.0));
    float ph = fract((vDist - uTime * 45.0) / 30.0);
    float head = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.3, ph));
    vec3 hot = vec3(1.0, 0.62, 0.15);
    col = mix(col, hot * (0.8 + 1.6 * head * uPulse), m * 0.85);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

/** 16-way grey ribbon with a red conductor 1; masked conductors glow with travelling pulses. */
export function ribbonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uOpacity: { value: 1 },
      uLength: { value: 120 },
      uPulse: { value: 1 },
      uMaskA: { value: new THREE.Vector4() },
      uMaskB: { value: new THREE.Vector4() },
      uMaskC: { value: new THREE.Vector4() },
      uMaskD: { value: new THREE.Vector4() },
    },
    vertexShader: vert,
    fragmentShader: ribbonFrag,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

export function setRibbonMask(m: THREE.ShaderMaterial, conductors: number[]): void {
  const arr = new Array(16).fill(0);
  for (const c of conductors) if (c >= 1 && c <= 16) arr[c - 1] = 1;
  (m.uniforms.uMaskA.value as THREE.Vector4).set(arr[0], arr[1], arr[2], arr[3]);
  (m.uniforms.uMaskB.value as THREE.Vector4).set(arr[4], arr[5], arr[6], arr[7]);
  (m.uniforms.uMaskC.value as THREE.Vector4).set(arr[8], arr[9], arr[10], arr[11]);
  (m.uniforms.uMaskD.value as THREE.Vector4).set(arr[12], arr[13], arr[14], arr[15]);
}
