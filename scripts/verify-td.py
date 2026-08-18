#!/usr/bin/env python3
"""Static verification gate for the grid tower-defense one-shot (SPEC.md).

WHAT THIS PROVES, AND WHAT IT DOES NOT.

The deliverable is a single self-contained HTML file whose correctness is
*behavioural* -- whether enemies actually walk the route, whether a sealing
tower is actually refused, whether shots actually connect. There is no browser
here and the spec explicitly tells the model not to rely on one. So this gate
cannot score the game. It checks what is mechanically checkable and reports
everything else as unknown.

Two tiers, and the distinction matters when reading a result:

  STRUCTURAL checks are near-unfakeable -- a hex colour is present or it is
  not, `node --check` passes or it does not. A FAIL here is a real defect.

  HEURISTIC checks (marked HEUR in the output) look for the *shape* of an
  algorithm: a BFS queue, an intercept solve, a delta-time multiply. They can
  be fooled by unusual-but-correct code, and they can be satisfied by code that
  merely looks right. Treat a HEUR fail as "go read that function", not as a
  verdict, and never treat a HEUR pass as proof the trap was avoided.

Checks (each maps to a requirement in SPEC.md):
  * a single HTML file exists
  * NO external dependencies -- no <script src>, remote <link>, @import
  * the six mandated colours are present verbatim
  * canvas is 640x480 and a 32px cell / 20x15 grid is expressed
  * requestAnimationFrame drives the loop
  * trap 1: a real pathfinding search exists (BFS queue or A* open set)
  * trap 1b: that search is invoked from more than one site -- routing AND
    placement validation -- which is what "reject a sealing tower" requires
  * trap 2: re-pathing is triggered from build/sell, not only at spawn
  * trap 3: predictive aiming -- intercept math, not the enemy's raw position
  * trap 4: delta time derived from the rAF timestamp and used as a multiplier
  * UI affordances: gold, lives, wave, start wave, sell, upgrade, speed toggle
  * canvas click/hover wired
  * no placeholder/TODO/elided-code markers, which the spec forbids outright
  * embedded JS passes `node --check` when node is available

Exit 0 = all checks passed; 1 = at least one failure; 2 = nothing to check.

Usage:
    verify-td.py [file ...]       # defaults to any *.html in cwd
"""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class Report:
    def __init__(self):
        self.failures = []
        self.passes = []
        self.unknowns = []

    def check(self, ok, label, detail="", heuristic=False):
        tag = "HEUR " if heuristic else ""
        if ok:
            self.passes.append(f"{tag}{label}")
        else:
            self.failures.append(f"{tag}{label}{': ' + detail if detail else ''}")

    def unknown(self, msg):
        self.unknowns.append(msg)


REQUIRED_COLOURS = {
    "#1b1b22": "buildable ground",
    "#3d3428": "path tiles",
    "#4cc9f0": "gun tower",
    "#b8c0ff": "frost tower",
    "#ef476f": "enemy",
    "#06d6a0": "health bar",
    "#ffd166": "gold accent",
}

PLACEHOLDER_PATTERNS = [
    r"\bTODO\b",
    r"\bFIXME\b",
    r"\.\.\.\s*(?:rest|remaining|other|more)\s+(?:of\s+)?(?:the\s+)?(?:code|logic|implementation)",
    r"//\s*(?:implement|add)\s+(?:the\s+)?(?:rest|remaining)",
    r"<!--\s*\.\.\.\s*-->",
    r"\[\s*(?:your|the)\s+code\s+here\s*\]",
]

# Identifiers a pathfinding routine is plausibly called. Kept broad on purpose;
# the call-site count below is the check that carries the weight.
PATH_FN = re.compile(
    r"\b(findPath|computePath|calcPath|calculatePath|getPath|buildPath|pathTo|"
    r"bfs|aStar|astar|aStarSearch|search Path|solvePath|routeFrom|findRoute|"
    r"computeRoute|getRoute)\b"
)


def extract_scripts(html):
    """Return the contents of every inline <script> block."""
    return re.findall(
        r"<script\b[^>]*>(.*?)</script>", html, re.DOTALL | re.IGNORECASE
    )


def strip_comments(js):
    """Crude comment stripper so structural scans don't trip over prose or
    commented-out code."""
    js = re.sub(r"/\*.*?\*/", " ", js, flags=re.DOTALL)
    js = re.sub(r"(?m)//.*$", " ", js)
    return js


def has_search_algorithm(js):
    """A real BFS or A* over the grid, rather than a hard-coded waypoint list.

    BFS shape: a worklist that is pushed to and drained from the front
    (`shift()`) or an explicit head index. A* shape: an open set plus a cost
    map (g/f score, or a priority sort on the frontier).
    """
    bfs = re.search(r"(queue|frontier|open|toVisit|work)\w*\s*\.\s*shift\s*\(", js, re.I) or (
        re.search(r"\b(queue|frontier)\w*\s*\.\s*push\s*\(", js, re.I)
        and re.search(r"\bhead\s*(\+\+|\+=|<)", js)
    )
    astar = re.search(r"\b[gf]Score\b|\bopenSet\b|\bcameFrom\b", js) or (
        re.search(r"\bheuristic\b", js, re.I)
        and re.search(r"\bopen\w*\s*\.\s*(sort|push)\s*\(", js, re.I)
    )
    visited = re.search(r"\bvisited\b|\bcameFrom\b|\bprev(ious)?\b|\bseen\b", js, re.I)
    return bool((bfs or astar) and visited)


