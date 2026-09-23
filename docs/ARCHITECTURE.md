# Architecture

Rebus Evolution keeps the evolutionary model independent from sound rendering:

```text
MusicGenome
    ↓
Strudel compiler / renderer adapter
    ↓
Strudel
    ↓
WebAudio
```

- `MusicGenome v0.1` is the renderer-independent source of truth. It contains structured rhythm, pitch, sound, development, interaction, mutation, and lineage data—never Strudel code.
- Strudel is the first renderer, isolated behind a project-owned adapter.
- The compact `StyleEnvelope` defines the fixed 120 BPM, 4/4, 16-bar world and bounded musical ranges. Explicit validators enforce its invariants at runtime.
- Deterministic generation is mandatory. `masterSeed + founder index` is the complete input to the seeded PRNG; uncontrolled randomness is excluded from generation paths.
- The canonical starting population contains 42 independent founders: six members in each of seven diversity-oriented metadata families. Families seed breadth but are not permanent genre classes.
- `extractGenomeFeatures` projects every genome into ten normalized, deterministic dimensions. The founder validator uses these features for simple distance and axis-range checks; the same representation can later support novelty, species, and population-map work.
- The system is frontend-first and local-first. Persistence will use IndexedDB when it is introduced.
- There is no backend at this stage.

The next audio boundary remains `MusicGenome → StrudelCompiler → Strudel → WebAudio`. The compiler may interpret the genome but must not leak renderer concepts back into it. Selection, crossover, mutation execution, and offspring remain outside this stage.
