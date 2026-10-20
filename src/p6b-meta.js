
/* ---------- meta layer: home menu, daily challenge, stats & streaks, share card, mobile dock ---------- */
const SHARE_URL = 'https://claude.ai/artifact/PxJBCx5z3sQYsLZZWkautK';
const STORE_KEY = 'wizard-chess-v1';
let mem = null;
function loadStats() {
  if (mem) return mem;
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
  mem = Object.assign({ played: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0, dailyStreak: 0, lastDailyWin: -99, dailyDone: {} }, s || {});
  return mem;
}
function saveStats() { try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); } catch (e) {} }

const online = { active: false, opp: '', code: '', color: 'w' };
let daily = false, baseLen = 0, dailyNo = 0, lastResult = null;
const curLevel = () => (daily ? 2 : level);
function todayNo() { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5) + 1; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function material(g) {
  let w = 0, b = 0; const V = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) { const p = g.get(f + r); if (p && p.type !== 'k') (p.color === 'w' ? (w += V[p.type]) : (b += V[p.type])); }
  return w - b;
}
// Same seed for everyone on a given day: a fair, balanced, slightly odd opening position.
function seedDaily(g, no) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const rnd = mulberry(no * 7919 + attempt * 104729);
    g.reset();
    let ok = true;
    for (let i = 0; i < 6; i++) {
      const mv = g.moves({ verbose: true });
      if (!mv.length) { ok = false; break; }
      g.move(mv[Math.floor(rnd() * mv.length)]);
    }
    if (ok && !g.in_check() && !g.game_over() && Math.abs(material(g)) <= 1) return;
  }
  g.reset();
}

function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200); }

/* ----- home ----- */
function refreshHome() {
  const s = loadStats(), no = todayNo();
  $('stWin').textContent = s.wins; $('stStreak').textContent = s.streak; $('stDaily').textContent = s.dailyStreak; $('stBest').textContent = s.best;
  const done = s.dailyDone[no];
  $('hDailyT').textContent = 'Günlük Meydan Okuma #' + no;
  $('hDailyD').textContent = done === 'win' ? 'Bugün kazandın ✓ Tekrar dene ya da paylaş.' : done ? 'Bugün denedin. Bir kez daha?' : 'Bugünün özel konumu. Herkes aynı sınavda.';
  const live = game.history().length > baseLen && !gameOver;
  $('hPlay').textContent = live ? 'Devam et' : 'Oyna';
  refreshAccountUI();
  $('hLevel').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === level)));
}
function openHome() { refreshHome(); $('home').hidden = false; $('banner').hidden = true; }
function closeHome() { $('home').hidden = true; }
function setLevel(v) {
  level = v;
  [$('hLevel'), $('segLevel')].forEach(seg => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === v))));
}
$('hLevel').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) { sfx.click(); setLevel(+b.dataset.v); } });
$('hPlay').onclick = () => {
  sfx.click(); closeHome();
  if (gameOver) newGame();
};
$('hDaily').onclick = () => { sfx.click(); closeHome(); if (!animating) newGame({ daily: true }); };
$('bHome').onclick = $('dHome').onclick = $('bHome2').onclick = () => { sfx.click(); openHome(); };
$('bNext').onclick = () => { sfx.click(); if (online.active) onlineLeave(false); newGame(); };
$('dDaily').onclick = () => { sfx.click(); if (!animating) newGame({ daily: true }); };

/* ----- mobile dock mirrors ----- */
const CAMS = ['player', 'top', 'side', 'hall'];
$('dUndo').onclick = () => { sfx.click(); $('bUndo').click(); };
$('dHint').onclick = () => { sfx.click(); $('bHint').click(); };
$('dCam').onclick = () => { sfx.click(); setCam(CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]); toast({ player: 'Oyuncu kamerası', top: 'Tepeden', side: 'Yan', hall: 'Katedral' }[camMode]); };
$('dPanel').onclick = () => { sfx.click(); $('bPanel').click(); };
$('dSide').onclick = () => $('bSide').click();
$('dAI').onclick = () => $('bAI').click();
$('dHide').onclick = () => $('bHide').click();
function syncDock() {
  $('dUndo').disabled = $('bUndo').disabled; $('dHint').disabled = $('bHint').disabled; $('dAI').disabled = $('bAI').disabled;
  $('dSide').textContent = $('bSide').textContent;
}

