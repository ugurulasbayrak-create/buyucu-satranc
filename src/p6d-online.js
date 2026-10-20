
/* ---------- accounts + online 2-player (Firebase Auth + Firestore). Inactive unless firebase-config.js is filled in. ---------- */
let fbAuth = null, fbDb = null, fbUser = null, fbOn = false;
const ROOM_KEY = 'wizard-chess-room';
const saveRoom = c => { try { c ? localStorage.setItem(ROOM_KEY, c) : localStorage.removeItem(ROOM_KEY); } catch (e) {} };
const savedRoom = () => { try { return localStorage.getItem(ROOM_KEY) || ''; } catch (e) { return ''; } };
let hbTimer = 0, clockTimer = 0, lastMySeen = 0, timeoutSent = false;
const MOVE_LIMIT = 180000;
const srvNow = () => Date.now() + (online.skew || 0);
let unsub = null, onlineDoc = null, pumping = false, remoteEndShown = false, resignArm = 0;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function fbConfigured() {
  const c = window.FIREBASE_CONFIG;
  return typeof firebase !== 'undefined' && c && c.apiKey && !/BURAYA|YOUR/i.test(c.apiKey) && c.projectId;
}
function initFirebase() {
  if (!fbConfigured()) return;
  try {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    fbAuth = firebase.auth(); fbDb = firebase.firestore();
    try { fbDb.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
    fbAuth.onAuthStateChanged(u => { fbUser = u; refreshAccountUI(); });
    fbOn = true;
  } catch (e) { fbOn = false; }
  refreshAccountUI();
}
const myName = () => (fbUser && (fbUser.displayName || (fbUser.email || '').split('@')[0])) || 'Oyuncu';
function refreshAccountUI() {
  $('hOnlineBox').hidden = !fbOn;
  if (!fbOn) return;
  $('hAcct').textContent = fbUser ? '👤 ' + myName() : 'Giriş yapılmadı';
  $('hLogin').hidden = !!fbUser; $('hLogout').hidden = !fbUser;
  const rc = savedRoom();
  $('hResume').hidden = !(fbUser && rc && !online.active);
  $('hResumeD').textContent = 'Oda ' + rc + ' · kaldığın yerden devam et';
}
const AUTH_ERR = {
  'auth/invalid-credential': 'E-posta veya şifre hatalı.', 'auth/wrong-password': 'E-posta veya şifre hatalı.', 'auth/user-not-found': 'Bu e-posta ile kayıt bulunamadı.',
  'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.', 'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/invalid-email': 'E-posta adresi geçersiz.', 'auth/too-many-requests': 'Çok fazla deneme. Biraz sonra tekrar dene.',
  'auth/network-request-failed': 'İnternet bağlantısı yok.', 'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı.',
  'auth/requires-recent-login': 'Güvenlik için çıkış yapıp tekrar giriş yap, sonra yeniden dene.'
};
const errText = e => AUTH_ERR[e && e.code] || ((e && e.message) ? e.message.slice(0, 120) : 'Bir sorun oluştu.');
const aMsg = (t, ok) => { const el = $('aMsg'); el.textContent = t || ''; el.classList.toggle('ok', !!ok); };
const lMsg = (t, ok) => { const el = $('lMsg'); el.textContent = t || ''; el.classList.toggle('ok', !!ok); };

async function authBusy(fn) {
  aMsg('');
  ['aGoogle', 'aLogin', 'aRegister'].forEach(id => $(id).disabled = true);
  try { await fn(); } catch (e) { aMsg(errText(e)); }
  ['aGoogle', 'aLogin', 'aRegister'].forEach(id => $(id).disabled = false);
}
$('hLogin').onclick = () => { sfx.click(); aMsg(''); $('auth').hidden = false; };
$('aClose').onclick = () => { $('auth').hidden = true; };
$('aLogin').onclick = () => authBusy(async () => { await fbAuth.signInWithEmailAndPassword($('aMail').value.trim(), $('aPass').value); $('auth').hidden = true; toast('Hoş geldin ' + myName()); });
$('aRegister').onclick = () => authBusy(async () => {
  const cr = await fbAuth.createUserWithEmailAndPassword($('aMail').value.trim(), $('aPass').value);
  await cr.user.updateProfile({ displayName: $('aMail').value.trim().split('@')[0].slice(0, 20) });
  fbUser = fbAuth.currentUser; refreshAccountUI(); $('auth').hidden = true; toast('Hesap oluşturuldu');
});
$('aReset').onclick = () => authBusy(async () => { const m = $('aMail').value.trim(); if (!m) { aMsg('Önce e-posta adresini yaz.'); return; } await fbAuth.sendPasswordResetEmail(m); aMsg('Şifre sıfırlama e-postası gönderildi.', true); });
$('aGoogle').onclick = () => authBusy(async () => {
  const cap = window.Capacitor, FA = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.FirebaseAuthentication;
  if (FA) {
    const r = await FA.signInWithGoogle({ skipNativeAuth: true });
    const idToken = r && r.credential && r.credential.idToken;
    if (!idToken) throw new Error('Google girişi tamamlanamadı.');
    await fbAuth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken));
  } else await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  $('auth').hidden = true; toast('Hoş geldin ' + myName());
});
$('hLogout').onclick = async () => { sfx.click(); try { const cap = window.Capacitor; if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.FirebaseAuthentication) await cap.Plugins.FirebaseAuthentication.signOut(); } catch (e) {} await fbAuth.signOut(); toast('Çıkış yapıldı'); };

