# Architecture

Rebus Evolution keeps the evolutionary model independent from sound rendering:

```text
MusicGenome
    ↓
StrudelCompiler (deterministic event plan)
    ↓
StrudelAudioEngine + PlaybackController
    ↓
WebAudio
```

- `MusicGenome v0.1` is the renderer-independent source of truth. It contains structured rhythm, pitch, sound, development, interaction, mutation, and lineage data—never Strudel code.
- Strudel is the first renderer. `StrudelCompiler` produces a typed, inspectable
  event plan; `StrudelAudioEngine` is the only browser/runtime boundary.
- The compact `StyleEnvelope` defines the fixed 120 BPM, 4/4, 16-bar world and bounded musical ranges. Explicit validators enforce its invariants at runtime.
- Deterministic generation and compilation are mandatory. Founder generation uses
  `masterSeed + founder index`; Generation 1 uses its canonical ratings input,
  generation config, and `rebus-1452-generation-1-v1`; compilation derives every
  probability decision from `genome.seed + compiler version + event key`.
  Uncontrolled randomness is excluded from all deterministic paths.
- The canonical starting population contains 42 independent founders: six members in each of seven diversity-oriented metadata families. Families seed breadth but are not permanent genre classes.
- `extractGenomeFeatures` projects every genome into ten normalized, deterministic dimensions. The founder validator uses these features for simple distance and axis-range checks; the same representation can later support novelty, species, and population-map work.
- `generateNextGeneration` is the generation-neutral evolution boundary. It accepts
  a source population, that population's ratings, and a config containing the next
  generation number. It assigns `genN-*` identities and lineage while orchestrating
  seeded selection, modular crossover, micro/meso/macro mutation, immigrants, and
  validation. Generation 1 is only a canonical wrapper around this engine.
- `generateImmigrant` samples identity-free musical material directly from the
  `StyleEnvelope`. It uses stratified coordinates for population breadth and has no
  dependency on founder families or founder profiles; the generation engine assigns
  immigrant identity and lineage.
- Parent usage caps and feature-space checks protect diversity without rejecting
  music by aesthetic rules.
- The system is frontend-first and local-first. Ratings are stored separately by
  arbitrary non-negative generation number, dataset version, and dataset hash.
  Exports preserve that identity, and the legacy Generation 0 storage key is
  migrated on read.
- There is no backend at this stage.

The audio boundary is `MusicGenome → StrudelCompiler → CompiledStrudelPattern →
StrudelAudioEngine → WebAudio`. The compiler interprets a genome but never leaks
renderer concepts back into it. Playback timing and UI state live in
`PlaybackController`, independent from Strudel. Switching organism or generation
stops and retires the current audio run before another one can start.
