# Meadow

Plants that evolve their own shape competing for a flat arena. 

One self-contained `index.html` — hand-rolled WebGL2, no libraries, no build
step, **zero network requests**. Published to GitHub Pages at
https://donmarshworks.github.io/meadow/


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

## The acceptance test

Is it still a meadow, or has one thing taken it? On the default settings, across
several seeds, after 12,000 ticks:

- at least **10 plants** are standing
- no plant holds more than **a quarter** of the ground that is held
- at least **6 leaf shapes** are present, and none covers more than half the
  living nodes
- two plants' programs differ, on average, in at least **0.40** of their fields
- at least **50 bred births** have happened, and no one lineage has done more
  than **0.65** of the parenting

Each mark stands well clear of what a healthy world does; `tools/verify.js`
carries the measured ranges beside them, and `npm run verify` fails the build
on any of them.

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
