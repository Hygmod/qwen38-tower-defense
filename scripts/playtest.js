#!/usr/bin/env node
/* playtest.js -- headless behavioural test driver for the single-file game.
 *
 * WHY THIS EXISTS. verify-td.py checks the SHAPE of the code; it cannot tell
 * you the game plays. Proving behaviour needs the real frame loop running, and
 * there is no browser here. Every session used to rebuild a driver like this
 * from scratch in /tmp -- measured at ~12% of the loop's entire token budget,
 * rediscovered 11 times. So it lives here, committed, and you just run it.
 *
 *   node scripts/playtest.js              # every scenario
 *   node scripts/playtest.js --list       # names only
 *   node scripts/playtest.js waves        # one scenario
 *
 * Exit 0 if every scenario passed or skipped, 1 if any failed.
 *
 * HOW IT WORKS. The game is a single <script> wrapped in an IIFE, so its
 * top-level bindings are invisible from outside. The driver extracts the
 * script, strips the IIFE wrapper so those bindings land in script scope,
 * auto-discovers them, and republishes them through GETTERS. Getters, not
 * plain references: the game reassigns `enemies`, `route`, `waveQueue` and
 * friends with `=`, and a plain reference captured at boot goes stale the
 * first time a wave starts.
 *
 * Discovery is by regex over the source rather than a hard-coded list, so a
 * session that adds a function gets it exposed for free and this file does not
 * rot. A scenario naming something that no longer exists reports SKIP, not
 * FAIL -- the harness must never punish a legitimate rename.
 *
 * requestAnimationFrame is captured, never scheduled. The driver steps the
 * real frame() itself at a fixed 1/60 dt, so time is deterministic and fifteen
 * waves take about a second.
 *
 * EACH SCENARIO GETS A FRESH BOOT. This cost two runs to learn: sharing one
 * boot let an early game-over cascade false failures into every scenario after
 * it. Scenarios are cheap; boots are cheaper than debugging that again.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, '..', 'index.html');
const DT = 1 / 60;

/* ----------------------------------------------------------- the sandbox */

function makeElement(tag) {
  const el = {
    tagName: tag || 'div',
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    hidden: false,
    width: 640,
    height: 480,
    children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, force) {
        const on = force === undefined ? !this._s.has(c) : !!force;
        on ? this._s.add(c) : this._s.delete(c);
        return on;
      },
      contains(c) { return this._s.has(c); },
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {},
    setAttribute() {},
    getAttribute() { return null; },
    focus() {},
    blur() {},
    click() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 640, bottom: 480, width: 640, height: 480, x: 0, y: 0 };
    },
    getContext() { return makeCtx(); },
  };
  return el;
}

/* A Proxy no-op 2D context: every draw call is absorbed, so the driver never
 * has to track which canvas API the game grew this week. Only the handful of
 * calls that must RETURN something are special-cased. */
