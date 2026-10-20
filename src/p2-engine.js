// ==ENGINE-START==
// chess.js 0.10.2 has no board(); build the 8x8 array (rank 8 first) from get().
const BOARD_SQ = [];
for (let r = 0; r < 8; r++) { const row = []; for (let c = 0; c < 8; c++) row.push('abcdefgh'[c] + (8 - r)); BOARD_SQ.push(row); }
function boardOf(g) { return BOARD_SQ.map(row => row.map(sq => g.get(sq))); }
const Engine = (function () {
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const PST = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  const MATE = 100000;
  const LEVELS = {
    1: { depth: 1, q: false, noise: 90, budget: 1500 },
    2: { depth: 2, q: true, noise: 12, budget: 3000 },
    3: { depth: 3, q: true, noise: 0, budget: 3500 }
  };
  let useQ = true;

  function evaluate(g) {
    const b = boardOf(g);
    let s = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        const v = VAL[p.type] + (p.color === 'w' ? PST[p.type][r * 8 + c] : PST[p.type][(7 - r) * 8 + c]);
        s += p.color === 'w' ? v : -v;
      }
    }
    return s;
  }
  const side = g => (g.turn() === 'w' ? 1 : -1);
  function order(moves) {
    return moves
      .map(m => ({ m, k: (m.captured ? 10 * VAL[m.captured] - VAL[m.piece] / 10 : 0) + (m.promotion ? 800 : 0) }))
      .sort((a, b) => b.k - a.k)
      .map(o => o.m);
  }
  const play = (g, m) => g.move({ from: m.from, to: m.to, promotion: m.promotion });

  function quiesce(g, alpha, beta, qd) {
    const stand = side(g) * evaluate(g);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 3) return alpha;
    const caps = order(g.moves({ verbose: true }).filter(m => m.captured || m.promotion));
    for (const m of caps) {
      play(g, m);
      const sc = -quiesce(g, -beta, -alpha, qd + 1);
      g.undo();
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function negamax(g, depth, alpha, beta, ply) {
    if (depth <= 0) return useQ ? quiesce(g, alpha, beta, 0) : side(g) * evaluate(g);
    const moves = g.moves({ verbose: true });
    if (!moves.length) return g.in_check() ? -MATE + ply : 0;
    let best = -Infinity;
    for (const m of order(moves)) {
      play(g, m);
      const sc = -negamax(g, depth - 1, -beta, -alpha, ply + 1);
      g.undo();
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function findBest(fen, level, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const g = new Chess(fen);
      const cfg = LEVELS[level] || LEVELS[2];
      const noise = opts.noise !== undefined ? opts.noise : cfg.noise;
      const cancel = opts.cancel || (() => false);
      const root = order(g.moves({ verbose: true }));
      if (!root.length) return resolve(null);
      useQ = cfg.q;
      const results = [];
      const start = performance.now();
      let i = 0, alpha = -Infinity;
      const full = noise > 0;
      function step() {
        if (cancel()) return resolve(null);
        const t0 = performance.now();
        do {
          if (i >= root.length) break;
          const m = root[i++];
          play(g, m);
          const d = performance.now() - start > cfg.budget ? Math.max(1, cfg.depth - 1) : cfg.depth;
          let sc;
          if (g.in_checkmate()) sc = MATE;
          else sc = -negamax(g, d - 1, full ? -Infinity : -Infinity, full ? Infinity : -alpha, 1);
          g.undo();
          results.push({ m, sc });
          if (sc > alpha) alpha = sc;
        } while (performance.now() - t0 < 14 && i < root.length);
        if (i < root.length) return setTimeout(step, 0);
        results.sort((a, b) => b.sc - a.sc);
        const top = results[0].sc;
        let pool = results.filter(r => r.sc >= top - noise);
        if (level === 1 && Math.random() < 0.25) pool = results.slice(0, Math.min(4, results.length));
        if (!pool.length) pool = [results[0]];
        resolve(pool[Math.floor(Math.random() * pool.length)].m);
      }
      step();
    });
  }
  return { findBest };
})();
// ==ENGINE-END==
