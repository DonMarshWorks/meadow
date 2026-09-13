# Plants

Plants that evolve their own shape competing for a flat 16:9 arena. One
self-contained `index.html` — hand-rolled WebGL2, no libraries, no build step,
**zero network requests**. Published to GitHub Pages at
https://donmarshworks.github.io/plants/

**This is an aesthetic project.** The plants are the point. When a choice is
between a more legible individual plant and a marginally better diversity
number, take the plant and write down what it cost.

## Running it

**For a person:** `npm run serve`, then open `http://localhost:8000/`. It also
works by opening `index.html` straight off disk — it fetches nothing — but test
it served, because that is how it ships.

**For Claude, to actually look at a change:**

```
npm run shot                                    → shots/latest.png
node tools/shot.js out.png --size 1600x900
node tools/shot.js out.png --hash '#seed=7&step=0.05&minfrag=100'
node tools/shot.js out.png --nohud --wait 40
```

It prints the world's own numbers beside the picture, so what is on screen and
what the simulation believes are never two separate claims. It needs the
harness installed — `npm i && npx playwright install chromium`, once. Serving
the page needs nothing at all, and neither does `npm run verify -- --static`.

**Use that tool rather than driving a browser by hand.** Photographing this page
has three traps in it and all three produce the identical symptom — a perfectly
black arena behind a perfectly correct HUD, which reads as a rendering bug and
is not one. `tools/shot.js` handles all three and says why in its header. In
short: the GL flags must be ANGLE-over-SwiftShader, the shutter must wait long
enough for a *sliced* rebuild to finish under software rendering, and
`requestAnimationFrame` must **not** be stubbed, because the frame loop is what
draws.

The last of those cuts against the rule right below it, and the distinction is
the whole thing: a probe that **measures** must stub rAF; a probe that wants a
**picture** must not. Handing rAF back afterwards does not work — the boot
schedules the loop with its own rAF call, and that is the call being dropped.

## Working on it

- `index.html` is the entire program. Edit it directly. There is no build step
  and no generator; if you find one, it is stale scaffolding, not the source.
- **Verify changes: `npm run verify`.** One-time setup: `npm i` then
  `npx playwright install chromium`. It renders in software so results are
  deterministic on any machine, which makes it slow — several minutes.
  `npm run verify -- --static` runs only the instant checks.
- `node tools/sweep.js envcap=1,2,3,4,5` searches a parameter rather than
  looking at one. It stops the frame loop, checks that two runs of one seed are
  byte-identical before comparing anything, and refuses to average a dead world
  into a mean. All three are scar tissue.
- **Deploy.** Work on `main` and push; GitHub Pages serves it directly.
  `npm run verify` must be green on the exact `index.html` being pushed — check
  the blob hash matches rather than assuming, since the run takes minutes and it
  is easy to edit the file while it runs.

  Do not put "now running verify" in the last sentence of a message. On the
  project this descends from, twice the sentence stood in for the action and the
  gate never ran: writing the intent discharges it, and a reply arriving before
  the next turn removes the only chance to notice. The call goes in the *same*
  message as the claim.

## Invariants — do not break these

1. **Zero external requests.** No CDN, no web fonts, no fetched images. The
   favicon is an inline SVG data URI. `verify.js` fails the build if anything
   leaves the origin.
2. **It must not degenerate.** Over a run, on the default settings, across
   seeds: niche evenness above **0.45**, no single strategy above **0.50** of
   the world, all five niches occupied, nothing extinct. This is the entire
   point of the piece and `verify.js` gates on it.
3. **The arena is 16:9 at every window shape**, centred, with black bars
   outside it. The world is never reshaped by the window.
4. **Adaptive resolution** must keep it near 60fps; it lowers DPR when frames
   are slow. Don't add unconditional per-fragment cost.
5. **Page must never zoom or scroll.** The interface stays a fixed size. See
   the input notes below.

## Architecture

Single file, in this order: CSS → HUD markup → seed and parameters → the
simulation → WebGL and the renderer → input → HUD → boot → frame loop →
charts, settings, about → test hooks.

