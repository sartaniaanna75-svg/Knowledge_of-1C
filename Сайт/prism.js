/**
 * Prism — vanilla JS адаптация React/ogl-компонента
 * Палитра: forest / wheat / terracotta через hueShift
 */
import { Renderer, Triangle, Program, Mesh } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.10/+esm';

const BRAND_DEFAULTS = {
  height: 3.5,
  baseWidth: 5.5,
  animationType: 'rotate',
  glow: 0.9,
  offset: { x: 0, y: 0 },
  noise: 0.06,
  transparent: true,
  scale: 3.6,
  /* сдвиг в сторону зелёно-янтарных тонов сайта */
  hueShift: 2.05,
  colorFrequency: 0.9,
  hoverStrength: 2,
  inertia: 0.05,
  bloom: 0.85,
  suspendWhenOffscreen: true,
  timeScale: 0.5
};

function parseConfig(el) {
  const ds = el.dataset;
  const num = (key, fallback) => {
    const v = ds[key];
    return v === undefined || v === '' ? fallback : Number(v);
  };

  return {
    height: num('height', BRAND_DEFAULTS.height),
    baseWidth: num('baseWidth', BRAND_DEFAULTS.baseWidth),
    animationType: ds.animationType || BRAND_DEFAULTS.animationType,
    glow: num('glow', BRAND_DEFAULTS.glow),
    offset: {
      x: num('offsetX', BRAND_DEFAULTS.offset.x),
      y: num('offsetY', BRAND_DEFAULTS.offset.y)
    },
    noise: num('noise', BRAND_DEFAULTS.noise),
    transparent: ds.transparent !== 'false',
    scale: num('scale', BRAND_DEFAULTS.scale),
    hueShift: num('hueShift', BRAND_DEFAULTS.hueShift),
    colorFrequency: num('colorFrequency', BRAND_DEFAULTS.colorFrequency),
    hoverStrength: num('hoverStrength', BRAND_DEFAULTS.hoverStrength),
    inertia: num('inertia', BRAND_DEFAULTS.inertia),
    bloom: num('bloom', BRAND_DEFAULTS.bloom),
    suspendWhenOffscreen: ds.suspendWhenOffscreen !== 'false',
    timeScale: num('timeScale', BRAND_DEFAULTS.timeScale)
  };
}

