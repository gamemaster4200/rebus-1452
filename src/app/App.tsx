import { useEffect, useMemo, useState } from 'react';
import canonicalFounders from '../data/founders.v0.1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import { compileGenomeToStrudel } from '../audio/strudel/StrudelCompiler';
import { StrudelAudioEngine } from '../audio/strudel/StrudelRuntime';
import {
  PlaybackController,
  type PlaybackState,
} from '../player/PlaybackController';
import {
  createRatingsExport,
  findNextUnratedIndex,
  RatingRepository,
  type FounderRating,
  type FounderScore,
} from '../ratings/RatingRepository';

const founders = canonicalFounders as unknown as MusicGenome[];
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
  return family?.replaceAll('-', ' ') ?? 'unknown';
}

function downloadRatings(ratings: ReadonlyMap<string, FounderRating>): void {
  const json = JSON.stringify(createRatingsExport(ratings), null, 2);
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'rebus-1452-founder-ratings.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [founderIndex, setFounderIndex] = useState(0);
  const [playback, setPlayback] = useState(initialPlaybackState);
  const [autoNext, setAutoNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const repository = useMemo(
    () => new RatingRepository(window.localStorage),
    [],
  );
  const [ratings, setRatings] = useState(() => repository.load());
  const controller = useMemo(
    () => new PlaybackController(new StrudelAudioEngine()),
    [],
  );

  const founder = founders[founderIndex];
  const compiled = useMemo(() => compileGenomeToStrudel(founder), [founder]);
  const currentRating = ratings.get(founder.id)?.score;

  useEffect(() => controller.subscribe(setPlayback), [controller]);

  useEffect(() => {
    controller.select(compiled);
  }, [compiled, controller]);

  useEffect(
    () => () => {
      controller.dispose();
    },
    [controller],
  );

  useEffect(() => {
    if (
      playback.status !== 'finished' ||
      !autoNext ||
      !ratings.has(founder.id)
    ) {
      return;
    }
    const next = findNextUnratedIndex(founders, ratings, founderIndex);
    if (next !== null) queueMicrotask(() => setFounderIndex(next));
  }, [autoNext, founder.id, founderIndex, playback.status, ratings]);

  const selectRelative = (delta: number) => {
    setError(null);
    setFounderIndex(
      (index) => (index + delta + founders.length) % founders.length,
    );
  };

  const selectNextUnrated = () => {
    const next = findNextUnratedIndex(founders, ratings, founderIndex);
    if (next !== null) {
      setError(null);
      setFounderIndex(next);
    }
  };

  const startPlayback = async (restart = false) => {
    setError(null);
    try {
      if (restart) await controller.restart();
      else await controller.play();
    } catch (reason) {
      controller.stop();
      setError(
        reason instanceof Error ? reason.message : 'Не удалось включить звук.',
      );
    }
  };

  const rate = (score: FounderScore) => {
    const next = repository.save({
      genomeId: founder.id,
      score,
      ratedAt: new Date().toISOString(),
    });
    setRatings(new Map(next));
  };

  const progress = (playback.elapsedMs / playback.totalMs) * 100;

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">rebus-1452 / founder listening room</p>
          <h1>REBUS EVOLUTION</h1>
        </div>
        <div className="rated-counter" aria-label="Прогресс оценивания">
          <strong>{ratings.size}</strong>
          <span>из {founders.length} оценено</span>
        </div>
      </header>

      <section className="player-card" aria-labelledby="founder-title">
        <div className="founder-heading">
          <div>
            <p className="counter">
              Founder {String(founderIndex + 1).padStart(3, '0')} /{' '}
              {founders.length}
            </p>
            <h2 id="founder-title">{founder.id}</h2>
          </div>
          <dl className="metadata">
            <div>
              <dt>Family</dt>
              <dd>{familyName(founder.family)}</dd>
            </div>
            <div>
              <dt>Generation</dt>
              <dd>{founder.lineage.generation}</dd>
            </div>
            <div>
              <dt>Seed</dt>
              <dd title={founder.seed}>{founder.seed}</dd>
            </div>
          </dl>
        </div>

        <div
          className="timeline"
          aria-label="16 тактов: секция A, затем секция B"
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
            {playback.status === 'loading' ? 'Loading…' : 'Play 32s'}
          </button>
          <button type="button" onClick={() => controller.stop()}>
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
            disabled={ratings.size === founders.length}
          >
            Next unrated
          </button>
          <label className="auto-next">
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(event) => setAutoNext(event.target.checked)}
            />
            После прослушивания перейти к следующему неоценённому
          </label>
          <button
            type="button"
            className="export"
            onClick={() => downloadRatings(ratings)}
            disabled={ratings.size === 0}
          >
            Export ratings JSON
          </button>
        </div>
      </section>

      <footer>120 BPM · 4/4 · 16 bars · deterministic Strudel compiler</footer>
    </main>
  );
}
