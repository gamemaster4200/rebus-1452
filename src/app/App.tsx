import { useEffect, useMemo, useRef, useState } from 'react';
import { compileGenomeToStrudel } from '../audio/strudel/StrudelCompiler';
import { StrudelAudioEngine } from '../audio/strudel/StrudelRuntime';
import canonicalFounders from '../data/founders.v0.1.json';
import generation1Json from '../data/generation-1.v0.1.json';
import generation1MetadataJson from '../data/generation-1.v0.1.meta.json';
import type { GenerationDatasetMetadata } from '../evolution/GenerationTypes';
import type { MusicGenome } from '../genome/MusicGenome';
import {
  PlaybackController,
  type PlaybackState,
} from '../player/PlaybackController';
import {
  createRatingsExport,
  findNextUnratedIndex,
  GENERATION_0_IDENTITY,
  RatingRepository,
  type FounderRating,
  type FounderScore,
  type RatingDatasetIdentity,
} from '../ratings/RatingRepository';

type Generation = 0 | 1;

const generation1Metadata =
  generation1MetadataJson as GenerationDatasetMetadata;
const DATASETS: Record<
  Generation,
  {
    readonly genomes: readonly MusicGenome[];
    readonly identity: RatingDatasetIdentity;
  }
> = {
  0: {
    genomes: canonicalFounders as unknown as MusicGenome[],
    identity: GENERATION_0_IDENTITY,
  },
  1: {
    genomes: generation1Json as unknown as MusicGenome[],
    identity: {
      generation: 1,
      datasetVersion: generation1Metadata.datasetVersion,
      datasetSha256: generation1Metadata.datasetSha256,
    },
  },
};

const SCORES: readonly FounderScore[] = [-2, -1, 0, 1, 2];
const SCORE_LABELS: Record<FounderScore, string> = {
  [-2]: 'Совсем не подходит',
  [-1]: 'Скорее не подходит',
  [0]: 'Нейтрально',
  [1]: 'Нравится',
  [2]: 'Отлично',
};
const initialPlaybackState: PlaybackState = {
  status: 'idle',
  elapsedMs: 0,
  totalMs: 32_000,
  section: 'A',
};

function formatTime(milliseconds: number): string {
  return `0:${Math.floor(milliseconds / 1_000)
    .toString()
    .padStart(2, '0')}`;
}

function familyName(family: MusicGenome['family']): string {
  return family?.replaceAll('-', ' ') ?? 'evolved';
}