function makeCtx() {
  const real = {
    canvas: { width: 640, height: 480 },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    measureText: (t) => ({ width: String(t == null ? '' : t).length * 6 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    isPointInPath: () => false,
    save() {}, restore() {},
  };
  return new Proxy(real, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeSandbox() {
  const frames = [];          // captured rAF callbacks
  const store = new Map();
  const els = new Map();

  const document = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, makeElement(id === 'game' ? 'canvas' : 'div'));
      return els.get(id);
    },
    /* The build/targeting-mode buttons are read with querySelectorAll and then
     * keyed off dataset, so returning [] would silently disable those code
     * paths. Hand back a few elements carrying plausible dataset values. */
    querySelectorAll(sel) {
      const n = 4;
      return Array.from({ length: n }, (_, i) => {
        const el = makeElement('button');
        el.dataset.type = ['gun', 'frost', 'cannon', 'gun'][i];
        el.dataset.mode = ['first', 'last', 'strong', 'close'][i];
        el.dataset.index = String(i);
        return el;
      });
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0]; },
    createElement: (t) => makeElement(t),
    addEventListener() {},
    removeEventListener() {},
    body: makeElement('body'),
    documentElement: makeElement('html'),
  };

  const AudioCtxStub = function () {
    return new Proxy({
      currentTime: 0,
      state: 'running',
      destination: {},
      sampleRate: 44100,
      resume: () => Promise.resolve(),
      close: () => Promise.resolve(),
      createGain: () => audioNode(),
      createOscillator: () => audioNode(),
      createBiquadFilter: () => audioNode(),
      createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
      createBufferSource: () => audioNode(),
      createDynamicsCompressor: () => audioNode(),
    }, { get(t, k) { return k in t ? t[k] : () => audioNode(); } });
  };
  function audioNode() {
    return new Proxy({
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      Q: { value: 0, setValueAtTime() {} },
      type: 'sine',
      connect: () => audioNode(),
      start() {}, stop() {}, disconnect() {},
    }, { get(t, k) { return k in t ? t[k] : () => {}; } });
  }

  let now = 0;
  const sandbox = {
    document,
    window: null,
    console,
    Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean,
    Float32Array, Uint8ClampedArray, Promise, Error, isNaN, parseInt, parseFloat,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    AudioContext: AudioCtxStub,
    webkitAudioContext: AudioCtxStub,
    performance: { now: () => now },
    requestAnimationFrame(cb) { frames.push(cb); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout(cb) { return 0; },        // deliberately never fires: toasts and
    clearTimeout() {},                    // fades must not drive game state
    setInterval() { return 0; },
    clearInterval() {},
    alert() {}, confirm: () => true, prompt: () => null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return { sandbox, frames, advance: (ms) => { now += ms; }, nowRef: () => now };
}

/* -------------------------------------------------------------- the boot */

function readScript() {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('no inline <script> found in index.html');
  return m[1];
}

/* Strip the outermost IIFE so `const state = ...` becomes a script-scope
 * binding we can see. Both `(() => {` and `(function () {` forms, and the
 * matching `})();` at the very end. If the wrapper is gone, leave it alone. */
function stripIIFE(src) {
  const s = src.trim();
  const open = /^\(\s*(?:function\s*[\w$]*\s*)?\([^)]*\)\s*(?:=>\s*)?\{/;
  const close = /\}\s*\)\s*\(\s*\)\s*;?\s*$/;
  if (open.test(s) && close.test(s)) {
    return s.replace(open, '').replace(close, '');
  }
  return src;
}

/* Discover top-level bindings by regex on the de-wrapped source. Only
 * declarations at column zero are top level -- anything indented is inside a
 * function or block and is not ours to publish. */
function discover(src) {
  const names = new Set();
  const re = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return [...names];
}

function boot() {
  const raw = readScript();
  const body = stripIIFE(raw);
  const names = discover(body);

  // Getters, so reassigned bindings stay live. Each one guarded, because a
  // `class` or a conditional declaration can be in TDZ at read time.
  const exports = names
    .map((n) => `  get ${n}() { try { return ${n}; } catch (e) { return undefined; } },`)
    .join('\n');
  const code = `${body}\n;globalThis.__G = {\n${exports}\n};\n`;

  const { sandbox, frames, advance } = makeSandbox();
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'game.js' });

  const G = sandbox.__G;
  if (!G) throw new Error('export shim did not run');
  if (frames.length === 0) throw new Error('game never called requestAnimationFrame -- no frame loop to drive');

  /* Drive the real loop. The game re-registers its callback every frame, so
   * take the most recent one each tick and feed it a monotonic timestamp. */
  let t = 0;
  function step(seconds) {
    const n = Math.max(1, Math.round(seconds / DT));
    for (let i = 0; i < n; i++) {
      const cb = frames[frames.length - 1];
      if (!cb) break;
      t += DT * 1000;
      advance(DT * 1000);
      cb(t);
    }
  }
  return { G, step, sandbox };
}

/* ----------------------------------------------------------- assertions */

class Skip extends Error {}

function need(G, ...names) {
  for (const n of names) {
    if (G[n] === undefined) throw new Skip(`no binding named '${n}'`);
  }
  return names.map((n) => G[n]);
}

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ------------------------------------------------------------ scenarios */

