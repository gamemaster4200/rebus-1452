import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STYLE_ENVELOPE } from '../genome/StyleEnvelope';
import { generateImmigrant } from './Immigrant';

function phenotype(template: ReturnType<typeof generateImmigrant>): string {
  return JSON.stringify({
    global: template.global,
    bass: template.bass,
    closedHat: template.closedHat,
    openHat: template.openHat,
    percussion: template.percussion,
    harmony: template.harmony,
    sound: template.sound,
    development: template.development,
    interaction: template.interaction,
    mutationStrategy: template.mutationStrategy,
  });
}

describe('generic immigrant generator', () => {
  it('is independent from founder generation and family profiles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/evolution/Immigrant.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /FounderGenerator|generateFounder|FAMILY_PROFILES/,
    );
  });

  it('is deterministic, identity-free, and has no family', () => {
    const first = generateImmigrant(STYLE_ENVELOPE, 'immigrant-seed', {
      index: 1,
      total: 4,
    });
    const second = generateImmigrant(STYLE_ENVELOPE, 'immigrant-seed', {
      index: 1,
      total: 4,
    });
    expect(first).toEqual(second);
    expect(first.family).toBeUndefined();
    expect(first).not.toHaveProperty('id');
    expect(first).not.toHaveProperty('lineage');
  });

  it('space-fills multiple seeds without phenotype collapse', () => {
    const immigrants = Array.from({ length: 4 }, (_, index) =>
      generateImmigrant(STYLE_ENVELOPE, `immigrant-${index}`, {
        index,
        total: 4,
      }),
    );
    expect(new Set(immigrants.map(phenotype)).size).toBe(4);
  });
});
