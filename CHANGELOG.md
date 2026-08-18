# Changelog

One line per improvement, newest at the bottom. Read this before you start so
you do not repeat work that is already done.

- Initial build from SPEC.md: 20x15 grid with BFS routing, gun + frost towers,
  waves with staggered spawns, gold/lives economy, upgrade and sell, predictive
  aiming, delta-time loop with a 2x toggle.
- Status: the static gate passes, but nothing has been verified in a running
  browser, so any behaviour may still be wrong. Prefer fixing what already
  exists over adding new features.
- Fixed live re-pathing soft-lock: enemies in transit that floor-mapped onto a
  just-blocked cell were permanently frozen (wave could never clear); they now
  re-path from the nearest adjacent cell that still reaches the exit.
