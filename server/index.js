// 3D Büyücü Satranç – oyun sunucusu (Railway).
// İstemciler hamleyi buraya gönderir; sunucu sırayı ve hamlenin geçerliliğini denetler, sonucu ve süre aşımını yazar.
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Chess } = require('chess.js');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT ortam değişkeni eksik'); process.exit(1); }
let sa;
try { sa = JSON.parse(raw); } catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT geçerli JSON değil'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const MOVE_LIMIT_MS = Number(process.env.MOVE_LIMIT_MS || 180000);
const allowed = (process.env.ALLOWED_ORIGINS || 'https://ugurulasbayrak-create.github.io,https://localhost,http://localhost,capacitor://localhost').split(',').map(s => s.trim());

const app = express();
app.use(express.json({ limit: '2kb' }));
app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.includes(o)), methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));

const CODE_RE = /^[A-Z2-9]{5}$/, SQ_RE = /^[a-h][1-8]$/;
const sideToMove = n => (n % 2 === 0 ? 'w' : 'b');
function replay(moves) {
  const g = new Chess();
  for (const m of moves) if (!g.move({ from: m.f, to: m.t, promotion: m.p || undefined })) return null;
  return g;
}
async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try { req.uid = (await admin.auth().verifyIdToken(h.startsWith('Bearer ') ? h.slice(7) : '')).uid; next(); }
  catch (e) { res.status(401).json({ error: 'auth' }); }
}

app.get('/', (req, res) => res.json({ ok: true, service: 'buyucu-satranc', limitMs: MOVE_LIMIT_MS }));

app.post('/move', auth, async (req, res) => {
  const { code, from, to, promotion } = req.body || {};
  if (!CODE_RE.test(code || '') || !SQ_RE.test(from || '') || !SQ_RE.test(to || '') || (promotion && !'qrbn'.includes(promotion))) return res.status(400).json({ error: 'bad_request' });
  try {
    const ref = db.collection('games').doc(code);
    const out = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      if (!s.exists) return { status: 404, error: 'no_game' };
      const d = s.data();
      if (d.status !== 'playing') return { status: 409, error: 'not_playing' };
      const moves = d.moves || [], turn = sideToMove(moves.length);
      if ((turn === 'w' ? d.w : d.b) !== req.uid) return { status: 403, error: 'not_your_turn' };
      const g = replay(moves);
      if (!g) return { status: 500, error: 'corrupt' };
      const mv = g.move({ from, to, promotion: promotion || undefined });
      if (!mv) return { status: 422, error: 'illegal' };
      const upd = { moves: moves.concat([{ f: from, t: to, p: mv.promotion || '' }]), updatedAt: FV.serverTimestamp() };
      if (g.game_over()) {
        upd.status = 'done';
        if (g.in_checkmate()) { upd.result = turn; upd.reason = 'mate'; } else { upd.result = 'draw'; upd.reason = 'draw'; }
      }
      tx.update(ref, upd);
      return { status: 200, ok: true, n: upd.moves.length, done: !!upd.status };
    });
    res.status(out.status).json(out);
  } catch (e) { console.error('move', e); res.status(500).json({ error: 'server' }); }
});

app.post('/resign', auth, async (req, res) => {
  const { code } = req.body || {};
  if (!CODE_RE.test(code || '')) return res.status(400).json({ error: 'bad_request' });
  try {
    const ref = db.collection('games').doc(code);
    const out = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      if (!s.exists) return { status: 404, error: 'no_game' };
      const d = s.data();
      if (d.w !== req.uid && d.b !== req.uid) return { status: 403, error: 'not_player' };
      if (d.status !== 'playing') return { status: 409, error: 'not_playing' };
      tx.update(ref, { status: 'done', result: d.w === req.uid ? 'b' : 'w', reason: 'resign' });
      return { status: 200, ok: true };
    });
    res.status(out.status).json(out);
  } catch (e) { console.error('resign', e); res.status(500).json({ error: 'server' }); }
});

// Süre aşımı: sırası gelen oyuncu MOVE_LIMIT_MS içinde oynamazsa maçı rakip kazanır.
async function sweep() {
  try {
    const now = Date.now();
    const playing = await db.collection('games').where('status', '==', 'playing').get();
    for (const doc of playing.docs) {
      const upd = doc.get('updatedAt');
      if (!upd || now - upd.toMillis() < MOVE_LIMIT_MS) continue;
      await db.runTransaction(async tx => {
        const s = await tx.get(doc.ref), x = s.data();
        if (!x || x.status !== 'playing' || !x.updatedAt || Date.now() - x.updatedAt.toMillis() < MOVE_LIMIT_MS) return;
        const loser = sideToMove((x.moves || []).length);
        tx.update(doc.ref, { status: 'done', result: loser === 'w' ? 'b' : 'w', reason: 'timeout' });
      });
    }
    const waiting = await db.collection('games').where('status', '==', 'waiting').get();
    for (const doc of waiting.docs) {
      const c = doc.get('createdAt');
      if (c && now - c.toMillis() > 2 * 3600 * 1000) await doc.ref.delete();
    }
  } catch (e) { console.error('sweep', e); }
}
setInterval(sweep, 15000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('buyucu-satranc server :' + port));
