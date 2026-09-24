# Rebus Evolution

Rebus Evolution is an experimental system for evolving music: a musical analogue of the idea behind Electric Sheep. Musical organisms carry renderer-independent genomes and develop through selection, crossover, and mutation. A listener provides aesthetic selection; later phases may extend that process into crowd generation.

The first renderer is [Strudel](https://strudel.cc/), running in the browser through WebAudio. The project is currently experimental and non-commercial.

## Development

Requirements: a current Node.js LTS release and npm.

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm run build
npm run lint
npm test
npm run format:check
npm run generate:founders
npm run generate:g1
```

The listening room exposes Generation 0 and Generation 1 as separate 42-item
populations. Each organism is a looping 16-bar, 32-second A/B fragment. Choose a
generation, use the transport to compare organisms, rate them from -2 to +2,
jump to the next unrated organism, and export that generation's local rating
set as JSON. Press **Play loop** to initialize WebAudio and keep the fragment
playing until Stop, Restart, organism navigation, or a generation switch.

`npm run generate:g1` deterministically rebuilds the versioned Generation 1
dataset from the canonical founders, the versioned Generation 0 rating input,
the generation configuration, and the master seed. Generated datasets are not
edited by hand.

See [Architecture](docs/ARCHITECTURE.md), [Genome](docs/GENOME.md),
[Renderer](docs/RENDERER.md), and [Roadmap](docs/ROADMAP.md).
