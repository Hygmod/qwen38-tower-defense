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
- Fixed the "First" targeting inversion after the first build: repathEnemy()
  re-roots each enemy's route at its own cell on every build/sell, so
  enemyProgress() ranking by e.routeIndex no longer measured closeness to the
  exit (a front-line enemy on a freshly re-rooted 3-cell route ranked below
  one 10 cells out, and towers stopped shooting the front). enemyProgress()
  now returns the negated distance to the exit along the enemy's own route
  (`routeIndex + 1 - route.length` minus the fraction of the segment still to
  the next waypoint), so higher = closer for routes of any length; the
  boxed-in sentinel became -Infinity (not -1, which the backlog sketch
  suggested) because real progress is now negative and unbounded below as
  routes grow — the guard's purpose is unchanged: boxed-in ranks last in
  First yet stays targetable when alone via acquireTarget's `best === null`
  seed. Verified in Node against the extracted functions: 9 cases pass
  (front outranks rear after repath, Last picks rearmost, boxed-in alone /
  vs real across modes, fresh-spawn regression, within-segment monotonicity,
  strong hp-tie toward front). Playtest 6/6.
- Cut two per-frame hotspots: syncHud() now diffs the selected tower's stats
  and upgrade/cost innerHTML (lastSelStatsHtml / lastSelCostsHtml, the same
  pattern as lastNwHtml) so the parse only runs when a displayed value
  changes, and the constant tooltip moved to init; render() no longer runs
  canPlace()'s full grid copy + BFS every frame while hovering — the cheap
  checks (bounds, gates, enemy-on-cell via enemyInCell()) stay live each
  frame and the candidate-grid BFS is cached in hoverBfs keyed on
  (cell, mazeVersion), with mazeVersion bumped in recomputeRoute() so any
  build/sell/reset invalidates it. The commit path (click -> buildTower ->
  canPlace) is untouched and remains authoritative. Verified in Node against
  the real loop: cache holds across 30 frames (one BFS), recomputes on cell
  change / build / sell, gate hover is cheap (no BFS), and stats+costs HTML
  are each written once across 60 idle frames with a tower selected.
  Playtest 6/6 still passes.
- Fixed Play Again carrying the Auto-start flag into the next game: resetGame()
  reset state.speed and state.autoStartTimer but not state.autoStart, so dying
  with Auto-start on left it armed and the next game auto-launched wave 2 four
  seconds in with no warning. resetGame() now also sets state.autoStart = false
  and calls syncAutostartBtn() (matching the syncSpeedBtn pattern), so a fresh
  game always starts with auto-start off. Playtest 6/6 still passes.

- Added a mid-game Restart ghost button in the controls row (next to
  Speed/Pause, `#btn-restart-mid`) that calls the same `resetGame()` as the
  game-over Play Again, so a botched early build can be abandoned without
  losing all 20 lives. Verified in Node against the real script with the
  playtest boot harness: a mid-wave click resets gold/lives/wave/kills/economy
  counters, clears enemies/projectiles/selection/hover/speed/auto-start, and
  the fresh run is playable afterwards; also confirmed the help-card
  open-freeze interaction (reset keeps the world frozen while the card is up,
  by design). Playtest 6/6 still passes.
- Added touch support: `touch-action: none` on the canvas stops drags from
  scrolling the page, and touchstart/touchmove/touchend/touchcancel now feed
  the same build-or-select path as click via a shared `tapCell()` (extracted
  from the old click handler). The press position sets `state.hover` so the
  build preview renders while the finger is down; a tap (movement under ~10px,
  tracked in `touchDown`) commits, a longer drag only scrubs the preview,
  and lift/cancel clears hover like mouseleave. `preventDefault` stops the
  browser synthesising a second click on top of the tap. Two-finger touches
  and taps after game over are no-ops; sealing rejections flow through the
  same canPlace() branch as clicks. Verified in Node against the real script
  with synthetic touch events: 19 cases pass (build, gold, select, preview,
  drag-suppress, wobble-tap, cancel, two-finger, seal-reject, game-over).
  Playtest 6/6 still passes.
