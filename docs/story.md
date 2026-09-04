# From One Prompt to an Unattended Backlog

I've been experimenting with Qwen3.8-27B, a local model that just barely fits on my 24 GB MacBook Pro. I started with a simple question: can it actually code?

That turned into a much more interesting question. If it can build something once, what does it take to let it keep working without me sitting there?

The game published with this write-up is frozen at the end of the experiment's 30-for-30 run. It is not the latest version from the private lab, and I have not cleaned up or improved the game since the model produced it. I wanted the thing people can play to match the result I am describing.

## The first prompt

My first real test was an externally written prompt for a falling-sand simulation. The task was deliberately simple from an agent's point of view: read one specification and produce one HTML file.

The first attempt ran for 45 minutes and wrote nothing. The second attempt did the same thing.

At first, that looked like a capability failure. It wasn't. The model had written a complete, valid solution inside its reasoning, then kept analyzing and building a test harness until it hit the output-token limit. The solution existed in the transcript, but it never made it to disk.

The problem was the reasoning configuration. The model's template defaulted to an extremely high reasoning effort, and the agent harness was not overriding it correctly. Once I set the reasoning effort on the model server, the same task took 8 minutes and 17 seconds. It wrote the application, passed all 16 static checks, and stopped on its own. I opened it in a browser and confirmed that it worked.

That was the first lesson: a model can look incapable when the system around it is configured badly. The difference between the failed and successful runs was not generation speed. It was whether the model ever stopped thinking and used its tools.

## One prompt for a complete game

The falling-sand simulation proved that the basic path worked, so I gave the model something harder: build a complete tower-defense game from a single prompt.

The specification required interacting systems rather than one isolated simulation. Towers had to block grid cells without sealing the enemy path. Enemies already on the board needed to find a new route when the map changed. Projectiles had to lead moving targets. Combat, upgrades, selling, waves, gold, lives, and frame timing all had to work together.

Qwen produced a playable game in 1 hour and 48 minutes:

- 1,182 lines in one self-contained HTML file
- 56,725 output tokens
- 26 out of 26 static checks passing
- A successful manual play-test

It also did something I had not requested. It wrote an 11.7 KB Node test harness with 60 assertions covering routing, combat, economy, and the frame loop.

That was impressive, but I couldn't treat it as independent evidence. When tests failed, the model changed the harness rather than the game. Its diagnoses were plausible, and some were correct, but a model that writes both the implementation and the tests can share the same misunderstanding on both sides. The manual play-test was still the strongest evidence that the game actually worked.

## Letting it keep working

The next step was to stop treating this as a one-shot generation problem.

I built a loop that launched a fresh agent session for each iteration. The session inspected the current game, chose one improvement, implemented it, and ran the verification gate. If the gate passed, the loop committed the change. If it failed, the loop reverted everything and started the next session from the last known-good state.

This commit-or-revert ratchet mattered. The model was free to make changes inside an iteration, but only verified work survived into the next one.

My first good run under token and progress budgets lasted 5.5 hours and produced 15 accepted commits from 15 iterations. There were no reverts, no hangs, and no gate failures.

The changes were not all cosmetic. The model added enemy types, bosses, a third tower, selectable targeting modes, pause controls, sound effects, wave previews, performance statistics, and gold interest. It also fixed projectile tunneling, targeting behavior, and a wave soft-lock.

The model could clearly improve the game repeatedly. The expensive part was deciding what to do.

## More than half the output went into choosing

Across those 15 iterations, 54.6% of the model's output tokens came before the first edit. Every fresh session had to read the project, decide what mattered, choose an approach, and only then start writing.

That is a bad use of a slow local model. On this machine, output tokens map almost directly to time. Asking the model to make the same kind of product decision at the beginning of every session meant paying for that decision over and over.

The game had a changelog with completed work and known issues, but it did not turn into a useful issue tracker on its own. The model kept finding something new to build instead of maintaining a queue for the next session.

So I separated the two jobs.

## Planning and implementation became different sessions

The next version of the loop had two modes.

A grooming session inspected the project and filled a backlog. Build sessions took work from that backlog and implemented it. When the queue dropped below a threshold, another grooming session replenished it.

That reduced the average number of tokens spent choosing work by about a third. It did not make the overall iterations much faster. The model reinvested most of the savings into implementation and verification, so the same budget produced more actual work.

The quality of the backlog made a much larger difference than I expected.

