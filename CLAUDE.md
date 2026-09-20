# Meadow

The app is called **Meadow**, and so are its GitHub repository and its URL; the
local project folder is still
`plants`.

Plants that evolve their own shape competing for a flat 16:9 arena. One
self-contained `index.html` — hand-rolled WebGL2, no libraries, no build step,
**zero network requests**. Published to GitHub Pages at
https://donmarshworks.github.io/meadow/

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
   ground photograph is embedded as base64 (`BG_B64`, about 250KB, in short
   lines with slashes written as underscores so the static scanner never sees
   a comment opener): a separate image file cannot become a WebGL texture
   when the page is opened off a disk, because a file page has no origin. The
   favicon is an inline SVG data URI. `verify.js` fails the build if anything
   leaves the origin.
2. **It must stay a meadow.** On the default settings, across seeds, after
   12,000 ticks: at least 10 plants; no plant holding over a quarter of the
   held ground; at least 6 leaf shapes and none over half the living nodes;
   programs differing in at least 0.40 of their fields between plants; at least
   50 bred births, no lineage doing over 0.65 of the parenting. `verify.js`
   gates on it and carries the measured ranges each mark was set against.
   "Form" — evenness over five bins of capacity and step — was the gate until
   2026-09-19 and is retired everywhere: it read red from before movement
   until then, and a gate that is always red gates nothing.
3. **The arena is 16:9 at every window shape**, centred, with black bars
   outside it. The world is never reshaped by the window.
4. **Adaptive resolution** must keep it near 60fps; it lowers DPR when frames
   are slow. Don't add unconditional per-fragment cost.
   The H key and the eye button put the whole interface away (`body.bare`),
   leaving one faint button to bring it back, because a touch screen has no H
   key; `ui=0` opens that way. F and the bracket button ask for full screen,
   and the button is not offered where the browser will not give it.
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

**There is no environment.** A spot is free or it is taken, and `blockedBy`
over nine collision bins is the whole of that question — it is the hottest
loop in the program at roughly two thousand calls a tick. Every node lives
`life` ticks, set once at birth. Until 2026-09-16 a census of the neighbours
was fused into that loop, split five ways into niches, and lifespan read off
the genome's affinities for them; Don removed all of it so that shape is the
only thing selection acts on. Note what went with it: pace used to be paid for
in lifespan and now costs nothing. Wood lives in a *second* bin map: it must
not be in the collision bins, because heartwood left there walls a body off
from its own dead interior, but it is still standing and still drawn.

**The genome** is a fixed-length linear program — 48 instructions (24 until
2026-09-18) over a fixed read space, plus four evolved constants — with seven
outputs: capacity, spread, pace, vigour, angle, turn, mem. `mem` writes a
per-node register (`NMEM`) that comes back as the `mem` input: written only on
the node's regular look, held to ±2 unsquashed so `mem <- mem` holds, and
inherited from the parent at birth. It is what lets a node do things in order.
At 24 instructions programs used 5 to 9 and the count fell over a run, so
length was never the constraint. The first three are read once at birth so a body is a
permanent record of the conditions each of its nodes grew through; vigour and
angle are re-read every look. Thirteen operators, the last of them XNOR, which
is 1 when both operands are on the same side of zero. Sixteen inputs: one,
age, depth, x, y, used, pcap, crowd, slot, wall, foe, foed, zig, wave, mem, self — zig
and wave oscillate with depth so a zigzag or a sinusoid is one mutation away,
because arcs were and waves were not, and selection only ever found arcs. Mutation is minted at
bifurcations, not per node, so a sector stays a coherent unit for selection to
act on.

