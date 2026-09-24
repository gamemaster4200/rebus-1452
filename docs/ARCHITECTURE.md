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
  `masterSeed + founder index`; compilation derives every probability decision from
  `genome.seed + compiler version + event key`. Uncontrolled randomness is excluded.
- The canonical starting population contains 42 independent founders: six members in each of seven diversity-oriented metadata families. Families seed breadth but are not permanent genre classes.
- `extractGenomeFeatures` projects every genome into ten normalized, deterministic dimensions. The founder validator uses these features for simple distance and axis-range checks; the same representation can later support novelty, species, and population-map work.
- The system is frontend-first and local-first. Founder ratings use versioned
  `localStorage` data for this milestone and export with the canonical dataset hash.
- There is no backend at this stage.

The audio boundary is `MusicGenome → StrudelCompiler → CompiledStrudelPattern →
StrudelAudioEngine → WebAudio`. The compiler interprets a genome but never leaks
renderer concepts back into it. Playback timing and UI state live in
`PlaybackController`, independent from Strudel. Selection, crossover, mutation
execution, and offspring remain outside this stage.
