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

## Known issues

The backlog: real problems and worthwhile ideas nobody has finished yet. Take
one from here if it appeals, or work on something else entirely -- your call.

When you resolve one, delete it from this section and add a line under Done.
When you find something you cannot finish this session, add it here, described
well enough that the next developer can act on it without rediscovering it.

- Nothing here has been verified in a running browser -- there is no browser in
  this environment and the static gate only checks that the code has the right
  SHAPE. Any behaviour may still be wrong, including things listed under Done.
  (The pure logic -- pathfinding, placement validation, sealing rejection,
  trapped-enemy dissolve/escape, swept projectile hits -- has been exercised in
  Node against the extracted functions.)