def path_call_sites(js):
    """How many distinct places call the pathfinder.

    Routing needs one. Rejecting a maze-sealing tower needs a second, against a
    candidate grid. One call site is the classic failure: the model computes
    the route but never re-runs the search to validate a placement.
    """
    return len(PATH_FN.findall(js))


def has_placement_validation(js):
    """A placement path that runs the search against a candidate grid and can
    refuse. Looks for a rejection/validity vocabulary near a path call."""
    guard = re.search(
        r"\b(wouldBlock|blocksPath|isValidPlacement|canPlace|canBuild|validPlacement|"
        r"placementValid|willSeal|sealsPath|isBlocked|pathExists|hasPath)\b",
        js,
    )
    # A candidate/trial copy of the grid, however it is spelled.
    copy = re.search(
        r"\b(candidate|trial|temp|tmp|test|hypothetical|simulated)\w*\b"
        r"|\.\s*map\s*\(\s*\w+\s*=>\s*\w+\s*\.\s*slice\s*\(",
        js,
        re.I,
    )
    return bool(guard and copy)


def has_repath_on_change(js):
    """Enemies re-path when the maze changes.

    Requires a path call inside -- or textually adjacent to -- a build/sell
    routine, and evidence it is applied across existing enemies rather than
    only at spawn time.
    """
    in_mutator = re.search(
        r"function\s+\w*(place|build|sell|remove)\w*Tower\w*\s*\([^)]*\)\s*\{"
        r"(?:[^{}]|\{[^{}]*\})*",
        js,
        re.I,
    )
    fan_out = re.search(
        r"(enemies|creeps|mobs|units)\s*\.\s*(forEach|map)\s*\(", js, re.I
    ) or re.search(r"for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+(enemies|creeps|mobs)\b", js, re.I)
    named = re.search(
        r"\b(re[-_]?path\w*|re[-_]?route\w*|recompute(Path|Route)\w*|"
        r"refresh(Path|Route)\w*|update(Path|Route)\w*|recalc(ulate)?(Path|Route)\w*)\b",
        js,
        re.I,
    )
    if named and fan_out:
        return True
    return bool(in_mutator and PATH_FN.search(in_mutator.group(0)) and fan_out)


def has_predictive_aim(js):
    """Leading the target: the intercept point, not the enemy's raw position.

    Accepts either a named intercept/predict helper, or the arithmetic shape of
    a lead solve -- a time-to-target divided by projectile speed and then
    multiplied back into the enemy's velocity components.
    """
    named = re.search(
        r"\b(predict\w*|intercept\w*|lead(Target|Point|Shot|Pos)?\w*|aimAhead|futurePos\w*)\b",
        js,
        re.I,
    )
    vel = re.search(r"\b(vx|vy|velX|velY|velocity|speedX|speedY|dirX|dirY)\b", js)
    solve = re.search(
        r"\b(t(ime)?(ToTarget|Hit|Impact|Intercept)?)\s*=\s*[^;\n]*"
        r"(dist\w*|len\w*|Math\.(hypot|sqrt))[^;\n]*/[^;\n]*(bulletSpeed|projectileSpeed|"
        r"missileSpeed|shotSpeed|\w*[Ss]peed)",
        js,
    )
    return bool(vel and (named or solve))


def has_delta_time(js):
    """Delta time from the rAF timestamp, used as a multiplier -- not a fixed
    per-frame constant."""
    derived = re.search(
        r"\b(dt|delta\w*|elapsed)\s*=\s*\(?\s*(now|ts|timestamp|time|currentTime|performance\.now\(\))"
        r"\s*-\s*(last|prev)\w*",
        js,
        re.I,
    )
    used = len(re.findall(r"\*\s*(dt|delta\w*)\b", js, re.I))
    return bool(derived and used >= 3)


