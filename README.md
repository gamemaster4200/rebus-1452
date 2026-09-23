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
```

The listening room presents every canonical founder as a 32-second preview. Use
the transport to compare organisms, rate them from -2 to +2, jump to the next
unrated founder, and export the local rating set as JSON. The browser asks for a
user gesture before WebAudio can start; press **Play 32s** to initialize it.

See [Architecture](docs/ARCHITECTURE.md), [Genome](docs/GENOME.md),
[Renderer](docs/RENDERER.md), and [Roadmap](docs/ROADMAP.md).