/* ----- lobby ----- */
$('hOnline').onclick = () => { sfx.click(); if (!fbUser) { $('auth').hidden = false; return; } openLobby(); };
$('hResume').onclick = async () => {
  sfx.click(); const code = savedRoom(); if (!code) return;
  try {
    const snap = await gamesRef(code).get();
    if (!snap.exists || snap.data().status === 'done') { saveRoom(''); refreshAccountUI(); toast('Bu maç artık yok veya bitmiş'); return; }
    await joinRoom(code); closeHome(); listen(code);
  } catch (e) { toast(e.message || 'Bağlanılamadı'); }
};
function openLobby() { lMsg(''); $('lWait').hidden = true; $('lUser').textContent = '👤 ' + myName(); $('lobby').hidden = false; $('home').hidden = true; }
$('lClose').onclick = () => { cancelWaiting(); $('lobby').hidden = true; openHome(); };
$('lCancel').onclick = () => { cancelWaiting(); $('lWait').hidden = true; lMsg(''); };
const gamesRef = code => fbDb.collection('games').doc(code);
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const lobbyBusy = v => ['lQuick', 'lCreate', 'lJoin'].forEach(id => $(id).disabled = v);

async function createRoom(isPublic) {
  const myColor = Math.random() < 0.5 ? 'w' : 'b';
  for (let i = 0; i < 6; i++) {
    const code = newCode(), ref = gamesRef(code);
    const ok = await fbDb.runTransaction(async tx => {
      const s = await tx.get(ref); if (s.exists) return false;
      tx.set(ref, { w: myColor === 'w' ? fbUser.uid : null, b: myColor === 'b' ? fbUser.uid : null, wName: myColor === 'w' ? myName() : '', bName: myColor === 'b' ? myName() : '', moves: [], status: 'waiting', result: '', reason: '', public: !!isPublic, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      return true;
    });
    if (ok) return code;
  }
  throw new Error('Oda oluşturulamadı.');
}
async function joinRoom(code) {
  const ref = gamesRef(code);
  return fbDb.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new Error('Oda bulunamadı.');
    const d = s.data();
    if (d.w === fbUser.uid || d.b === fbUser.uid) return;          // rejoin
    if (d.status !== 'waiting' || (d.w && d.b)) throw new Error('Oda dolu.');
    tx.update(ref, d.w ? { b: fbUser.uid, bName: myName(), status: 'playing', updatedAt: firebase.firestore.FieldValue.serverTimestamp() } : { w: fbUser.uid, wName: myName(), status: 'playing', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
}
function listen(code) {
  if (unsub) unsub();
  online.code = code; remoteEndShown = false;
  unsub = gamesRef(code).onSnapshot(snap => { if (snap.exists) onGameSnap(snap.data()); }, err => lMsg('Bağlantı hatası: ' + (err.code || err.message)));
}
async function runLobby(fn) {
  lMsg(''); lobbyBusy(true);
  try { await fn(); } catch (e) { lMsg(e.message || 'Bir sorun oluştu.'); }
  lobbyBusy(false);
}
$('lCreate').onclick = () => runLobby(async () => { const code = await createRoom(false); $('lWaitCode').textContent = code; $('lWait').hidden = false; listen(code); });
$('lJoin').onclick = () => runLobby(async () => { const code = $('lCode').value.trim().toUpperCase(); if (code.length !== 5) throw new Error('Kod 5 karakter olmalı.'); await joinRoom(code); listen(code); lMsg('Bağlanılıyor…', true); });
$('lQuick').onclick = () => runLobby(async () => {
  const q = await fbDb.collection('games').where('status', '==', 'waiting').where('public', '==', true).limit(8).get();
  for (const doc of q.docs) {
    const d = doc.data(); if (d.w === fbUser.uid || d.b === fbUser.uid) continue;
    try { await joinRoom(doc.id); listen(doc.id); lMsg('Rakip bulundu…', true); return; } catch (e) { /* taken, try next */ }
  }
  const code = await createRoom(true); $('lWaitCode').textContent = code; $('lWait').hidden = false; listen(code); lMsg('Rakip aranıyor…', true);
});
$('lShare').onclick = async () => {
  const code = online.code, text = '♞ 3D Büyücü Satranç\'ta seninle online oynamak istiyorum! Oda kodu: ' + code + '\n' + SHARE_URL;
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Kopyalandı'); } catch (e) { toast('Kod: ' + code); }
};
async function cancelWaiting() {
  if (onlineDoc && onlineDoc.status === 'waiting' && online.code && !online.active) { try { await gamesRef(online.code).delete(); } catch (e) {} }
  if (!online.active && unsub) { unsub(); unsub = null; }
  onlineDoc = null;
}

/* ----- game sync ----- */
function onGameSnap(d) {
  onlineDoc = d;
  if (d.status === 'playing' && !online.active && fbUser) {
    const color = d.w === fbUser.uid ? 'w' : d.b === fbUser.uid ? 'b' : null;
    if (!color) return;
    online.opp = (color === 'w' ? d.bName : d.wName) || 'Rakip';
    online.color = color; online.active = true; online.oppOff = false; saveRoom(online.code); startHeartbeat(); startClock();
    $('lobby').hidden = true; $('home').hidden = true; $('lWait').hidden = true;
    pendingSide = color; newGame({ online: true });
    if ((d.moves || []).length) {
      d.moves.forEach(m => game.move({ from: m.f, to: m.t, promotion: m.p || undefined }));
      const h = game.history({ verbose: true }); lastMove = { from: h[h.length - 1].from, to: h[h.length - 1].to };
      checkSq = game.in_check() ? findKing(game.turn()) : null;
      clearSelection(); placeAll(false); paintSquares(); refreshUI(); updateStatus(); setBusy(game.turn() !== playerColor);
    }
    toast('Rakip: ' + online.opp);
  }
  if (!online.active) return;
  const mine = d[online.color === 'w' ? 'wSeen' : 'bSeen'], mineMs = mine && mine.toMillis ? mine.toMillis() : 0;
  if (mineMs && mineMs !== lastMySeen) { lastMySeen = mineMs; if (Math.abs(mineMs - Date.now()) < 3600000) online.skew = mineMs - Date.now(); }
  online.turnAt = d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : srvNow();
  online.movesN = (d.moves || []).length;
  const seen = d[online.color === 'w' ? 'bSeen' : 'wSeen'], ms = seen && seen.toMillis ? seen.toMillis() : 0;
  const off = d.status === 'playing' && ms > 0 && srvNow() - ms > 90000;
  if (off !== online.oppOff) { online.oppOff = off; updateStatus(); if (off) toast('Rakibin bağlantısı koptu, dönmesini bekle'); }
  if (d.status === 'done' && !gameOver && !remoteEndShown) {
    // wait until pending moves are shown, then show the result
    pumpMoves(d.moves || []).then(() => {
      if (gameOver) return;
      remoteEndShown = true;
      const mine = online.color;
      if (d.reason === 'timeout') {
        const won = d.result === mine;
        remoteEnd(won ? 'win' : 'loss', won ? 'Rakibin süresi doldu. Kazandın!' : 'Süren doldu', won ? 'Rakip hamle süresinde oynamadı.' : 'Hamleni 3 dakikada yapmadın.');
      } else if (d.reason === 'resign') {
        const won = d.result === mine;
        remoteEnd(won ? 'win' : 'loss', won ? 'Rakip pes etti. Kazandın!' : 'Pes ettin', won ? 'Rakip pes etti.' : 'Bu maçı bıraktın.');
      } else if (d.result === 'draw') remoteEnd('draw', 'Berabere', 'Oyun berabere bitti.');
      else remoteEnd(d.result === mine ? 'win' : 'loss', d.result === mine ? 'Şah mat! Kazandın' : 'Şah mat. Rakip kazandı', '');
    });
    return;
  }
  pumpMoves(d.moves || []);
}
async function pumpMoves(remote) {
  if (pumping) { pumpMoves.latest = remote; await pumping; return; }
  pumping = (async () => {
    let list = remote;
    for (;;) {
      while (game.history().length < list.length) {
        while (animating) await sleep(120);
        if (!online.active || gameOver) return;
        const mv = list[game.history().length];
        applyMove({ from: mv.f, to: mv.t, promotion: mv.p || undefined }, true, true);
        await sleep(60);
        while (animating) await sleep(120);
      }
      if (pumpMoves.latest) { list = pumpMoves.latest; pumpMoves.latest = null; } else break;
    }
  })();
  try { await pumping; } finally { pumping = false; }
}
async function onlineSend(mv, tries) {
  tries = tries || 0;
  const ref = gamesRef(online.code), expected = game.history().length - 1;
  try {
    await fbDb.runTransaction(async tx => {
      const s = await tx.get(ref), d = s.data(), moves = d.moves || [];
      if (moves.length !== expected) { if (moves.length > expected) return; throw new Error('sync'); }
      tx.update(ref, { moves: moves.concat([{ f: mv.from, t: mv.to, p: mv.promotion || '' }]), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
  } catch (e) {
    if (tries < 8 && online.active && !gameOver) { if (tries === 0) toast('Bağlantı sorunu, tekrar deneniyor…'); await sleep(Math.min(8000, 1500 * (tries + 1))); onlineSend(mv, tries + 1); }
    else if (online.active) resyncFromServer();
  }
}
async function resyncFromServer() {
  try {
    const d = (await gamesRef(online.code).get()).data(); if (!d) return;
    if (animating) { await sleep(600); }
    epoch++; game = new Chess();
    (d.moves || []).forEach(m => game.move({ from: m.f, to: m.t, promotion: m.p || undefined }));
    const h = game.history({ verbose: true });
    lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
    checkSq = game.in_check() ? findKing(game.turn()) : null;
    clearSelection(); placeAll(false); paintSquares(); refreshUI(); updateStatus(); setBusy(game.turn() !== playerColor);
    toast('Bağlantı sorunu: tahta sunucuyla eşitlendi');
  } catch (e) { toast('Hamle gönderilemedi. İnternetini kontrol et.'); }
}
function startClock() {
  clearInterval(clockTimer); timeoutSent = false; $('clock').hidden = false;
  clockTimer = setInterval(() => {
    if (!online.active || gameOver) { $('clock').hidden = true; clearInterval(clockTimer); return; }
    const left = Math.max(0, (online.turnAt || srvNow()) + MOVE_LIMIT - srvNow());
    const s = Math.ceil(left / 1000);
    $('clockT').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    $('clock').classList.toggle('low', s <= 30);
    $('clock').title = game.turn() === playerColor ? 'Senin sıran' : 'Rakibin sırası';
    if (left <= 0 && !timeoutSent && online.movesN === game.history().length && !animating) claimTimeout();
  }, 1000);
}
async function claimTimeout() {
  timeoutSent = true;
  const loser = game.turn(), result = loser === 'w' ? 'b' : 'w', ref = gamesRef(online.code);
  try {
    await fbDb.runTransaction(async tx => {
      const s = await tx.get(ref), d = s.data();
      if (!d || d.status !== 'playing' || (d.moves || []).length !== game.history().length) return;
      const upd = d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0;
      if (upd && srvNow() - upd < MOVE_LIMIT - 2000) return;     // someone moved meanwhile
      tx.update(ref, { status: 'done', result, reason: 'timeout' });
    });
  } catch (e) { timeoutSent = false; }
}
function startHeartbeat() {
  clearInterval(hbTimer);
  const beat = () => { if (!online.active || document.hidden || !online.code) return; gamesRef(online.code).update({ [online.color === 'w' ? 'wSeen' : 'bSeen']: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); };
  beat(); hbTimer = setInterval(beat, 20000);
}
function remoteEnd(res, title, text) {
  if (gameOver) return;
  saveRoom(''); clearInterval(hbTimer); clearInterval(clockTimer); $('clock').hidden = true;
  gameOver = true; clearSelection(); setBusy(false);
  $('bannerTitle').textContent = title; $('bannerText').textContent = text; $('banner').hidden = false;
  setStatus(title, 'end');
  if (res === 'win') sfx.win(); else if (res === 'loss') sfx.lose(); else sfx.end();
  metaOnEnd(res);
  if (res === 'win') { fx.flash = 0.3; }
  syncButtons();
}
async function onlineFinish(res) {
  if (!online.code) return;
  saveRoom(''); clearInterval(hbTimer); clearInterval(clockTimer); $('clock').hidden = true;
  const result = res === 'draw' ? 'draw' : res === 'win' ? online.color : (online.color === 'w' ? 'b' : 'w');
  try { await gamesRef(online.code).update({ status: 'done', result, reason: res === 'draw' ? 'draw' : 'mate' }); } catch (e) {}
}
function onlineLeave(abandon) {
  if (online.active && abandon && !gameOver && online.code) {
    const result = online.color === 'w' ? 'b' : 'w';
    gamesRef(online.code).update({ status: 'done', result, reason: 'resign' }).catch(() => {});
  }
  if (unsub) { unsub(); unsub = null; }
  clearInterval(hbTimer); clearInterval(clockTimer); $('clock').hidden = true; if (abandon || gameOver) saveRoom('');
  online.active = false; online.oppOff = false; online.code = ''; onlineDoc = null; $('bResign').hidden = true;
}
$('bResign').onclick = () => {
  if (!online.active || gameOver) return;
  if (Date.now() > resignArm) { resignArm = Date.now() + 3000; $('bResign').textContent = 'Emin misin? Tekrar dokun'; setTimeout(() => { $('bResign').textContent = 'Pes et'; }, 3000); return; }
  resignArm = 0; $('bResign').textContent = 'Pes et';
  const result = online.color === 'w' ? 'b' : 'w';
  gamesRef(online.code).update({ status: 'done', result, reason: 'resign' }).catch(() => {});
  remoteEnd('loss', 'Pes ettin', 'Bu maçı bıraktın.');
};
let delArm = 0;
$('lDelete').onclick = async () => {
  if (!fbUser) return;
  if (Date.now() > delArm) { delArm = Date.now() + 4000; $('lDelete').textContent = 'Emin misin? Tekrar dokun (geri alınamaz)'; setTimeout(() => { $('lDelete').textContent = 'Hesabımı sil'; }, 4000); return; }
  delArm = 0; $('lDelete').textContent = 'Hesabımı sil';
  try { await fbUser.delete(); $('lobby').hidden = true; toast('Hesabın silindi'); openHome(); } catch (e) { lMsg(errText(e)); }
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && online.active) startHeartbeat(); });
initFirebase();