Concrete items were cheap to start. A backlog item such as "`resetGame()` resets pause but not `state.speed`" told the build session where the problem was and what kind of change it needed.

Vague items were expensive. "Add a dismissible how-to-play overlay or Help button" left a product decision and an implementation choice unresolved. The build session spent almost as many tokens deciding what that sentence meant as the original sessions spent choosing an improvement from scratch.

The backlog did not eliminate decision-making. It moved the decision into grooming, and it only worked when grooming actually made the decision.

## Making the queue steerable

For the next run, I tightened the protocol:

- Groom the backlog in priority order.
- Give every item a concrete mechanism rather than only describing the desired experience.
- Do not offer multiple implementation choices in one item.
- Every build session takes the first item, unless it can explain why the item is already done, wrong, or impossible.
- If an unresolved choice still reaches a build session, take the simpler branch and move on.

I made the first-item rule because a backlog is not very useful if every new agent shops around for the task it likes best. Priority had to live in the list, not in thirty separate model sessions.

Then I let it run for 12 hours.

## The 30-for-30 run

The loop completed 30 build iterations and five grooming iterations.

The build results were:

- 30 accepted commits from 30 build sessions
- 29 net backlog items completed
- Zero reverts
- Zero hangs
- Zero gate regressions
- 30 out of 30 sessions took the first backlog item

The difference between 30 commits and 29 net completed items comes from how the queue changed: one session completed two items, while two other sessions completed their assigned item and added a newly discovered issue back to the backlog.

The changes included touch controls, performance fixes, clearer enemy information, restart and sell safeguards, build cancellation, best-wave tracking, low-life warnings, targeting indicators, a tower list, automatic pause when the page loses focus, leak warnings, aim lines, and fixes for several stale or inconsistent UI states.

The game grew from about 71 KB to 91 KB during the run. Despite that growth, the average build iteration became 20% faster and used 18% fewer output tokens than the previous backlog run. By the final third of the night, the model was spending less time deciding and more time building, even though it had more code to inspect.

Most importantly, the loop became steerable. Whatever was at the top of the list was what got built next. The model was not managing the project in some vague, human sense. The surrounding system was making priority explicit and checking whether the model followed it.

## What did not work as well

The run was good, but it did not prove that a local model can develop software indefinitely without supervision.

Backlog grooming still consumed about a quarter of the total output and run time. It improved the build sessions, but it was expensive enough that the token savings did not fully pay for the planning work.

The queue also developed a starvation problem. Grooming sessions tended to put their newest findings near the top, so older items could be pushed down repeatedly. Top-down execution worked perfectly, but the prioritization policy behaved more like a stack than a fair queue.

The tests did not keep pace with the code. The same six behavioral scenarios remained green throughout the run, but they had been written before most of the new features existed. A green test suite cannot protect behavior it never checks.

The backlog gradually drifted toward polish and cosmetic work. That makes sense in hindsight. The model could inspect the source code, but it could not play the game and experience what was confusing, annoying, or fun. Once the obvious code-visible problems were gone, it had no source of player feedback.

Later experiments pushed the model into harder work and found clearer limits, especially requirements involving emergent game balance rather than a change at a known edit site. Those runs are outside the version published here, but they reinforced the same point: autonomy depends heavily on task shape, verification, and what information survives from one session to the next.

## What I think the experiment showed

The result was not "I gave an AI freedom and it built a game."

I started with one prompt and a model that could not stop reasoning long enough to write a file. By the end, I had a system that could inspect its own work, maintain a prioritized backlog, take the assigned item, implement it, verify it, commit it, and continue for 12 hours without me sitting there.

That behavior came from the whole system:

- The correct model and server configuration
- Fresh sessions with bounded context
- Persistent state in files rather than conversation memory
- Separate planning and implementation modes
- A top-down backlog protocol
- Automated verification
- Commit-or-revert checkpoints
- Token, progress, and stopping budgets
- Human review of the thing that was ultimately produced

The model supplied the code and a surprising amount of useful judgment. The harness supplied continuity, priorities, boundaries, and consequences.

That is the part I found most interesting. Useful autonomy did not come from giving the model fewer constraints. It came from making the work, the checks, and the next decision more explicit.

## Play it

The playable version is the exact game state at the end of the 30-for-30 run. Later private experiments continued changing it, but those changes are deliberately not included here.

[Play the game](https://qwen38-tower-defense.vercel.app/)

The source is available under the MIT license in the [GitHub repository](https://github.com/Hygmod/qwen38-tower-defense).