function mountPrism(container, options = {}) {
  if (!container || container.__prismMounted) return () => {};
  container.__prismMounted = true;
  container.classList.add('prism-container');

  const cfg = { ...BRAND_DEFAULTS, ...options };

  const H = Math.max(0.001, cfg.height);
  const BW = Math.max(0.001, cfg.baseWidth);
  const BASE_HALF = BW * 0.5;
  const GLOW = Math.max(0.0, cfg.glow);
  const NOISE = Math.max(0.0, cfg.noise);
  const offX = cfg.offset?.x ?? 0;
  const offY = cfg.offset?.y ?? 0;
  const SAT = cfg.transparent ? 1.35 : 1;
  const SCALE = Math.max(0.001, cfg.scale);
  const HUE = cfg.hueShift || 0;
  const CFREQ = Math.max(0.0, cfg.colorFrequency || 1);
  const BLOOM = Math.max(0.0, cfg.bloom || 1);
  const TS = Math.max(0, cfg.timeScale || 1);
  const HOVSTR = Math.max(0, cfg.hoverStrength || 1);
  const INERT = Math.max(0, Math.min(1, cfg.inertia || 0.12));
  const animationType = cfg.animationType || 'rotate';

  const dpr = Math.min(1.75, window.devicePixelRatio || 1);
  const renderer = new Renderer({
    dpr,
    alpha: cfg.transparent,
    antialias: false
  });
  const gl = renderer.gl;
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);

  Object.assign(gl.canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block'
  });
  container.appendChild(gl.canvas);

  const vertex = /* glsl */ `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragment = /* glsl */ `
    precision highp float;

    uniform vec2  iResolution;
    uniform float iTime;

    uniform float uHeight;
    uniform float uBaseHalf;
    uniform mat3  uRot;
    uniform int   uUseBaseWobble;
    uniform float uGlow;
    uniform vec2  uOffsetPx;
    uniform float uNoise;
    uniform float uSaturation;
    uniform float uScale;
    uniform float uHueShift;
    uniform float uColorFreq;
    uniform float uBloom;
    uniform float uCenterShift;
    uniform float uInvBaseHalf;
    uniform float uInvHeight;
    uniform float uMinAxis;
    uniform float uPxScale;
    uniform float uTimeScale;

    vec4 tanh4(vec4 x){
      vec4 e2x = exp(2.0*x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float sdOctaAnisoInv(vec3 p){
      vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
      float m = q.x + q.y + q.z - 1.0;
      return m * uMinAxis * 0.5773502691896258;
    }

    float sdPyramidUpInv(vec3 p){
      float oct = sdOctaAnisoInv(p);
      float halfSpace = -p.y;
      return max(oct, halfSpace);
    }

    mat3 hueRotation(float a){
      float c = cos(a), s = sin(a);
      mat3 W = mat3(
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114
      );
      mat3 U = mat3(
         0.701, -0.587, -0.114,
        -0.299,  0.413, -0.114,
        -0.300, -0.588,  0.886
      );
      mat3 V = mat3(
         0.168, -0.331,  0.500,
         0.328,  0.035, -0.500,
        -0.497,  0.296,  0.201
      );
      return W + U * c + V * s;
    }

    void main(){
      vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

      float z = 5.0;
      float d = 0.0;

      vec3 p;
      vec4 o = vec4(0.0);

      float centerShift = uCenterShift;
      float cf = uColorFreq;

      mat2 wob = mat2(1.0);
      if (uUseBaseWobble == 1) {
        float t = iTime * uTimeScale;
        float c0 = cos(t + 0.0);
        float c1 = cos(t + 33.0);
        float c2 = cos(t + 11.0);
        wob = mat2(c0, c1, c2, c0);
      }

      const int STEPS = 100;
      for (int i = 0; i < STEPS; i++) {
        p = vec3(f, z);
        p.xz = p.xz * wob;
        p = uRot * p;
        vec3 q = p;
        q.y += centerShift;
        d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
        z -= d;
        o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
      }

      o = tanh4(o * o * (uGlow * uBloom) / 1e5);

      vec3 col = o.rgb;
      float n = rand(gl_FragCoord.xy + vec2(iTime));
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);

      float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

      if(abs(uHueShift) > 0.0001){
        col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
      }

      /* лёгкий тёплый оттенок под cream/forest палитру */
      col = mix(col, col * vec3(0.92, 1.0, 0.88), 0.22);

      gl_FragColor = vec4(col, o.a);
    }
  `;

  const geometry = new Triangle(gl);
  const iResBuf = new Float32Array(2);
  const offsetPxBuf = new Float32Array(2);

  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iResolution: { value: iResBuf },
      iTime: { value: 0 },
      uHeight: { value: H },
      uBaseHalf: { value: BASE_HALF },
      uUseBaseWobble: { value: 1 },
      uRot: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
      uGlow: { value: GLOW },
      uOffsetPx: { value: offsetPxBuf },
      uNoise: { value: NOISE },
      uSaturation: { value: SAT },
      uScale: { value: SCALE },
      uHueShift: { value: HUE },
      uColorFreq: { value: CFREQ },
      uBloom: { value: BLOOM },
      uCenterShift: { value: H * 0.25 },
      uInvBaseHalf: { value: 1 / BASE_HALF },
      uInvHeight: { value: 1 / H },
      uMinAxis: { value: Math.min(BASE_HALF, H) },
      uPxScale: {
        value: 1 / ((gl.drawingBufferHeight || 1) * 0.1 * SCALE)
      },
      uTimeScale: { value: TS }
    }
  });
  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    iResBuf[0] = gl.drawingBufferWidth;
    iResBuf[1] = gl.drawingBufferHeight;
    offsetPxBuf[0] = offX * dpr;
    offsetPxBuf[1] = offY * dpr;
    program.uniforms.uPxScale.value = 1 / ((gl.drawingBufferHeight || 1) * 0.1 * SCALE);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const rotBuf = new Float32Array(9);
  const setMat3FromEuler = (yawY, pitchX, rollZ, out) => {
    const cy = Math.cos(yawY);
    const sy = Math.sin(yawY);
    const cx = Math.cos(pitchX);
    const sx = Math.sin(pitchX);
    const cz = Math.cos(rollZ);
    const sz = Math.sin(rollZ);
    const r00 = cy * cz + sy * sx * sz;
    const r01 = -cy * sz + sy * sx * cz;
    const r02 = sy * cx;
    const r10 = cx * sz;
    const r11 = cx * cz;
    const r12 = -sx;
    const r20 = -sy * cz + cy * sx * sz;
    const r21 = sy * sz + cy * sx * cz;
    const r22 = cy * cx;
    out[0] = r00;
    out[1] = r10;
    out[2] = r20;
    out[3] = r01;
    out[4] = r11;
    out[5] = r21;
    out[6] = r02;
    out[7] = r12;
    out[8] = r22;
    return out;
  };

  const NOISE_IS_ZERO = NOISE < 1e-6;
  let raf = 0;
  const t0 = performance.now();
  const startRAF = () => {
    if (raf) return;
    raf = requestAnimationFrame(render);
  };
  const stopRAF = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const rnd = () => Math.random();
  const wX = (0.3 + rnd() * 0.6);
  const wY = (0.2 + rnd() * 0.7);
  const wZ = (0.1 + rnd() * 0.5);
  const phX = rnd() * Math.PI * 2;
  const phZ = rnd() * Math.PI * 2;

  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  const lerp = (a, b, t) => a + (b - a) * t;

  const pointer = { x: 0, y: 0, inside: true };
  const onMove = (e) => {
    const ww = Math.max(1, window.innerWidth);
    const wh = Math.max(1, window.innerHeight);
    const cx = ww * 0.5;
    const cy = wh * 0.5;
    const nx = (e.clientX - cx) / (ww * 0.5);
    const ny = (e.clientY - cy) / (wh * 0.5);
    pointer.x = Math.max(-1, Math.min(1, nx));
    pointer.y = Math.max(-1, Math.min(1, ny));
    pointer.inside = true;
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  const onBlur = () => {
    pointer.inside = false;
  };

  let onPointerMove = null;
  if (animationType === 'hover') {
    onPointerMove = (e) => {
      onMove(e);
      startRAF();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onBlur);
    program.uniforms.uUseBaseWobble.value = 0;
  } else if (animationType === '3drotate') {
    program.uniforms.uUseBaseWobble.value = 0;
  } else {
    program.uniforms.uUseBaseWobble.value = 1;
  }

  const render = (t) => {
    const time = (t - t0) * 0.001;
    program.uniforms.iTime.value = time;

    let continueRAF = true;

    if (animationType === 'hover') {
      const maxPitch = 0.6 * HOVSTR;
      const maxYaw = 0.6 * HOVSTR;
      targetYaw = (pointer.inside ? -pointer.x : 0) * maxYaw;
      targetPitch = (pointer.inside ? pointer.y : 0) * maxPitch;
      yaw = lerp(yaw, targetYaw, INERT);
      pitch = lerp(pitch, targetPitch, INERT);
      roll = lerp(roll, 0, 0.1);
      program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);

      if (NOISE_IS_ZERO) {
        const settled =
          Math.abs(yaw - targetYaw) < 1e-4 &&
          Math.abs(pitch - targetPitch) < 1e-4 &&
          Math.abs(roll) < 1e-4;
        if (settled) continueRAF = false;
      }
    } else if (animationType === '3drotate') {
      const tScaled = time * TS;
      yaw = tScaled * wY;
      pitch = Math.sin(tScaled * wX + phX) * 0.6;
      roll = Math.sin(tScaled * wZ + phZ) * 0.5;
      program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);
      if (TS < 1e-6) continueRAF = false;
    } else {
      rotBuf[0] = 1;
      rotBuf[1] = 0;
      rotBuf[2] = 0;
      rotBuf[3] = 0;
      rotBuf[4] = 1;
      rotBuf[5] = 0;
      rotBuf[6] = 0;
      rotBuf[7] = 0;
      rotBuf[8] = 1;
      program.uniforms.uRot.value = rotBuf;
      if (TS < 1e-6) continueRAF = false;
    }

    renderer.render({ scene: mesh });
    if (continueRAF) {
      raf = requestAnimationFrame(render);
    } else {
      raf = 0;
    }
  };

  let io = null;
  if (cfg.suspendWhenOffscreen) {
    io = new IntersectionObserver((entries) => {
      const vis = entries.some((e) => e.isIntersecting);
      if (vis) startRAF();
      else stopRAF();
    });
    io.observe(container);
    startRAF();
  } else {
    startRAF();
  }

  return () => {
    stopRAF();
    ro.disconnect();
    if (animationType === 'hover') {
      if (onPointerMove) window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onBlur);
    }
    if (io) io.disconnect();
    if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
    container.__prismMounted = false;
  };
}

function boot() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('[data-prism]').forEach((el) => {
    mountPrism(el, parseConfig(el));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { mountPrism };