const SCENARIOS = {
  boots: (t) => {
    const { G } = t;
    need(G, 'state', 'route');
    check(G.route.length > 1, `route should span entry to exit, got ${G.route.length} cells`);
    check(G.state.lives > 0, 'should start with lives');
    check(G.state.gold > 0, 'should start with gold');
  },

  /* The core promise of the genre: a competent layout survives. Towers are
   * placed beside the route rather than on it, so this also proves that
   * placement, targeting, projectiles, damage and the wave state machine all
   * agree with each other.
   *
   * Deliberately asserts SURVIVAL, not a flawless run. A zero-leak assertion
   * would fire the first time a session legitimately rebalances difficulty,
   * and a gate that cries wolf gets ignored. Leaking some lives across fifteen
   * waves is a well-tuned game; dying is a broken one. */
  waves: (t) => {
    const { G, step } = t;
    const [buildTower, startWave] = need(G, 'buildTower', 'startWave', 'state', 'route');
    G.state.gold = 100000;

    let built = 0;
    for (const cell of G.route) {
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const c = cell.c + dc, r = cell.r + dr;
        if (c < 0 || r < 0) continue;
        if (G.canPlace && !G.canPlace(c, r).ok) continue;
        buildTower(c, r);
        built++;
        if (built >= 24) break;
      }
      if (built >= 24) break;
    }
    check(built > 8, `expected to place a real defence, only placed ${built}`);

    // Play like someone who is trying: keep the towers upgraded.
    const upgradeAll = () => {
      if (!G.upgradeTower || !G.towerGrid) return;
      for (const row of G.towerGrid) {
        for (const tw of row || []) {
          if (tw) { try { G.upgradeTower(tw); } catch (e) { /* maxed or broke */ } }
        }
      }
    };

    const startLives = G.state.lives;
    for (let w = 0; w < 15; w++) {
      G.state.gold = 100000;
      upgradeAll();
      startWave();
      let guard = 0;
      while (G.state.waveInProgress && guard < 60 * 60 * 3) { step(DT); guard++; }
      check(guard < 60 * 60 * 3, `wave ${w + 1} never finished -- the wave state machine is stuck`);
      check(G.state.lives > 0, `lost the game on wave ${w + 1} with 24 upgraded towers`);
    }
    check(G.state.lives > 0, 'should still be alive after 15 waves');
    // Enemies must actually be dying, not just walking past a decorative defence.
    const leaked = startLives - G.state.lives;
    check(leaked < startLives * 0.75,
      `leaked ${leaked} of ${startLives} lives -- towers are barely killing anything`);
  },

  /* Sealing the maze must be refused. This is the rule the whole pathfinding
   * design exists to protect, and it is invisible to a static check. */
  sealing: (t) => {
    const { G } = t;
    const [canPlace] = need(G, 'canPlace', 'COLS', 'ROWS', 'buildTower', 'state');
    G.state.gold = 100000;
    let sealed = null;
    // Wall off a full column but one cell, then try to close it.
    const col = Math.floor(G.COLS / 2);
    let open = -1;
    for (let r = 0; r < G.ROWS; r++) {
      if (canPlace(col, r).ok) { if (open < 0) { open = r; continue; } G.buildTower(col, r); }
    }
    check(open >= 0, 'could not build a wall to test sealing with');
    const verdict = canPlace(col, open);
    check(!verdict.ok, 'placing the last cell of a full wall should be rejected, but was allowed');
  },

  /* Pause must freeze the world exactly -- not slow it, not skip it. */
  pause: (t) => {
    const { G, step } = t;
    const [startWave, togglePause] = need(G, 'startWave', 'togglePause', 'state');
    startWave();
    step(1.5);
    togglePause();
    const snap = JSON.stringify((G.enemies || []).map((e) => [e.x, e.y]));
    step(2.0);
    check(JSON.stringify((G.enemies || []).map((e) => [e.x, e.y])) === snap,
      'enemies moved while the game was paused');
    togglePause();
    step(0.5);
    if ((G.enemies || []).length) {
      check(JSON.stringify((G.enemies || []).map((e) => [e.x, e.y])) !== snap,
        'enemies did not resume moving after unpause');
    }
  },

  /* Every targeting mode must pick the enemy it advertises. Bugs here are
   * completely invisible to a shape check -- iteration 13 shipped one. */
  targeting: (t) => {
    const { G, step } = t;
    const [acquireTarget, buildTower, startWave] = need(G, 'acquireTarget', 'buildTower', 'startWave', 'state', 'route');
    G.state.gold = 100000;
    const mid = G.route[Math.floor(G.route.length / 2)];
    let tower = null;
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (G.canPlace(mid.c + dc, mid.r + dr).ok) {
        buildTower(mid.c + dc, mid.r + dr);
        tower = (G.towerGrid[mid.r + dr] || [])[mid.c + dc];
        if (tower) break;
      }
    }
    if (!tower) throw new Skip('could not place a tower next to the route');
    /* Guard on the FEATURE, not the binding. acquireTarget has existed since
     * the first build, but per-tower targeting modes arrived later; asserting
     * mode semantics against a build that has none reports a bug that is not
     * there. If towers carry no `mode` of their own, there is nothing to test. */
    if (tower.mode === undefined) throw new Skip('towers have no targeting mode yet');
    tower.range = 10000;   // see the whole board, so ordering is the only variable

    startWave();
    step(6);
    const inRange = (G.enemies || []).filter((e) => !e.dead && !e.leaked);
    if (inRange.length < 2) throw new Skip('not enough live enemies to compare targeting');

    const modes = ['first', 'last', 'strong', 'close'];
    for (const m of modes) {
      tower.mode = m;
      const got = acquireTarget(tower);
      if (!got) continue;
      if (m === 'strong') {
        const maxHp = Math.max(...inRange.map((e) => e.hp));
        check(got.hp === maxHp, `mode 'strong' picked hp=${got.hp}, board max is ${maxHp}`);
      }
      if (m === 'close') {
        const d = (e) => Math.hypot(e.x - tower.x, e.y - tower.y);
        const min = Math.min(...inRange.map(d));
        check(Math.abs(d(got) - min) < 1e-6, `mode 'close' did not pick the nearest enemy`);
      }
      if (m === 'first' && G.enemyProgress) {
        const max = Math.max(...inRange.map((e) => G.enemyProgress(e)));
        check(Math.abs(G.enemyProgress(got) - max) < 1e-6, `mode 'first' did not pick the furthest-along enemy`);
      }
    }
  },

  /* Money must not leak. A rejected build charges nothing; a sell refunds a
   * fraction, never more than was paid. */
  economy: (t) => {
    const { G } = t;
    const [buildTower, canPlace] = need(G, 'buildTower', 'canPlace', 'state');
    G.state.gold = 500;
    // A build on the route itself must be refused and must not charge.
    const on = G.route[Math.floor(G.route.length / 2)];
    if (!canPlace(on.c, on.r).ok) {
      const before = G.state.gold;
      buildTower(on.c, on.r);
      check(G.state.gold === before,
        `a rejected placement charged the player ${before - G.state.gold}g`);
    }
    // Build then sell: refund must be positive and less than the price paid.
    let placed = null;
    for (const cell of G.route) {
      for (const [dc, dr] of [[0, -1], [0, 1]]) {
        const c = cell.c + dc, r = cell.r + dr;
        if (c >= 0 && r >= 0 && canPlace(c, r).ok) {
          const before = G.state.gold;
          buildTower(c, r);
          if (G.state.gold < before) { placed = { c, r, paid: before - G.state.gold }; break; }
        }
      }
      if (placed) break;
    }
    if (!placed || !G.sellTower) throw new Skip('could not build a tower to sell');
    const tower = (G.towerGrid[placed.r] || [])[placed.c];
    if (!tower) throw new Skip('tower did not land in towerGrid');
    const before = G.state.gold;
    G.sellTower(tower);
    const refund = G.state.gold - before;
    check(refund > 0, 'selling refunded nothing');
    check(refund <= placed.paid, `sell refunded ${refund}g for a ${placed.paid}g tower`);
  },
};