function downloadRatings(
  ratings: ReadonlyMap<string, FounderRating>,
  identity: RatingDatasetIdentity,
): void {
  const json = JSON.stringify(createRatingsExport(ratings, identity), null, 2);
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rebus-1452-generation-${identity.generation}-ratings.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LineageSummary({ genome }: { readonly genome: MusicGenome }) {
  const lineage = genome.lineage;
  if (lineage.generation === 0) return null;
  const mutations = lineage.mutations ?? [];
  return (
    <div className="lineage-summary" aria-label="Происхождение организма">
      <p>
        <strong>Origin:</strong> {lineage.originType}
      </p>
      {lineage.parents.length > 0 && (
        <p>
          <strong>
            {lineage.parents.length === 1 ? 'Parent:' : 'Parents:'}
          </strong>{' '}
          {lineage.parents.join(' × ')}
        </p>
      )}
      {mutations.length > 0 && (
        <details>
          <summary>Mutations: {mutations.length}</summary>
          <ul>
            {mutations.map((mutation, index) => (
              <li key={`${mutation.path}-${index}`}>
                {mutation.scale} / {mutation.category}: {mutation.path}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function App() {
  const [generation, setGeneration] = useState<Generation>(0);
  const [genomeIndex, setGenomeIndex] = useState(0);
  const selectedIndexRef = useRef(0);
  const selectedGenomeIdRef = useRef<string | null>(null);
  const playbackIntentRef = useRef(false);
  const [playback, setPlayback] = useState(initialPlaybackState);
  const [error, setError] = useState<string | null>(null);
  const repositories = useMemo(
    () => ({
      0: new RatingRepository(window.localStorage, DATASETS[0].identity),
      1: new RatingRepository(window.localStorage, DATASETS[1].identity),
    }),
    [],
  );
  const [ratingsByGeneration, setRatingsByGeneration] = useState(() => ({
    0: repositories[0].load(),
    1: repositories[1].load(),
  }));
  const controller = useMemo(
    () => new PlaybackController(new StrudelAudioEngine()),
    [],
  );

  const dataset = DATASETS[generation];
  const genomes = dataset.genomes;
  const genome = genomes[genomeIndex];
  const ratings = ratingsByGeneration[generation];
  const compiled = useMemo(() => compileGenomeToStrudel(genome), [genome]);
  const currentRating = ratings.get(genome.id)?.score;

  useEffect(() => controller.subscribe(setPlayback), [controller]);
  useEffect(() => {
    if (selectedGenomeIdRef.current === compiled.genomeId) return;
    selectedGenomeIdRef.current = compiled.genomeId;
    controller.select(compiled);
  }, [compiled, controller]);
  useEffect(
    () => () => {
      controller.dispose();
    },
    [controller],
  );

  const switchGeneration = (next: Generation) => {
    playbackIntentRef.current = false;
    selectedIndexRef.current = 0;
    selectedGenomeIdRef.current = null;
    controller.stop();
    setError(null);
    setGeneration(next);
    setGenomeIndex(0);
  };

  const selectRelative = (delta: number) => {
    setError(null);
    const status = controller.getState().status;
    const shouldResume =
      playbackIntentRef.current &&
      (status === 'playing' || status === 'loading');
    const nextIndex =
      (selectedIndexRef.current + delta + genomes.length) % genomes.length;
    const nextCompiled = compileGenomeToStrudel(genomes[nextIndex]);

    selectedIndexRef.current = nextIndex;
    selectedGenomeIdRef.current = nextCompiled.genomeId;
    controller.select(nextCompiled, status === 'stopped' ? 'stopped' : 'idle');
    setGenomeIndex(nextIndex);

    if (shouldResume) {
      void controller.play().catch((reason: unknown) => {
        playbackIntentRef.current = false;
        controller.stop();
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось включить звук.',
        );
      });
    }
  };

  const selectNextUnrated = () => {
    const next = findNextUnratedIndex(genomes, ratings, genomeIndex);
    if (next !== null) {
      setError(null);
      playbackIntentRef.current = false;
      selectedIndexRef.current = next;
      setGenomeIndex(next);
    }
  };

  const startPlayback = async (restart = false) => {
    setError(null);
    playbackIntentRef.current = true;
    try {
      if (restart) await controller.restart();
      else await controller.play();
    } catch (reason) {
      playbackIntentRef.current = false;
      controller.stop();
      setError(
        reason instanceof Error ? reason.message : 'Не удалось включить звук.',
      );
    }
  };

  const stopPlayback = () => {
    playbackIntentRef.current = false;
    controller.stop();
  };

  const rate = (score: FounderScore) => {
    const next = repositories[generation].save({
      genomeId: genome.id,
      score,
      ratedAt: new Date().toISOString(),
    });
    setRatingsByGeneration((current) => ({
      ...current,
      [generation]: new Map(next),
    }));
  };

  const progress = (playback.elapsedMs / playback.totalMs) * 100;
  const itemLabel = generation === 0 ? 'Founder' : 'Organism';

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">rebus-1452 / evolutionary listening room</p>
          <h1>REBUS EVOLUTION</h1>
        </div>
        <div className="rated-counter" aria-label="Прогресс оценивания">
          <strong>{ratings.size}</strong>
          <span>из {genomes.length} оценено</span>
        </div>
      </header>

      <nav className="generation-picker" aria-label="Выбор поколения">
        <label htmlFor="generation">Generation</label>
        <select
          id="generation"
          aria-label="Generation"
          value={generation}
          onChange={(event) =>
            switchGeneration(Number(event.target.value) as Generation)
          }
        >
          <option value={0}>Generation 0</option>
          <option value={1}>Generation 1</option>
        </select>
      </nav>

      <section className="player-card" aria-labelledby="founder-title">
        <div className="founder-heading">
          <div>
            <p className="counter">
              {itemLabel} {String(genomeIndex + 1).padStart(3, '0')} /{' '}
              {genomes.length}
            </p>
            <h2 id="founder-title">{genome.id}</h2>
          </div>
          <dl className="metadata">
            <div>
              <dt>Family</dt>
              <dd>{familyName(genome.family)}</dd>
            </div>
            <div>
              <dt>Generation</dt>
              <dd>{genome.lineage.generation}</dd>
            </div>
            <div>
              <dt>Seed</dt>
              <dd title={genome.seed}>{genome.seed}</dd>
            </div>
          </dl>
        </div>

        <LineageSummary genome={genome} />

        <div
          className="timeline"
          aria-label="Зацикленные 16 тактов: секция A, затем секция B"
        >
          <div className="timeline-labels">
            <span>A · bars 1–8</span>
            <span>B · bars 9–16</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <span className="section-boundary" aria-hidden="true" />
          </div>
          <div className="time-row" role="status" aria-live="polite">
            <span>
              {playback.status} · section {playback.section}
            </span>
            <span>
              {formatTime(playback.elapsedMs)} / {formatTime(playback.totalMs)}
            </span>
          </div>
        </div>

        <div className="transport" aria-label="Воспроизведение">
          <button type="button" onClick={() => selectRelative(-1)}>
            ← Previous
          </button>
          <button
            type="button"
            className="play"
            onClick={() => void startPlayback()}
            disabled={
              playback.status === 'loading' || playback.status === 'playing'
            }
          >
            {playback.status === 'loading' ? 'Loading…' : 'Play loop'}
          </button>
          <button type="button" onClick={stopPlayback}>
            Stop
          </button>
          <button
            type="button"
            onClick={() => void startPlayback(true)}
            disabled={playback.status === 'loading'}
          >
            Restart
          </button>
          <button type="button" onClick={() => selectRelative(1)}>
            Next →
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <fieldset className="rating-panel">
          <legend>Насколько этот организм подходит для эволюции?</legend>
          <div className="score-buttons">
            {SCORES.map((score) => (
              <button
                type="button"
                key={score}
                className="score"
                aria-label={`${score}: ${SCORE_LABELS[score]}`}
                aria-pressed={currentRating === score}
                onClick={() => rate(score)}
              >
                <strong>{score > 0 ? `+${score}` : score}</strong>
                <span>{SCORE_LABELS[score]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="workflow-actions">
          <button
            type="button"
            className="next-unrated"
            onClick={selectNextUnrated}
            disabled={ratings.size === genomes.length}
          >
            Next unrated
          </button>
          <button
            type="button"
            className="export"
            onClick={() => downloadRatings(ratings, dataset.identity)}
            disabled={ratings.size === 0}
          >
            Export ratings JSON
          </button>
        </div>
      </section>

      <footer>
        120 BPM · 4/4 · 16-bar loop · deterministic Strudel compiler
      </footer>
    </main>
  );
}