- Guarded the mid-game Restart button (`#btn-restart-mid`) against
  misclicks: its click handler now wraps `resetGame()` in a
  `confirm("Abandon this run and start over?")`, so a stray click no
  longer wipes an in-progress run. The game-over Play Again button is
  untouched (the run is already over). Playtest 6/6 still passes.
- Added a way to cancel the active build type: `selectBuildType()` now
  toggles, so re-picking the already-selected tower button (or re-pressing
  its hotkey) sets `state.buildType = null` and drops every button's
  `.selected` class, entering an inspect mode where `tapCell()` clears the
  selection but never builds (and the hover preview render pass is skipped,
  which also removed its only null-deref path). Switching to a different
  type still switches as before. Help card's Building section and Keys line
  note the cancel. Verified in Node against the real script: 19 cases pass
  (toggle on/off via re-pick, switch gun→frost→cannon, no selected class in
  inspect mode, inspect tap builds nothing/charges no gold/selects placed
  towers, build-mode tap regression, render safe with hover + null
  buildType). Playtest 6/6 still passes.
- Added the all-time best wave to the side panel: a new `#best-wave` line
  under the stats grid shows "Best wave: N" (— while none is set) during a
  run, so the player sees the goal being chased instead of only at game
  over. syncHud() renders it with the same diff-cache pattern as lastNwHtml
  (new lastBestHtml) so the innerHTML parse only runs when the value
  changes; while the current run is at or past the best (state.wave >=
  bestWave) the number turns amber with a ★ so a record attempt is visible
  at a glance. bestWave itself is untouched (still persisted in
  showGameOver()). Playtest 6/6 still passes.
- Cut the redundant per-spawn pathfinding: spawnEnemy() ran a fresh
  findPath(towerGrid, ENTRY, EXIT) BFS for every single enemy a wave fired,
  even though the cached `route` is already current (recomputeRoute() runs on
  init, every build, and every sell, and is followed by repathAllEnemies()).
  It now assigns `e.route = route` (sharing the array; safe because route
  arrays are never mutated in place -- recomputeRoute reassigns the variable
  and repathEnemy reassigns each enemy's own e.route, while updateEnemy only
  reads the array and bumps the scalar e.routeIndex), falling back to a
  recompute only if the cache is somehow empty. Verified in Node against the
  real boot: a spawned enemy reuses the exact cached reference, a new spawn
  after a build tracks the freshly reassigned route, and the empty-cache
  fallback still yields a real entry->exit path. Playtest 6/6 still passes.
- Added a low-lives urgency signal: `#lives` now gets a `low` class (toggled
  in `syncHud()` whenever `state.lives <= 3`) that turns the number red
  (#ff4d4d) and pulses it via a new `lives-pulse` keyframe (opacity 1 -> 0.3
  -> 1, 0.8s infinite), so a player looking away notices they're about to
  lose. Pure CSS + one classList.toggle; the playtest stub's toggle(force)
  already supports the second arg. Playtest 6/6 still passes.
- Added a live on-field enemy-type breakdown to the `#wave-info` line so a
  player can tell at a glance whether the remaining horde still has the fast
  scouts that call for frost. The dot markup moved out of `nextWavePreviewHtml()`
  into two shared helpers (`countTypes()` tallies a list of type strings,
  `typeDotsHtml()` renders the colored dots), and both the Next-row preview and
  the new `aliveTypeBreakdownHtml()` (counts each `e.type` in `enemies`, alive
  only) go through them, so the two dot renderings can't drift. `syncHud()`
  writes the breakdown into a new `#alive-breakdown` span after the "Enemies
  remaining" total, diff-cached in `lastAbHtml` like the other HTML lines, and
  resets it when the wave ends. Playtest 6/6 still passes.
