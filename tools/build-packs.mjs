/**
 * Compile compendium packs from their JSON sources.
 *
 *   packs/src/<pack-name>/*.json  →  packs/<pack-name>/  (LevelDB, read by Foundry)
 *
 * Edit the JSON in packs/src, then run `npm run build:packs` (all packs) or
 * `npm run build:packs -- <pack-name> [...]` (only those). Close Foundry (or at least the world
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

// Build only the packs named on the command line (`npm run build:packs -- miko-rites`), or all.
// Rebuilding a pack rewrites its database files even when the content is the same, so naming
// the packs you changed keeps unrelated packs out of the git diff.
const available = readdirSync(srcRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !available.includes(name));
if (unknown.length) {
  console.error(`Unknown pack(s): ${unknown.join(', ')}. Available: ${available.join(', ')}`);
  process.exit(1);
}
const packs = requested.length ? requested : available;

for (const pack of packs) {
  const src = join(srcRoot, pack);
  const dest = join(root, 'packs', pack);
  rmSync(dest, { recursive: true, force: true });
  await compilePack(src, dest, { log: false });
  console.log(`Built ${pack}`);
}
