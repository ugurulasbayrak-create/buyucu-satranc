
/* ---------- post-processing: HDR bloom, filmic grade, impact effects; env map baked from the hall ---------- */
const fx = { aberr: 0, flash: 0, vig: 0.5, redPulse: 0, bloom: 0.32 };
let composer = null, bloomPass = null, gradePass = null;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, vig: { value: 0.42 }, aberr: { value: 0 }, flash: { value: 0 }, red: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float exposure, vig, aberr, flash, red, time; varying vec2 vUv;',
    'vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }',
    'void main(){',
    '  vec2 d = vUv - 0.5; float r2 = dot(d, d);',
    '  vec2 off = d * aberr * (0.4 + r2 * 2.0);',
    '  vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);',
    '  col *= exposure; col += vec3(1.0, 0.92, 0.75) * flash;',
    '  col = aces(col);',
    '  col = mix(col, col * vec3(1.15, 0.55, 0.5), red * smoothstep(0.1, 0.6, r2) );',
    '  col *= 1.0 - vig * smoothstep(0.12, 0.62, r2);',
    '  col += (fract(sin(dot(vUv * 800.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;',
    '  col = pow(max(col, 0.0), vec3(1.0 / 2.2));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n')
};

let quality = 0, qWinStart = 0, qFrames = 0;
function buildComposer() {
  try {
    if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.UnrealBloomPass) return false;
    const w = Math.max(10, stageEl.clientWidth), h = Math.max(10, stageEl.clientHeight), pr = renderer.getPixelRatio();
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, encoding: THREE.LinearEncoding };
    const rt = quality === 0 ? new THREE.WebGLMultisampleRenderTarget(w * pr, h * pr, opts) : new THREE.WebGLRenderTarget(w * pr, h * pr, opts);
    if (quality === 0) rt.samples = 4;
    composer = new THREE.EffectComposer(renderer, rt);
    composer.setPixelRatio && composer.setPixelRatio(pr);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w * (quality ? 0.5 : 1), h * (quality ? 0.5 : 1)), 0.32, 0.55, 1.15);
    composer.addPass(bloomPass);
    gradePass = new THREE.ShaderPass(GradeShader);
    gradePass.renderToScreen = true;
    composer.addPass(gradePass);
    composer.setSize(w, h);
    return true;
  } catch (err) { composer = null; return false; }
}
function applyQuality() {
  const w = Math.max(10, stageEl.clientWidth), h = Math.max(10, stageEl.clientHeight);
  composer = null;
  if (quality === 0) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.toneMapping = THREE.NoToneMapping; }
  else if (quality === 1) { renderer.setPixelRatio(1); renderer.toneMapping = THREE.NoToneMapping; }
  else { renderer.setPixelRatio(0.8); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.78; }
  renderer.setSize(w, h, false);
  if (quality < 2 && !buildComposer()) { quality = 2; applyQuality(); return; }
  sun.castShadow = quality < 2;
}
let warmupUntil = 0;
function initPost() { quality = 0; applyQuality(); warmupUntil = performance.now() + 4000; return !!composer; }

function resizePost(w, h) { if (composer) composer.setSize(w, h); }

function watchPerformance(dtReal) {
  if (quality >= 2) return;
  const now = performance.now();
  if (now < warmupUntil) { qWinStart = 0; return; }
  if (!qWinStart) { qWinStart = now; qFrames = 0; }
  qFrames++;
  const el = now - qWinStart;
  if (el > 1800) {
    const fps = qFrames / (el / 1000);
    qWinStart = 0;
    if (fps < 24) { quality += fps < 8 ? 2 : 1; quality = Math.min(quality, 2); applyQuality(); }
  }
}

function renderFrame(dt) {
  watchPerformance(dt);
  if (!composer) { renderer.render(scene, camera); return; }
  fx.aberr *= Math.exp(-dt * 5); fx.flash *= Math.exp(-dt * 7); fx.redPulse *= Math.exp(-dt * 3);
  const u = gradePass.uniforms;
  u.aberr.value = fx.aberr; u.flash.value = fx.flash; u.red.value = fx.redPulse; u.vig.value = fx.vig; u.time.value = (u.time.value + dt) % 100;
  u.exposure.value = 0.8;
  bloomPass.strength = fx.bloom + fx.flash * 0.8;
  composer.render(dt);
}

// Bake the hall into a cube map so the gold, black marble and ivory reflect the room and the fire.
function bakeEnvironment() {
  try {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cc = new THREE.CubeCamera(0.1, 200, rt);
    cc.position.set(0, 2.2, 0);
    scene.environment = null;
    cc.update(renderer, scene);
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromCubemap(rt.texture).texture;
    pm.dispose();
    scene.environment = env;
    rt.dispose();
    return true;
  } catch (err) { return false; }
}
