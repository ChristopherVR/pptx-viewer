import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkDist, inspectYjsRuntime } from './check-published-yjs.mjs';

test('recognizes external ESM, dynamic imports and CommonJS', () => {
	for (const source of [
		"import { Map } from 'yjs';",
		"const Y = await import('yjs');",
		'const Y=require("yjs");',
	]) {
		assert.deepEqual(inspectYjsRuntime(source), { external: true, bundled: false });
	}
});

test('detects a bundled runtime even when an external import also exists', () => {
	assert.deepEqual(
		inspectYjsRuntime('import("yjs"); console.error("Yjs was already imported.");'),
		{ external: true, bundled: true },
	);
});

test('does not count a relative chunk or a different package as external Yjs', () => {
	for (const source of ["import('./yjs-chunk.js')", "import('yjs-extra')"]) {
		assert.deepEqual(inspectYjsRuntime(source), { external: false, bundled: false });
	}
});

test('inspects emitted JavaScript, not declaration-only imports', () => {
	const directory = mkdtempSync(join(tmpdir(), 'pptx-yjs-package-'));
	try {
		writeFileSync(join(directory, 'index.d.ts'), "import { Doc } from 'yjs';");
		assert.deepEqual(checkDist(directory), { scanned: 0, bundled: [], external: false });
		writeFileSync(join(directory, 'index.mjs'), "export * from './chunk.mjs';");
		writeFileSync(join(directory, 'chunk.mjs'), 'console.error("Yjs was already imported.");');
		assert.deepEqual(checkDist(directory), {
			scanned: 2,
			bundled: ['chunk.mjs'],
			external: false,
		});
		writeFileSync(join(directory, 'chunk.mjs'), "const Y = await import('yjs');");
		assert.deepEqual(checkDist(directory), { scanned: 2, bundled: [], external: true });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
