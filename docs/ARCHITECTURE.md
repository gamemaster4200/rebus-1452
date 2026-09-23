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

- `MusicGenome` is the renderer-independent source of truth. It must not contain Strudel code.
- Strudel is the first renderer, isolated behind a project-owned adapter.
- Deterministic, seeded generation is a required future property. The same genome and seed must produce the same musical result.
- The system is frontend-first and local-first. Persistence will use IndexedDB when it is introduced.
- There is no backend at this stage.

The bootstrap defines only these boundaries. The concrete genome schema and evolutionary operators belong to v0.1 and later experiments.