**Movement.** Since 2026-09-17 a node is not where it grew. A root is fixed;
every other node owns the live angle of the branch to its parent (`NLA`), and
turning it swings everything below. The turn rate comes from a sixth genome
output, `turn`, scaled by `1 - NDESC/freeze` (standing descendants, recounted
each movement step) so tips move at any age and stems freeze under load —
age was tried first and froze whole old plants, which is what the screen is
mostly made of — and capped at `vmax` divided by the joint's lever (its step
plus its subtree's reach, `NREACH`) so a long limb turns slowly whatever. A
joint is an oscillator: `turn` drives the rate and sign of a phase `NPH` and
the lean is `bend·sin(NPH)` about the angle it grew at (`NANG`), so it slows
into each extreme and reverses on its own. Two earlier versions are worth not
repeating: unbounded angles made young plants spin like bearings, and a hard
clamp made every plant lean to the stop and freeze there (Don, 2026-09-17).
Roots do not turn at all.
`movePlants` runs every `mstep` ticks: it builds child lists, walks each body
root to tip rewriting position, heading, rotation and branch midpoint, rebins
what crossed a cell, and then tests every node that has moved a tenth of a
radius since it was last tested against the living nodes of *other* plants.
Of two that touch, the faster (displacement on the last step, `NV`) survives
and the slower is cut — `sever` marks the node and everything below it; equal
speeds cut both. A node within `core` generations of its root is hard and beats
anything softer regardless of speed: the core barely moves, so under the speed
test alone it lost every contact and a twig sweeping past the base felled the
plant. A node carrying `hard` standing descendants (`NDESC`) is hard as well:
ten generations did not cover a trunk, and one cut at depth 26 took 4,408 of
5,704 nodes. That caps a single cut near `hard` nodes; the depth rule stays
for small plants, which have no heavy limbs. Two hard nodes are a standoff and
neither is cut (`overlapScan` reports them as `hardPairs`); speed between them
felled whole plants.
A plant may pass through itself, and so when it splits its pieces are standing
inside each other: a pair of one lineage already inside the radius at its
previous test is in a truce, not a collision, until the two part (`nearestFoe`'s `px,py`).
Without it a split was a massacre — 2,854 nodes doomed in one measured tick —
which also killed the offspring reproduction depends on. `overlapScan` reports
such pairs as `kinPairs` and asserts only across lineages. Two inputs feed strategy: `foe`, the sine of
the bearing to the nearest node of another plant, and `foed`, how near it is.
Wood does not turn but is carried. Nodes may be carried past the edge; a node
outside, or a child that would land outside, cannot bud.

Consequences to keep in mind: the instance buffer is dirty on every movement
step, so the sliced rebuild is effectively continuous; `instHash` still says
a sliced build equals a whole one but no longer says the picture is unchanged
between ticks; `overlapScan` counts only pairs from *different* plants; and
`wallScan` asserts only that roots are inside.

**Heartwood.** A node that dies still holding children stops growing, stops
counting as alive, and stays in the tree as structure. It is released when its
last child goes, or when its rot clock expires. Without it, ageing alone split a
fifth of all deaths into separate bodies and nothing could grow past about ten
nodes; with it, mean body size went from 10.7 to 508 on the sphere.

**Founders are screened.** A random founder's program is redrawn until a
REHEARSAL of it — grown alone in scratch arrays for the length of its grace,
real program, real placement and refusal rules — reaches twice `minfrag`
(`branches`, `founders=0` to disable). Two cheaper tests passed nearly
everything: trusting the capacity asked for, and counting siblings that fit
round one node. Most random programs fail it, on pace as often as on
branching, since pace is free and a slow program is simply worse. It matters
because the opening now seeds only `maxplants` founders; unscreened, ten seats
were held a thousand ticks each by things that could never be plants and worlds
sat at thirty nodes for eight thousand ticks.

**Score, death and sexual reproduction (2026-09-19).** A plant's score is its
area averaged over its life plus `aggression` × its kills. Area is ground, not
nodes: distinct cells of a coarse grid (`ACELL`, three steps), found exactly by
sorting one key per living node (`scoreBodies`). Kills are credited in `spoil`,
so only to the faster node of a contact, never to a core that stood still.
The record follows the BODY, not the root index, exactly as `BFOUND` does:
nodes carry their body's record as of the last sweep (`NAS`, `NAN_`, `NKL`), and
when a root rots the largest piece is the same plant and keeps it (`HEIR`); the
other pieces are new plants with none.
Nothing is judged on node count and nothing has a grace period. While there
are more plants than `maxplants`, half the excess goes per sweep, each the
OLDEST plant in the lowest quartile by area (`chooseTheOldest`) — oldest, so a
newborn is never the one taken. One floor remains: a scrap under 8 nodes that
is a fragment, or is over 400 ticks old, is debris and is cleared unranked,
because without it the quartiles are quartiles of dust.
When a plant dies that was above the lowest quartile (`rebirths`: standing last
sweep, neither standing nor carried on by an heir now), a new one is founded (see open space, below). One in four is a random program, screened
as any founder is. Otherwise it is the child of two of the top five by score,
the pair whose programs differ most (`genomeGap`): the stronger's genome whole,
with one contiguous run of the weaker's instructions copied over it IN PLACE —
positions carry the wiring in a linear program — of length
`max(0.10, 0.5 × weak/strong)` of the program. Its hue is FRESH (`freshHue`, the widest gap standing), as are its leaf shape
and its tone. Mixing the parents' hues was tried and fails when it matters: the
best plants are often close in hue, and a run went one green. Rot pieces keep
their parent's look; births are what bring new ones.
Measured: about 35 such deaths per 16,000 ticks, three quarters of the
births sexual. A founded plant is hard all over for `nursery` ticks (`isHard`), because a
child born as one node into a full arena was felled before it established.
When a plant comes apart only its LARGEST piece is kept, the old root's
remainder counting as a piece (`FRAGDOOM`, death-log reason `piece`;
`keepfrag=1` restores the old way). Rot was making thirty plants for every
birth, all with the parent's leaf and hue. With nothing else adding plants,
an empty seat is filled by a birth, one a sweep, at the roomiest of a dozen
points (`bornVacancy`).
The cull of the oldest in the lowest quartile is PERIODIC, one every
`cullevery` ticks whatever the count; tied to excess it never ran once pieces
stopped being kept, and the ten opening plants lived for ever.
Wood about to rot through, with the smaller part of the plant beyond it, does
not sever: that part is rewound toward the plant while the wood still shows
(`sever(i,"rot")` from `reap`), so it never hangs loose. Only when the far side
is the larger does the plant split, and then the near side is the piece cleared.
Every birth goes in the middle of the largest OPEN SPACE (`openSpace`): cells
of the coarse grid holding a living node are marked, a breadth-first pass
gives each empty cell its distance to the nearest occupied one, walls counting
as occupied, and the farthest cell is planted. It was the dead plant's root,
in the thick of the fighting.
Both parents' kill counts are cleared when they breed (`killreset`), so the turn
passes round; area, a lifetime average, is left alone.
Spores are off (`spore` = 0) and seeding only restarts a world
under half its plants. `plants().breeding` reports all of it.
What went: the `minfrag` size bar and its grace, the juvenile quota and the
largest-family-first cull; `minfrag` survives only as the bar a founder's
rehearsal must clear. The plant count still runs at two to three times
`maxplants`, because rot makes plants faster than half-the-excess clears them.

**Self-shade.** A plant may fold through itself, and did, more and more: size,
hardness and the plant limit all count nodes, so a ball beats the same plant
spread out. It is discouraged, not outlawed. `nearestFoe` also counts the
node's own plant within the collision radius (`FOE_OWN`; budding never places
one that close, so each got there by folding). The `self` input reports it and
each look takes `shade` ticks of life per tick per such neighbour, up to four.
Tips only: charged to every node it killed plant interiors, which rotted
through and shattered the plant (74 plants at a limit of 10).
`overlapScan().ownPairs` is the measure. The principled fix — size as ground
covered, not nodes — is deferred to arrive with sexual selection, which needs
an area measure anyway.

