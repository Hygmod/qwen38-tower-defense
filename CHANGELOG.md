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

## Known issues

The backlog: real problems and worthwhile ideas nobody has finished yet. Take
one from here if it appeals, or work on something else entirely -- your call.

When you resolve one, delete it from this section and add a line under Done.
When you find something you cannot finish this session, add it here, described
well enough that the next developer can act on it without rediscovering it.

- Nothing here has been verified in a running browser -- there is no browser in
  this environment and the static gate only checks that the code has the right
  SHAPE. Any behaviour may still be wrong, including things listed under Done.
- Possible economy bug, unverified: gold may be deducted before the sealing
  check rejects a tower placement, so a rejected build could still charge the
  player. Worth tracing the order of operations in the placement path.
