import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkDist, inspectYjsManifest, inspectYjsRuntime } from './check-published-yjs.mjs';

test('recognizes external ESM, dynamic imports and CommonJS', () => {
	for (const source of [
		"import { Map } from 'yjs';",
		"const Y = await import('yjs');",
		'const Y=require("yjs");',
		'import{Map}from"yjs";',
	]) {
		assert.deepEqual(inspectYjsRuntime(source), { external: true, bundled: false });
	}
});

test('accepts only an optional application-owned Yjs peer', () => {
	const valid = {
		peerDependencies: { yjs: '^13.6.32' },
		peerDependenciesMeta: { yjs: { optional: true } },
	};
	assert.deepEqual(inspectYjsManifest(valid), []);
	for (const invalid of [
		{},
		{ ...valid, peerDependencies: { yjs: '' } },
		{ ...valid, peerDependenciesMeta: {} },
		{ ...valid, dependencies: { yjs: '^13.6.32' } },
		{ ...valid, optionalDependencies: { yjs: '^13.6.32' } },
	]) {
		assert.notEqual(inspectYjsManifest(invalid).length, 0);
	}
	assert.deepEqual(inspectYjsManifest({ ...valid, devDependencies: { yjs: '^13.6.32' } }), []);
});

for (const binding of ['react', 'vue', 'angular', 'vanilla', 'svelte']) {
	test(`${binding} declares the external runtime as an optional peer`, () => {
		const manifest = JSON.parse(
			readFileSync(new URL(`../packages/${binding}/package.json`, import.meta.url), 'utf8'),
		);
		assert.deepEqual(inspectYjsManifest(manifest), []);
	});
}

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
