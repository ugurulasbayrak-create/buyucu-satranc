
/* ---------- tweens and particles ---------- */
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = t => t * t * t;
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const tweens = [];
function tween(ms, fn, ease, delay) {
  return new Promise(res => { tweens.push({ t: -(delay || 0), ms: reduced ? Math.min(ms, 120) : ms, fn, ease: ease || (k => k), res }); });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt * 1000;
    if (w.t < 0) continue;
    const k = Math.min(1, w.t / w.ms);
    w.fn(w.ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); w.res(); }
  }
}

const bursts = [];
function burst(x, y, z, hex, n, speed, size) {
  n = n || 28; speed = speed || 1.6; size = size || 0.16;
  if (reduced) n = Math.ceil(n / 4);
  const pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 2 * speed, Math.random() * speed * 1.3 + 0.3, (Math.random() - 0.5) * 2 * speed));
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: spriteTex, color: C(hex), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  bursts.push({ pts, vel, life: 0, max: 1.0 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.life += dt;
    const p = b.pts.geometry.attributes.position;
    for (let k = 0; k < b.vel.length; k++) {
      const v = b.vel[k]; v.y -= 2.6 * dt;
      p.array[k * 3] += v.x * dt; p.array[k * 3 + 1] = Math.max(0.02, p.array[k * 3 + 1] + v.y * dt); p.array[k * 3 + 2] += v.z * dt;
    }
    p.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.life / b.max);
    if (b.life >= b.max) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
  }
}
function shockwave(x, z, hex) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.17, 40), new THREE.MeshBasicMaterial({ color: C(hex), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m);
  tween(700, e => { m.scale.setScalar(1 + e * 5); m.material.opacity = 0.85 * (1 - e); }, k => k).then(() => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}

const debris = [];
const debrisGeo = new THREE.DodecahedronGeometry(0.1, 0);
function rubble(x, z, color) {
  const mat = new THREE.MeshStandardMaterial({ color: C(color === 'w' ? '#f2ead8' : '#1a1a20'), roughness: 0.6, metalness: color === 'w' ? 0.05 : 0.4 });
  const n = reduced ? 6 : 30;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(debrisGeo, mat); m.castShadow = true;
    m.position.set(x + (Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.7, z + (Math.random() - 0.5) * 0.3);
    const s = 0.8 + Math.random() * 1.9; m.scale.setScalar(s);
    scene.add(m);
    debris.push({ m, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 3.5, vz: (Math.random() - 0.5) * 5, rx: Math.random() * 6, rz: Math.random() * 6, life: 0, max: 3.2 + Math.random() * 1.2, s });
  }
}
animators.push((t, dt) => {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life += dt; d.vy -= 9 * dt;
    d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
    if (d.m.position.y < 0.08) { d.m.position.y = 0.08; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; }
    d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
    const fade = Math.max(0, Math.min(1, (d.max - d.life) / 0.8));
    d.m.scale.setScalar(d.s * fade);
    if (d.life >= d.max) { scene.remove(d.m); debris.splice(i, 1); }
  }
});
