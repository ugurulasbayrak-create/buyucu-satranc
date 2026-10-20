(function () {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined' || typeof Chess === 'undefined') { $('fail').hidden = false; return; }

const FILES = 'abcdefgh';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = h => new THREE.Color(h).convertSRGBToLinear();
const sqPos = sq => ({ x: FILES.indexOf(sq[0]) - 3.5, z: 4.5 - (+sq[1]) });
const rngOf = seed => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const animators = [];   // functions(time, dt) run every frame

/* ---------- renderer, scene, camera ---------- */
const stageEl = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stageEl.prepend(renderer.domElement);
const dom = renderer.domElement;

const BG = 0x1a1511;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 34, 110);

const FLOOR_Y = -1.52;
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
const cam = { theta: 0, phi: 1.0, radius: 14 };
const camT = { theta: 0, phi: 1.0, radius: 14 };
const camTarget = new THREE.Vector3(0, 0.5, 0.5);
const camTargetT = new THREE.Vector3(0, 0.5, 0.5);

/* ---------- warm environment map for reflections ---------- */
(function () {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#4a3524'); g.addColorStop(0.42, '#a8814f'); g.addColorStop(0.5, '#f0cf93'); g.addColorStop(0.58, '#6a4a2c'); g.addColorStop(1, '#1a110a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  [[80, 60, 30], [230, 45, 22], [380, 70, 36], [470, 100, 18], [160, 105, 16]].forEach(([px, py, r]) => {
    const rg = x.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, 'rgba(255,240,205,1)'); rg.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = rg; x.fillRect(px - r, py - r, r * 2, r * 2);
  });
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(t).texture;
  pm.dispose();
})();

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(C('#dfe3e8'), C('#38342f'), 0.5));
const sun = new THREE.DirectionalLight(C('#f4ecdc'), 0.8);
sun.position.set(-7, 14, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);

/* ---------- textures ---------- */
const spriteTex = (function () {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function stoneTex(h, s, l, rows, cols, seed, repX, repY) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const x = cv.getContext('2d'), rnd = rngOf(seed);
  const bw = 512 / cols, bh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const off = (r % 2) * bw * 0.5 * (cols > 3 ? 1 : 0);
      x.fillStyle = 'hsl(' + (h + rnd() * 6 - 3) + ',' + s + '%,' + (l + rnd() * 9 - 4.5) + '%)';
      x.fillRect(c * bw + off, r * bh, bw, bh);
      if (off) { x.fillRect(c * bw + off - 512, r * bh, bw, bh); }
    }
  }
  x.globalAlpha = 0.09;
  for (let i = 0; i < 1400; i++) { x.fillStyle = rnd() > 0.5 ? '#fff' : '#000'; x.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3); }
  x.globalAlpha = 0.85; x.strokeStyle = 'hsl(' + h + ',' + s + '%,' + (l - 24) + '%)'; x.lineWidth = 3;
  for (let r = 0; r <= rows; r++) { x.beginPath(); x.moveTo(0, r * bh); x.lineTo(512, r * bh); x.stroke(); }
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5 * (cols > 3 ? 1 : 0);
    for (let c = 0; c <= cols; c++) { x.beginPath(); x.moveTo(c * bw + off, r * bh); x.lineTo(c * bw + off, (r + 1) * bh); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX || 1, repY || 1);
  return t;
}