/* ------------------------------------------------------------------ main */

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    Object.keys(SCENARIOS).forEach((n) => console.log(n));
    return 0;
  }
  const only = args.filter((a) => !a.startsWith('-'));
  const names = only.length ? only : Object.keys(SCENARIOS);

  let failed = 0, passed = 0, skipped = 0;
  for (const name of names) {
    const fn = SCENARIOS[name];
    if (!fn) { console.log(`  ??  ${name} -- no such scenario`); failed++; continue; }
    let t;
    try {
      t = boot();                       // FRESH boot per scenario, deliberately
    } catch (e) {
      console.log(`  FAIL  ${name} -- boot failed: ${e.message}`);
      failed++;
      continue;
    }
    try {
      fn(t);
      console.log(`  ok    ${name}`);
      passed++;
    } catch (e) {
      if (e instanceof Skip) {
        console.log(`  skip  ${name} -- ${e.message}`);
        skipped++;
      } else {
        console.log(`  FAIL  ${name} -- ${e.message}`);
        failed++;
      }
    }
  }
  console.log(`\nplaytest: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (skipped) {
    console.log('A skip means a scenario could not find the binding it needed -- usually a');
    console.log('rename. That is not a failure, but the scenario stopped protecting you.');
  }
  return failed ? 1 : 0;
}

process.exit(main());