def main(argv):
    files = [Path(a) for a in argv[1:]]
    if not files:
        files = sorted(Path(".").glob("*.html"))
    files = [f for f in files if f.is_file()]

    if not files:
        print("verify-td: no HTML file found -- nothing to check", file=sys.stderr)
        return 2

    if len(files) > 1:
        print(f"verify-td: note: {len(files)} HTML files; checking all of them")

    overall = Report()

    for path in files:
        r = Report()
        html = path.read_text(encoding="utf-8", errors="replace")
        scripts = extract_scripts(html)
        js = strip_comments("\n".join(scripts))
        lower = html.lower()

        # --- self-containment (spec: "NO external libraries or dependencies")
        ext_script = re.search(r"<script\b[^>]*\bsrc\s*=", html, re.IGNORECASE)
        ext_link = re.findall(
            r"<link\b[^>]*\bhref\s*=\s*[\"']([^\"']+)[\"']", html, re.IGNORECASE
        )
        remote_link = [h for h in ext_link if re.match(r"https?:|//", h)]
        css_import = re.search(r"@import\b", html, re.IGNORECASE)
        r.check(not ext_script, "no external <script src>")
        r.check(not remote_link, "no remote <link href>", str(remote_link))
        r.check(not css_import, "no CSS @import")

        # --- inline JS actually present
        r.check(bool(js.strip()), "inline JavaScript present")

        # --- mandated palette
        missing = [c for c in REQUIRED_COLOURS if c not in lower]
        r.check(
            not missing,
            "all seven mandated colours present",
            ", ".join(f"{c} ({REQUIRED_COLOURS[c]})" for c in missing),
        )

        # --- canvas geometry
        r.check("<canvas" in lower, "canvas element declared")
        r.check(
            re.search(r"\b640\b", html) is not None and re.search(r"\b480\b", html) is not None,
            "640x480 canvas dimensions",
        )
        r.check(
            re.search(r"\b32\b", js) is not None
            and re.search(r"\b20\b", js) is not None
            and re.search(r"\b15\b", js) is not None,
            "32px cell and 20x15 grid expressed",
        )

        # --- the loop
        r.check("requestanimationframe" in js.lower(), "requestAnimationFrame loop")

        # --- trap 1: real pathfinding, and used twice
        r.check(has_search_algorithm(js), "real BFS/A* search over the grid", heuristic=True)
        sites = path_call_sites(js)
        r.check(
            sites >= 2,
            "pathfinder called from 2+ sites (route + placement check)",
            f"found {sites} call site(s)",
            heuristic=True,
        )
        r.check(
            has_placement_validation(js),
            "placement validated against a candidate grid",
            heuristic=True,
        )

        # --- trap 2: live re-pathing on build/sell
        r.check(has_repath_on_change(js), "enemies re-path on build/sell", heuristic=True)

        # --- trap 3: predictive aiming
        r.check(has_predictive_aim(js), "projectiles lead the target", heuristic=True)

        # --- trap 4: delta time
        r.check(has_delta_time(js), "delta time derived and used as a multiplier", heuristic=True)

        # --- UI affordances
        for word, label in (
            ("gold", "gold readout"),
            ("lives", "lives readout"),
            ("wave", "wave readout"),
            ("sell", "sell control"),
            ("upgrade", "upgrade control"),
        ):
            r.check(word in lower, f"a '{word}' control/readout ({label})")
        r.check(
            re.search(r"start\s*wave", html, re.IGNORECASE) is not None, "a 'start wave' control"
        )
        r.check(
            re.search(r"2\s*x|speed", html, re.IGNORECASE) is not None, "a speed toggle"
        )
        towers = [t for t in ("gun", "frost") if t in lower]
        r.check(len(towers) == 2, "both tower types referenced", f"found {towers}")

        # --- canvas interaction
        click = re.search(r"\bclick\b|mousedown|pointerdown", js, re.IGNORECASE)
        hover = re.search(r"mousemove|pointermove", js, re.IGNORECASE)
        r.check(bool(click and hover), "canvas click + hover wired")

        # --- no placeholders (spec forbids these explicitly)
        found_ph = [p for p in PLACEHOLDER_PATTERNS if re.search(p, html, re.IGNORECASE)]
        r.check(not found_ph, "no placeholder / elided-code markers", str(found_ph))

        # --- syntax, opportunistically
        if shutil.which("node") and js.strip():
            with tempfile.NamedTemporaryFile(
                "w", suffix=".js", delete=False, encoding="utf-8"
            ) as fh:
                fh.write(js)
                tmp = fh.name
            proc = subprocess.run(
                ["node", "--check", tmp], capture_output=True, text=True
            )
            Path(tmp).unlink(missing_ok=True)
            r.check(
                proc.returncode == 0,
                "node --check on inline JS",
                proc.stderr.strip().splitlines()[0] if proc.stderr.strip() else "",
            )
        else:
            r.unknown("node unavailable -- inline JS not syntax-checked")

        r.unknown(
            "game BEHAVIOUR is unverified: no browser here, and the spec forbids "
            "relying on one. Routing, wave pacing, economy, slow stacking and "
            "whether shots actually connect are all unscored."
        )
        r.unknown(
            "HEUR checks match algorithm SHAPE, not correctness. A pass means the "
            "code looks like it does the thing; go read the function to be sure."
        )

        # --- report
        print(f"\n=== {path} ({len(html)} bytes, {len(scripts)} script block(s)) ===")
        for p in r.passes:
            print(f"  PASS  {p}")
        for f in r.failures:
            print(f"  FAIL  {f}")
        for u in r.unknowns:
            print(f"  ????  {u}")

        overall.failures.extend(r.failures)
        overall.passes.extend(r.passes)

    print(
        f"\nverify-td: {len(overall.passes)} passed, "
        f"{len(overall.failures)} failed across {len(files)} file(s)"
    )
    return 1 if overall.failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
