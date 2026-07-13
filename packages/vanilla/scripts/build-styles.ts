import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(packageRoot, 'dist/styles.css');
const bundle = await import('../dist/index.js');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${bundle.getViewerCss()}\n`, 'utf8');
