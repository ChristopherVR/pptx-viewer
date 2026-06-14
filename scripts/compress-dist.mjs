#!/usr/bin/env node
// Emit pre-compressed .gz (gzip) and .br (brotli) copies of the build output so
// the published packages can be served directly from a CDN / static host without
// on-the-fly compression. Dependency-free — uses Node's built-in zlib.
//
// Usage: node scripts/compress-dist.mjs <dir> [<dir> ...]
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const COMPRESSIBLE = ['.js', '.mjs', '.cjs', '.css'];

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
	console.error('usage: node scripts/compress-dist.mjs <dir> [<dir> ...]');
	process.exit(1);
}

let count = 0;
let rawTotal = 0;
let gzTotal = 0;
let brTotal = 0;

function walk(dir) {
	for (const name of readdirSync(dir)) {
		// Don't recompress what we already produced.
		if (name.endsWith('.gz') || name.endsWith('.br')) {
			continue;
		}
		const full = join(dir, name);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walk(full);
		} else if (COMPRESSIBLE.some((ext) => name.endsWith(ext))) {
			compress(full);
		}
	}
}

function compress(file) {
	const buf = readFileSync(file);
	const gz = gzipSync(buf, { level: 9 });
	const br = brotliCompressSync(buf, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 11,
			[constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
		},
	});
	writeFileSync(`${file}.gz`, gz);
	writeFileSync(`${file}.br`, br);
	count += 1;
	rawTotal += buf.length;
	gzTotal += gz.length;
	brTotal += br.length;
}

for (const dir of dirs) {
	walk(dir);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
	`compressed ${count} file(s): raw ${kb(rawTotal)} → gzip ${kb(gzTotal)} / brotli ${kb(brTotal)}`,
);
