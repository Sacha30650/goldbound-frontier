import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const files = ['index.html', 'styles.css', 'game.js', 'manifest.webmanifest', 'sw.js'];
const runtimeAssets = [
  'frontier-hero.webp', 'village.webp', 'river.webp', 'vault.webp',
  'icon-192.png', 'icon-512.png'
];

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'assets'), { recursive: true });
for (const file of files) await cp(resolve(root, file), resolve(dist, file));
for (const file of runtimeAssets) {
  await cp(resolve(root, 'assets', file), resolve(dist, 'assets', file));
}
console.log(`Goldbound mobile web bundle built in ${dist}`);
