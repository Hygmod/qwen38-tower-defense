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
  trapped-enemy dissolve/escape -- has been exercised in Node against the
  extracted functions.)
- Projectile tunneling after a long frame: frame() clamps dt to 0.1s (0.2s at
  2x speed), and a 430 px/s gun projectile then jumps up to ~86px in one step --
  well past the combined hit radii (~12px), so it can step clean over a close
  enemy after a tab-background. Rare (only the first frame after refocus).
  Fix if it matters: sub-step projectile movement when dt is large, or a
  swept-circle (segment vs circle) hit test in updateProjectiles().
