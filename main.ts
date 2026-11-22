// Vice Heat entry program — written fresh in the recorded session (Node 22 only).
// It hands in the game in game/ plus the real screenshots in screenshots/:
// copy both trees into the output directory and write the dossier the judge
// reads, using the vendored make.fun library (vendor/makefun-game.ts, untouched).
// The game itself is plain static files that a desktop browser opens offline.
// Run locally to test:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve to play:        node serve.ts   then open http://localhost:8080
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots')))
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Caps from the competition gate: 4 screenshots max, 256 KiB each, game/ at most
// 993 entries / 48 MiB, paths under 1000 bytes. buildDossier refuses anything
// over those caps, exactly as the scorer would.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('Vice Heat entry written to', out);
