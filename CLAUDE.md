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
- **Patch `index.html` with a small node script written to a file by the Write
  tool**, anchored on exact text and refusing unless each anchor is found
  exactly once. Shell heredocs and `node -e` with nested quotes have failed
  here repeatedly, and twice left a patch script that did not parse.
- `node tools/sweep.js envcap=1,2,3,4,5` searches a parameter rather than
  looking at one. It stops the frame loop, checks that two runs of one seed are
  byte-identical before comparing anything, and refuses to average a dead world
  into a mean. All three are scar tissue.
- **Deploy.** Work on `main` and push; GitHub Pages serves it directly.
  `npm run verify` must be green on the exact `index.html` being pushed — check
  the blob hash matches rather than assuming, since the run takes minutes and it
  is easy to edit the file while it runs.

  A run counts only if its hash before, its hash after and the file on disk
  are all the same, and only by verify's OWN exit code and its "everything
  passed" line. A wrapper that ends in `echo` exits 0 whatever verify did, and
  once hid a crash on a busy port. Two runs cannot share port 8123: queue the
  second behind the first.

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

**Motion is continuous to the eye (2026-10-03).** Three things, found by
measuring the change between consecutive one-tick moves of every instance.
A joint's rate is a TARGET (`NWT`, set by `setTurn`) that `NW` eases toward over
`turnease` ticks: set outright it changed at every look, and every ancestor's
changed at once when a limb below died, since a lighter load turns faster.
This one is simulation, and the gates were re-run. Between movement steps a
node is DRAWN carried on along its last move (`carryF`, `NVX`/`NVY`, the
per-node clock `NMT`), a quarter of it a tick, which is where the next step
puts it; nodes had moved one tick in four and stood still for three, twenty
jumps a second. Drawing only, no lag, and only accurate because the rates
ease. Leaf roll reads the same carried phase. Living motion's 99th-percentile
one-tick jerk went from 0.42 of a step to 0.04.

Consequences to keep in mind: the instance buffer is dirty on every movement
step, so the sliced rebuild is effectively continuous; `instHash` still says
a sliced build equals a whole one but no longer says the picture is unchanged
between ticks; `overlapScan` counts only pairs from *different* plants, and
sets apart any pair with a dying node (`dyingPairs`), which is not a violation; and
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

