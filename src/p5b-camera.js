
/* ---------- camera: presets, spring motion, orbit, pan, fly, cinematic effects ---------- */
let fitRadius = 14, camMode = 'player', autoOrbit = false, timeScale = 1, slowUntil = 0, freezeUntil = 0, shake = 0;
const camV = { theta: 0, phi: 0, radius: 0, fov: 0 }, camTV = new THREE.Vector3();
const follow = { x: 0, z: 0, w: 0, goal: 0 };
let fovGoal = 46; cam.fov = 46;
const baseTheta = () => (playerColor === 'w' ? 0 : Math.PI);
function nearestTheta(t) { return t + Math.round((camT.theta - t) / (Math.PI * 2)) * Math.PI * 2; }

function setCam(mode) {
  camMode = mode; autoOrbit = false;
  const b = baseTheta(), pt = camera.aspect < 0.85;
  const P = {
    player: pt ? { th: b, ph: 0.62, r: fitRadius * 0.98, tg: [0, 0.2, 0.3], fov: 46 } : { th: b, ph: 1.0, r: fitRadius, tg: [0, 0.5, 0.5], fov: 46 },
    top:    { th: b, ph: 0.14, r: fitRadius * 0.95, tg: [0, 0, 0], fov: 40 },
    side:   { th: b + Math.PI / 2, ph: 1.3, r: fitRadius * 0.92, tg: [0, 0.6, 0], fov: 44 },
    hall:   { th: b + 0.5, ph: 1.24, r: 27, tg: [0, 3.4, 0], fov: 58 }
  }[mode];
  camT.theta = nearestTheta(P.th); camT.phi = P.ph; camT.radius = P.r; camTargetT.set(P.tg[0], P.tg[1], P.tg[2]); fovGoal = P.fov;
  document.querySelectorAll('[data-cam]').forEach(b2 => b2.setAttribute('aria-pressed', String(b2.dataset.cam === mode)));
}
const resetCamera = () => setCam(camMode === 'hall' ? 'hall' : 'player');
function introFly() {
  camMode = 'player';
  const b = baseTheta();
  cam.theta = b + 1.1; cam.phi = 1.32; cam.radius = 36; cam.fov = 62; camTarget.set(0, 4, 0);
  camV.theta = camV.phi = camV.radius = camV.fov = 0; camTV.set(0, 0, 0);
  camT.theta = cam.theta; camT.phi = cam.phi; camT.radius = cam.radius; camTargetT.copy(camTarget);
  setTimeout(() => setCam('player'), 250);
}

// Critically damped spring (smooth damp): stable, no overshoot, frame-rate independent.
function damp(cur, goal, vel, key, smooth, dt) {
  const w = 2 / smooth, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - goal, tmp = (vel[key] + w * ch) * dt;
  vel[key] = (vel[key] - w * tmp) * e;
  return goal + (ch + tmp) * e;
}
function updateCamera(dt, now) {
  if (autoOrbit && !ptrs.size) camT.theta += dt * 0.16;
  const sm = 0.42;
  cam.theta = damp(cam.theta, camT.theta, camV, 'theta', sm, dt);
  cam.phi = damp(cam.phi, camT.phi, camV, 'phi', sm, dt);
  cam.radius = damp(cam.radius, camT.radius, camV, 'radius', sm * 1.1, dt);
  cam.fov = damp(cam.fov, fovGoal, camV, 'fov', 0.5, dt);
  ['x', 'y', 'z'].forEach(a => { const v = { k: camTV[a] }; camTarget[a] = damp(camTarget[a], camTargetT[a], v, 'k', sm, dt); camTV[a] = v.k; });
  follow.w += (follow.goal - follow.w) * (1 - Math.exp(-dt * 3.5));
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  // slow motion returns to normal speed after an impact
  if (now < freezeUntil) timeScale = 0.03;
  else if (now < slowUntil) timeScale = 0.24;
  else timeScale += (1 - timeScale) * (1 - Math.exp(-dt * 3));
  shake *= Math.exp(-dt * 6);
  placeCamera(now / 1000);
}
// replaces the simple placeCamera: adds follow, idle breathing and shake
function placeCamera(t) {
  const idle = ptrs.size || autoOrbit ? 0 : 1, tt = t || 0;
  const th = cam.theta + Math.sin(tt * 0.31) * 0.012 * idle, ph = cam.phi + Math.sin(tt * 0.23) * 0.006 * idle;
  const tx = camTarget.x + (follow.x - camTarget.x) * follow.w * 0.45, tz = camTarget.z + (follow.z - camTarget.z) * follow.w * 0.45;
  const s = Math.sin(ph);
  camera.position.set(tx + cam.radius * s * Math.sin(th), camTarget.y + cam.radius * Math.cos(ph), tz + cam.radius * s * Math.cos(th));
  if (shake > 0.002) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
  camera.lookAt(tx, camTarget.y, tz);
}