**The spoils.** The faster node of a cut earns its limb life: the striking
node and every ancestor to the root gain `spoils` ticks per living node taken,
capped at twice `life` (wood on the path up to twice `rot`). A hard node that
was standing still defended and earns nothing. Nothing extra is taken from the
loser — that was proposed and declined, because it feeds the one-family
takeover. Before this, winning paid nothing. `plants().spoils` reports kills,
life given and node speeds.

**Dying back.** What is dying is carried by its plant but does not turn
(`setTurn`); it was frozen in place once, and a retracting limb came away from
the plant and withdrew into empty air. A ghost likewise follows its parent
while the parent stands (`g+28`, `g+29`): its curve is shifted by the parent's
movement since the death and it retracts toward the parent as it is now. A plant the limit or the size bar removes is killed
whole and dims as one over `agefade`; only a cut unwinds. A limb cut at its
base is marked (`NDYING`) and each
node's remaining life set by its distance from the farthest tip, so it withers
from the tips toward the wound over at most 300 ticks. Dying nodes cannot bud
and do not count toward `PSIZE`, so a dying body is already nobody to the
limit. Before this a single cut once freed 4,871 nodes at a stroke and big
plants winked out inside the quarter-second fade. `deathLog()` says what took
what. Dying is growing run backwards, in ONE smooth motion. A cut limb dies at once
(it no longer lingers, colliding, while it dies back) and a cleared plant dies
whole; either way the dead part is ghosts, and `scheduleRewind` gives each a
window measured along the branches: H is the distance out to the farthest tip,
a node's segment runs from t1·H/(H+len) to t1, and its children's t1 is its
start. So every tip starts at zero, every branch arrives as its fork begins to
move, and a tip travels at constant speed through the nodes. Progress in a
window is LINEAR and the ease is on the whole clock (`emitGhost`); easing each
segment, and scheduling by depth, is what made the old one step. The dying
part rides whatever living thing it hangs from (`NTAN`, ghost slots 28-32), all
of it shifted by the same amount. `retspeed`, `retcut`, `retall`, `retage`.

