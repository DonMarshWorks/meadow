# Plants — the design as it stands

This is the model as it is actually built. The evidence sits in
[`plants-measured.md`](plants-measured.md) — every claim that was tested and
what the testing said, including the several it destroyed. **Read that one
before trying an idea that sounds obvious**, because a good few of them have
already been tried.

Where a measurement contradicted an argument, the measurement is recorded and
the argument struck rather than quietly rewritten. The wrong turns are the most
useful part of a document like this.

---

## Where this came from, and what changed

The ecology here is lifted from [Aetheris](https://github.com/DonMarshWorks/aetheris),
a procedural planet whose plants evolved against a wandering climate. The
genome, the growth turn, heartwood, fragmentation, the frontier, spores, the
census and the colour projection all came across nearly intact.

What did not come with them is everything that made a planet: terrain, climate,
seasons, a sun, a camera, and the sphere itself. That removes four things the
old design leaned on, and each needed an answer:

| gone | replaced by |
|---|---|
| five biomes to be adapted to | five **situations**, made by the plants — see below |
| a climate that never stopped moving | the plants themselves, which also never stop |
| sunlight scaling growth | nothing. Every leaf gathers at the same rate |
| a sphere with no boundary | a rectangle with hard walls, and `wall` as a genome input |

And one thing changed character rather than being replaced. On a sphere you can
zoom, so the tension between "many small competitors" and "a few individuals you
can watch" can be deferred to the camera. Here the whole arena is always on
screen, so it has to be decided once. **This piece is aesthetic before it is
ecological, and it takes the side of the legible individual.**

---

## The arena

A flat rectangle, `x ∈ [-16/9, 16/9]` and `y ∈ [-1, 1]`, so the world is 16 by 9
whatever shape the window is. A wide window gets bars above and below, a tall one
gets them at the sides, and the plants are the same plants either way. The
letterbox is a `gl.viewport` and a scissored clear, so there is exactly one
description of where the world is and the bars are simply canvas nobody drew on.

Positions and headings are two-dimensional and a heading is a plain unit
direction: growth turns it and steps `p + h·d`. The sphere needed a geodesic, a
re-normalisation and a parallel transport to say the same thing, plus a seam and
a pole guard, and all five went with the curvature.

**The walls are hard.** A bud landing outside the frame is refused exactly as if
a neighbour were standing there — the plant loses the turn. Nothing wraps and
nothing dies of being at the edge. The genome can read `wall`, so a lineage can
learn to turn away from the frame or to hug it and be crowded from one side only.

---

## What a place is

There is no terrain, so nothing about a spot was decided before the plants
arrived. Every difference between one place and another is a difference the
plants have made — and that is enough, because it is the one kind of environment
that cannot settle down. A climate had to be steered by a controller to stop any
of its environments vanishing; this one cannot lose any of the five, because
each is manufactured by the plants living in the one before it.

`probeAt` measures what is standing within 1.5 collision radii of a point and
splits it five ways, summing to one:

- **gap** — nothing there
- **clone** — this body's own tissue
- **kin** — another body, near enough in the genome to count as a relative
- **rival** — another body, far enough off to be a stranger
- **wood** — dead heartwood, still standing

Fit is the genome's five affinities dotted with those, exactly as it was against
the planet's biomes, and lifespan reads off fit and is never itself a gene.

**Each of the five is a living.** A gap specialist is a pioneer that runs into
open ground and suffocates when the ground closes. A clone specialist thickens a
mat and has to bootstrap — a founder standing alone has almost no clone around
it and must survive on very little until its second node arrives, which is a real
cost paid by a real strategy. A kin specialist forms stands with its own kind. A
rival specialist makes its living on contested borders. A wood specialist lives
on what the others leave behind.

**And they make each other.** Pioneers fill open ground, which makes crowding,
which is what a clone specialist wants; a clone thicket ages into heartwood,
which is what a wood specialist wants; the wood rots through and the gap is back.
That is succession, and it is written nowhere. Whether it actually happens is a
measurement and not an argument — see `even` on the charts.

### Two consequences that are easy to get wrong

**Founders must not be judged on fit.** Empty ground is pure `gap`, so a
viability test at the moment of founding would admit pioneers and nothing else,
and four of the five niches could never start. `plantsSeed` therefore plants
without a viability gate, and `sporeviable` defaults to 0 rather than to
`viable`. Ordinary growth is still gated, because by then the neighbourhood is
real.

**`fitcap` is load-bearing here in a way it was not on the sphere.** Open ground
is most of an empty world, so without a ceiling on what suitability buys, the
first pioneer to arrive is handed a lifespan nothing else can approach and the
opening seconds decide the run.

---

## The plants themselves

### Turns

Plants take turns. In each turn, for each plant:

1. **Death.** Any node whose age exceeds the allowance for where it actually
   sits is killed. Evaluation continues into its children regardless.
2. **Severance.** Each surviving subtree cut loose becomes an independent plant.
3. **Growth.** Candidate nodes are drawn from the frontier; each evaluates a
   formula returning how badly it wants to bud, and the highest wins. The winner
   evaluates a second formula giving a turn angle, added to the heading it
   inherited. If the new position collides — or lands outside the arena — the
   request is refused and the plant loses the turn.

Candidates come from the **frontier**, never from the body. Sampling the body
would make a large plant spend its turns on interior nodes that cannot grow, and
the size distribution would then be set by that accident rather than by anything
chosen.

### The genome

A fixed-length linear program: 24 instructions over a fixed read space, four
evolved constants, and ten outputs.

Linear/Cartesian GP rather than expression trees — no bloat by construction,
point mutations stay small, and instructions that reach no output drift neutrally
and become the raw material that makes a genome evolvable rather than brittle.

| output | read | what it decides |
|---|---|---|
| capacity | at birth | how many children this node may ever have |
| spread | per child | how far its children are placed |
| pace | at birth | how fast it matures, paid for in lifespan |
| angle | per child | the turn that places a child |
| vigour | every look | how badly it wants a child *now* |
| five affinities | at birth | how this node leans, on top of what it inherited |

The first three being fixed at birth is what makes a body a permanent record of
the conditions each of its nodes grew through. Vigour is re-read, so it can
depend on age — rising as a node matures, or oscillating if age goes through a
sine, which is where whorls and rhythmic branching come from.

Inputs, all scaled so the interesting region sits around zero: `one`, `age`,
`depth`, `fit`, the five memberships, `y`, `used`, `pcap`, `crowd`, `slot`,
`wall`, `store`.

**Mutation is minted at bifurcations, not per node.** Mutating every node would
let drift inside one body swamp the differences between bodies — lineages would
blur and selection could not accumulate. A small per-node chance (`nodemut`) is
the floor under that, because a lineage that never branches would otherwise copy
itself down a vine for ever and could not evolve at all.

**Affinities stay numbers while everything else became a program.** The fixed
budget is why: it is what stops the drift to a bland immortal generalist, a
formula output cannot easily be budget-constrained across five values, and this
is what colour is projected from.

### Heartwood, and the life cycle

Lifespan derives from fit, age accumulates, and the oldest nodes are nearest the
root — so a plant is repeatedly hollowed out from the centre.

A node that dies still holding children **does not vanish**: it stops growing,
stops counting as alive, and stays in the tree as structure. It is released when
its last child goes, or when its rot clock expires. Without this, ageing alone
split a fifth of all deaths into separate bodies and nothing could grow past
about ten nodes.

Wood is **not** in the collision bins — left there it walls a body off from its
own dead interior, which is what a crust does and not what a plant does — but it
*is* in a second bin map of its own, because it is still standing, still drawn,
and still one of the five things a place can be.

When wood finally rots through, whatever was hanging off it becomes a plant in
its own right. **That is how new individuals mostly arrive here**: not from
seed, but from bodies breaking apart where they already stand. Two consequences:
per-plant state must be cheap to create, and identity for colour must be
genomic, never per-plant, or the picture would strobe.

### Arriving

- **Spores.** With small probability a bud is thrown clear instead, founding a
  body that carries its parent's genome mutated harder than usual. Rare enough
  that an arrival reads as an event — and rare for a measured reason: a spore is
  a copy of whatever is winning, flung across the world, so dispersal is
  *homogenising*.
- **Reseeding.** A fresh random genome appears in any province that has nothing
  growing in it. This fills empty ground without spreading the incumbent, and it
  is what stops extinction being absorbing. It also **masks** extinction, which
  matters when testing — see `plants-measured.md`.
- **Horizontal transfer.** A bifurcation occasionally copies a contiguous block
  of instructions from a touching foreign lineage, guarded by genetic distance.
  The point is not novelty — mutation supplies that — it is transmission: a
  lineage that works out something hard otherwise has no way to pass it on
  except by out-growing everybody, and a discovery that costs growth before it
  pays never gets the chance. The distance guard is what makes a species barrier
  emergent rather than declared.

---

## Rendering

**Colour is information, not decoration.** Genome to colour through a fixed
projection, never a per-lineage palette:

- **hue** — which of the five the affinity vector favours
- **saturation** — how peaked it is, so generalists desaturate toward grey
- **lightness** — the life-history axis

Then related plants look related, convergent evolution shows up as the same
colour appearing independently in similar places, and the picture becomes a map
of the successional state of every patch for nothing. Per-lineage jitter would
destroy all of it.

Red and magenta are absent from the palette on purpose and must stay absent:
they are the selection highlight and the size ring. An annotation the world can
produce on its own is not an annotation.

**Instanced quads straight to the screen.** No sheet texture, no mipmap, no seam
passes, no detail patch — the sphere needed all four to fold plants into a
planet's albedo and to make zooming mean anything. The instance buffer is
rebuilt only when the world changes and **sliced across frames**; the draw
happens every frame. Keeping those two clocks apart is what stops a 60fps redraw
from costing a 60Hz rebuild.

**Thickness and cover from age, not from descendant count.** Da Vinci's rule is
the classical answer and costs O(depth) per event under constant death; age
gives nearly the same picture for nothing and composes — the old core is thick
and dark *and about to die*, the frontier is thin and bright.

---

## What is not built

Everything under "Next" in `CLAUDE.md`. In particular the plants are currently
four quantised leaf forms and a line, which is the level of detail a planet
could show and far less than this arena can. That is the next work and the
reason `step` is as large as it is.

Not modelled, and not to be claimed: soil, water, nutrients, photosynthesis,
pollination, herbivory, or any weather at all. What is modelled is competition
for room, and a lifespan that depends on your neighbours.
