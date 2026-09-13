# Plants — the evidence

Every claim here was tested. Where a measurement contradicted an argument, the
measurement stands and the argument is recorded as wrong rather than quietly
deleted — the wrong turns are the most useful part of a document like this.

**Read this before trying an idea that sounds obvious.** A good few of them have
already been tried, here or on [Aetheris](https://github.com/DonMarshWorks/aetheris),
the planet this ecology came off.

Method, unless a section says otherwise: `tools/sweep.js`, four seeds, 6,000
ticks, frame loop stopped, determinism asserted before anything was compared.

---

## 1. The environment the plants make for each other

### `envcap` — derived 8, measured 3

`envcap` is how many neighbours it takes for a spot to count as full, and so
where `gap` reaches zero. It is the one number in this project that was invented
rather than inherited.

**The derivation was wrong.** The probe counts inside 1.5 collision radii, a
node occupies about one, and the continuum arithmetic says eight fit. The
continuum arithmetic does not survive contact with discreteness: in hexagonal
packing at spacing *r* the first ring of six sits at *r* and the next at 1.73*r*,
outside the probe entirely. A genuinely full spot holds **six**, and real packing
is looser than that. At 8 the ground never read as full, `gap` held 71% of the
world, and the other four niches were a rounding error.

Swept, four seeds, niche evenness:

| envcap | 1 | 2 | 3 | 4 | 5 | 8 | 12 |
|---|---|---|---|---|---|---|---|
| evenness | 0.83 | **0.93** | **0.92** | 0.87 | 0.81 | 0.62 | 0.48 |
| open ground | 0.04 | 0.17 | 0.29 | 0.44 | 0.53 | 0.71 | 0.80 |

**A real peak, not a slope**, which is worth knowing on its own: the shape that
misleads at a boundary is the monotone one, and this is not it. At 1 the
pioneers vanish instead of the others — a single neighbour fills the ground,
`gap` collapses to 0.04, and evenness falls because one of the five is gone.

2 and 3 tied **exactly** at eight seeds: evenness 0.93 and biggest strategy 0.21
on both. So the tie was broken by a reason rather than by a decimal — at 3 open
ground is 29% of the world and pioneers are a population; at 2 it is 17% and
they are mostly founders and frontier tips. **3.**

### Empty ground is pure `gap`, which breaks founding

Not a sweep, a consequence, and it has to be designed around rather than tuned:
a seed or a spore lands on ground with nothing on it, so its five memberships
are `(1,0,0,0,0)` whatever it is built for. Gating a founder on `viable` would
therefore admit pioneers and nothing else, and four of the five niches could
never start at all.

So `plantsSeed` plants without a viability test, and `sporeviable` defaults to 0
rather than to `viable`. Ordinary growth is still gated, because by then the
neighbourhood is real — and note that a clone specialist's *second* node is
judged next to its parent, where clone is already 1/`envcap` of the
neighbourhood, so the strategy can bootstrap. That bootstrap is a real cost paid
by a real strategy and is worth keeping.

---

## 2. Scale, and what this piece is for

### `step` and `minfrag` — the trade, and which side to take

There is no camera, so a node is always the same size on the glass and the
tension between "many small competitors" and "a few individuals you can watch"
has to be settled once.

`minfrag` swept alone at `step` 0.026, four seeds:

| minfrag | 5 | 10 | 20 | 35 | 50 | 70 | 100 | 150 |
|---|---|---|---|---|---|---|---|---|
| evenness | 0.94 | 0.94 | 0.92 | 0.89 | 0.87 | 0.84 | 0.76 | 0.75 |
| plants | 802 | 457 | 263 | 194 | 146 | 130 | 95 | 78 |
| mean body | 11 | 19 | 32 | 44 | 54 | 63 | 80 | 94 |
| largest | 103 | 147 | 186 | 318 | 357 | 555 | 643 | 816 |

Monotone, with no optimum in it — only a choice. **This is an aesthetic project
and the plants are the point**, so it takes the legible individual: `step` 0.040
and `minfrag` 70, which is 47 plants of mean 59 in an arena about 89 nodes
across, and a node about 22px on a 1920-wide window.

**And the pair is not the sum of its parts.** At 0.026/35 the world runs at
evenness 0.74; at 0.040/70 it runs at 0.84. Raising `minfrag` alone costs
diversity and raising both did not — which is the opposite of what the
single-dial sweep predicts, and is flagged here because it means neither number
can be moved on the strength of that table alone.

Verified at the shipped defaults across four seeds, 12,000 ticks: evenness
0.83–0.85, biggest strategy 0.26–0.32, all five niches occupied, nothing
extinct.

### Everything counted had to be rescaled

The sphere ran 80,000 live nodes; this runs a few thousand. Every count-like
default is therefore wrong by construction if inherited:

- `grow` 900 → 90. What matters to every clock in the system is attempts *per
  node* per tick, not attempts per tick. Carrying 900 across would have given
  every node eight times its chances and silently re-tuned lifespan, maturity
  and the settle grace along with it.
- `minfrag` 65 → 70 *at a larger step* — comparable as a share of the world, not
  as a number.
- `topn` 25 → 4. Twenty-five rings on a world of 47 plants marks a fifth of
  everything alive, and an annotation that common stops being an annotation.

---

## 3. What was inherited and not re-measured

These came from the sphere with their measured values intact. They are recorded
here as **assumptions**, not findings, because the world they were measured in
had an ocean in it:

- `crowdref` 12 — where the crowding input reads zero. Explicitly a guess here.
- `clamp` 8, `tries` 8, `readmit` 1, `jitter` 0.17, `spore` 0.001, `hgtd` 2.20,
  `settle` 1000, `esettlemax` 2000, the energy block.
- `rare` 0.70 and `kin` 0.00. On the sphere `rare` was half the answer to a
  marine monoculture and `kin` did nothing for specialisation. Both are worth
  re-asking here, where the neighbours *are* the environment rather than
  something laid over one.

---

## 4. Method — six ways the harness was wrong, not the thing measured

Every one of these cost real time in this project, and every one is cheap to
repeat.

### Reseeding masks extinction

**The first `minfrag` sweep concluded there was no extinction cliff. It was
measuring the rescue.** `reseed` plants a fresh random genome in every empty
province, so the world *cannot* die, and every arm up to `minfrag` 150 duly
"survived".

Don caught it: *emptying the world just gives reseeding more chance to start
with new pioneers.* The numbers had already said so and had been read past — at
minfrag 100–150, open ground rose to 0.44–0.48 and evenness fell to 0.75–0.76
while the survival column stayed clean. Degradation wearing survival's clothes.

Re-run with `reseed=0`, which is the only honest test of a dial that can empty
the world: still nothing died out to 6,000 ticks, so the cliff is genuinely
absent at this scale rather than merely hidden. Untested at long horizons.

> **The rule: any test of something that might empty the world has to turn the
> rescue off first, or it is a test of the rescue.**

### The blank arena, three times, never once the page

The picture was empty and the page was innocent on all three occasions.

1. **Wrong SwiftShader path.** The probe used `--use-gl=swiftshader` where the
   project uses `--use-gl=angle --use-angle=swiftshader`. The raw path loses the
   WebGL context outright when the 5.5MB instance buffer is allocated. The page
   booted, simulated, reported perfectly healthy statistics, drew the HUD
   correctly, and rendered nothing. Found by wrapping every GL call and logging
   the last three before `webglcontextlost`.
2. **Not waiting for a sliced rebuild.** With the flags fixed the arena was
   still blank, because the screenshot came four seconds after the frame loop
   was handed back and a *sliced* rebuild under software rendering needs far
   longer. Two different faults, one identical symptom.
3. **Handing rAF back does not restart a loop.** The boot schedules the frame
   loop with its own `requestAnimationFrame` call — and that is precisely the
   call the metering drops. Restoring the function afterwards restores nothing,
   because there is no pending callback. The drawing check now opens an
   unmetered page instead.

And a fourth of the same family: the bars-are-black check read **237/255** and
reported a leaking letterbox. It was sampling the word PLANTS in the corner of
the HUD. The interface is hidden before the picture is judged.

> **When a probe says the picture is empty, check the probe.**

### Extracting code by line range is off by one until proven otherwise

The simulation was lifted out of the source by line span and the span stopped
one line short of a closing brace. `node --check` passed — the file was still
valid JavaScript — and everything after it was silently nested one scope deeper,
so a `const` seven hundred lines later was invisible to its own use site. It
presented as `SETTINGS is not defined` with `const SETTINGS` plainly on screen.

Related, same day, same class: a patch script's end anchor was changed from one
line to another but left `inclusive`, which ate the anchor and left a function
body with no declaration in front of it. Valid syntax, wrong structure, both
times.

`verify.js` now asserts brace depth at known top-level declarations, scans for
unterminated block comments, and greps for duplicate function definitions.

### The counters that catch a broken harness

Assert these before believing anything else:

- **Two runs of one seed are byte-identical**, down to the instance buffer hash.
  `sweep.js` refuses to run if they are not.
- **A sliced rebuild equals a whole one.** The only thing that says slicing
  changed *when* work happened and nothing else.
- **A quantity that can only be one thing, is.** Nodes inside the walls: 0
  outside. Overlapping pairs: 0. Parent links longer than a legal step: 0.
  Non-finite program results: 0.

---

## 5. Open questions

- Does succession actually cycle, or does it reach a mosaic and stop? Evenness
  says the five niches coexist; it does not say a given patch goes round.
  Wanted: a per-patch time series, not a global one.
- `crowdref`, unswept.
- `rare` and `kin`, both worth re-asking in a world where the neighbours are the
  whole environment.
- Long horizons. Everything here is 6,000–12,000 ticks. The sphere's nastiest
  failures were slow ratchets that looked fine for a long time first.
