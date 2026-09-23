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
- oscillator, filter, envelope, noise, space, delay, and drive become bounded
  SuperDough controls;
- development traits transform bars 9–16 through density, probability, rotation,
  pitch, percussion, filter, and energy changes;
- interactions influence kick/bass balance, open-hat ducking, and aligned accents.

Mutation strategy remains hereditary metadata for future reproduction. It is not
executed during playback, so listening to an organism cannot mutate its genome.

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

The master seed is `rebus-1452-founders-v1`. A founder seed is the master seed plus a zero-padded index, for example `rebus-1452-founders-v1:017`. The generator uses only the project-owned seeded PRNG.

Run:

```sh
npm run generate:founders
```

The command validates and writes `src/data/founders.v0.1.json`. The JSON is generated data and must not be edited manually. Re-running the command produces byte-equivalent output.

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