/* cinematic effects ---------------------------------------------------- */
let camReturn = null;
function impactCam(sq, strength) {
  if (reduced) return;
  const now = performance.now();
  fx.aberr = 0.022 * strength; fx.flash = 0.5 * strength; shake = 0.5 * strength;
  freezeUntil = now + 120; slowUntil = now + 1150; timeScale = 0.03;
  if (camMode === 'top' || ptrs.size) return;
  const p = sqPos(sq), sv = { r: camT.radius, ph: camT.phi, th: camT.theta, x: camTargetT.x, y: camTargetT.y, z: camTargetT.z, fov: fovGoal };
  camTargetT.set(p.x, 0.55, p.z);
  camT.radius = Math.max(6.2, sv.r * 0.46); camT.phi = clamp(sv.ph - 0.18, 0.6, 1.0); camT.theta = sv.th + 0.5; fovGoal = sv.fov - 12;
  clearTimeout(camReturn);
  camReturn = setTimeout(() => {
    if (ptrs.size) return;
    camT.radius = sv.r; camT.phi = sv.ph; camT.theta = sv.th; camTargetT.set(sv.x, sv.y, sv.z); fovGoal = sv.fov;
  }, 2300);
}
function checkCam() { if (reduced) return; shake = Math.max(shake, 0.12); fx.redPulse = 1; fx.aberr = Math.max(fx.aberr, 0.006); }
function followPiece(g, on) { if (on) { follow.x = g.position.x; follow.z = g.position.z; follow.goal = 1; } else follow.goal = 0; }

/* input ---------------------------------------------------------------- */
const ptrs = new Map();
let moved = 0, pinch0 = 0, rad0 = 0;
dom.addEventListener('contextmenu', e => e.preventDefault());
dom.addEventListener('pointerdown', e => {
  try { dom.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button });
  autoOrbit = false;
  if (ptrs.size === 1) moved = 0;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); rad0 = camT.radius; moved = 99; }
  ensureAudio();
});
dom.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') hover(e); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved <= 6) return;
    if (p.btn === 2 || p.btn === 1 || e.shiftKey) panBy(dx, dy, camT.radius * 0.0016);
    else { camT.theta -= dx * 0.0065; camT.phi = clamp(camT.phi - dy * 0.0055, 0.1, 1.5); setPressed(); }
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 > 0 && d > 0) camT.radius = clamp(rad0 * pinch0 / d, 6, 40);
  }
});
function panBy(dx, dy, k) {
  const s = Math.sin(camT.theta), c = Math.cos(camT.theta);
  camTargetT.x = clamp(camTargetT.x - c * dx * k - s * dy * k, -30, 30);
  camTargetT.z = clamp(camTargetT.z + s * dx * k - c * dy * k, -30, 30);
  setPressed();
}
function setPressed() { document.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', 'false')); }
const endPtr = (e, tap) => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (tap && p && p.btn === 0 && ptrs.size === 0 && moved <= 6) onTap(e);
};
dom.addEventListener('pointerup', e => endPtr(e, true));
dom.addEventListener('pointercancel', e => endPtr(e, false));
dom.addEventListener('wheel', e => { e.preventDefault(); autoOrbit = false; camT.radius = clamp(camT.radius * Math.exp(e.deltaY * 0.001), 6, 40); }, { passive: false });

const keys = new Set();
window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
  const k = e.key.toLowerCase();
  if ('wasdrf'.includes(k) && k.length === 1) { keys.add(k); autoOrbit = false; e.preventDefault(); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
animators.push((t, dt) => {
  if (!keys.size) return;
  const sp = camT.radius * 0.7 * dt, s = Math.sin(camT.theta), c = Math.cos(camT.theta);
  let fx2 = 0, fz = 0, up = 0;
  if (keys.has('w')) { fx2 -= s; fz -= c; } if (keys.has('s')) { fx2 += s; fz += c; }
  if (keys.has('a')) { fx2 -= c; fz += s; } if (keys.has('d')) { fx2 += c; fz -= s; }
  if (keys.has('r')) up += 1; if (keys.has('f')) up -= 1;
  camTargetT.x = clamp(camTargetT.x + fx2 * sp, -30, 30); camTargetT.z = clamp(camTargetT.z + fz * sp, -30, 30);
  camTargetT.y = clamp(camTargetT.y + up * sp, -1, 14);
  setPressed();
});

function hover(e) {
  if (busy || gameOver) { dom.style.cursor = 'grab'; return; }
  const sq = pick(e), p = sq && game.get(sq);
  const ok = sq && ((p && p.color === playerColor) || legal.some(m => m.to === sq));
  dom.style.cursor = ok ? 'pointer' : 'grab';
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(ev) {
  const r = dom.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...pieces.values(), ...Object.values(sqMesh)], true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.sq && o.parent) o = o.parent;
    if (o && o.userData.sq) return o.userData.sq;
  }
  return null;
}
new ResizeObserver(() => {
  const w = Math.max(10, stageEl.clientWidth), h = Math.max(10, stageEl.clientHeight);
  renderer.setSize(w, h, false); resizePost(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  fitRadius = clamp(Math.max(10.6, 11.6 / camera.aspect), 10.6, 30);
  if (camMode !== 'hall') setCam(camMode);
}).observe(stageEl);