**Rendering** is instanced quads straight to the default framebuffer through an
orthographic transform, with the letterbox done by `gl.viewport` and a scissored
clear. There is no sheet texture, no mipmap, no seam passes and no detail patch
— the sphere needed all four to fold plants into a planet's albedo and to make
zooming mean anything, and a flat arena entirely on screen needs none of them.

**Branches are curves, since 2026-09-18.** One instance layout (`INST` = 14
floats) serves leaves and branches, because both must go down in one draw to
keep the per-plant paint order; `W.x < 0` marks a leaf. A branch is a ribbon on
a cubic Hermite from parent to child, evaluated in the vertex shader over an
eight-segment strip, so it is still one instance. The tangents are chosen on
the CPU in `emitNode`, and that is where squiggles are prevented: direction is
the bisector of the two UNIT chords at a node (so unequal segment lengths never
enter, which is what makes a uniform Catmull-Rom overshoot), length is the
chord's, cut to a third as the turn sharpens, and an end with nothing to bisect
against — no grandparent, a limb frozen in dying — is straight. A TIP, which
has no child, mirrors its start direction across the chord, so its last
segment is a circular arc carrying the bend on; its leaf lies along that end
direction, passed as a unit vector in `D`, so leaves cost no trigonometry.
`NCONT` names the child that continues a branch, so a run of nodes is one
smooth line and side branches peel off it. Half-width follows load
(`taper`, via `NDESC`). What was last painted is kept per node (`NSG`) and a
ghost copies it, for the reason `NSTEMA` exists. Ribbons thinner than a pixel
are drawn a pixel wide and fainter (`uPx`). Measured: rebuild 0.78 → 1.03 ms at
22,270 instances, same instance count. `curve=0` restores straight branches.

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

**Test hooks.** `window.__world` exposes `plants()`, `bodies()`, `deathLog()`, `arena()`,
`runWorld()`, `growPlants()`, `printGenome()`, `instHash()`, `params()`,
`defaults()`, `settings()`, `pins()`, `pick()`, `selected()`, `markedBodies()`,
`overlapScan()`, `hopScan()`, `wallScan()`, `stemScan()`, `seam()`, `paintOrder()`,
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
- **[here] `--static` passing does not mean the page loads.** A `new
  Float32Array(PMAX)` was declared beside the function that used it, which sat
  above `const PMAX`. Valid syntax, every static check green, and a
  ReferenceError at load that reached Don's screen. A top-level `const` sized
  by another goes below it, and any edit that adds one is followed by a run
  that loads the page, not only by `--static`.
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
- **Hue is ancestry, not form, since 2026-09-17.** A founder takes the middle
  of the widest gap between the hues already standing (`freshHue`; drawn at
  random, unrelated plants kept looking alike),
  descendants inherit it, bifurcations nudge it by `huedrift` (tiny: it
  compounds, and at 0.03 one plant ran green to orange to teal), and a piece
  that splits off steps `fraghue` round the wheel. That step is painted over
  `hueease` ticks, not at once (`NHOWE`): the genome changes on the sweep, the
  paint runs behind. `NHUE` is a position on a
  twelve-stop perceptual wheel (`wheelDeg`), not an HSL angle, a third of
  which is green. Saturation is
  still the turn and lightness is now age. The old rule — hue as a fixed
  projection of capacity and step, so convergent evolution was visible — was
  dropped by Don because a few dozen plants mostly in one green band were not
  telling anyone anything; the form projection survives as `formOf`, which
  the diversity gate counts, and is simply not painted. Never colour from the
  program's bytes: an address changing by one is not a small change.
