
/* ---------- pieces: robed wizard statues in ivory and black, gilded with gold leaf ---------- */
// gold leaf: flaky metallic texture used as colour and bump
const leafTex = (function () {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d'), rnd = rngOf(77);
  x.fillStyle = '#d6a737'; x.fillRect(0, 0, 256, 256);
  const tones = ['#f3cf66', '#c9962a', '#e4b744', '#b8841f', '#f7da7d', '#d9ac3b'];
  for (let i = 0; i < 900; i++) {
    x.globalAlpha = 0.12 + rnd() * 0.25; x.fillStyle = tones[Math.floor(rnd() * tones.length)];
    const w = 14 + rnd() * 40, h = 8 + rnd() * 26;
    x.save(); x.translate(rnd() * 256, rnd() * 256); x.rotate(rnd() * 3.14); x.fillRect(-w / 2, -h / 2, w, h); x.restore();
  }
  x.globalAlpha = 0.18; x.strokeStyle = '#7a5410'; x.lineWidth = 0.7;
  for (let i = 0; i < 120; i++) { x.beginPath(); const px = rnd() * 256, py = rnd() * 256; x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 30, py + (rnd() - 0.5) * 30); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, bumpMap: leafTex, bumpScale: 0.08, color: 0xffffff, roughness: 0.2, metalness: 1.0, envMapIntensity: 1.5 });

const SIDE = {
  w: {
    body: new THREE.MeshPhysicalMaterial({ color: C('#d9cfb8'), roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.75 }),
    trim: leafMat,
    glow: new THREE.MeshStandardMaterial({ color: C('#d8f6ff'), emissive: C('#3fc8ff'), emissiveIntensity: 1.0, roughness: 0.5 }),
    hex: '#7fd6ff'
  },
  b: {
    body: new THREE.MeshPhysicalMaterial({ color: C('#111116'), roughness: 0.24, metalness: 0.55, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.3 }),
    trim: leafMat,
    glow: new THREE.MeshStandardMaterial({ color: C('#e9dcff'), emissive: C('#9455ff'), emissiveIntensity: 1.2, roughness: 0.5 }),
    hex: '#b58cff'
  }
};

// robe: lathe profile with vertical pleats
function robe(pts, n, amp) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), n * 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), k = 1 + amp * Math.sin(Math.atan2(z, x) * n);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function mergeGeos(list) {
  const P = [], N = [], U = [];
  list.forEach(g0 => { const g = g0.index ? g0.toNonIndexed() : g0; P.push(g.attributes.position.array); N.push(g.attributes.normal.array); U.push(g.attributes.uv ? g.attributes.uv.array : new Float32Array((g.attributes.position.count) * 2)); });
  const cat = arrs => { let n = 0; arrs.forEach(a => n += a.length); const out = new Float32Array(n); let o = 0; arrs.forEach(a => { out.set(a, o); o += a.length; }); return out; };
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(cat(P), 3));
  m.setAttribute('normal', new THREE.BufferAttribute(cat(N), 3));
  m.setAttribute('uv', new THREE.BufferAttribute(cat(U), 2));
  return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

function knightHeadGeo() {
  const pts = [[-0.27,0.2],[-0.31,0.6],[-0.25,1.0],[-0.15,1.28],[-0.06,1.5],[0.0,1.33],[0.09,1.48],[0.15,1.27],[0.33,1.0],[0.46,0.85],[0.49,0.72],[0.41,0.65],[0.27,0.74],[0.14,0.69],[0.1,0.5],[0.22,0.3],[0.3,0.2],[-0.27,0.2]].map(q => new THREE.Vector2(q[0], q[1]));
  const s = new THREE.Shape(new THREE.SplineCurve(pts).getPoints(90));
  const e = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.075, bevelSegments: 6, curveSegments: 4 });
  e.translate(0, 0, -0.1); e.computeVertexNormals();
  return e;
}

