
/* ---------- cathedral hall ---------- */
(function () {
  // floor
  const floorTex = stoneTex(30, 6, 30, 4, 4, 11, 14, 14);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, roughness: 0.72, metalness: 0.05, envMapIntensity: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor);

  // walls and ceiling
  const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex(38, 12, 50, 10, 6, 21, 10, 3), color: 0xffffff, roughness: 0.9, envMapIntensity: 0.25 });
  const H = 30, wy = FLOOR_Y + H / 2;
  const wall = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat); m.position.set(x, wy, z); scene.add(m); return m; };
  wall(70, 1, 0, -30); wall(70, 1, 0, 40); wall(1, 72, -27, 5); wall(1, 72, 27, 5);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(70, 72), new THREE.MeshStandardMaterial({ color: C('#2b1d12'), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, FLOOR_Y + H, 5); scene.add(ceil);

  // arched windows and door on the back wall
  const arch = (w, h) => {
    const s = new THREE.Shape(), r = w / 2;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h); s.absarc(0, h, r, 0, Math.PI, false); s.lineTo(-r, 0);
    return new THREE.ShapeGeometry(s, 24);
  };
  const winGeo = arch(3.4, 6.5), winMat = new THREE.MeshBasicMaterial({ color: C('#3a5878'), toneMapped: false });
  const winGlow = new THREE.MeshBasicMaterial({ color: C('#7aa4d0'), toneMapped: false, transparent: true, opacity: 0.55 });
  [-21, -14, -7, 7, 14, 21].forEach(x => {
    const w = new THREE.Mesh(winGeo, winMat); w.position.set(x, FLOOR_Y + 5, -29.45); scene.add(w);
    const g = new THREE.Mesh(arch(2.2, 4.6), winGlow); g.position.set(x, FLOOR_Y + 5.6, -29.4); scene.add(g);
  });
  const door = new THREE.Mesh(arch(5, 7), new THREE.MeshStandardMaterial({ color: C('#4a2e19'), roughness: 0.85 }));
  door.position.set(0, FLOOR_Y, -29.44); scene.add(door);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 24), goldMat); ring.position.set(0.9, FLOOR_Y + 3.2, -29.35); scene.add(ring);


  // rose window above the door
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'); x.translate(256, 256);
    const cols = ['#6fa0d8', '#e0b64f', '#c85a4a', '#8fb7e6'];
    x.fillStyle = '#1b2a3c'; x.beginPath(); x.arc(0, 0, 250, 0, 7); x.fill();
    for (let i = 0; i < 16; i++) {
      x.save(); x.rotate((i / 16) * Math.PI * 2);
      x.fillStyle = cols[i % 4]; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 232, -0.18, 0.18); x.closePath(); x.fill();
      x.fillStyle = cols[(i + 2) % 4]; x.beginPath(); x.arc(150, 0, 34, 0, 7); x.fill();
      x.restore();
    }
    x.strokeStyle = '#6b5a45'; x.lineWidth = 9;
    for (let i = 0; i < 16; i++) { x.save(); x.rotate((i / 16) * Math.PI * 2); x.beginPath(); x.moveTo(30, 0); x.lineTo(240, 0); x.stroke(); x.restore(); }
    [240, 120, 30].forEach(r => { x.lineWidth = 12; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: C('#c8d4e4') }));
    m.position.set(0, FLOOR_Y + 14.5, -29.45); scene.add(m);
  })();

  // columns
  const colTex = stoneTex(38, 9, 52, 8, 4, 31, 3, 1);
  const colMat = new THREE.MeshStandardMaterial({ map: colTex, color: 0xffffff, roughness: 0.85, envMapIntensity: 0.3 });
  const shaft = new THREE.CylinderGeometry(1.0, 1.1, 17, 20), base = new THREE.BoxGeometry(2.9, 0.9, 2.9), cap = new THREE.BoxGeometry(3.0, 0.8, 3.0), flare = new THREE.CylinderGeometry(1.7, 1.0, 1.0, 20);
  const addCol = (x, z) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(base, colMat); b.position.y = FLOOR_Y + 0.45; g.add(b);
    const s = new THREE.Mesh(shaft, colMat); s.position.y = FLOOR_Y + 0.9 + 8.5; g.add(s);
    const f = new THREE.Mesh(flare, colMat); f.position.y = FLOOR_Y + 0.9 + 17.5; g.add(f);
    const c = new THREE.Mesh(cap, colMat); c.position.y = FLOOR_Y + 0.9 + 18.4; g.add(c);
    g.position.set(x, 0, z); scene.add(g);
  };
  for (let z = -24; z <= 30; z += 6.5) { addCol(-13, z); addCol(13, z); }

  // braziers: pedestal, iron basket, layered flames, embers
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex(36, 14, 50, 3, 3, 41, 1, 1), color: 0xffffff, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: C('#17130f'), roughness: 0.5, metalness: 0.8 });
  const fireTex = (function () {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d'); x.translate(64, 170); x.scale(1, 1.6);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,248,205,1)'); g.addColorStop(0.25, 'rgba(255,196,70,.92)'); g.addColorStop(0.6, 'rgba(255,104,24,.55)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    x.fillStyle = g; x.fillRect(-64, -120, 128, 256);
    return new THREE.CanvasTexture(c);
  })();
  const embers = [];
  const addBrazier = (bx, bz, seed) => {
    const steps = [[3.4, 0.55], [2.7, 0.55], [2.0, 0.55]];
    let y = FLOOR_Y;
    steps.forEach(([w, h]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), stoneMat); m.position.set(bx, y + h / 2, bz); m.receiveShadow = true; scene.add(m); y += h; });
    const g = new THREE.Group(); g.position.set(bx, y, bz); scene.add(g);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6), iron);
      bar.position.set(Math.cos(a) * 0.78, 0.58, Math.sin(a) * 0.78); g.add(bar);
    }
    [0.02, 1.15].forEach(h => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 8, 28), iron); r.rotation.x = Math.PI / 2; r.position.y = h; g.add(r); });
    const coals = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), new THREE.MeshBasicMaterial({ color: C('#ff6a18').multiplyScalar(2.2), toneMapped: false }));
    coals.scale.y = 0.35; coals.position.y = 0.3; g.add(coals);
    const flames = [];
    [[1.7, 3.0, 0.9, '#ffb347'], [1.3, 2.4, 0.95, '#ff7a1c'], [0.9, 1.9, 1.0, '#fff0b0']].forEach(([w, h, y0, col], i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: C(col).multiplyScalar(1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
      s.scale.set(w, h, 1); s.position.y = y0 + h * 0.2; g.add(s); flames.push({ s, w, h, y0, ph: i * 1.7 + seed });
    });
    const light = new THREE.PointLight(C('#ffa860'), 0.95, 22, 1.9); light.position.set(bx, y + 1.9, bz); scene.add(light);
    const N = 36, pos = new Float32Array(N * 3), st = [];
    for (let i = 0; i < N; i++) { st.push({ a: Math.random() * 6.28, r: Math.random() * 0.6, y: Math.random() * 4, v: 0.5 + Math.random() * 0.9 }); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ep = new THREE.Points(eg, new THREE.PointsMaterial({ map: spriteTex, color: C('#ffb050'), size: 0.12, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    ep.frustumCulled = false; scene.add(ep); embers.push({ ep, st, cx: bx, cy: y + 0.6, cz: bz });
    animators.push((t) => {
      flames.forEach(f => {
        const k = 1 + 0.12 * Math.sin(t * 9 + f.ph) + 0.06 * Math.sin(t * 17 + f.ph * 2);
        f.s.scale.set(f.w * (0.94 + 0.06 * Math.sin(t * 7 + f.ph)), f.h * k, 1); f.s.position.y = f.y0 + f.h * 0.2 * k;
      });
      light.intensity = 0.92 + 0.2 * Math.sin(t * 8 + seed) + 0.1 * Math.sin(t * 21 + seed);
    });
  };
  addBrazier(-8.6, 0.6, 0.3); addBrazier(8.6, 0.6, 2.1);
  animators.push((t, dt) => {
    embers.forEach(e => {
      const p = e.ep.geometry.attributes.position;
      e.st.forEach((s, i) => {
        s.y += s.v * dt; if (s.y > 5) { s.y = 0; s.a = Math.random() * 6.28; }
        p.array[i * 3] = e.cx + Math.cos(s.a + s.y * 0.7) * (s.r + s.y * 0.12);
        p.array[i * 3 + 1] = e.cy + s.y; p.array[i * 3 + 2] = e.cz + Math.sin(s.a + s.y * 0.7) * (s.r + s.y * 0.12);
      });
      p.needsUpdate = true;
    });
  });


  // gothic vault ribs between the column rows
  const topY = FLOOR_Y + 0.9 + 18.8;
  const ribGeo = new THREE.TorusGeometry(13, 0.42, 8, 40, Math.PI);
  for (let z = -24; z <= 30; z += 6.5) {
    const rib = new THREE.Mesh(ribGeo, colMat); rib.scale.y = 0.46; rib.position.set(0, topY, z); scene.add(rib);
  }
  const longRibGeo = new THREE.BoxGeometry(0.7, 0.7, 76);
  [-13, 13].forEach(x => { const lr = new THREE.Mesh(longRibGeo, colMat); lr.position.set(x, topY + 0.3, 5); scene.add(lr); });

  // light shafts through the back windows
  const shaftTex = (function () {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,240,205,.9)'); g.addColorStop(0.55, 'rgba(255,240,205,.25)'); g.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const hg = x.createLinearGradient(0, 0, 64, 0); hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = hg; x.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c);
  })();
  const shaftMats = [];
  [-21, -14, -7, 7, 14, 21].forEach((wx, i) => {
    const grp = new THREE.Group(); grp.position.set(wx, FLOOR_Y + 6.2, -28.6); grp.rotation.x = 0.61 - Math.PI / 2;
    const mat = new THREE.MeshBasicMaterial({ map: shaftTex, color: C('#cfe0ff'), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
    shaftMats.push(mat);
    [0, Math.PI / 2].forEach(r => { const g2 = new THREE.PlaneGeometry(3.2, 40); g2.translate(0, -20, 0); const m = new THREE.Mesh(g2, mat); m.rotation.y = r; grp.add(m); });
    scene.add(grp);
  });
  animators.push((t) => shaftMats.forEach((m, i) => { m.opacity = 0.1 + 0.03 * Math.sin(t * 0.7 + i * 1.3); }));

  // wall torches on the columns (glow only, no extra lights)
  [-17.5, -4.5, 8.5, 21.5].forEach((tz, ti) => [-1, 1].forEach((sd, si) => {
    const tx = sd * 11.7, seedT = ti * 2 + si;
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), iron); br.position.set(tx, 2.6, tz); scene.add(br);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.14, 0.34, 10), iron); cup.position.set(tx, 3.15, tz); scene.add(cup);
    const spr = [];
    [[0.9, 1.7, '#ffb347'], [0.6, 1.2, '#fff0b0']].forEach(([w, hh, col], k) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: C(col).multiplyScalar(1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
      s.scale.set(w, hh, 1); s.position.set(tx, 3.7 + hh * 0.2, tz); scene.add(s); spr.push({ s, w, hh, ph: seedT + k });
    });
    animators.push((t) => spr.forEach(f => { const k = 1 + 0.14 * Math.sin(t * 10 + f.ph) + 0.06 * Math.sin(t * 19 + f.ph); f.s.scale.set(f.w * (0.94 + 0.06 * Math.sin(t * 8 + f.ph)), f.hh * k, 1); }));
  }));

  // glowing orbs at the slab corners
  [[-5.55, -5.55], [5.55, -5.55], [-5.55, 5.55], [5.55, 5.55]].forEach(([ox, oz], i) => {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), new THREE.MeshBasicMaterial({ color: C('#e8f3ff').multiplyScalar(1.5), toneMapped: false }));
    orb.position.set(ox, 0.3, oz); scene.add(orb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex, color: C('#a8d0ff').multiplyScalar(0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
    glow.scale.set(0.9, 0.9, 1); glow.position.copy(orb.position); scene.add(glow);
    animators.push((t) => { const k = 1 + 0.15 * Math.sin(t * 2.4 + i * 1.7); glow.scale.set(0.9 * k, 0.9 * k, 1); });
  });

  // drifting dust in the light
  const MOTES = 150, mp = new Float32Array(MOTES * 3), ms = [];
  for (let i = 0; i < MOTES; i++) { mp[i * 3] = (Math.random() - 0.5) * 26; mp[i * 3 + 1] = Math.random() * 9 - 1; mp[i * 3 + 2] = (Math.random() - 0.5) * 26; ms.push(Math.random() * 6.28); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  scene.add(new THREE.Points(mg, new THREE.PointsMaterial({ map: spriteTex, color: C('#ffd9a0'), size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  animators.push((t, dt) => {
    const p = mg.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      p.array[i * 3] += Math.sin(t * 0.3 + ms[i]) * dt * 0.12;
      p.array[i * 3 + 1] += dt * 0.1; if (p.array[i * 3 + 1] > 8) p.array[i * 3 + 1] = -1;
    }
    p.needsUpdate = true;
  });
})();
