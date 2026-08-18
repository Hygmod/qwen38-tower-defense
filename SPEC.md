Act as an expert software engineer specializing in real-time game systems and pathfinding.

Your task is to build a self-contained "Grid Tower Defense" game inside a single, beautifully styled HTML file. The entire application must be written in vanilla HTML, CSS, and JavaScript with NO external libraries or dependencies.

### Visual & UI Requirements:
1. UI Layout: A clean, modern, dark-themed dashboard. Center the game canvas. Provide a side panel showing Gold, Lives and Wave number, styled buttons to select the tower type to build, a "Start Wave" button, a "Sell" button, an "Upgrade" button, and a 1x/2x speed toggle.
2. Canvas Dimensions: Fixed at 640x480 pixels. The playfield is a 20x15 grid of 32px cells; grid coordinates and pixel coordinates must be converted through a single pair of helpers, never by scattering the magic number.
3. Visuals: Elements must have distinct, vibrant colors:
   - Buildable ground: Deep charcoal (#1b1b22)
   - Enemy path tiles: Warm brown (#3d3428)
   - Gun tower: Electric cyan (#4cc9f0)
   - Frost tower: Pale ice (#b8c0ff)
   - Enemy: Hot pink (#ef476f)
   - Health bar / gold accent: Mint (#06d6a0) and amber (#ffd166)

### Game Mechanics & Rules:
You must maintain explicit game state and update it in a frame-by-frame loop driven by `requestAnimationFrame`. The systems must behave according to these exact rules:
1. Map: One entry tile on the left edge and one exit tile on the right edge. Enemies walk from entry to exit along a route computed by a real pathfinding search (breadth-first or A*) over walkable cells. Do not hard-code a fixed waypoint list — the route must be derived from the current grid.
2. Towers: Each tower occupies one cell, costs gold, and has range, damage, fire rate and projectile speed. Gun towers are cheap, fast and single-target. Frost towers deal little damage but apply a slow that halves enemy speed for 2 seconds and refreshes on re-hit. A tower may only be built on empty buildable ground, never on a path tile, another tower, or a cell containing an enemy.
3. Waves: Each wave spawns a fixed count of enemies at a staggered interval; enemy maximum health and count scale upward with the wave number. Killing an enemy grants gold; an enemy that reaches the exit costs one life and is removed. Start at 20 lives and 200 gold, and end the game when lives reach zero.
4. Economy: Clicking a placed tower selects it and draws its range as a circle. A selected tower can be upgraded — increasing damage and range at an escalating cost — or sold for 70% of everything invested in it.

### Critical Implementation Rules (The Coding Traps):
- Placement Must Not Seal the Maze: before a tower is committed, run the pathfinding search again against a candidate grid that includes the proposed tower. If entry can no longer reach exit, the placement must be REJECTED, no gold spent, and a message shown. The real grid must not be left mutated by a rejected attempt.
- Live Re-pathing: enemies already walking the field must recompute their route from their current cell whenever a tower is placed or sold. Enemies must never follow a stale route through a cell that is now occupied.
- Predictive Aiming: a tower must fire at where the target WILL be, not where it is. Compute the intercept point from the enemy's current velocity and the projectile's speed. If you aim at the enemy's present position, every shot will trail behind moving targets and fast enemies will be near-unhittable.
- Frame Independence: derive a delta time from the `requestAnimationFrame` timestamp and scale ALL movement, cooldowns and slow-effect timers by it. Never advance state by a fixed per-frame constant — the 2x speed toggle must be implemented as a multiplier on delta time, not as a second loop.
- Interaction: clicking the canvas builds the selected tower type, or selects an existing one; hovering a cell previews the tower footprint and range.

### Deliverable:
Write the complete, production-ready code inside a single HTML file containing the full HTML, CSS, and JavaScript. Do not omit any logic, do not use placeholders, and do not use "code shortcuts". It must work immediately when saved as an .html file and opened in a browser.

Note: You may not have access to a browser, dev server, or vision tools — do not rely on running or visually inspecting the game for verification. Validate by reading and reasoning about the code instead.

Before finishing, review the code to confirm:
- Side panel (gold, lives, wave, tower select, start wave, sell, upgrade, speed toggle) is wired to the game state
- Routes come from a real pathfinding search over the grid, not a hard-coded waypoint list
- Placement runs the search on a candidate grid and rejects any tower that would seal the maze, without mutating the real grid
- Enemies re-path from their current cell when a tower is placed or sold
- Towers lead their targets using enemy velocity and projectile speed
- All movement and timers scale by delta time; 2x speed is a delta multiplier
- Complete single HTML file with no placeholders or omitted logic