// returns { body, trim, glow } = merged geometries (colour independent except knight facing)
function designPiece(type, color) {
  const parts = { body: [], trim: [], glow: [] };
  const put = (role, geom, x, y, z, rx, ry, rz, sx, sy, sz) => {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _v.set(x || 0, y || 0, z || 0); _s.set(sx || 1, sy || 1, sz || 1);
    _m4.compose(_v, _q, _s); parts[role].push(geom.applyMatrix4(_m4));
  };
  const ring = (r, tube, y, role) => put(role || 'trim', new THREE.TorusGeometry(r, tube, 8, 40), 0, y, 0, Math.PI / 2, 0, 0);
  const ball = (r, role, x, y, z, sx, sy, sz) => put(role, new THREE.SphereGeometry(r, 16, 12), x, y, z, 0, 0, 0, sx, sy, sz);
  const L = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 36);
  // plinth shared by all
  put('body', L([[0,0],[.42,0],[.44,.04],[.42,.1],[.35,.15],[0,.15]]), 0, 0, 0);
  ring(0.4, 0.035, 0.1);
  const shoulders = (x, y, r) => [-1, 1].forEach(sd => { ball(r, 'body', sd * x, y, 0); ball(r * 0.5, 'trim', sd * x, y + r * 0.7, 0); });
  const staff = (x, h, topRole, withRing) => {
    put('trim', new THREE.CylinderGeometry(0.02, 0.025, h, 8), x, 0.15 + h / 2, 0.05, 0, 0, -0.05);
    if (withRing) put('trim', new THREE.TorusGeometry(0.12, 0.024, 8, 28), x - 0.006, 0.15 + h + 0.08, 0.05, 0, 0, 0);
    else ball(0.055, topRole || 'glow', x - 0.003, 0.15 + h + 0.04, 0.05);
  };

  switch (type) {
    case 'p': {
      put('body', robe([[0,.15],[.34,.15],[.31,.3],[.25,.5],[.2,.64],[0,.64]], 12, 0.03), 0, 0, 0);
      ring(0.33, 0.032, 0.2); ring(0.235, 0.03, 0.5);
      shoulders(0.21, 0.6, 0.09);
      ball(0.17, 'body', 0, 0.78, 0);
      ball(0.2, 'body', 0, 0.86, 0, 1, 0.78, 1); ring(0.185, 0.026, 0.8);
      ball(0.04, 'trim', 0, 1.02, 0);
      staff(0.31, 0.78, 'trim');
      break;
    }
    case 'r': {
      put('body', robe([[0,.15],[.4,.15],[.36,.3],[.32,.42],[.31,1.0],[.37,1.05],[.38,1.22],[0,1.22]], 16, 0.022), 0, 0, 0);
      ring(0.35, 0.036, 0.36); ring(0.315, 0.03, 0.78); ring(0.385, 0.04, 1.1);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; put('trim', new THREE.BoxGeometry(0.1, 0.28, 0.05), Math.sin(a) * 0.335, 0.58, Math.cos(a) * 0.335, 0, a, 0); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; put('trim', new THREE.BoxGeometry(0.08, 0.2, 0.05), Math.sin(a) * 0.36, 0.92, Math.cos(a) * 0.36, 0, a, 0); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; put('body', new THREE.BoxGeometry(0.14, 0.2, 0.1), Math.sin(a) * 0.335, 1.31, Math.cos(a) * 0.335, 0, a, 0); }
      ball(0.24, 'trim', 0, 1.22, 0, 1, 0.6, 1);
      ball(0.045, 'glow', 0, 1.4, 0);
      break;
    }
    case 'n': {
      put('body', robe([[0,.15],[.38,.15],[.33,.4],[.27,.7],[0,.7]], 12, 0.03), 0, 0, 0);
      ring(0.35, 0.032, 0.21); ring(0.27, 0.03, 0.62);
      shoulders(0.23, 0.68, 0.1);
      const ry = color === 'w' ? Math.PI / 4 : -Math.PI * 3 / 4;
      const hs = 0.74, hy = 0.42;
      const hp = (lx, ly, lz) => [lx * Math.cos(ry) + lz * Math.sin(ry), hy + ly * hs, -lx * Math.sin(ry) + lz * Math.cos(ry)];
      put('body', knightHeadGeo(), 0, hy, 0, 0, ry, 0, hs, hs, hs);
      for (let i = 0; i < 7; i++) { const f = i / 6, q = hp(-0.34 + f * 0.2, 0.55 + f * 0.82, 0); put('trim', new THREE.ConeGeometry(0.05, 0.2, 6), q[0], q[1], q[2], 0, ry, 0.7 - f * 0.25, hs, hs, hs); }
      [-1, 1].forEach(sd => { const e = hp(0.21, 1.0, sd * 0.2); ball(0.03, 'glow', e[0], e[1], e[2]); const c = hp(0.2, 0.86, sd * 0.2); ball(0.045, 'trim', c[0], c[1], c[2]); const n2 = hp(0.47, 0.72, sd * 0.1); ball(0.02, 'glow', n2[0], n2[1], n2[2]); });
      { const q = hp(0.3, 0.8, 0); put('trim', new THREE.TorusGeometry(0.1, 0.016, 6, 18), q[0], q[1], q[2], 0, ry + Math.PI / 2, 0, hs, hs, hs); }
      break;
    }
    case 'b': {
      put('body', robe([[0,.15],[.36,.15],[.31,.4],[.24,.7],[.2,.86],[0,.86]], 12, 0.028), 0, 0, 0);
      ring(0.34, 0.032, 0.2); ring(0.255, 0.03, 0.52); ring(0.21, 0.026, 0.82);
      shoulders(0.21, 0.76, 0.085);
      ball(0.16, 'body', 0, 1.0, 0);
      put('body', new THREE.ConeGeometry(0.21, 0.66, 28), 0, 1.45, 0);
      ring(0.175, 0.024, 1.14);
      put('trim', new THREE.BoxGeometry(0.035, 0.42, 0.02), 0, 1.4, 0.175, -0.3, 0, 0);
      ball(0.055, 'glow', 0, 1.8, 0);
      staff(-0.33, 1.3, 'glow');
      break;
    }
    case 'q': {
      put('body', robe([[0,.15],[.42,.15],[.36,.45],[.27,.85],[.25,1.06],[0,1.06]], 14, 0.03), 0, 0, 0);
      ring(0.4, 0.036, 0.21); ring(0.3, 0.032, 0.62); ring(0.255, 0.03, 1.03);
      shoulders(0.27, 0.95, 0.105);
      ball(0.165, 'body', 0, 1.2, 0);
      put('trim', L([[0.2,1.3],[0.235,1.3],[0.25,1.42],[0.215,1.42]]), 0, 0, 0);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; put('trim', new THREE.ConeGeometry(0.04, 0.3, 8), Math.sin(a) * 0.235, 1.56, Math.cos(a) * 0.235, Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); }
      for (let i = 0; i < 10; i++) { const a = ((i + 0.5) / 10) * Math.PI * 2; ball(0.028, 'glow', Math.sin(a) * 0.23, 1.38, Math.cos(a) * 0.23); }
      staff(0.4, 1.35, null, true);
      break;
    }
    case 'k': {
      put('body', robe([[0,.15],[.44,.15],[.38,.5],[.29,.95],[.27,1.2],[0,1.2]], 14, 0.03), 0, 0, 0);
      ring(0.42, 0.038, 0.22); ring(0.32, 0.034, 0.66); ring(0.275, 0.03, 1.17);
      put('trim', new THREE.BoxGeometry(0.07, 0.4, 0.035), 0, 0.82, 0.335);
      shoulders(0.29, 1.1, 0.11);
      ball(0.17, 'body', 0, 1.36, 0);
      put('trim', L([[0.2,1.46],[0.245,1.46],[0.26,1.6],[0.22,1.6]]), 0, 0, 0);
      put('trim', new THREE.TorusGeometry(0.215, 0.022, 8, 24, Math.PI), 0, 1.58, 0, 0, 0, 0, 1, 0.8, 1);
      put('trim', new THREE.TorusGeometry(0.215, 0.022, 8, 24, Math.PI), 0, 1.58, 0, 0, Math.PI / 2, 0, 1, 0.8, 1);
      put('glow', new THREE.BoxGeometry(0.07, 0.34, 0.07), 0, 1.98, 0);
      put('glow', new THREE.BoxGeometry(0.24, 0.07, 0.07), 0, 2.04, 0);
      ball(0.04, 'glow', 0, 1.76, 0);
      break;
    }
  }
  const out = {};
  ['body', 'trim', 'glow'].forEach(r => { if (parts[r].length) out[r] = mergeGeos(parts[r]); });
  return out;
}

const pieceCache = {};
function buildPiece(type, color) {
  const key = type + color;
  const geos = pieceCache[key] || (pieceCache[key] = designPiece(type, color));
  const S = SIDE[color];
  const outer = new THREE.Group(), g = new THREE.Group(), anim = [];
  ['body', 'trim', 'glow'].forEach(r => {
    if (!geos[r]) return;
    const m = new THREE.Mesh(geos[r], S[r]); m.castShadow = true; m.receiveShadow = true; g.add(m);
  });
  if (type === 'q') {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), S.glow); orb.position.y = 1.78; g.add(orb);
    anim.push(t => { orb.position.y = 1.78 + Math.sin(t * 2.2) * 0.05; });
  }
  if (type === 'k') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 8, 56), S.glow); halo.position.y = 2.3; halo.rotation.x = Math.PI / 2 + 0.35; g.add(halo);
    anim.push(t => { halo.rotation.y = Math.sin(t * 0.9) * 0.5; halo.position.y = 2.3 + Math.sin(t * 1.6) * 0.03; });
  }
  g.scale.setScalar(1.2);
  outer.add(g);
  outer.userData = { type, color, anim, sq: null };
  return outer;
}
