# Meadow

Plants that evolve their own shape competing for a flat arena. There is no
terrain here, no weather, and no ecology — only room, and the other plants
taking it.

One self-contained `index.html` — hand-rolled WebGL2, no libraries, no build
step, **zero network requests**. Published to GitHub Pages at
https://donmarshworks.github.io/plants/

![the arena](shots/a-bigger-plants.png)

---

## What it is

A 16:9 arena of uniform ground. Plants grow into it a node at a time, branching
in continuous position, and every one of them carries a short program that
decides how it grows. They compete for room, they age, they die from the middle
outward, and the pieces that break off go on as plants in their own right.

Nothing about a spot is decided before the plants arrive, and nothing about it
is decided after, either: a spot is free or it is taken. Every node lives the
same fixed span. What decides whether a lineage persists is the **shape** it
grows — how many branches, how far apart, at what angles, how fast, and how all
of that changes along the plant as it ages — because shape is what claims room
and holds it.

Until September 2026 this was an ecology: five situations the plants made for
each other, affinities for them in the genome, and a lifespan that read off the
match. That version and what it measured are in `docs/`. It was removed so that
the plants would be the whole subject.

**Plants move.** A plant's root is fixed, but every other node can turn the
branch that joins it to its parent, carrying everything beyond it. A joint slows
under what it carries, so tips keep moving at any age, stems settle, and a
long limb is swung slowly whatever it weighs. A branch swings
only so far either side of the angle it grew at, slowing into each limit and
turning back, since a plant bends and does not spin. The program
decides which way to turn and can feel where the nearest other plant is. When
two plants touch, the faster node wins and the slower is cut, losing everything
beyond the point of contact, and the branch that struck lives longer for it, except that the core of a plant, its first ten
generations from the root, is hard and cuts whatever strikes it, and so is any
branch carrying a couple of hundred nodes; a plant may pass through itself. Reach is a weapon and a liability at
once, and what a lineage makes of that is up to it.

**Color is ancestry.** Every new plant is born with a hue of its own, chosen
to stand apart from the plants already there, and passes it down; each branching may shift it a little, so a
lineage's color drifts as it evolves and a piece that breaks off keeps the color
of the plant it came from. Saturation says how sharply a node turned from its
parent, so a straight vine is grey and a wide fan is vivid. Lightness says age:
new growth is pale and darkens over its life.

## Where it came from

This is the evolving-plants half of [Aetheris](https://github.com/DonMarshWorks/aetheris),
lifted off the planet it grew on. The genome, the formulas, heartwood,
fragmentation and spores came across nearly intact. What did not come with it
was everything that made a planet: terrain, climate, seasons, the sun, a camera,
a sphere — and then, in a second cut, the ecology itself.

Two things follow from that and shape the whole piece:

- **There is no camera.** The whole arena is on screen at all times, so a node
  is always the same size on the glass, and the trade between "many small
  competitors" and "a few individuals you can watch" has to be made once rather
  than deferred to a zoom. This takes the second side of it — this is an
  aesthetic project and the plants are the point.
- **The world has edges.** A rectangle does and a sphere does not. Growth is
  simply refused at the frame, so a plant pressed against it loses the turns it
  spends pushing. Nothing wraps around.

## Running it

Open `index.html`. That is all — it works from `file://`, a memory stick or an
aeroplane, because it fetches nothing.

```
npm run serve      # a local server on :8000, which is how it ships
npm run verify     # the gate: several minutes, renders in software
npm run verify -- --static     # the instant checks only
```

`npm i && npx playwright install chromium` once, first, for the harness. The
site itself has no dependencies.

## Experimenting

Every parameter is overridable from the URL, so a variant costs a minute and no
edit:

```
index.html#seed=7&step=0.05&minfrag=100&glen=48
```

Seed plus parameters determine a world completely — nothing reads the clock and
no genome draws from `Math.random` — so a link really is the world and not
merely a description of it. The settings panel writes one for you.

To search a space rather than look at one:

```
node tools/sweep.js life=800,1500,3000
node tools/sweep.js --seeds 8 --ticks 20000 reseed=0 minfrag=20,50,100
```

`sweep.js` refuses to average a dead world into a mean, checks that two runs of
one seed are byte-identical before it compares anything, and stops the frame
loop first. All three of those are scar tissue; see `CLAUDE.md`.

## The acceptance test

Two ways this genre of simulation dies: **monoculture**, where one form wins
and diversity goes to zero, and **extinction**. Diversity is measured on the
color arc: hue is a fixed projection of the phenotype, cut into five bins, and
the living nodes are counted into them. The piece passes if, on the default
settings across several seeds:

- form evenness stays **above 0.45**
- no single hue bin holds **more than half** the world
- nothing goes extinct

Those two lines are drawn on the graphs, and `npm run verify` fails the build on
them. Everything else in the readout is description.

At the first run after the ecology was removed (2026-09-16), four seeds and
12,000 ticks: evenness 0.54–0.63, nothing extinct, and the biggest bin
0.45–0.54 — two of the four seeds a hair over the line. The population
converges on capacity 4–5 and a mid-range step, which is a fact about the world
and not about the projection. Whether the gate moves or the world does is an
open decision.

## The window never reshapes the world

![a square window](shots/d-square-window-letterbox.png)

Same arena, same plants, bars added. Verified at four window shapes.

## Documents

- [`docs/plants-design.md`](docs/plants-design.md) — the model as it stands, and why.
- [`docs/plants-measured.md`](docs/plants-measured.md) — the evidence. Every claim
  that was tested and what the testing said, **including the ones it destroyed**.
  Read this before trying an idea that sounds obvious.
- [`CLAUDE.md`](CLAUDE.md) — how to work on it, and the bugs that have already
  shipped once.

## License

MIT. See [LICENSE](LICENSE).

## How plants breed

Every plant is scored on the ground it has covered, averaged over its life, plus
the enemy nodes it has killed, weighted by the Aggression setting. When a plant
that was above the lowest quartile by area dies, a new one grows where its root
stood: one time in four a random program, otherwise the child of the two most
unlike each other among the five best-scoring plants. The stronger gives its
program and the weaker overwrites a contiguous stretch of it, half when they
score alike, never less than a tenth. The child's color and leaf are its own, chosen to stand apart
from the plants already there.
When there are more plants than the target, the one cleared is the oldest of
those covering the least ground, so nothing needs a grace period.

## Credits

The ground under the plants is a photograph of moss and soil by Liam Briese, from
Unsplash (`UYMZ2Fw-OaM`), cropped to 16:9, scaled to 1600x900 and embedded in
`index.html` as a data URI so the page still makes no requests.
