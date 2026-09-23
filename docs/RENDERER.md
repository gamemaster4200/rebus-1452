# Strudel renderer

## Contract

`compileGenomeToStrudel` accepts a valid `MusicGenome v0.1` and returns a
`CompiledStrudelPattern`. The result is structured data, not executable source.
It always describes 16 bars at 120 BPM: section A occupies bars 1–8, section B
bars 9–16, and the total listening window is 32 seconds.

The plan records each event's bar, 16th-note step, logical voice, and a bounded
subset of Strudel/SuperDough controls. `debugCompiledGenome` provides a stable,
human-readable summary for diagnostics. `validateCompiledStrudelPattern` checks
duration, form, kick continuity, bass presence, A/B difference, timeline bounds,
and finite numeric values.

## Determinism and diversity

Compilation is pure. Probability is resolved by the project-owned seeded PRNG
using the genome seed, compiler version, voice, position, and decision kind. The
same genome and compiler version therefore produce the same event plan. Changing
founder traits changes rhythm, pitch, timbre, development, or interaction output;
the canonical smoke test requires 42 distinct post-compilation fingerprints.

## Runtime and safety

`StrudelAudioEngine` lazily initializes `@strudel/web` after a user gesture. It
materializes the event plan through Strudel's structured pattern API (`pure`,
`stack`, `sequence`, and `slowcat`) and never evaluates genome-provided code.

Safety is applied at compilation and runtime: gains and synthesis controls are
clamped, per-event compression and conservative post-gain are included, effects
feedback is bounded, and Strudel polyphony is capped at 48 voices. This reduces
surprises but does not replace normal listening care; start at a modest system
volume.

Noise timbres use Strudel's dedicated white, pink, and brown synths. The
SuperDough oscillator/noise crossfade control is deliberately excluded because
its current teardown path can disconnect the same AudioNode twice during rapid
pattern replacement.

`PlaybackController` owns the 32-second wall-clock lifecycle. Stop, restart, or
founder navigation clears timers and resets the complete SuperDough output graph:
orbits, reverb, delay, buses, and destination routing are disconnected and
recreated. Scheduled sources from the former graph may finish internally, but
they no longer have a route to the audio destination and cannot leak between
organisms. The browser `AudioContext` stays alive so Strudel's AudioWorklets do
not need unsafe repeated registration. Fake scheduler and runtime-module tests
exercise these rules without WebAudio.

## Ratings

Ratings from -2 through +2 are stored locally under a versioned key. Zero is a
real rating, not an unrated sentinel. JSON exports contain a schema version, the
founder dataset version and SHA-256, export time, and stable founder-sorted rows.