**The arena.** A flat rectangle, `x ∈ [-AX, AX]` and `y ∈ [-1, 1]` with
`AX = 16/9`. Positions and headings are two-dimensional; a heading is a plain
unit direction and stepping is `p + h·d`. The sphere this descends from needed
geodesics, re-normalisation, parallel transport, a wrapping seam and a pole
guard, and all five went with the curvature.

**The environment is the other plants.** `probeAt` measures what is standing
within 1.5 collision radii of a point and splits it five ways — gap, clone, kin,
rival, wood — summing to one. Fit is the genome's five affinities dotted with
those, exactly as it was against the planet's biomes, and lifespan reads off fit.
This is what replaces the climate, and the argument for it is that it is the one
environment that cannot settle down: each of the five niches is manufactured by
the plants living in the one before it.

**The probe is fused with the collision test** because they read the same nine
bins, and it is the hottest loop in the program at roughly two thousand calls a
tick. Wood lives in a *second* bin map: it must not be in the collision bins,
because heartwood left there walls a body off from its own dead interior, but it
is still standing and still one of the five things a place can be.

**The genome** is a fixed-length linear program — 24 instructions over a fixed
read space, plus four evolved constants — with ten outputs: capacity, spread,
pace, vigour, angle, and the five affinities. The first three are read once at
birth so a body is a permanent record of the conditions each of its nodes grew
through; vigour is re-read every look. Mutation is minted at bifurcations, not
per node, so a sector stays a coherent unit for selection to act on.

**Heartwood.** A node that dies still holding children stops growing, stops
counting as alive, and stays in the tree as structure. It is released when its
last child goes, or when its rot clock expires. Without it, ageing alone split a
fifth of all deaths into separate bodies and nothing could grow past about ten
nodes; with it, mean body size went from 10.7 to 508 on the sphere.

**Rendering** is instanced quads straight to the default framebuffer through an
orthographic transform, with the letterbox done by `gl.viewport` and a scissored
clear. There is no sheet texture, no mipmap, no seam passes and no detail patch
— the sphere needed all four to fold plants into a planet's albedo and to make
zooming mean anything, and a flat arena entirely on screen needs none of them.

The instance buffer is rebuilt only when the world changes, **sliced across
frames**, while the draw happens every frame. Keeping those two clocks apart is
what stops a 60fps redraw from costing a 60Hz rebuild.

**The clock.** There is no climate, so there is no second clock to stay in step
with, and the time-lapse buttons mean what they say: ecology ticks per second.
The frame loop pays a debt against a *share* of each frame, so the plants get
the same CPU per second whatever the frame rate. A backlog longer than a second
is dropped rather than paid later, and the HUD prints the rate actually
achieved — never the multiplier, because on a slow machine that would be a claim
the piece cannot keep.

**Test hooks.** `window.__world` exposes `plants()`, `env()`, `arena()`,
`runWorld()`, `growPlants()`, `printGenome()`, `instHash()`, `params()`,
`defaults()`, `settings()`, `pins()`, `pick()`, `selected()`, `markedBodies()`,
`overlapScan()`, `hopScan()`, `wallScan()`, `seam()`, `paintOrder()`,
`bodyDiag()`, `setSpeed()`, `setPaused()`, `debug()`. Used by `verify.js` and
`sweep.js`. Keep them working.

**Any probe that runs the world must stub `requestAnimationFrame` first.** The
frame loop advances the same world `runWorld` advances, by an amount that
depends on how many frames the machine managed. Let through exactly the first
rAF call — the boot lives inside one and schedules the loop as its last act —
and drop every call after. Assert the probe agrees with itself before you let it
compare anything.

## Hard-won lessons

Every one of these was a real bug. Most of them shipped on the planet this came
from; the ones marked **[here]** were found in this codebase.

**Measuring**

