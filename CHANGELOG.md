# Changelog

This file is the only memory that survives between sessions. Read it before you
start, and update it before you finish.

## Done

What has already been built. Newest at the bottom. Do not repeat any of this.

- Initial build from SPEC.md: 20x15 grid with BFS routing, gun + frost towers,
  waves with staggered spawns, gold/lives economy, upgrade and sell, predictive
  aiming, delta-time loop with a 2x toggle.
- Fixed live re-pathing soft-lock: enemies in transit that floor-mapped onto a
  just-blocked cell were permanently frozen (wave could never clear); they now
  re-path from the nearest adjacent cell that still reaches the exit.
- Fixed targeting priority for boxed-in enemies: a frozen enemy trapped in a
  sealed pocket ranked MAX progress, so all towers in range wasted DPS on it
  while real enemies leaked; it now ranks lowest (still shootable alone).
- Added a live "Enemies remaining" counter in the side panel showing alive and
  yet-to-spawn enemies during an active wave.
- Hover build preview now draws the re-routed enemy path (dashed amber line)
  that the maze WOULD have if the tower were committed there; canPlace() now
  returns the candidate-grid path it already computed, so the preview is free.
- Fixed a targeting tie: boxed-in enemies ranked progress 0, equal to a
  just-spawned enemy, so array order let the stale frozen enemy keep stealing
  shots; enemyProgress now returns -1 so real enemies always outrank it.
- Verified the suspected economy bug from Known issues is not a bug:
  buildTower() runs canPlace() (sealing check, no mutation) before any gold
  deduction, so rejected placements never charge the player.
- Fixed a wave soft-lock: an enemy sealed into a pocket by legal placements
  (entry->exit still connects, so each build is allowed) ends up with an empty
  route and sits forever, so the wave never clears and Start Wave stays
  disabled. Boxed-in enemies now run a 5s grace timer (TRAP_GRACE) shown as a
  draining amber countdown ring; if not shot down or freed by selling a tower
  (re-path resets the clock) they dissolve for no gold and the wave can clear.
  Kill-box play still works: towers in range shoot it, and repath on sell
  frees it. Logic exercised in Node (trap, dissolve timing, escape, no gold).
- Fixed projectile tunneling after a long frame: updateProjectiles() now runs a
  swept segment-vs-circle hit test (new closestOnSegment() helper) over the
  whole segment a shot travels this frame instead of sampling only the endpoint,
  so the first frame after a tab refocus (~0.2s, ~86px for a gun shot) can no
  longer step clean over a close enemy. Keeps the earliest contact along the
  path so a shot crossing two enemies hits the nearer one. Verified in Node:
  tunnel hit, no off-path false positive, earliest-of-two, short-step
  regression, frost slow, start-overlap, out-of-bounds.
- Added enemy variety: three types (normal, scout, brute) with distinct
  speed/HP/size/color/reward. Scouts (fast, fragile) appear from wave 3;
  brutes (slow, tanky) from wave 5. spawnEnemy() picks a type via
  pickEnemyType() using per-type multipliers from an ENEMY_TYPES config.
  drawEnemy() now reads e.color instead of a hard-coded pink. A legend in the
  side panel explains each type and hints at counterplay (frost for scouts,
  concentrated fire for brutes).
- Added a Pause feature: a Pause/Resume button in the controls plus a `P`
  hotkey freeze the simulation while the render loop keeps running, so you can
  plan tower placement mid-wave without racing the enemies. `lastTime` still
  updates every frame so resuming never fast-forwards, and building while
  paused works and takes effect on resume. A "Paused" badge shows over the
  canvas; the button is disabled at game over and its state/UI reset cleanly
  on Play Again.
- Fixed a targeting bug that fully broke the "box them in" kill strategy:
  a boxed-in (trapped) enemy reports progress -1, but acquireTarget() started
  its best-so-far at -1 with a strict > compare, so -1 > -1 was always false
  and no tower ever fired on a trapped enemy even when it was the only one in
  range -- it just sat and dissolved for no gold after the TRAP_GRACE timer.
  acquireTarget() now seeds best-so-far at -Infinity, so a lone boxed-in enemy
  is targetable (as the Done notes intended) while every real enemy (progress
  >= 0) still strictly outranks it. Verified in Node against the extracted
  functions: boxed-alone now shoots, real-alone and both (either order) still
  pick the real enemy, empty stays null.