/* ----- results ----- */
function metaOnEnd(res) {
  const s = loadStats(), plies = game.history().length - baseLen, moves = Math.max(1, Math.ceil(plies / 2));
  s.played++;
  if (res === 'win') { s.wins++; s.streak++; s.best = Math.max(s.best, s.streak); }
  else if (res === 'loss') { s.losses++; s.streak = 0; } else s.draws++;
  if (daily) {
    if (res === 'win' && s.dailyDone[dailyNo] !== 'win') { s.dailyStreak = s.lastDailyWin === dailyNo - 1 ? s.dailyStreak + 1 : (s.lastDailyWin === dailyNo ? s.dailyStreak : 1); s.lastDailyWin = dailyNo; }
    if (s.dailyDone[dailyNo] !== 'win') s.dailyDone[dailyNo] = res;
  }
  saveStats();
  const h = game.history({ verbose: true });
  const mine = h.filter(m => m.captured && m.color === playerColor).length, theirs = h.filter(m => m.captured && m.color !== playerColor).length;
  lastResult = { res, moves, mine, theirs, daily, no: dailyNo, streak: s.streak, dailyStreak: s.dailyStreak, level: curLevel() };
  $('bannerStat').textContent = (res === 'win' ? '🏆 ' : res === 'loss' ? '💀 ' : '🤝 ') + moves + ' hamle · ' + mine + ' taş aldın · Seri 🔥 ' + s.streak + (daily ? ' · Günlük seri ' + s.dailyStreak : '');
  $('bShare').hidden = false;
}
function shareText(r) {
  const head = r.daily ? '🔮 3D Büyücü Satranç · Günlük #' + r.no : '♞ 3D Büyücü Satranç';
  const line = r.res === 'win' ? '🏆 Şah mat! ' + r.moves + ' hamlede kazandım' : r.res === 'loss' ? '💀 Bu sefer büyücü kazandı (' + r.moves + ' hamle)' : '🤝 Berabere (' + r.moves + ' hamle)';
  const lv = ['', 'Çırak', 'Büyücü', 'Üstat'][r.level];
  return head + '\n' + line + '\n⚔️ Aldığım taş: ' + r.mine + ' · Kaybettiğim: ' + r.theirs + '\n🔥 Seri: ' + r.streak + (r.daily ? ' · Günlük seri: ' + r.dailyStreak : '') + ' · ' + lv + '\nSen de dene 👉 ' + SHARE_URL;
}