- Build buttons now show at-a-glance affordability: `syncHud()` sets
  `btn.disabled = state.gold < TOWER_TYPES[btn.dataset.type].cost` for each
  `.tower-btn` (same comparison the hover preview's `affordable` uses), and new
  CSS dims a disabled button (`opacity: 0.4`, cost text turns #ef476f) so a
  broke player sees which towers they can't yet buy instead of learning from a
  failed click + toast. An armed type stays armed (`.selected` preserved) while
  unaffordable and its button re-enables automatically when gold recovers;
  cancelling it still works via its hotkey. Help card's Building section notes
  the dimming. Verified in Node against the real script: 19 cases pass
  (enabled at 200g, all-disabled at 40g, exact-cost boundary at 50/75/100g,
  armed-while-disabled, re-enable on gold recovery, live re-check after two
  builds leave 75g). Playtest 6/6 still passes.
- Fixed one-frame ghosting of projectile-killed enemies: in `update()`,
  `enemies = enemies.filter(...)` ran BEFORE `updateProjectiles()`, so an enemy
  shot down that frame lingered in the array past the frame callback — the
  "Enemies remaining" count (`enemies.length + toSpawn` in `syncHud()`) and the
  wave-clear check (`state.toSpawn === 0 && enemies.length === 0` in
  `updateWave()`) both read the stale count for a full frame (visible when
  paused on that frame), and the render pass (`drawEnemy` has no dead guard)
  drew the corpse one extra frame. The filter now runs after
  `updateProjectiles()`; the interim state is inert because every consumer
  (acquireTarget, the projectile hit test, updateEnemy, enemyInCell,
  damageEnemy) already skips dead/leaked enemies. Verified by driving the real
  frame() one frame at a time through the playtest boot harness: 4000 frames
  over 5 waves with 76 projectile-kill frames, 0 stale-enemy violations at
  frame end with the fix and exactly 76 (one per kill frame) with the old
  order. Playtest 6/6 still passes.
- Added a "Towers" list section to the side panel (above Selected Tower): one
  row per placed tower — type dot + name + level + Value — sorted by Value
  descending (stable, so ties keep row-major grid order), with the selected
  tower's row highlighted. Clicking a row selects that tower. New `allTowers()`
  scans towerGrid (the single source of truth; there is no separate tower
  array), `towerValue()` now holds the shared dealt/invested math used by both
  the list and the Selected Tower panel's stats line, and `towersListHtml()`
  builds the rows keyed by stable cell (data-r/data-c) which the delegated
  click handler resolves back to the tower object. Rendered in `syncHud()`
  ABOVE the no-selection early return (so it stays live when nothing is
  selected — it is how you pick what to select), diff-cached in lastTowersHtml
  like the other innerHTML lines; rows are rewritten only when a Value crosses
  a 0.1 boundary, order changes, a tower is built/sold, or selection moves.
  max-height 148px scrolls. Verified in Node against the real script: empty
  state, sort order, selection mark on/off, syncHud write + diff-cache no-op,
  sell-removes-row, and toFixed(1) display all pass. Playtest 6/6 still passes.
- Added a two-step sell guard: the first click (or `S` key) on Sell arms the button
  (text changes to "Sure?", amber highlight via `.armed` class), and a second click
  within 2 s confirms the sale. `armSell()` / `disarmSell()` / `handleSellAttempt()`
  manage the state; the 2 s countdown (`sellArmTimer`) ticks in `update()` (dt-scaled,
  freezes under Pause) and auto-disarms on expiry. Selection changing to a different
  tower or null disarms immediately (checked in `syncHud()`), as does `resetGame()`.
  Also fixed `btnSell.disabled` to be `!state.selected || state.gameOver` (was
  unconditionally `false`), so the button is properly dimmed when nothing is
  selected or the game is over. Playtest 6/6 still passes.
- Added on-field targeting-mode badges: `drawTower()` now prints a small bold
  F/L/S/C letter (mapped from `t.mode`, defaulting to F) under the level pips,
  so towers set to e.g. Strong are identifiable at a glance without selecting
  them. Non-default modes render amber (#ffd166), the default First a muted
  grey (#8a8aa0), both with the usual 1px shadow for readability; the pips
  moved up 2.5px (y+12 -> y+9.5) to make room, and the help card's targeting
  section notes the badge. Hover ghost preview is untouched (drawTowerBody
  only). Playtest 6/6 still passes.
- Fixed sold towers keeping credit from in-flight shots: `sellTower()` nulled
  the grid cell but left projectiles carrying `p.src === t` alive, so those
  shots landed and ran `src.dealt += dmg` / `src.kills += 1` on the removed
  tower's now-orphaned object (never shown again, quietly inflating its stats).
  `sellTower()` now filters those shots out of `projectiles` (`p.src !== t`) on
  sell, so a tower's in-flight shots die with it while other towers' shots and
  src-less shots are untouched. Verified in Node against the real script with
  the playtest boot harness: 9 cases pass (two-T1 shots dropped, T2 shot and
  src-less shot survive, grid cell cleared, refund still granted). Playtest 6/6
  still passes.
- Fixed Play Again (and mid-game Restart) carrying the armed build type into the
  next game: resetGame() reset state.speed/autoStart/selected/hover but not
  state.buildType, so dying with Cannon armed started the fresh run armed for
  Cannon -- or in inspect mode (buildType = null, canvas clicks can never
  build) if the type had been cancelled. resetGame() now sets
  state.buildType = "gun" (the boot default) alongside the other resets;
  syncHud() already re-syncs the buttons' .selected class from the field, so
  no button-state change was needed. Verified in Node against the real script
  with the playtest boot harness: cannon/frost armed and inspect mode all
  reset to gun with button classes re-synced, and a fresh run after a mid-wave
  restart clears its wave. Playtest 6/6 still passes.
- The `Escape` hotkey now also cancels an armed build type: the Escape branch
  of the `keydown` handler sets `state.buildType = null` alongside
  `state.selected = null`, so Esc is a one-keystroke "back to neutral"
  (matching the re-press-to-cancel behaviour of the tower buttons) instead of
  leaving a frost/cannon armed and invisible in inspect mode. `syncHud()`
  already re-syncs the buttons' `.selected` class from the field, and the
  hover-preview render pass is gated on `state.buildType`, so no other change
  was needed. The help card's Keys line now reads "Esc deselect / cancel
  build". Verified in Node against the real script with a keydown-capturing
  driver: 11 cases pass (esc clears armed type, idempotent, clears
  selection+type together, hotkey-1 regression, help-card-open gating
  preserved — esc behind the card still only closes it). Playtest 6/6 still
  passes.
- Auto-pause when the tab is hidden or the window loses focus: `frame()`
  clamped dt to 0.1s (no fast-forward) but the sim still ticked while the
  player read elsewhere, so lives could drain quietly. A new `pauseIfAway()`
  (gated on `!state.gameOver && !state.paused`) sets `state.paused = true` and
  calls `syncPauseUI()`; wired to `document` `visibilitychange` (reads
  `document.hidden`) and `document` `blur` (fires on window focus loss). Both
  are on `document` rather than `window` because the playtest stub only gives
  `document` a working `addEventListener` and `document.blur` is a standard
  window-focus-loss signal in real browsers too. Deliberately NO auto-resume
  on focus return: the player resumes via P or the Resume button, which also
  avoids a surprise auto-start wave the moment focus comes back. While paused
  `update()` is skipped, so the auto-start countdown freezes too. Verified in
  Node against the real script with captured listeners: 17 cases pass (blur
  pauses + UI sync, no auto-resume on re-show, hidden pause, visible no-op,
  game-over no-op, help-card pause-claim preserved through a blur, manual
  pause survives a blur). Playtest 6/6 still passes.
- Added a leak warning: a new `leakImminent()` returns true while any live
  enemy's remaining distance to the exit along its current route (exactly
  `-enemyProgress(e)`: full cells ahead + the fraction of the current segment
  still to walk) is within 3 cells, and the exit gate in `render()` then
  pulses between amber and enemy-pink (#ef476f) at ~2Hz via a sine on
  `performance.now()` with a small radius swell, so an in-progress leak reads
  at a glance instead of arriving as a silent -1 life. Boxed-in enemies
  (empty route, progress -Infinity) and dead/leaked enemies never trigger it;
  the help card's Goal section notes the red pulse. Verified in Node against
  the real boot: 15 cases pass (boundary at exactly 3, mid-segment 3.5 ->
  false, 2.1 -> true, mixed far+near, boxed-in/dead/leaked no-trigger,
  render no-throw, and end-to-end the warning fires before the first leak in
  an undefended wave). Playtest 6/6 still passes.
- Added per-tower aim lines: `updateTower()` now stores its pick on the tower
  (`t.target = target`, null when none) instead of discarding it, so the player
  can see why a tower shot a given enemy under First/Strong/Close modes. A new
  render pass (after towers, before enemies, so lines tuck under their target)
  draws a faint 0.16-alpha line in the tower's own color from tower to
  `t.target` whenever the target is still alive and not leaked; the target
  persists across cooldowns (updateTower's early return leaves it set) and the
  dead/leaked guard covers enemies killed mid-frame before the next acquire.
  Playtest 6/6 still passes.
- Added a bulk targeting control: an "All" button (`#btn-mode-all`) in the
  `#sel-modes` row re-points every tower to the mode the selected tower
  currently has (the one highlighted in the row), so a boss wave is a one-click
  focus instead of clicking each tower's mode one at a time. Clicking it sets
  `t.mode` on every tower in `allTowers()` (a fresh scan, so towers built later
  are included on the next press), plays a new short `Sound.ui()` tick (added
  to the Sound module — the backlog's `Sound.ui()` did not yet exist), and runs
  `syncHud()`; the selected tower's own mode is unchanged so its `.selected`
  highlight (the class the backlog's ".on" referred to) stays correct for free.
  The button is styled amber (`.mode-all`, sharing its base with `.mode-btn` via
  a compound selector) so it reads as an action, not a fifth mode, and is
  excluded from the `modeBtns` array so the generic per-tower handler and the
  `.selected` toggle never touch it. A no-op when nothing is selected (the row
  is hidden anyway). Help card's targeting section and the row's hint both note
  it. Verified in Node against the real script with a click-dispatching driver:
  11 cases pass (build 3, apply Strong/Close/Last to all, new tower re-pointed,
  no-selection no-op). Playtest 6/6 still passes.

## Backlog

Work that is queued but not done: bugs worth fixing and improvements worth
making. Both count equally.

Each item is one bullet. Keep it short -- a sentence or two saying what is
wrong or what is missing, and enough detail that the next developer can start
without rediscovering it. No IDs, no status fields, no priorities.

- `Sound.beginFrame()` is called at the top of `update()`, which is skipped while paused, so the per-frame sound budget keeps its last value: after a dense frame that spent all 12 emissions, a build/upgrade/sell while paused plays no sound at all. Move the `beginFrame()` call from `update()` to `frame()` (before the paused check) so every rendered frame gets a fresh budget regardless of pause.
- A stale build preview can sit under the help card: `showHelp()` does not clear `state.hover`, and the card covers the canvas without firing `mouseleave`, so a hovering mouse leaves the range circle + dashed re-route line drawn on the visible canvas slivers behind the 540px card while the game is frozen. Clear `state.hover = null` in `showHelp()` (matching `resetGame()`, which already does this).
- Right-click on the canvas does nothing useful (the browser context menu opens) and there is no fast way to drop both an armed build type and a selected tower. Add a `contextmenu` listener on the canvas that `preventDefault()`s and sets `state.buildType = null` and `state.selected = null` (then `syncHud()`), so right-click is a universal "back to neutral" gesture; note it in the help card's Keys line.
- Hovering a placed tower draws nothing (the hover-preview block in `render()` is gated on `!towerGrid[r][c]`), so comparing a tower's coverage requires clicking it first and deselecting after. In the same hover block, when `state.hover` is over an occupied cell, draw that tower's range circle with `drawRangeCircle(t.x, t.y, t.range, "#06d6a0", 0.06)` so coverage is visible on hover before committing a selection.
- The canvas cursor is always default: there is no affordance that a cell is buildable or a tower is clickable. In the `mousemove` handler set `canvas.style.cursor` to `"crosshair"` when `state.buildType` is armed, `"pointer"` when `state.hover` is over an occupied cell (`towerGrid[r][c]`), and `"default"` otherwise (and back to `"default"` in the `mouseleave` handler).
- The mid-game Restart button (`#btn-restart-mid`) currently uses a browser `confirm()` dialog; replace it with the armed two-step (first click arms a "Sure?" state on the button, second within 2 s confirms, auto-disarm on timeout) using the existing `armSell()`/`disarmSell()` pattern generalized (the timer tick already lives in `update()`), for a more polished in-page guard.

When you finish an item, DELETE its bullet from here and add a line under Done.