- **Shapes are evened out by area** (`LEAFFIT`): all are drawn in one square
  and a heart fills two thirds of it where a maple fills under a third, so
  hearts looked twice the size. Line shapes are left alone.
- **A leaf's drawn direction EASES toward its target** over 45 ticks, by the
  clock (`NLDX/NLDY/NLDT`), and a leaf handed to a first child starts from the
  parent's. The target still jumps — by the whole bud angle at a handover —
  and drawn raw that was a one-frame rotation at every growing tip. A budding
  branch's curve end likewise eases from the tip's arc to the bisector over
  the child's sprout.
- **Leaves roll** about their length in time with their joint's phase (`NPH`,
  `leafRoll`, `roll`): narrower and a little dimmer edge-on. Per node per
  rebuild, not per fragment.
- **Tangents fade with the turn, they are not a plain bisector.** At a turn
  near 180 degrees, which a saturated angle output makes common, the incoming
  and outgoing directions cancel and their sum flips side as the joint sways;
  the curve and its leaf flipped with it. The incoming direction is weighted
  by how far the two agree and is gone by 90 degrees.
- **A plant has a tone** beside its hue (`NTL`, `NTS`): a lightness offset of
  ±0.11 and a saturation multiplier of 0.55 to 1.2, drawn once by whatever
  founds it and copied exactly. It shifts the whole band; lightness still says
  age and saturation still says turn.
- **Nothing is reserved.** The selection highlight is a lift toward white.
  (Red was the highlight and magenta the size ring; both went 2026-09-17.)
- **Twelve leaf shapes** (lance, spade, heart, clover, needles, fern, aspen,
  wheat, dandelion, oak, maple, horse chestnut; shape 0, the plain disc, is retired but its number is
  kept), a gene (`NSHAPE`): copied exactly within a plant and to
  the pieces that rot off it, and chosen fresh — unused among the largest
  plants standing where possible — by a founder or a spore (`freshShape`). Drawn
  in the fragment shader by `leafQ` (`leafshape=7` shows one shape on every
  plant), no trigonometry per fragment. All but
  round, clover and dandelion are drawn ahead of the node, base on it. At the default
  leaf size a leaf is a pixel or two and the shape cannot be seen; it needs the
  leaf-size dial turned up.
- **Only tips carry leaves, and a branch grows forward with its leaf.** A new
  node is drawn starting on its parent and slides to its real place over
  `sprout` ticks (`drawPos`; drawing only, it collides from its real place at
  once). The first child of a tip is handed the tip's leaf as it was that tick
  — width, darkness, colour (`NLW0`, `NLD0`, `NC0`) — and eases to its own, and
  does not fade in. Before this a leaf shrank on one node while another grew
  on the next, at every tip at once, and that was sparkle. A node that loses
  its last child reopens a leaf over 60 ticks (`NLKAT`).
- **A leaf's size is its age** (2026-09-18): born at `fatlo`, full at `fathi` by
  70% of the node's life, then CLOSING — shrinking smoothly to nothing, and
  dimming part way — by 80% (it used to go black and be removed, which is a
  pop against the photograph), so the last
  fifth of a node's life is bare branch. `leafLook` is the one function for the
  living leaf and its ghost. Form classes still set leaf aspect, not size. A
  per-plant scale (`NLSC`, 0.5 to 1.5) is part of the genome: drawn by a
  founder, copied exactly within a body, nudged only when a spore founds a
  plant.
  The kill reward lengthens a life, so a rewarded limb's leaves step back a
  little in size and one that had dropped can return.
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
weather, no soil chemistry, no photosynthesis and no ecology — there is
competition for room, and a fixed lifespan.

## Next

The plants are the point and they are currently four quantised leaf forms on
curved, tapered branches. Detail and beauty go here: leaf shape that reads as
a species, a sense of overlap and depth, and whatever else survives the rule above
about haze. `step` is already large enough that a plant is a third of a metre of
screen — there is room in that for a great deal that would have been invisible
on a planet.

Two counters exist for exactly this work and should be used before and after:
`instHash()` says the picture did not change when it was not meant to, and
`buildMs()` says what the rebuild cost. An optimisation is only allowed to make
`buildMs` smaller, and `instHash` is how you say it did nothing else.
