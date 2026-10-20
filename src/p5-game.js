
/* ---------- game state ---------- */
let game = new Chess();
let playerColor = 'w', pendingSide = 'w', level = 2;
let busy = false, animating = false, gameOver = false, epoch = 0;
let selected = null, legal = [], lastMove = null, checkSq = null, selectedGroup = null;
const pieces = new Map();
let time = 0;

const markerGroup = new THREE.Group(), hintGroup = new THREE.Group();
scene.add(markerGroup); scene.add(hintGroup);
const mk = {
  dot: new THREE.MeshBasicMaterial({ color: C('#7fd6ff'), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
  cap: new THREE.MeshBasicMaterial({ color: C('#ff7a45'), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  sel: new THREE.MeshBasicMaterial({ color: C('#e3bb62'), transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  hint: new THREE.MeshBasicMaterial({ color: C('#bcd8d2'), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
};
const mkGeo = {
  dot: new THREE.CircleGeometry(0.17, 28).rotateX(-Math.PI / 2),
  ring: new THREE.RingGeometry(0.34, 0.46, 36).rotateX(-Math.PI / 2),
  sel: new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2)
};
function addMarker(group, kind, sq) {
  const p = sqPos(sq);
  const m = new THREE.Mesh(kind === 'move' ? mkGeo.dot : kind === 'sel' ? mkGeo.sel : mkGeo.ring, kind === 'move' ? mk.dot : kind === 'sel' ? mk.sel : kind === 'capture' ? mk.cap : mk.hint);
  m.position.set(p.x, 0.016, p.z); m.renderOrder = 2; m.userData.ph = Math.random() * 6; m.userData.kind = kind;
  group.add(m);
}
function clearGroup(g) { while (g.children.length) g.remove(g.children[0]); }
function clearHint() { clearGroup(hintGroup); }
function clearSelection() {
  if (selectedGroup) selectedGroup.position.y = 0;
  selectedGroup = null; selected = null; legal = []; clearGroup(markerGroup);
}
function select(sq) {
  clearSelection(); clearHint();
  selected = sq; legal = game.moves({ square: sq, verbose: true });
  selectedGroup = pieces.get(sq) || null;
  addMarker(markerGroup, 'sel', sq);
  legal.forEach(m => addMarker(markerGroup, m.captured ? 'capture' : 'move', m.to));
  sfx.select();
}
function paintSquares() {
  Object.values(sqMesh).forEach(m => m.material.emissive.setHex(0x000000));
  if (lastMove) [lastMove.from, lastMove.to].forEach(s => sqMesh[s].material.emissive.copy(C('#4d3d12')));
}
function findKing(color) {
  const b = boardOf(game);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = b[r][c]; if (p && p.type === 'k' && p.color === color) return FILES[c] + (8 - r); }
  return null;
}

function placeAll(intro) {
  pieces.forEach(g => scene.remove(g)); pieces.clear();
  const b = boardOf(game); let n = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (!p) continue;
      const sq = FILES[c] + (8 - r), pos = sqPos(sq);
      const g = buildPiece(p.type, p.color);
      g.position.set(pos.x, 0, pos.z); g.userData.sq = sq;
      scene.add(g); pieces.set(sq, g);
      if (intro) {
        g.scale.setScalar(0.001);
        tween(520, e => { g.scale.setScalar(Math.max(0.001, e)); g.position.y = (1 - e) * 0.8; }, easeOutBack, n * 22);
        n++;
      }
    }
  }
}

/* ---------- move animation ---------- */
function dissolve(g) {
  const col = SIDE[g.userData.color].hex, p = g.position;
  burst(p.x, 0.5, p.z, col, 64, 3.2, 0.26);
  burst(p.x, 0.4, p.z, '#ffd98a', 40, 2.2, 0.18);
  shockwave(p.x, p.z, col);
  setTimeout(() => shockwave(p.x, p.z, '#ffd98a'), 140);
  sfx.capture(); rubble(p.x, p.z, g.userData.color);
  const r0 = g.rotation.y;
  return tween(300, (e, k) => {
    g.scale.set(1 + 0.18 * Math.sin(k * 3.14), Math.max(0.001, 1 - e * e * 0.95), 1 + 0.18 * Math.sin(k * 3.14));
    g.rotation.y = r0 + e * 1.2; g.position.y = e * 0.25;
  }, k => k).then(() => scene.remove(g));
}
async function animateMove(mv) {
  animating = true;
  const grp = pieces.get(mv.from), to = sqPos(mv.to), from = sqPos(mv.from);
  pieces.delete(mv.from);
  let capGrp = null;
  const capSq = mv.flags.includes('e') ? mv.to[0] + mv.from[1] : (mv.captured ? mv.to : null);
  if (capSq) { capGrp = pieces.get(capSq); pieces.delete(capSq); }
  let rookGrp = null, rf = null, rt = null;
  if (mv.flags.includes('k') || mv.flags.includes('q')) {
    const rk = mv.from[1], ks = mv.flags.includes('k');
    rf = sqPos((ks ? 'h' : 'a') + rk); rt = sqPos((ks ? 'f' : 'd') + rk);
    const rfSq = (ks ? 'h' : 'a') + rk, rtSq = (ks ? 'f' : 'd') + rk;
    rookGrp = pieces.get(rfSq); pieces.delete(rfSq);
    if (rookGrp) { pieces.set(rtSq, rookGrp); rookGrp.userData.sq = rtSq; }
  }
  pieces.set(mv.to, grp); grp.userData.sq = mv.to;
  const h = capSq ? 1.7 : (mv.piece === 'n' ? 1.15 : 0.7);
  const dur = clamp(380 + Math.hypot(to.x - from.x, to.z - from.z) * 95, 450, 1000) + (capSq ? 260 : 0);
  follow.goal = 1;
  const jobs = [tween(dur, (e, k) => {
    follow.x = grp.position.x; follow.z = grp.position.z;
    grp.position.x = lerp(from.x, to.x, e); grp.position.z = lerp(from.z, to.z, e); grp.position.y = Math.sin(Math.PI * k) * h;
  }, easeInOut)];
  if (rookGrp) jobs.push(tween(dur, (e, k) => {
    rookGrp.position.x = lerp(rf.x, rt.x, e); rookGrp.position.z = lerp(rf.z, rt.z, e); rookGrp.position.y = Math.sin(Math.PI * k) * 0.45;
  }, easeInOut));
  await Promise.all(jobs);
  follow.goal = 0;
  grp.position.set(to.x, 0, to.z);
  burst(to.x, 0.08, to.z, SIDE[mv.color].hex, 14, 1.0, 0.13);
  if (capGrp) { impactCam(mv.to, 1); await dissolve(capGrp); } else if (mv.flags.includes('k') || mv.flags.includes('q')) sfx.castle(); else sfx.move();
  if (mv.promotion) {
    const ng = buildPiece(mv.promotion, mv.color);
    ng.position.set(to.x, 0, to.z); ng.userData.sq = mv.to; ng.scale.setScalar(0.01);
    scene.remove(grp); scene.add(ng); pieces.set(mv.to, ng);
    burst(to.x, 0.9, to.z, SIDE[mv.color].hex, 46, 2.0, 0.2); sfx.promote(); fx.flash = 0.3;
    await tween(450, e => ng.scale.setScalar(Math.max(0.01, e)), easeOutBack);
  }
  animating = false;
}

