
/* ---------- UI ---------- */
const chip = $('chip'), chipText = $('chipText');
const GL = { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' };
const PV = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const TR = { K: 'Ş', Q: 'V', R: 'K', B: 'F', N: 'A' };
const trSAN = s => s.replace(/[KQRBN]/g, m => TR[m]);
function setStatus(text, mood) { chipText.textContent = text; chip.dataset.mood = mood || 'you'; $('sideTag').textContent = online.active ? 'vs ' + online.opp + (online.code ? ' · ' + online.code : '') + (online.oppOff ? ' ⚠' : '') : (playerColor === 'w' ? 'Beyaz oynuyorsun' : 'Siyah oynuyorsun'); }
function syncButtons() {
  $('bUndo').disabled = online.active || busy || animating || game.history().length - baseLen < (game.turn() === playerColor ? 2 : 1);
  $('bHint').disabled = busy || animating || gameOver || game.turn() !== playerColor || online.active;
  $('bNew').disabled = animating;
  $('bResign').hidden = !online.active || gameOver;
  $('bAI').disabled = busy || animating || gameOver || game.turn() !== playerColor || online.active;
  $('bSide').textContent = pendingSide === 'w' ? 'Siyah Oyna' : 'Beyaz Oyna';
  syncDock();
}
function setBusy(v) { busy = v; syncButtons(); }
function refreshUI() {
  const hist = game.history({ verbose: true });
  const turn = game.turn();
  $('turnSwatch').className = 'swatch' + (turn === 'b' ? ' b' : '');
  $('turnText').textContent = (turn === 'w' ? 'Beyaz' : 'Siyah') + (turn === playerColor ? ' (sen)' : ' (rakip)');
  const mine = [], theirs = [];
  hist.forEach(m => { if (m.captured) (m.color === playerColor ? mine : theirs).push(m.captured); });
  const capColor = playerColor === 'w' ? 'gb' : 'gw', foeColor = playerColor === 'w' ? 'gw' : 'gb';
  const order = 'qrbnp', sortFn = (a, b) => order.indexOf(a) - order.indexOf(b);
  const draw = (el, arr, cls) => { el.textContent = ''; arr.slice().sort(sortFn).forEach(t => { const s = document.createElement('span'); s.className = cls; s.textContent = GL[t]; el.appendChild(s); }); };
  draw($('trayYou'), mine, capColor); draw($('trayFoe'), theirs, foeColor);
  $('capW').textContent = hist.filter(m => m.captured && m.color === 'w').length; $('capB').textContent = hist.filter(m => m.captured && m.color === 'b').length;
  const diff = mine.reduce((a, t) => a + PV[t], 0) - theirs.reduce((a, t) => a + PV[t], 0);
  $('advantage').textContent = diff === 0 ? '' : (diff > 0 ? '+' : '−') + Math.abs(diff);
  const list = $('moveList'); list.textContent = '';
  if (!hist.length) { const li = document.createElement('li'); li.className = 'empty'; li.style.display = 'block'; li.textContent = 'Henüz hamle yok.'; list.appendChild(li); }
  for (let i = 0; i < hist.length; i += 2) {
    const li = document.createElement('li');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = (i / 2 + 1) + '.';
    const a = document.createElement('span'); a.textContent = trSAN(hist[i].san);
    const b = document.createElement('span'); b.textContent = hist[i + 1] ? trSAN(hist[i + 1].san) : '';
    (hist[i + 1] ? b : a).classList.add('last');
    li.append(n, a, b); list.appendChild(li);
  }
  list.scrollTop = list.scrollHeight;
  syncButtons();
}
function updateStatus() {
  if (gameOver) return;
  const mine = game.turn() === playerColor;
  if (game.in_check()) setStatus(mine ? 'Şah! Şahını koru' : 'Rakibe şah çekildi', 'check');
  else setStatus(mine ? 'Sıra sende' : 'Rakip büyü hazırlıyor', mine ? 'you' : 'foe');
}
function endGame() {
  gameOver = true; clearSelection(); setBusy(false);
  let title, text, res = 'draw';
  if (game.in_checkmate()) {
    const won = game.turn() !== playerColor;
    res = won ? 'win' : 'loss';
    title = won ? 'Şah mat! Kazandın' : 'Şah mat. Rakip kazandı';
    text = won ? 'Rakibin şahı köşeye sıkıştı.' : 'Bir dahaki sefere daha dikkatli ol.';
  } else {
    title = 'Berabere';
    text = game.in_stalemate() ? 'Pat: hamle yok ama şah tehdit altında değil.'
      : game.in_threefold_repetition() ? 'Aynı konum üç kez tekrarlandı.'
      : game.insufficient_material() ? 'İki tarafta da mat yapacak güç kalmadı.' : '50 hamle kuralı doldu.';
  }
  $('bannerTitle').textContent = title; $('bannerText').textContent = text; $('banner').hidden = false;
  setStatus(title, 'end');
  if (res === 'win') sfx.win(); else if (res === 'loss') sfx.lose(); else sfx.end();
  metaOnEnd(res); if (online.active) onlineFinish(res);
  if (game.in_checkmate()) { const kq = findKing(game.turn()); if (kq) { const kp = sqPos(kq); camTargetT.set(kp.x * 0.3, 0.8, kp.z * 0.3); } camT.radius = fitRadius * 0.85; camT.phi = 0.95; fx.flash = 0.35; autoOrbit = true; }
}

/* ---------- flow ---------- */
function onTap(e) {
  if (busy || animating || gameOver || game.turn() !== playerColor) return;
  const sq = pick(e);
  if (!sq) { clearSelection(); return; }
  if (selected) {
    const cand = legal.filter(m => m.to === sq);
    if (cand.length) { chooseAndMove(cand); return; }
  }
  const p = game.get(sq);
  if (p && p.color === playerColor) { if (selected === sq) clearSelection(); else select(sq); }
  else clearSelection();
}
function askPromotion() {
  return new Promise(res => {
    const box = $('promo'); box.hidden = false;
    const done = v => { box.hidden = true; box.onclick = null; res(v); };
    box.onclick = ev => {
      const b = ev.target.closest('button[data-p]');
      if (b) done(b.dataset.p); else if (ev.target === box) done(null);
    };
  });
}
async function chooseAndMove(cand) {
  const m = cand[0];
  if (m.promotion) {
    setBusy(true);
    const p = await askPromotion();
    setBusy(false);
    if (!p) return;
    applyMove({ from: m.from, to: m.to, promotion: p }, false);
  } else applyMove({ from: m.from, to: m.to }, false);
}
async function applyMove(m, byAI, remote) {
  const ep = epoch;
  setBusy(true); clearSelection(); clearHint(); checkSq = null;
  const mv = game.move(m);
  if (!mv) { setBusy(false); return; }
  lastMove = { from: mv.from, to: mv.to }; paintSquares();
  if (online.active && !remote) onlineSend(mv);
  await animateMove(mv);
  if (ep !== epoch) return;
  checkSq = game.in_check() ? findKing(game.turn()) : null;
  refreshUI();
  if (game.game_over()) { endGame(); return; }
  if (checkSq) { sfx.check(); checkCam(); }
  updateStatus();
  if (online.active) setBusy(game.turn() !== playerColor); else if (game.turn() !== playerColor) aiTurn(); else setBusy(false);
}
async function aiTurn() {
  const ep = epoch;
  setBusy(true); updateStatus();
  const t0 = performance.now();
  const best = await Engine.findBest(game.fen(), curLevel(), { cancel: () => ep !== epoch });
  if (ep !== epoch) return;
  await sleep(Math.max(0, 650 - (performance.now() - t0)));
  if (ep !== epoch) return;
  if (!best) { endGame(); return; }
  applyMove({ from: best.from, to: best.to, promotion: best.promotion }, true);
}
async function hint() {
  if (busy || animating || gameOver || game.turn() !== playerColor) return;
  const ep = epoch;
  setBusy(true); setStatus('İpucu aranıyor', 'you');
  const best = await Engine.findBest(game.fen(), 2, { noise: 0, cancel: () => ep !== epoch });
  if (ep !== epoch) return;
  setBusy(false);
  if (!best) { updateStatus(); return; }
  clearSelection(); clearHint();
  addMarker(hintGroup, 'hint', best.from); addMarker(hintGroup, 'hint', best.to);
  setStatus('İpucu: ' + best.from + ' → ' + best.to, 'you');
}
function undo() {
  if (busy || animating) return;
  const n = game.turn() === playerColor ? 2 : 1;
  if (game.history().length - baseLen < n) return;
  epoch++;
  for (let i = 0; i < n; i++) game.undo();
  gameOver = false; $('banner').hidden = true;
  const h = game.history({ verbose: true });
  lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
  checkSq = game.in_check() ? findKing(game.turn()) : null;
  clearSelection(); clearHint(); placeAll(false); paintSquares(); refreshUI(); updateStatus();
}
function newGame(opts) {
  if (animating) return;
  if (online.active && !(opts && opts.online)) onlineLeave(true);
  epoch++;
  daily = !!(opts && opts.daily);
  game = new Chess(); playerColor = pendingSide; gameOver = false; baseLen = 0;
  if (daily) { playerColor = pendingSide = 'w'; dailyNo = todayNo(); seedDaily(game, dailyNo); baseLen = game.history().length; const h = game.history({ verbose: true }); lastMove = { from: h[h.length - 1].from, to: h[h.length - 1].to }; toast('Günlük Meydan Okuma #' + dailyNo); }
  if (!daily) lastMove = null; checkSq = null; clearSelection(); clearHint();
  $('banner').hidden = true; $('share').hidden = true; $('promo').hidden = true;
  placeAll(true); paintSquares(); introFly(); refreshUI(); setBusy(false);
  if (online.active) { setBusy(game.turn() !== playerColor); updateStatus(); } else if (game.turn() !== playerColor) aiTurn(); else updateStatus();
}

/* ---------- controls ---------- */
$('bNew').onclick = () => { sfx.click(); newGame(); };
$('bAgain').onclick = () => { sfx.click(); if (online.active) { onlineLeave(false); openHome(); return; } newGame({ daily }); };
$('bUndo').onclick = undo;
$('bHint').onclick = hint;
$('bSide').onclick = () => { if (animating) return; pendingSide = playerColor === 'w' ? 'b' : 'w'; newGame(); };
$('bAI').onclick = async () => {
  if (busy || animating || gameOver || game.turn() !== playerColor) return;
  const ep = epoch; setBusy(true); setStatus('YZ senin yerine düşünüyor', 'you');
  const best = await Engine.findBest(game.fen(), Math.max(2, curLevel()), { cancel: () => ep !== epoch });
  if (ep !== epoch) return;
  if (best) applyMove({ from: best.from, to: best.to, promotion: best.promotion }, false); else setBusy(false);
};
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => setCam(b.dataset.cam)));
$('bPanel').onclick = () => { const d = $('drawer'); d.hidden = !d.hidden; $('bPanel').setAttribute('aria-pressed', String(!d.hidden)); };
function setUiHidden(v) { stageEl.classList.toggle('hide-ui', v); $('showUi').hidden = !v; }
$('bHide').onclick = () => setUiHidden(true);
$('showUi').onclick = () => setUiHidden(false);
$('bSound').onclick = () => {
  ensureAudio(); setMuted(!muted);
  $('bSound').setAttribute('aria-pressed', String(!muted)); $('bSound').textContent = 'Ses: ' + (muted ? 'kapalı' : 'açık');
  if (!muted) sfx.click();
};
$('bMusic').onclick = () => {
  ensureAudio(); setMusic(!musicOn);
  $('bMusic').setAttribute('aria-pressed', String(musicOn)); $('bMusic').textContent = 'Müzik: ' + (musicOn ? 'açık' : 'kapalı');
};
$('segLevel').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  sfx.click(); setLevel(+b.dataset.v);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { clearSelection(); clearHint(); }
  if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) setUiHidden(!stageEl.classList.contains('hide-ui'));
});