/* ----- share card (canvas) ----- */
const GLY = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
function drawCard(r) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const bg = x.createRadialGradient(W / 2, 420, 60, W / 2, 620, 980); bg.addColorStop(0, '#3a2510'); bg.addColorStop(0.55, '#150e08'); bg.addColorStop(1, '#070504');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // glow
  const gl = x.createRadialGradient(W / 2, 780, 20, W / 2, 780, 520); gl.addColorStop(0, 'rgba(255,170,60,.28)'); gl.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = gl; x.fillRect(0, 300, W, 1000);
  x.strokeStyle = '#e0b64f'; x.lineWidth = 4; x.strokeRect(34, 34, W - 68, H - 68); x.lineWidth = 1.5; x.strokeRect(50, 50, W - 100, H - 100);
  x.textAlign = 'center'; x.fillStyle = '#e0b64f';
  x.font = '700 78px Almendra, Georgia, serif'; x.fillText('3D BÜYÜCÜ SATRANÇ', W / 2, 168);
  x.font = '400 34px Spectral, Georgia, serif'; x.fillStyle = '#b9a98c';
  x.fillText(r.daily ? '✦ Günlük Meydan Okuma #' + r.no + ' ✦' : '✦ ' + ['', 'Çırak', 'Büyücü', 'Üstat'][r.level] + ' seviyesi ✦', W / 2, 222);
  // board
  const bs = 640, bx = (W - bs) / 2, by = 270, sq = bs / 8;
  x.fillStyle = '#e0b64f'; x.fillRect(bx - 14, by - 14, bs + 28, bs + 28);
  const flip = playerColor === 'b';
  for (let rr = 0; rr < 8; rr++) for (let ff = 0; ff < 8; ff++) {
    const file = flip ? 7 - ff : ff, rank = flip ? rr : 7 - rr;
    x.fillStyle = (file + rank) % 2 ? '#efe3c7' : '#17120f'; x.fillRect(bx + ff * sq, by + rr * sq, sq, sq);
    const p = game.get('abcdefgh'[file] + (rank + 1));
    if (p) {
      x.font = '62px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
      x.textBaseline = 'middle';
      x.lineWidth = 3; x.strokeStyle = p.color === 'w' ? '#5a3d0a' : '#e0b64f';
      x.fillStyle = p.color === 'w' ? '#fff6dc' : '#0b0908';
      const gch = GLY[p.color === 'w' ? 'b' : 'b'][p.type];
      x.strokeText(gch, bx + ff * sq + sq / 2, by + rr * sq + sq / 2 + 3); x.fillText(gch, bx + ff * sq + sq / 2, by + rr * sq + sq / 2 + 3);
    }
  }
  x.textBaseline = 'alphabetic';
  // result
  const col = r.res === 'win' ? '#ffd98a' : r.res === 'loss' ? '#ff8a6a' : '#cfd8d4';
  x.fillStyle = col; x.font = '700 92px Almendra, Georgia, serif';
  x.shadowColor = col; x.shadowBlur = 28;
  x.fillText(r.res === 'win' ? 'ŞAH MAT!' : r.res === 'loss' ? 'MAĞLUP' : 'BERABERE', W / 2, 1010); x.shadowBlur = 0;
  x.fillStyle = '#f3ead8'; x.font = '400 40px Spectral, Georgia, serif';
  x.fillText(r.moves + ' hamle · ' + r.mine + ' taş aldım · ' + r.theirs + ' taş kaybettim', W / 2, 1070);
  // pills
  const pill = (cx, label, val) => { x.fillStyle = 'rgba(224,182,79,.12)'; x.strokeStyle = '#e0b64f'; x.lineWidth = 2; const w = 300, h = 110, px = cx - w / 2, py = 1120;
    x.beginPath(); x.roundRect ? x.roundRect(px, py, w, h, 28) : x.rect(px, py, w, h); x.fill(); x.stroke();
    x.fillStyle = '#e0b64f'; x.font = '700 52px Almendra, Georgia, serif'; x.fillText(val, cx, py + 56);
    x.fillStyle = '#b9a98c'; x.font = '400 24px Spectral, Georgia, serif'; x.fillText(label.toUpperCase(), cx, py + 92); };
  pill(W / 2 - 170, 'Galibiyet serisi', '🔥 ' + r.streak); pill(W / 2 + 170, r.daily ? 'Günlük seri' : 'Seviye', r.daily ? '✦ ' + r.dailyStreak : ['', 'Çırak', 'Büyücü', 'Üstat'][r.level]);
  x.fillStyle = '#7d6e55'; x.font = '400 26px Spectral, Georgia, serif'; x.fillText('Sen de dene — 3D Büyücü Satranç', W / 2, 1290);
  return c;
}
async function openShare() {
  if (!lastResult) return;
  try { await (document.fonts && document.fonts.ready); } catch (e) {}
  const c = drawCard(lastResult);
  const url = c.toDataURL('image/png');
  $('shareImg').src = url; $('share').hidden = false;
}
async function doShare() {
  const text = shareText(lastResult);
  const c = drawCard(lastResult);
  const blob = await new Promise(res => { try { c.toBlob(res, 'image/png'); } catch (e) { res(null); } });
  try {
    if (blob && navigator.canShare) {
      const file = new File([blob], 'buyucu-satranc.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  doCopy();
}
async function doCopy() {
  const text = shareText(lastResult);
  try { await navigator.clipboard.writeText(text); toast('Metin kopyalandı'); return; } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Metin kopyalandı'); } catch (e) { toast('Kopyalanamadı, görseli kaydet'); }
}
$('bShare').onclick = () => { sfx.click(); openShare(); };
$('shShare').onclick = doShare;
$('shCopy').onclick = doCopy;
$('shClose').onclick = () => { $('share').hidden = true; };

$('hAbout').onclick = () => { sfx.click(); $('about').hidden = false; };
$('abClose').onclick = () => { $('about').hidden = true; };
