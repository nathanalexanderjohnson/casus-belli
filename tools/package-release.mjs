/**
 * Stage a FoundryVTT release of the system.
 *
 *   dist/casus-belli/   the system folder exactly as Foundry installs it (zip its contents)
 *   dist/system.json    the release manifest (also uploaded on its own)
 *
 * Run after `npm run build` and `npm run build:packs`. The staged system.json points its
 * `manifest` at the latest release and its `download` at this version's zip, so Foundry can
 * install and update the system from GitHub releases.
 *
 * Usage: node tools/package-release.mjs [owner/repo]
 *   owner/repo defaults to $GITHUB_REPOSITORY (set in GitHub Actions), then to system.json "url".
 * When $GITHUB_OUTPUT is set, writes `version=` and `zip=` for later workflow steps.
 */
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'system.json'), 'utf8'));
const { id, version } = manifest;

/** What Foundry needs at runtime. Sources (SCSS, pack JSON), tooling and dev files stay out. */
const INCLUDE = [
  'template.json',
  'module',
  'templates',
  'css',
  'lang',
  'assets',
  'lib',
  'packs',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'LICENSE.txt',
];
/** Excluded inside included folders: pack sources, git metadata, LevelDB lock files. */
const EXCLUDE = [/^packs[\\/]src([\\/]|$)/, /\.gitattributes$/, /(^|[\\/])LOCK$/, /\.map$/];

function fail(message) {
  console.error(`package-release: ${message}`);
  process.exit(1);
}

// ── Repository (for the manifest and download URLs) ─────────────────────────
let repo = process.argv[2] || process.env.GITHUB_REPOSITORY;
if (!repo) {
  const match = /github\.com\/([^/]+\/[^/]+?)\/?$/.exec(manifest.url ?? '');
  repo = match?.[1];
}
if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) fail(`could not determine owner/repo (got "${repo}")`);
if (!id || !version) fail('system.json needs "id" and "version"');

// ── Check the build ran ─────────────────────────────────────────────────────
const missing = [];
for (const path of [...(manifest.esmodules ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map((l) => l.path)]) {
  if (!existsSync(join(root, path))) missing.push(path);
}
for (const pack of manifest.packs ?? []) {
  // A built LevelDB pack always has a CURRENT file.
  if (!existsSync(join(root, pack.path, 'CURRENT'))) missing.push(`${pack.path} (run npm run build:packs)`);
}
if (missing.length) fail(`missing build output:\n  ${missing.join('\n  ')}`);

// ── Stage ───────────────────────────────────────────────────────────────────
const dist = join(root, 'dist');
const stage = join(dist, id);
rmSync(dist, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const entry of INCLUDE) {
  const from = join(root, entry);
  if (!existsSync(from)) continue;
  cpSync(from, join(stage, entry), {
    recursive: true,
    filter: (src) => {
      const rel = relative(root, src).split(sep).join('/');
      return !EXCLUDE.some((pattern) => pattern.test(rel));
    },
  });
}

const base = `https://github.com/${repo}`;
const release = {
  ...manifest,
  url: manifest.url || base,
  manifest: `${base}/releases/latest/download/system.json`,
  download: `${base}/releases/download/${version}/${id}.zip`,
};
const json = JSON.stringify(release, null, 2) + '\n';
writeFileSync(join(stage, 'system.json'), json);
writeFileSync(join(dist, 'system.json'), json);

console.log(`Staged ${id} ${version} in ${relative(root, stage)}`);
console.log(`  manifest: ${release.manifest}`);
console.log(`  download: ${release.download}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nzip=${id}.zip\n`);
}
