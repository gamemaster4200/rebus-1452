import { describe, expect, it } from 'vitest';
import canonicalFounders from '../../data/founders.v0.1.json';
import type { MusicGenome } from '../../genome/MusicGenome';
import {
  compileGenomeToStrudel,
  compiledGenomeFingerprint,
  debugCompiledGenome,
  validateCompiledStrudelPattern,
} from './StrudelCompiler';

const founders = canonicalFounders as unknown as MusicGenome[];

describe('StrudelCompiler', () => {
  it('compiles deterministically without altering the genome', () => {
    const founder = founders[0];
    expect(founder).toBeDefined();
    const before = JSON.stringify(founder);
    const first = compileGenomeToStrudel(founder);
    const second = compileGenomeToStrudel(founder);

    expect(first).toEqual(second);
    expect(JSON.stringify(founder)).toBe(before);
    expect(debugCompiledGenome(first)).toBe(debugCompiledGenome(second));
  });

  it('programmatically smoke-tests all 42 canonical founders', () => {
    expect(founders).toHaveLength(42);
    founders.forEach((founder) => {
      const compiled = compileGenomeToStrudel(founder);
      expect(validateCompiledStrudelPattern(compiled), founder.id).toEqual([]);
      expect(compiled).toMatchObject({
        bars: 16,
        durationSeconds: 32,
        sectionBoundaryBar: 8,
        bpm: 120,
      });
      expect(
        compiled.events.filter((event) => event.voice === 'kick'),
      ).toHaveLength(64);
      expect(compiled.events.some((event) => event.voice === 'bass')).toBe(
        true,
      );
      expect(
        compiled.events.some((event) => event.voice.startsWith('percussion-')),
      ).toBe(true);
    });
  });

  it('preserves population diversity after compilation', () => {
    const fingerprints = founders.map((founder) =>
      compiledGenomeFingerprint(compileGenomeToStrudel(founder)),
    );
    expect(new Set(fingerprints).size).toBe(42);
  });

  it('keeps every founder inside the technical mix envelope', () => {
    const expensivePerEventControls = [
      'compressor',
      'compressorRatio',
      'compressorKnee',
      'compressorAttack',
      'compressorRelease',
      'distort',
      'postgain',
      'room',
      'delay',
    ];

    founders.forEach((founder) => {
      const compiled = compileGenomeToStrudel(founder);
      const bass = compiled.events.filter((event) => event.voice === 'bass');
      const hats = compiled.events.filter((event) =>
        event.voice.endsWith('hat'),
      );

      bass.forEach((event) => {
        expect(['white', 'pink', 'brown']).not.toContain(event.controls.s);
        expect(event.controls.attack).toBeLessThanOrEqual(0.025);
        expect(event.controls.release).toBeLessThanOrEqual(0.16);
        expect(event.controls.clip).toBeGreaterThanOrEqual(0.55);
      });

      hats.forEach((event) => {
        expect(event.controls.hcutoff).toBeGreaterThanOrEqual(6_000);
        expect(event.controls.sustain).toBe(0);
        expect(event.controls.release).toBeLessThanOrEqual(0.03);
      });

      compiled.events.forEach((event) => {
        expensivePerEventControls.forEach((control) => {
          expect(event.controls).not.toHaveProperty(control);
        });
      });

      const summedGainByStep = new Map<string, number>();
      compiled.events.forEach((event) => {
        const key = `${event.bar}:${event.step}`;
        const eventGain = event.controls.gain * event.controls.velocity;
        summedGainByStep.set(key, (summedGainByStep.get(key) ?? 0) + eventGain);
      });
      expect(Math.max(...summedGainByStep.values())).toBeLessThanOrEqual(0.6);
    });
  });
});
