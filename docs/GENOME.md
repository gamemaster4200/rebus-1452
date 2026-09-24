# MusicGenome v0.1

`MusicGenome` is the renderer-neutral hereditary record of one musical organism. It describes musical intent as structured data; it never stores Strudel source, raw audio, or synthesizer-specific commands.

## Fixed world

Every v0.1 organism belongs to one compact `StyleEnvelope`:

- techno at 120 BPM in 4/4;
- 16 bars (32 seconds), split into eight-bar sections A and B;
- a 16th-note base grid and four-on-the-floor kick;
- bounded pitch collections, rhythmic density, percussion layers, sound parameters, interactions, development, and mutation traits.

The envelope combines numeric ranges, allowed enum values, and explicit invariants. Runtime validation rejects positions outside a cycle, excess percussion layers, unnormalized mutation weights, inaudible A/B development, and other invalid states.

## Schema

The top-level genome contains:

- identity, founder metadata, deterministic seed, and lineage;
- fixed global timing and form;
- structural bass rhythm, pitch choices, accents, lengths, rests, rotation, probability, and periodic variation;
- closed-hat, open-hat, and one or two logical percussion voices;
- a minimal tonic and pitch collection, with an optional A/B pitch shift;
- bounded oscillator, filter, drive, envelope, noise, reverb, and delay traits;
- explicit A → B changes for density, voices, filter, probability, rotation, and energy;
- a small set of bass/percussion, hat/percussion, accent, and kick/bass interactions;
- inheritable mutation rate, strength, scale weights, and category weights.

Pitch values are semitone offsets from a pitch-class root. Rhythm hits are integer positions inside a finite cycle. These representations can be compiled into different renderers without changing the genome.

## Audible phenotype

The first compiler maps hereditary traits into a 16-bar Strudel event plan:

- bass hits, rotation, probability, pitch choices, accents, note lengths, and gate
  become timed synth notes;
- closed/open hats and percussion retain their logical grids, mute bars, accents,
  rotations, probabilities, instruments, and layer changes;
- harmony selects absolute MIDI notes and the optional section-B shift;
- oscillator, filter, envelope, and gain become bounded SuperDough controls;
  drive and noise traits influence the safe filter mapping without allocating
  per-note distortion processors; `noise-blend` basses use a pitched triangle
  source, and dedicated noise synths are reserved for short hats;
- development traits transform bars 9–16 through density, probability, rotation,
  pitch, percussion, filter, and energy changes;
- interactions influence kick/bass balance, open-hat ducking, and aligned accents.

Mutation strategy is hereditary metadata used by the offline Generation 1
generator. It controls mutation rate, strength, scale weights, and category
weights. It is never executed during playback, so listening to an organism cannot
mutate its genome.

## Founders

The canonical population contains 42 independent generation-zero ancestors. IDs are stable from `founder-001` to `founder-042`; every lineage has no parents and is marked as a founder.

Seven metadata families contain six founders each:

1. Sparse Hypnotic
2. Groove Heavy
3. Driving
4. Bass Led
5. Percussion Led
6. Dark / Industrial
7. Wild / Outliers

Family profiles stratify the initial population across musical feature ranges. They guarantee a broad starting map but are not hard genre classes for later generations.

## Determinism and canonical data

The founder master seed is `rebus-1452-founders-v1`. A founder seed is the master
seed plus a zero-padded index, for example `rebus-1452-founders-v1:017`. The
Generation 1 master seed is `rebus-1452-generation-1-v1`. Both generators use only
the project-owned seeded PRNG.

Run:

```sh
npm run generate:founders
npm run generate:g1
```

The commands validate and write `src/data/founders.v0.1.json` and
`src/data/generation-1.v0.1.json`. Generated JSON must not be edited manually;
re-running either command produces byte-equivalent output. Generation 1 contains,
in stable ID order, seven unchanged musical elites, 24 crossover children, seven
mutation-only children, and four random immigrants. Every evolved lineage records
its origin, parents, ancestors, and actual path-level mutations.

The canonical G1 wrapper delegates reproduction to the generation-neutral engine.
That engine can produce later numbered generations from any validated preceding
population and its matching ratings without embedding G1-specific conditions.
Immigrants are sampled independently from the full Style Envelope, carry no family,
parents, or ancestors, and receive their ID and generation only when admitted to a
population.

## Feature extraction

`extractGenomeFeatures` deterministically maps a genome to ten normalized values:

- bass density;
- bass pitch variety;
- hat density;
- percussion density;
- syncopation;
- brightness;
- roughness;
- space;
- development amount;
- mutation rate.

Population validation checks pairwise normalized distances and minimum range on every axis. This deliberately simple representation is suitable for v0.1 validation and forms a stable input for later novelty, species, visualization, and preference experiments.