**Dying is withdrawing, and it goes on moving (2026-10-03, Don's design).**
What is going — a plant cleared whole, a limb cut, the part beyond rotting
wood — is not removed and replayed. It STAYS in the plant, marked `NDYING`:
still read, still swayed by the same joints, so it moves exactly as it did.
It buds no more, does not count toward `PSIZE` (so its seat is free at once),
neither cuts nor is cut, and holds its ground until it has withdrawn from it.
`scheduleRewind` gives each node a window measured along the branches: H is
the distance out to the farthest tip, a node's segment runs from t1·H/(H+len)
to t1, and its children's t1 is its start, so every tip starts at zero, every
branch arrives as its fork begins to move, and a tip travels at constant speed
through the nodes. Progress in a window is LINEAR and the ease is on the whole
clock; easing each segment, and scheduling by depth, is what made an older one
step. `markDying` marks what was scheduled; `dyingE` is how far a node has
withdrawn; `drawPos` pulls it that far toward where its parent is drawn NOW;
`emitNode` scales its leaf, twig and tangents by what is left and dims it; and
`releaseDying` frees it at `NDIEAT`, tips first, when nothing of it is on
screen. Only a node that was a tip when it began keeps a leaf (`NDTIP`), or a
branch would sprout leaves as its children withdrew into it. Durations:
`retspeed` ticks per step of branch, a floor of 180, and the caps `retcut`,
`retall`, `retage` — all tripled on 2026-10-03 because it felt frantic.

Ghosts remain only for a node that dies alone, of age. They were the whole
mechanism until then, and every way a frozen record failed to move like the
living thing was a jerk at the death: it stopped swinging, it did not turn
with its anchor, and a whole plant, which hangs from nothing, stopped dead
before it withdrew. A ghost now rides its anchor rigidly (turned as well as
carried) and its last motion runs down over `GDRIFT` ticks, and it is merged
into the paint order where its node stood.

Three things this design broke, each found by an audit in the live page and
each worth knowing the shape of. The sweep frees heartwood of a body with
nothing living and nothing dying, and `BDYING` counts only the LIVING that are
dying, so a dying plant's trunk was freed whole mid-withdrawal: wood that is
itself `NDYING` is now exempt. A dying node's life was lengthened to see it
through, and since leaf size is age over life that made every node younger and
reopened closed leaves: `reap` simply passes over the dying instead. And
`overlapScan` counted the dying against the exclusion invariant.

**Rendering** is instanced quads straight to the default framebuffer through an
orthographic transform, with the letterbox done by `gl.viewport` and a scissored
clear. There is no sheet texture, no mipmap, no seam passes and no detail patch
— the sphere needed all four to fold plants into a planet's albedo and to make
zooming mean anything, and a flat arena entirely on screen needs none of them.

**Branches are curves, since 2026-09-18.** One instance layout (`INST` = 15
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
smooth line and side branches peel off it. Half-width is its own subject,
below. What was last painted is kept per node (`NSG`) and a
ghost copies it, for the reason `NSTEMA` exists. Ribbons thinner than a pixel
are drawn a pixel wide and fainter (`uPx`). Measured: rebuild 0.78 → 1.03 ms at
22,270 instances, same instance count. `curve=0` restores straight branches.

**A branch is as thick as its subtree is large, and nothing else (Don,
2026-10-03).** Not how old it is, not how near the root, not how far it
reaches. Half-width is a fixed minimum (`thin`, which every tip and twig is)
plus the trunk's thickness times the subtree's share of the plant's nodes
raised to `taperp` (2.0, set by eye after 0.6, 0.8 and 1.0). A branch STARTS
at the width its own subtree earns and ENDS at its heaviest child's start
(`NHV`), so the main line tapers unbroken along every segment and a fork steps
down, as a tree's does. `NNT` is the size of the whole tree and `NRT` its
length, which sets the trunk; the movement step counts all three with `NDESC`
and hands the plant's figures to every node, because it walks each tree from
its real top. The `stem` dial (maximum 0.9) therefore thickens the base and
leaves the ends alone.
The width DRAWN eases toward the width wanted over `WIDTHEASE` ticks, about
twenty frames (`widthShown`): the wanted width changes in steps, a bud adding
a node to everything below it. The heaviest child starts at its parent's
drawn end, not a copy eased apart from it, so that joint stays whole.
Three earlier rules, and what each did wrong. Load raised to 0.4 times the
dial scaled tip and trunk alike. Distance to the farthest tip made a thin
branch off a trunk's base start as thick as the trunk. And a branch that
"continued" its parent started at its parent's width, so when the continuing
child was a short one it went from trunk to twig in a segment: 49 to 66 such
at any moment, the worst 24 to 1.

**A branch runs from its parent's color to its own** (`I_C0`, the fifteenth
float: the parent's branch color packed as three bytes plus one), so there is
no step of color at a joint. The paint is kept per node for the length of one
build (`paintCached`, `BUILD`), since a parent may be painted before or after
its child. For a LEAF the same slot is how wide its stalk is, as a share of the
leaf, so a stalk is the width of the branch it sits on.

**Ends are round where they need to be.** The strip has a row before its start
and one after its end, pushed out by the half-width into a half-disc when the
sign of `I_C0` (start) or of `W.y` (end) says so, and folded flat otherwise. A
tip's end is round, a side branch's start is, and so is any joint where a
branch sets off in a different direction from the one its parent arrived in,
which closes the wedge two square ends leave open. A straight joint is left
flush: two caps over each other show as a bead on a translucent branch.

**The canvas is not multisampled, since 2026-09-20** (`aa=1` restores it). It
was most of the cost of drawing: 35 fps with it and 120 without on an
integrated GPU at 1280x720, where removing the leaf shapes, the ribbon's
vertices or the discard each moved it by a fifth of that or less — plain discs
were SLOWER, because they cover more. The shader already softens every edge,
so the pictures differ by 1 part in 255. The page's timers cannot see GPU time:
read the overlay's `frame` against `work`.

**Paint order is a choice** (`layers`, "Branches over leaves" in the settings).
0, the default, is plant by plant; 1 is every branch in the world and then every
leaf, each in the plants' stable order, built in ONE walk with the leaves
written from the middle of the buffer (`LEAF0`) and moved down on completion.
`layers=0` is byte-identical to the build before it existed. Neither is right
everywhere: plant by plant lays one plant's branches over another's leaves, and
leaves-over-all buries every stem. With large opaque leaves BOTH show leaves
that seem to float and branches that seem to end in nothing; the branches are
all there (`limbs=2` shows them) and are covered by leaves painted later. It is
not a missing-branch bug and was checked against the instance buffer.
`twigs=1` draws a tip's last twig with its leaf when layers is on.

The instance buffer is rebuilt only when the world changes, **sliced across
frames**, while the draw happens every frame. Keeping those two clocks apart is
what stops a 60fps redraw from costing a 60Hz rebuild.

**The clock.** There is no climate, so there is no second clock to stay in step
with, and the time-lapse buttons mean what they say: ecology ticks per second.
The frame loop pays a debt against a *share* of each frame, so the plants get
the same CPU per second whatever the frame rate. The share is of the frame the
machine can HOLD (16.7ms, or 33.3 once it falls under 40fps), less what the
rest of the frame needed, never under `ecoshare` of it. Until 2026-09-20 it was
a share of how long the last frame WORKED, which fed on itself: an iPhone idle
eleven milliseconds a frame ran 80 ticks a second of the 190 asked for, and a
slow machine's long frames bought longer ones. `ecorate` is 80 because that is
the pace everything had actually been judged at. One tick is 2 to 4ms on fast
hardware and cannot be split, which is what a streaming stick runs into.
The perf overlay (`perf=1`, P, five presses top left, a remote's rewind key)
says mean / worst FRAME, and what key last arrived, plus `frame` (how long
one lasts) against `work` (how long it worked) and `gpu`, the GPU's backlog.

**The tick is a generator (2026-09-23).** `plantsTick` may hand the frame back
between bodies, blocks of nodes and buds, and `plantsSlice(endMs)` resumes
it; `plantsStep` drives the same generator to its end, so every harness and
the prerun run one implementation. Nothing else writes the world between
slices, so `runSliced` — yield at every opportunity — leaves the world byte
for byte where `runWorld` does, and that is asserted before anything else is
believed. It exists because a 50ms tick cannot be interrupted and a Fire TV
drew 14 frames a second with its GPU idle. The rebuild's slice is capped at
8ms. Note what it does NOT fix: the picture changes when a rebuild completes,
and on that stick that was three times a second at the default world size.
What the eye sees is the rebuild rate; report it beside the frame rate.

**The world waits while a picture is half built (2026-10-03).** A rebuild
spread over several frames used to read the world at several ticks: a node
that died between two slices was drawn neither alive nor dying, and a budding
tip's leaf went to a child the build did not know of. With the CPU throttled
four times, 21,939 leaves were missing from 285 pictures in 40 seconds, the
worst 440 in one: a sparkle over the whole screen whenever the frame rate fell
under 50, which is when slicing starts. Now no tick runs while `SB.busy`, and
the two take turns: the rebuild earns `sheetSlice` of credit a frame and
begins when it has earned what the last one cost (`sheetCredit`), and a frame
gives its whole budget to one or the other. Same work a frame, same ticks a
second, nothing missing. `instHash` never saw this, because it never ran a
tick between slices.

**The resolution governor times the GPU.** Every two seconds one frame reads
back a pixel, which cannot return until the frame is drawn, and the backlog
in FRAMES decides. Two indirect tests failed first: the frame rate alone cut a
CPU-bound stick to 806x453 for nothing, and "the share of the frame not
accounted for by our work" read a 20ms frame shown at a 33ms refresh as 40%
waiting for pixels. `gl.finish()` returns at once in Chrome and measures
nothing.

**The world opens at its beginning** (`prerun` 0, since 2026-10-03): the first
thing seen is the founders as single nodes, growing. It used to run 1,200
ticks out of sight first.

**A slow machine grows a bigger-plant world** (`auto`, `sizeToMachine`). A
fixed piece of arithmetic that touches nothing (`machineBench`, 8.7ms on this
desktop, best of three) is timed at boot; it was the world's own first 150
ticks until the world had to open at tick 0. A
machine over 2.5 times slower reloads with a larger `step`, as the square
root of the shortfall, up to 0.06, which on a CPU throttled ten times took the
picture from 3 changes a second to 33. The chosen step goes in the link, so
the world a stick shows is the world its link reproduces; naming step, or
`auto=0`, leaves it alone, and verify and sweep pin `auto=0`. Don chose this
over one world for every machine. The probe is noisy, about a fifth either
way on one machine. CPU throttling in Chromium
(`Emulation.setCPUThrottlingRate`, 10x) is a fair stand-in for the stick's
CPU and no stand-in at all for its GPU. A backlog longer than a second
is dropped rather than paid later, and the HUD prints the rate actually
achieved — never the multiplier, because on a slow machine that would be a claim
the piece cannot keep.

**Test hooks.** `window.__world` exposes `plants()`, `bodies()`, `deathLog()`, `arena()`,
`runWorld()`, `growPlants()`, `printGenome()`, `instHash()`, `params()`,
`defaults()`, `settings()`, `pins()`, `pick()`, `selected()`, `markedBodies()`,
`overlapScan()`, `hopScan()`, `wallScan()`, `stemScan()`, `seam()`, `paintOrder()`,
`bodyDiag()`, `setSpeed()`, `setPaused()`, `debug()`, `runSliced()`, `sized()`,
`season()`, `seasonAt()`, `style()`. Used by `verify.js` and
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

**Smoothness** (all [here], 2026-10-03, and all found by measuring)

- **Tag every instance with an identity and compare consecutive pictures.**
  Nothing else found these. A scratch copy of the page writes `tag(node)*4 +
  kind` beside each instance (branch, tip leaf, twig, twig leaf; a ghost keeps
  its node's), and a probe compares one build with the next. The scratch
  scripts were not kept; the method is what matters, and it took an afternoon
  to see that a leaf handed to a new tip changes identity in place and must be
  paired by position.
- **A probe sees only the quantity it measures.** Size times cover found the
  pops and was blind to a color flash, to a change of paint order, to a jerk
  of motion at constant size, and to a width. Each needed its own probe, and
  each time the report "it is smooth now" was true of what had been measured
  and false of the screen. When Don still sees it, the probe is missing a
  dimension: ask which, do not argue.
- **And only the conditions it runs in.** Stepping the world by hand and
  building whole after each tick is not the frame loop. The sparkle, the
  vanishing trunks, the leaves moving along a branch and the stale plant
  length all needed an audit INSIDE the live page, at every completed build,
  over a minute or more: one was visible at one sample in five.
- **A jerk is a value replaced outright.** Joint rates at a look, a life cut
  in a lump, a width that follows a count, the plant's length when a limb
  goes, which child continues a branch. If the picture reads it, it eases
  toward a target, by the clock, and a new node starts at the target.
- **Ease the thing drawn, once, not its inputs one by one.** Branch width was
  patched three times by easing an input, and each left another input that
  stepped. One eased output ended it.
- **Two eased copies of one quantity drift apart.** A joint is whole only if
  the child's start reads the SAME drawn number as its parent's end.
- **Do not read a plant's figures off `PROOT` between sweeps.** It names the
  body's root as of the last sweep: after a split or a death it is a dead
  slot, or the newborn that took it. Let the movement step hand them out; it
  walks each tree from its real top.
- **Do not decide what is drawn from something that is recounted.** `NDEP`
  moves when a root changes. Settle it at birth.
- **Changing a value the paint reads changes the picture.** Lengthening a
  dying node's life to protect it reopened its leaves.
- **A rule that says "nothing is dying" must count everything that is.**
- **A frozen record cannot be made to move like the thing it records.** Three
  patches to ghosts each fixed one way they differed from the living. Leaving
  the dying alive, which was Don's idea, removed the difference.

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
- **Seasons, variation and style drift are paint only, on the wall clock**
  (2026-09-23), so seed 7 is the same world in any season on any machine
  (a season now also sets how fast that world is played; see below).
  Seasons (`seasonAt`): every hue shifted the same way, saturation and
  lightness stretched, the drawn leaf scaled; the year starts where the seed
  says and each season holds a plateau for three fifths of its length. Fall
  sends cool hues DOWN the wheel through green to yellow and into brown — the
  short way ran through violet and the first fall was magenta. Variation
  (`freshTone`, `NVO`, `NVS`): each family's own leaf opacity and branch
  thickness, multipliers on the dials, hashed from the tone draw rather than
  taken from `prnd` so the world's random stream is untouched. Style
  (`styleAt`): four seeded random walks multiplying leaf size, opacity, stem
  and saturation; a moved dial leaves the walk. All three are sampled ONCE per
  instance build, so a sliced build equals a whole one — but two builds
  seconds apart differ by design, so `instHash` proves equality only with the
  clocks pinned (`seasonat`, `styleat`) or the features off, and verify and
  sweep pin `seasons=0&style=0`.
- **The seasons are told apart at a glance (2026-10-03, Don).** Six things,
  none of which reaches the simulation's rules.
  *Color:* fall goes 0.92 of the way to its colors, not a third — warm hues to
  red, greens to gold and amber by where they stood, blues to russet; summer
  pulls 0.45 toward green; spring is lighter; winter darker. Each season's
  shift is computed on its own (`seasonShift`) and the two are BLENDED. Blending
  the target hue and taking the short way to it flipped direction for a plant
  opposite the target as it moved, and the whole plant changed color in one
  build; it was always there and only showed once the pull was strong.
  *Winter by leaf:* `DECID`, by shape, is how much of winter's small, dark and
  grey a plant takes — maple, oak and chestnut all of it (leaf 0.35), needles
  and wheat almost none.
  *Ground:* the photograph is tinted toward a season color at its own
  brightness (`uTint`), brightened or dimmed, and in winter dusted with snow
  where it is light and where a blurred, enlarged sample of itself is
  (`uSnow`, set against the photograph's mean brightness, `bgLum`). Nothing
  when `bg` is 0.
  *Flowers, fruit, holly (`emitBloom`, `bloomQ`; `flowers=0`, `bloom`):*
  spring flowers, fruit from midsummer into early fall, red berries on one
  plant in three through winter. Which nodes: hashed from the slot and birth
  tick. What they look like: hashed from the plant's tone, so a family shares
  them and `prnd` is untouched. Variety is parametric, not a list — petal
  count, outline, notch, gap depth, eye, second whorl, two colors, size; fruit
  is a layout (cluster, raceme, pair on stalks, one long), a count, two colors.
  Leaf instances of shape 20 and 21, the description packed in `I_C0` and the
  second color in `W.y`; the one arctangent per fragment in the program, paid
  only by flowers. Each plant is early or late, each node opens at its own
  point of the ramp, so nothing arrives at size. Only while the year turns.
  Fruit hangs FROM its branch: it points away from it and is set out so the
  start of its stalks is on the node (at random angles a pair on stalks was a
  V joined to nothing). And a berry is a ball: its highlight is fixed on the
  SCREEN (`vDir` undoes the bunch's direction), or it swung round the berry as
  the branch swayed and read as a flat disc turning. Flowers are flat and keep
  a fixed angle.
  `MAXINST` is four per node for it.
  *Pace (`SEASON.pace`):* the world runs 1.2 of its ticks a second in spring
  and summer, 0.6 in fall, 0.15 in winter. Pacing only: the same ticks in the
  same order, so growth, ageing and sway slow together and seed 7 is still the
  same world. Don chose this over separate growth and motion dials inside the
  simulation; slowing growth alone kills every plant a quarter into winter (a
  node lives 3,250 ticks, a season is 14,400).
  *Between ticks (`TFRAC`, `BFRAC`):* at 12 ticks a second on a 60-frame
  screen everything drawn by the tick stood still for frames, so carry, leaf
  roll and withdrawal read the fraction of a tick the frame loop owes. Sampled
  once per build, zero outside one, so the simulation never sees it.
  *Breeze (`breezeOf`):* since pace ties motion to growth, summer and fall get
  a painted flutter of leaf direction on the wall clock. Its phase is read off
  where the leaf is DRAWN, never its node, or a leaf handed to a new tip would
  jump. With the year turning there is a new picture every frame.
  The corner shows the season's name and nothing else.

**Twelve leaf shapes** (lance, spade, heart, clover, needles, fern, aspen,
  wheat, dandelion, oak, maple, horse chestnut; shape 0, the plain disc, is retired but its number is
  kept), a gene (`NSHAPE`): copied exactly within a plant and to
  the pieces that rot off it, and chosen fresh — unused among the largest
  plants standing where possible — by a founder or a spore (`freshShape`). Drawn
  in the fragment shader by `leafQ` (`leafshape=7` shows one shape on every
  plant), no trigonometry per fragment. All but
  round, clover and dandelion are drawn ahead of the node, base on it. Lance,
  heart, aspen, oak, maple and chestnut have a short stalk (`petiole`,
  `orStalk`), drawn only where the blade is not and painted as BRANCH: a leaf's
  `W.y` carries `stemdark/leafK`. At the default
  leaf size a leaf is a pixel or two and the shape cannot be seen; it needs the
  leaf-size dial turned up.
- **A branch grows forward with its leaf.** A new node is drawn starting on its
  parent and slides to its real place over `sprout` ticks (`drawPos`; drawing
  only, it collides from its real place at once). The first child of a tip is
  handed the tip's leaf as it was DRAWN that tick — width, darkness, color and
  roll (`NLW0`, `NLD0`, `NC0`, `NLR0`/`NLR1`), including whatever the tip was
  itself still easing from — and eases to its own; a node with a child draws no
  tip leaf. It also takes the tip's place in the paint order (`NPS`). Any other
  new tip opens its leaf from nothing over 60 ticks. A node that loses its
  last child reopens a leaf over 60 ticks (`NLKAT`). Each of those details was
  a pop when it was missing: a leaf narrowing at the bud, a leaf appearing
  beside a leaf shrinking, a leaf jumping in the order, a leaf arriving at
  size.
- **Leaves along the branch, on twigs (2026-10-03).** Each plant draws a
  leafiness of 10% to 30%, a direction its twigs curl and a phase, hashed from
  its tone like the other looks (`NLFY`, `NTWC`, `NTPH`). Which nodes carry one
  is settled at BIRTH from a running total handed from parent to child
  (`NTWA`, `NTWS`), evenly spaced and alternating sides; only a node with a
  child shows it, on a curved twig 0.8 of a step long (`twigOf`), grown in and
  out by `twigOpen`. `twig=0` is byte-identical to before; `tipleaf=0` takes
  the leaf off every tip. It was first read off `NDEP`, the depth below the
  plant's root, which is recounted when the root changes, and every twig leaf
  of a plant moved one node along in the frame of a sweep.
- **A leaf's size is its age** (2026-09-18): born at `fatlo`, full at `fathi` by
  70% of the node's life, then CLOSING — shrinking smoothly to nothing, and
  dimming part way — by 80% (it used to go black and be removed, which is a
  pop against the photograph), so the last
  fifth of a node's life is bare branch. `leafLook` is the one function for the
  living leaf and its ghost. Form classes still set leaf aspect, not size. A
  per-plant scale (`NLSC`, 0.5 to 1.5) is part of the genome: drawn by a
  founder, copied exactly within a body, nudged only when a spore founds a
  plant.
  A node's life is NOT fixed: self-shade takes it in lumps of a hundred ticks
  at a look and a kill's spoils add to it. So the paint reads a life that
  eases toward the real one over 90 ticks (`lifeShown`); read raw, a leaf
  jumped in size or vanished just before its node died. `rotFade`, which is
  heartwood's, reads the real one.
- **Nothing may change its place in the paint order while it is on screen.**
  Within a lineage the order is by paint slot (`NPS`) and then node slot. A new
  tip that takes a leaf takes its parent's paint slot, and a ghost is merged in
  where its node stood (`orderGhosts`, `upTo`). Ordered by node slot alone, a
  handed leaf jumped to wherever the new node's slot fell (872 overlapping
  pairs flipped front to back in 400 ticks), and ghosts were a block under
  their lineage's living (668 at the start of die-backs).
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

Open, none urgent:
- **A streaming stick** is CPU-bound. `auto` gives it a world of bigger plants;
  the alternative for a dense world is interpolating between rebuilds on the
  GPU, or moving the simulation to a worker. Not built.
- **Twigs do not flex** with their branch yet; the joint's phase is there.
- **Each segment of a withdrawing branch starts at full speed** when the tip
  retracting into it arrives. Continuous at the visible tip, by design, but a
  twig leaf on that segment starts with it.
- **`kids` per lineage**: asked for, deferred.
- **The seasons' motion has not been probed**, only photographed: the breeze,
  the drawing between ticks and flowers opening were never run through the
  instance-identity probe. Don judges them by eye.
- Branch-against-branch collision, a maximum age, and the slow fall in program
  diversity over long runs are older open threads.

Two counters exist for exactly this work and should be used before and after:
`instHash()` says the picture did not change when it was not meant to, and
`buildMs()` says what the rebuild cost. An optimisation is only allowed to make
`buildMs` smaller, and `instHash` is how you say it did nothing else.