- Added per-tower targeting modes (First/Last/Strong/Close), selectable from a
  segmented control in the Selected Tower panel: acquireTarget() now branches on
  t.mode (default "first"), so you can focus-fire brutes (Strong), pick off the
  rearmost (Last), or shoot the nearest (Close). Each mode falls back to the
  others for deterministic tie-breaking, and best still starts null so a lone
  boxed-in enemy stays targetable (kill-box preserved). New .mode-btn control +
  default mode field in buildTower + a hint tying Strong to brute counterplay.
  Verified in Node against the extracted acquireTarget: 14 cases (each mode,
  default, boxed-alone, real-outranks-boxed, out-of-range ignore, tie-break,
  dead/leaked-skip) all pass.
- Added game-over statistics: the overlay now shows Wave reached, total Kills,
  total Gold earned (kills + wave bonuses), and Best wave (persisted in
  localStorage). state.kills and state.totalGoldEarned are incremented in
  damageEnemy() and updateWave() respectively, and reset on Play Again.
- Added a third tower, the Cannon (hotkey 3, 100g, orange #ff8c42): slow
  single projectile that detonates at its first contact point and deals area
  damage to every enemy within a 1.3-cell radius with linear falloff (full at
  centre, 50% at the edge). It fills the anti-swarm gap left by the two
  single-target towers now that waves scale in count. Implemented by adding a
  `splash` field to projectiles and branching in updateProjectiles() -- the
  detonation point is the earliest swept-segment contact (reusing the existing
  hit test, so it stays tunnel-proof), and a `explosions` ring effect (updated
  in a new updateEffects(), dt-scaled like everything else) marks each blast.
  Gun/frost are unaffected (splash 0 keeps the single-target path). New build
  button + swatch, key 3, and a legend note. Verified in Node against the
  extracted functions: cluster kill, far-enemy ignored, gun single-target
  regression, full/half falloff, and no explosion on a miss -- all pass.
- Added a Boss enemy that appears at the tail of every 5th wave (5, 10, 15…):
  very slow (0.4x), very tanky (8x HP), large radius (18px), purple with a
  golden crown and wider HP bar. It rewards 5x gold on kill, incentivising the
  player to concentrate fire or slow it. spawnEnemy() now accepts an optional
  forceType parameter; updateWave() spawns the boss once per qualifying wave
  (state.bossSpawned flag, reset in startWave and resetGame). The boss
  integrates with all existing systems (targeting, frost slow, cannon splash,
  trap/dissolve, leak). Legend updated with boss entry and counterplay hint.
- Added synthesized sound effects via the Web Audio API (no files, no deps):
  per-tower shots, cannon blast (low-passed noise burst), kill, leak alarm,
  trapped-dissolve, build/upgrade/sell, wave start/clear, boss fanfare, game
  over sting. The AudioContext is created lazily on the first user gesture so
  autoplay policy is never fought, a 12-sound/frame budget (reset in
  Sound.beginFrame() at the top of update()) caps dense moments, and the
  mute toggle (new ghost button + `M` hotkey, persisted in localStorage as
  td-sound) silences everything and is honored at boot. Verified in Node
  against the extracted module with a fake Web Audio API: 15 cases pass
  (node graph, resume-from-suspended, budget cap, noise-buffer caching,
  arpeggio, mute on/off/persistence, persisted-mute boot).
- Added a next-wave lineup preview: each wave's exact composition is now
  pre-rolled up front (planWave()) instead of drawn per spawn, so the side
  panel shows a "Next N: ●counts" row (colored dots per enemy type, Boss
  called out) for the coming wave before it starts — live during the current
  wave too, so you can save gold for a 5th-wave boss or prep anti-scout frost.
  startWave() promotes nextWavePlan to the active waveQueue and rolls the
  following wave; updateWave() spawns from waveQueue.shift(); the boss is the
  last queue element on 5th waves and its fanfare/toast moved into
  spawnEnemy(); state.bossSpawned is gone. Verified in Node: planWave
  invariants (length, boss-at-tail, type eligibility) across 30 waves x 50
  rolls, and queue consumption over a full 60-wave run (no underflow, tail
  boss on all 12 fifth-waves).
- Added floating damage numbers: white damage text rises and fades above each
  enemy on hit; kills show an amber gold-reward float ("+Ng") that lingers
  longer. A new `floats` array + spawnFloat()/updateFloats() (dt-scaled) +
  canvas render pass (with a 1px shadow for readability) handle the effect;
  capped at 36 active floats so cannon splash never floods. Verified in Node:
  spawn/decay timing and cap bound.
- Added per-tower performance stats to the Selected Tower panel: each tower
  now tracks `dealt` (total damage) and `kills` (finishers), tallied in
  damageEnemy() via a new `src` parameter that projectiles carry from their
  firing tower (cannon splash attributes every splash hit to the cannon, so
  area towers credit correctly). The panel shows Dealt / Kills / Value, where
  Value = damage per gold invested (with a tooltip explaining it) -- this
  gives the player the feedback needed to decide which tower to upgrade next
  and which to sell, which was previously a blind guess. Verified in Node
  against the extracted functions: 12 cases pass (partial-hit tally, kill
  attribution, gold reward, no-src safety, dead-enemy no-recount, splash
  multi-victim credit with falloff bounds).
- Added gold interest (classic TD banking): each cleared wave now banks
  5% of the gold still on hand, capped at 30g per wave (INTEREST_RATE /
  INTEREST_CAP, shared helper waveInterest()), credited to both state.gold
  and state.totalGoldEarned alongside the wave bonus, with the amount called
  out in the wave-clear toast. This turns the existing "save for the boss"
  strategy (next-wave preview) into a real save-vs-spend decision: hoarding
  pays a little, spending now loses the bank. The Next row now shows a live
  "bank +Ng" figure (recomputed each frame from current gold) so the player
  sees what a clear would pay, and the legend hints at the mechanic. The cap
  keeps late-game hoards from snowballing past ~one tower per wave. Verified
  in Node against the extracted waveInterest: 8/8 cases pass (zero, floor
  rounding, below/at/over cap), plus shape checks that the wave-clear branch
  calls it and credits gold + totalGoldEarned with bonus+interest.
- Fixed Play Again carrying the speed toggle into the next game: resetGame() now
  resets state.speed to 1 and refreshes the Speed button via a new syncSpeedBtn()
  helper (matching the syncSoundBtn/syncAutostartBtn pattern; the click handler
  now uses it too), so a 2x session no longer restarts at 2x.
- Added a before→after upgrade preview to the Selected Tower panel: the
  cost line now shows what the upgrade buys (e.g. "→ Damage 12 17 · Range
  3.4 3.8") so the escalating cost is an informed choice. The math moved
  into a shared upgradedStats() helper used by both upgradeTower() and the
  preview, so the two can never drift; ladder verified in Node for all
  three tower types (damage/range per level match the old inline formula
  exactly).
- Added an "Auto-start" toggle (ghost button in the controls): when on, each
  cleared wave schedules the next one AUTO_START_DELAY (4s) later, so the
  player can keep building hands-free between waves. A new state.autoStart
  flag arms it and state.autoStartTimer counts down in updateWave() *between*
  waves only — the tick is dt-scaled and update() is skipped while paused, so
  the delay freezes under Pause and shortens under 2x for free. The countdown
  is shown live on the Start Wave button ("Start Wave · auto Ns"); a manual
  start, toggling the feature off, or Play Again all cancel a running
  countdown so it never surprises. Verified in Node against the real loop
  (ON fires wave 2 with no click, OFF never auto-starts, manual start cancels
  the timer), and the full playtest suite (6/6) still passes.
- Fixed the responsive layout: on narrow windows the flexbox-centering
  overflow bug clipped the left edge of the canvas with no way to scroll back
  to it. Replaced `align-items/justify-content: center` on body with
  `margin: auto` on `.app` (avoids the negative-overflow clipping), added
  `overflow: auto` on body as a safety net, and two media queries: ≤960px
  switches the layout to a column (canvas above panel, panel full-width up to
  480px) and ≤700px scales the canvas to fit the viewport width while keeping
  its 4:3 aspect ratio (eventCell() already compensates for CSS scaling so
  mouse input stays accurate). Playtest 6/6 still passes.
- Added onboarding: a dismissible "How to play" overlay (#help-overlay, a
  scrollable help-card over the canvas) that explains the goal, building and
  the sealing rule, waves/economy (Next-row preview, 5% interest banking,
  bosses), upgrade/sell, per-tower targeting modes, enemy counterplay (scouts,
  brutes, kill-box) and the key list. It auto-shows on first load only —
  dismissal persists in localStorage (td-help-seen) — and reopens via the new
  "How to play" ghost button or the `H` hotkey; Escape closes it when open
  (otherwise still deselects). Pure UI: no game-logic changes, playtest 6/6
  still passes.
- Added a master volume slider (range input, 0–100%) next to the Sound
  button: a master GainNode (created once with the AudioContext) sits between
  every tone/blast and the destination, so the slider scales all SFX
  uniformly without touching per-sound levels. Volume persists in
  localStorage (td-volume); the slider dims and disables when sound is muted
  and re-syncs on boot and on mute toggle. Also fixed `resetGame()` not
  clearing `state.hover`, which left a stale build preview (range circle,
  dashed re-route line, tower ghost) over the fresh maze after Play Again.
  Playtest 6/6 still passes.
- Fixed simultaneous-leak double game-over: the leak branch in updateEnemy()
  never re-checked state.gameOver, so two enemies reaching the exit in the same
  frame each fired Sound.gameOver() and re-rendered the overlay, and could push
  lives below 0 mid-frame; it now returns early when the game is already over,
  so the sting/overlay fire exactly once and lives clamps to 0 (both leaks still
  count when the second leaker is what exhausts lives). Verified in Node against
  the real loop: 3 cases pass (simultaneous-leak sting-once, both-leaks-count,
  lone-leaker regression), and the guard was confirmed to fail the first case
  when removed. Playtest 6/6 still passes.
- The help overlay now auto-pauses the sim while it is open, and document-level
  hotkeys no longer steer the game behind it: showHelp() pauses when a game is
  under way (state.wave > 0, so the first-load auto-show over an empty maze
  stays live -- which also keeps the harness's boot-running assumption intact)
  and hideHelp() resumes ONLY if the card took the pause (a manual pause
  survives a help round-trip; a manual resume via P/button releases the card's
  claim). While the card is up the keydown handler swallows every hotkey except
  H/Esc, both of which now close it (H is a toggle). resetGame keeps the world
  frozen if the card is open (Play Again edge), pause button/badge syncing moved
  into a shared syncPauseUI() used by togglePause/showHelp/hideHelp/resetGame,
  and the card notes the game pauses while it's open. Verified in Node against
  the extracted script with a keydown-capturing driver: 33 checks pass (hotkey
  gating, H-toggle, auto-pause/resume ownership, manual-pause survival,
  manual-resume takeover, game-over no-op, reset-with-help-open). Playtest 6/6.
- Removed dead `routeKeys`: the cell-key Set rebuilt in recomputeRoute() was
  never read (path tiles render straight from `route`, and canPlace() uses its
  own candidate-grid BFS), so it was pure write-only overhead. Deleted the
  declaration and the rebuild line. Playtest 6/6 still passes.
- Softened the wave 3–4 scout spike in pickEnemyType(): scouts now debut at
  25% (wave 3) and 35% (wave 4) instead of jumping straight to 55%, so the
  expected-speed jump from wave 2 drops from ~+38% to ~+18% (1.0 → 1.175 →
  1.244); wave 5+ keeps the shipped mix exactly (20% brute / 35% scout /
  45% normal). Verified in Node over 200k rolls per wave: distributions match
  the targets and only normal/scout/brute are ever returned. Playtest 6/6.
- Added numeric HP for high-HP enemies: drawEnemy() now prints a live HP
  count above the health bar for brutes (white) and the boss (amber), so the
  player can see exactly how much damage is left to take them down instead of
  eyeballing a tiny sliver of bar. Pure render addition (Math.ceil(e.hp),
  same 1px-shadow style as damage floats); the side-panel legend and the help
  overlay both note the mechanic. Playtest 6/6 still passes.
- Fixed the volume slider's undefined accent: #vol-slider used
  `accent-color: var(--accent)` but `--accent` was never defined in :root, so
  it silently fell back to the browser-default accent; it now points at the
  existing `--mint` token (the palette's primary accent). Pure CSS one-liner.
  Playtest 6/6 still passes.

## Backlog

Work that is queued but not done: bugs worth fixing and improvements worth
making. Both count equally.

Each item is one bullet. Keep it short -- a sentence or two saying what is
wrong or what is missing, and enough detail that the next developer can start
without rediscovering it. No IDs, no status fields, no priorities.

- `syncHud()` runs every frame from frame() and unconditionally rebuilds `elSelStats.innerHTML` whenever a tower is selected (only the Next row has a diff guard, lastNwHtml), and render() runs `canPlace()` — a full grid copy plus BFS — every frame while the mouse hovers an empty cell. Diff the stats HTML the same way and cache the hover placement check, recomputing it only when the hovered cell, the maze, or the gold changes.
- `spawnEnemy()` runs a fresh `findPath(towerGrid, ENTRY, EXIT)` BFS on every single spawn even though the cached `route` is already current (recomputeRoute() runs on every build and sell). Assign `e.route = route` instead, falling back to a recompute only if route is empty.
- No touch support: canvas input is mouse-only (mousemove/mouseleave/click). Taps do fire click so building works, but there is no preview and the canvas has no `touch-action: none`, so dragging over it scrolls the page on mobile. Add `touch-action: none` and map tap/touchstart onto the same build-or-select path as click.
- `bestWave` (persisted in localStorage) is only surfaced on the game-over screen; the side panel never shows the all-time best during a run, so the player can't see the goal they're chasing. Show it in the panel, e.g. a small line under the Wave stat.

When you finish an item, DELETE its bullet from here and add a line under Done.
