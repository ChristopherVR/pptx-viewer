/**
 * Writes the published entry files of pptx-viewer-core: ESM (`.mjs`), CommonJS (`.js`) and
 * declarations (`.d.ts`) that forward to the matching `ooxml-core/pptx` subpath.
 * The implementation lives in ooxml-core; this package only keeps the public entry points.
 * `src/**` holds the same one-line re-exports as type-checked sources.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const entries = [
	{ dir: '', target: 'ooxml-core/pptx' },
	{ dir: 'converter', target: 'ooxml-core/pptx/converter' },
	// The CLI entry runs the command line on import (as the previous bundle did); keep the shebang.
	{ dir: 'cli', target: 'ooxml-core/pptx/cli', shebang: true },
	{ dir: 'signature-node', target: 'ooxml-core/pptx/signature-node' },
	{ dir: 'math', target: 'ooxml-core/math' },
];

await rm(dist, { recursive: true, force: true });
for (const { dir, target, shebang } of entries) {
	const out = join(dist, dir);
	await mkdir(out, { recursive: true });
	const bang = shebang ? '#!/usr/bin/env node\n' : '';
	await writeFile(join(out, 'index.mjs'), `${bang}export * from '${target}';\n`);
	await writeFile(
		join(out, 'index.js'),
		`${bang}'use strict';\nmodule.exports = require('${target}');\n`,
	);
	await writeFile(join(out, 'index.d.ts'), `export * from '${target}';\n`);
}
