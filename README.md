# Qwen3.8 Tower Defense

A dependency-free tower-defense game built and then improved by Qwen3.8-27B running locally on a 24 GB MacBook Pro.

This repository is frozen at the end of a 30-for-30 unattended run: 30 build sessions, 30 accepted commits, no reverts, no hangs, and no verification regressions. The game here is the artifact from that endpoint, not a cleaned-up or newer private version.

[Play the game](https://qwen38-tower-defense.vercel.app/) or [read the full story](https://qwen38-tower-defense.vercel.app/story/). The story covers the one-shot build, the improvement loop, what failed, and what made the loop steerable.

## Result

- One-shot build: 1 hour 48 minutes, 56,725 output tokens, 1,182 lines, and 26/26 static checks
- First improvement run: 15 accepted commits from 15 iterations
- Final unattended run: 30 accepted commits from 30 build sessions over 12 hours
- Final gate: 26/26 static checks and 6/6 behavioral scenarios
- Published game artifact SHA-256: `796d8ef49467b285485370b6a72c4208b73b9ee68e96f966c573ece13180dcb6`

## Play

Pick a tower, then click or tap an empty cell. Towers change the enemy route, but the game rejects any placement that would completely seal the path.

- `1`, `2`, `3`: select Gun, Frost, or Cannon; press the same key again to cancel
- `Space`: start a wave
- `U`: upgrade the selected tower
- `S`: arm or confirm a sale
- `P`: pause or resume
- `M`: toggle sound
- `H`: open help
- `Esc` or right-click: deselect and cancel building

The controls in the side panel work on desktop and touch devices too.

## Run locally

There is no build step and there are no dependencies. Serve the repository root with any static server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Run the included checks with:

```sh
python3 scripts/verify-td.py index.html
node scripts/playtest.js
```

## Provenance

The public history was reconstructed from the private experiment through source commit `cc7e6f39b014b978ec8092572c1d7001017a454b`. Every revision was filtered to the game source, specification, changelog, and game-specific verification scripts. Raw prompts, transcripts, model logs, harness internals, private paths, and later experiments are not included.

History filtering changed the public commit hashes. The SHA-256 above proves that the published `index.html` is byte-for-byte identical to the frozen 30-for-30 artifact.

## Limitations

The static gate checks code shape, not whether the game is fun or balanced. The behavioral harness covers six core scenarios, but it predates many later features. The final browser checks are separate from both.

The model also wrote and revised its own early test harness. That was useful, but it was not independent verification: an implementation and its self-written tests can share the same misunderstanding.

## License

[MIT](LICENSE) © 2026 Josh Anton