function marble(base, vein, seed, veinAlpha) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d'), rnd = rngOf(seed);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 24; i++) {
    x.strokeStyle = vein; x.globalAlpha = (veinAlpha || 0.12) * (0.4 + rnd()); x.lineWidth = 0.5 + rnd() * 1.5;
    x.beginPath(); let px = rnd() * 256, py = rnd() * 256; x.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 90; py += (rnd() - 0.2) * 70; x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 0.06;
  for (let i = 0; i < 380; i++) { x.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000'; x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
const lightTex = [1, 2, 3, 4].map(i => marble('#d4c8ae', '#8a7a58', 300 + i * 77, 0.16));
const darkTex = [1, 2, 3, 4].map(i => marble('#101014', '#9fb4d6', 900 + i * 91, 0.22));

function slabTexture() {
  const S = 1024, u = S / 13, cx = S / 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), rnd = rngOf(4242);
  x.fillStyle = '#09090c'; x.fillRect(0, 0, S, S);
  // crackle veins
  x.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(rnd() * 4), t = rnd() * S;
    let px = side === 0 ? t : side === 1 ? t : side === 2 ? 4 : S - 4;
    let py = side === 0 ? 4 : side === 1 ? S - 4 : t;
    let ang = Math.atan2(cx - py, cx - px) + (rnd() - 0.5) * 1.4;
    x.strokeStyle = 'rgba(214,230,255,' + (0.28 + rnd() * 0.45) + ')'; x.lineWidth = 0.6 + rnd() * 1.3;
    x.beginPath(); x.moveTo(px, py);
    const steps = 10 + Math.floor(rnd() * 22);
    for (let k = 0; k < steps; k++) {
      ang += (rnd() - 0.5) * 1.1; const len = 12 + rnd() * 26;
      px += Math.cos(ang) * len; py += Math.sin(ang) * len; x.lineTo(px, py);
      if (rnd() < 0.12) { x.moveTo(px, py); const a2 = ang + (rnd() - 0.5) * 2; x.lineTo(px + Math.cos(a2) * 30, py + Math.sin(a2) * 30); x.moveTo(px, py); }
    }
    x.stroke();
  }
  // gold lines
  x.strokeStyle = '#d9a93c'; x.shadowColor = 'rgba(217,169,60,.55)'; x.shadowBlur = 6;
  [[4.78, 3], [4.92, 1.2], [6.2, 2.6], [6.05, 1]].forEach(([h, w]) => { x.lineWidth = w; x.strokeRect(cx - h * u, cx - h * u, h * 2 * u, h * 2 * u); });
  // runes between the lines
  x.lineWidth = 2.4; x.shadowBlur = 4;
  const rune = (px, py, rot, size) => {
    x.save(); x.translate(px, py); x.rotate(rot);
    x.beginPath(); x.moveTo(0, -size); x.lineTo(0, size);
    const br = 1 + Math.floor(rnd() * 3);
    for (let b = 0; b < br; b++) { const yy = -size * 0.8 + rnd() * size * 1.4, dir = rnd() > 0.5 ? 1 : -1; x.moveTo(0, yy); x.lineTo(dir * size * (0.5 + rnd() * 0.5), yy + (rnd() > 0.5 ? 1 : -1) * size * 0.55); }
    x.stroke(); x.restore();
  };
  const band = 5.5, n = 24, span = 5.2;
  for (let i = 0; i < n; i++) {
    const p = -span + (i / (n - 1)) * span * 2;
    rune(cx + p * u, cx + band * u, 0, 0.22 * u);
    rune(cx + p * u, cx - band * u, Math.PI, 0.22 * u);
    rune(cx - band * u, cx + p * u, Math.PI / 2, 0.22 * u);
    rune(cx + band * u, cx + p * u, -Math.PI / 2, 0.22 * u);
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const px = cx + sx * 5.55 * u, py = cx + sy * 5.55 * u;
    x.lineWidth = 2; for (let a = 0; a < 4; a++) { x.beginPath(); x.moveTo(px - Math.cos(a * Math.PI / 4) * 0.34 * u, py - Math.sin(a * Math.PI / 4) * 0.34 * u); x.lineTo(px + Math.cos(a * Math.PI / 4) * 0.34 * u, py + Math.sin(a * Math.PI / 4) * 0.34 * u); x.stroke(); }
  });
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  return t;
}

/* ---------- slab, board, frame ---------- */
const goldMat = new THREE.MeshStandardMaterial({ color: C('#d9a93c'), roughness: 0.28, metalness: 1.0, envMapIntensity: 1.1 });
const sqMesh = {};
(function () {
  const side = new THREE.MeshStandardMaterial({ color: C('#0b0b0e'), roughness: 0.4, metalness: 0.5 });
  const top = new THREE.MeshStandardMaterial({ map: slabTexture(), color: 0xffffff, roughness: 0.32, metalness: 0.45, envMapIntensity: 0.9 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(13, 1.4, 13), [side, side, top, side, side, side]);
  slab.position.y = -0.82; slab.receiveShadow = true; slab.castShadow = true; scene.add(slab);

  const geo = new THREE.BoxGeometry(0.99, 0.2, 0.99);
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      const dark = (f + r) % 2 === 1;
      const tex = (dark ? darkTex : lightTex)[(f * 3 + r) % 4];
      const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: dark ? 0.3 : 0.42, metalness: dark ? 0.2 : 0.05, envMapIntensity: 0.55 });
      const m = new THREE.Mesh(geo, mat);
      const name = FILES[f] + r;
      m.position.set(f - 3.5, -0.1, 4.5 - r);
      m.receiveShadow = true; m.userData.sq = name;
      scene.add(m); sqMesh[name] = m;
    }
  }
  // gold frame strips around the 8x8
  [[0, -4.11, 8.44, 0.22], [0, 4.11, 8.44, 0.22], [-4.11, 0, 0.22, 8.0], [4.11, 0, 0.22, 8.0]].forEach(([px, pz, w, d]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), goldMat);
    b.position.set(px, -0.02, pz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
  });
})();

function addLabels() {
  const geo = new THREE.PlaneGeometry(0.4, 0.4), cache = {};
  const matFor = ch => cache[ch] || (cache[ch] = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#e8c260'; x.font = '600 38px Spectral, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, 32, 34);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  })());
  const put = (ch, x, z, rot) => {
    const m = new THREE.Mesh(geo, matFor(ch));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, -0.105, z); scene.add(m);
  };
  for (let i = 0; i < 8; i++) {
    const x = i - 3.5, z = 4.5 - (i + 1);
    put(FILES[i], x, 4.5, 0); put(FILES[i], x, -4.5, Math.PI);
    put(String(i + 1), -4.5, z, 0); put(String(i + 1), 4.5, z, Math.PI);
  }
}
Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), sleep(1500)]).then(addLabels, addLabels);
