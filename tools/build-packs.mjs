/**
 * Compile compendium packs from their JSON sources.
 *
 *   packs/src/<pack-name>/*.json  →  packs/<pack-name>/  (LevelDB, read by Foundry)
 *
 * Edit the JSON in packs/src, then run `npm run build:packs`. Close Foundry (or at least the world
 * using this system) first: Foundry locks the LevelDB files while it runs.
 *
 * Each source file is one document and needs a unique 16-character `_id` and a matching
 * `_key` of the form "!items!<_id>".
 */
import { compilePack } from '@foundryvtt/foundryvtt-cli';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'packs', 'src');

if (!existsSync(srcRoot)) {
  console.error(`No pack sources found at ${srcRoot}`);
  process.exit(1);
}

const packs = readdirSync(srcRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const pack of packs) {
  const src = join(srcRoot, pack);
  const dest = join(root, 'packs', pack);
  rmSync(dest, { recursive: true, force: true });
  await compilePack(src, dest, { log: false });
  console.log(`Built ${pack}`);
}