- **[here] The harness was wrong, not the page.** The first render probe drove
  SwiftShader through `--use-gl=swiftshader` instead of `--use-gl=angle
  --use-angle=swiftshader`. The raw path loses the WebGL context outright when
  the 5.5MB instance buffer is allocated, and the page then boots, simulates,
  reports perfectly healthy statistics and draws *nothing*. The HUD was correct,
  the ecology was correct, the invariants all passed, and the arena was blank.
  **When a probe says the picture is empty, check the probe.**
- **[here] And then it was wrong a second time, in the opposite direction.**
  With the flags fixed the arena was *still* blank, because the screenshot was
  taken four seconds after handing the frame loop back and a *sliced* rebuild
  under software rendering needs longer than that to finish. Two different
  harness faults presenting as one identical symptom. `verify.js` now waits 20
  seconds before it photographs anything.
- **[here] Reseeding masks extinction, so any test of a dial that can empty the
  world must turn the rescue off first, or it is a test of the rescue.** The
  first `minfrag` sweep found no extinction anywhere up to 150 and concluded
  there was no cliff. Don pointed out that `reseed` plants a fresh random genome
  in every empty province — so the world *cannot* die, and what actually happens
  at a high bar is that emptying the ground gives reseeding more room and the
  world becomes a treadmill of new pioneers. The numbers said so and had been
  read past: open ground rose to 0.48 and evenness fell to 0.75 while every arm
  "survived". Degradation wearing survival's clothes.
- **Never sample a control loop at a multiple of its own period**, and
  cross-check any census against an independent recomputation of the same
  quantity at the same instant.
- **A mean over a window that may or may not contain the expensive event is a
  coin toss, not a measurement.** The rebuild lands about once a second and the
  sampling window is about a second. Report worst-in-window alongside the mean,
  and count how many of the event the window saw.
- **Measure the frame rate on the wall clock**, and keep it separate from
  whatever the simulation is allowed to integrate. A governor cannot correct an
  error it cannot see: a frame rate computed from clamped timesteps could not
  report anything worse than 4.0 however slowly the machine was going.
- **`other` clamped at zero is not evidence of nothing.** Once accounted phases
  exceed the frame time the unaccounted column reads 0, which looks like "no GPU
  wait" and means the accounting has saturated.
- **Pin every knob that adapts before testing one that does not.** The adaptive
  resolution and the rebuild slice both switch on frame-rate thresholds.
- **Isolate passes one at a time; do not reason about where the pixels go.**
  Four theories about where the time went were wrong on the sphere and both real
  findings came from turning passes off one per load.
- **Look for a constant being recomputed before you look for work to skip.**
  `emitNode` was recomputing fourteen transcendentals per node per pass to
  arrive at numbers decided at birth: 59.4ms → 13.8ms, byte-identical.
- **Cache from the stored value, not from the argument.** The first version of
  that cache computed from float64 parameters where the loop it replaced read
  Float32Arrays. One rounding earlier, and every instance moved in its last bit.
  `instHash()` is the only reason it was caught.
- **Smoothness is spreading the work, not reducing it.**

**JavaScript**

- **[here] Extracting a function by line range is off by one until proven
  otherwise.** The simulation was lifted out of the source by line span and the
  span stopped one line short of `genomeText`'s closing brace. `node --check`
  passed — the file was still valid JavaScript — and everything after it was
  silently nested one scope deeper, so a `const` seven hundred lines later was
  invisible to its own use site. It presented as `SETTINGS is not defined` with
  `const SETTINGS` plainly there on screen. **Assert brace depth at known
  top-level declarations**, which is what the comment/brace scanner in
  `verify.js` now does.
- **[here] Changing an anchor without changing its `inclusive` flag deletes the
  anchor.** A patch script's end anchor was edited from one line to another but
  left inclusive, so `const pinnable = k => {` was eaten and its body left
  dangling. Same class as the above: valid syntax, wrong structure.
- **A leftover function declaration silently wins**, because declarations hoist
  and the last one wins. Grep for duplicate definitions first; `verify.js` does.
- **Capture the defaults before the hash is applied, not after.** The settings
  panel writes a shareable link by naming every parameter that differs from the
  defaults, so if "default" means "whatever this page booted with", every
  setting that *arrived* in the link is dropped the moment the panel is opened.

**GLSL**

- **Never write a backtick inside shader source**, including in comments. The
  shaders live in JS template literals, so a backtick closes the literal and the
  rest is parsed as JavaScript. The failure is a syntax error somewhere else
  entirely. `verify.js` checks statically that every shader reaches `void main`.
- `smoothstep(a, b, x)` with `a > b` is **undefined behavior**, not a reversed
  ramp. Always ascending. Symptom: the feature silently vanishes on some
  drivers. `verify.js` scans for this statically.
- **Band-limit fine detail** against the pixel footprint. Anything finer than a
  pixel aliases into moiré.
- Compute `dFdx`/`dFdy` **before** any branching — derivatives inside
  non-uniform control flow are undefined.
- **A `discard` is not free on a tile-based renderer** — but testing that needs
  the instruction ABSENT at compile time rather than unreached, because the
  driver reacts to it existing at all.

**Looking like plants**

- **Small solid marks with ground between them read as structure; translucent
  ones laid over each other average into haze.** Coverage is bought with the
  leaf size range, never with opacity.
- **Colour must stay a fixed projection of the genome**, never a per-lineage
  palette. Hue says which niche, saturation says how committed, lightness
  carries the life-history axis. Per-lineage jitter destroys all of it, and with
  it the ability to see convergent evolution at all.
- **Red and magenta are reserved** — the selection highlight and the size ring.
  An annotation the world can produce on its own is not an annotation.
- **Draw order must be per plant and stable.** One plant may legitimately stand
  over another; what it may not do is change which, between frames. Key it on a
  lineage id minted by the founder and inherited, never on the body's root — a
  root changes the moment a body splits, and the piece surfaces over whatever it
  overlapped at exactly the moment part of it died.
- **A node arriving at full strength is a glitter, not growth.** Hundreds a
  second each appearing from nothing; the eye reads simultaneous onsets as
  sparkle. Fade in, and fade out at the other end.

**Input**

- Pointers are tracked in a **`Map` keyed by pointer id**, and cleared on
  `blur`/`visibilitychange`, or a lost release jams input permanently.
- Read tap positions from the **tracked pointer**, not the release event; some
  touch stacks report zeroes there.
- `touch-action: none` on body and canvas, plus `user-scalable=no`, plus
  `preventDefault` on Safari `gesture*` events and ctrl+wheel. Without all four
  the browser zooms the page and the interface scales with the world.
- **Never empty a scroll container to rebuild it.** On iOS that collapses
  `scrollHeight` and takes `scrollTop` with it, so tapping a control's pin
  jumps the list to the top and the next tap lands on a different card. Update
  in place. It does **not** reproduce in Chromium, so an emulated test reporting
  "the list held its place" is true and worthless.
- **When two instances of one control disagree, the difference is not in the
  control.** The same pin button worked on the world view and not in the panel;
  the size of the target was a real defect and was not this one.

## Style

**American spelling throughout** — the about panel, the settings and graph
cards, button labels, the README and these documents. Comments inside
`index.html` are still British-ish in places, inherited along with the code;
match the file you are editing. Comments explain *why*, not *what*.

Do not claim the piece models anything it does not. There is no terrain, no
weather, no soil chemistry and no photosynthesis — there is competition for
room, and a lifespan that depends on your neighbours.

## Next

The plants are the point and they are currently four quantised leaf forms and a
line. Detail and beauty go here: leaf shape that reads as a species, branch
taper, a sense of overlap and depth, and whatever else survives the rule above
about haze. `step` is already large enough that a plant is a third of a metre of
screen — there is room in that for a great deal that would have been invisible
on a planet.

Two counters exist for exactly this work and should be used before and after:
`instHash()` says the picture did not change when it was not meant to, and
`buildMs()` says what the rebuild cost. An optimisation is only allowed to make
`buildMs` smaller, and `instHash` is how you say it did nothing else.
