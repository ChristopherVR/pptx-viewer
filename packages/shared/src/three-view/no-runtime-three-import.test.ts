import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * shared is bundled with `splitting: false`, so every module reachable from
 * `src/index.ts` (including lazily imported scene modules) ends up in
 * `dist/index.mjs`. A runtime `import ... from 'three'` anywhere in that graph
 * would make `three` a hard dependency of every binding. Scene code must take
 * `three` from its mount context and import only types.
 */
const RUNTIME_THREE_IMPORT = /^\s*import\s+(?!type\b)[^;]*from\s+['"]three(?:\/[^'"]*)?['"]/mu;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
	});
}

describe('three-view bundling contract', () => {
	it('never imports three at runtime from the view host or the registered scene modules', () => {
		const root = join(__dirname, '..');
		const files = [
			...sourceFiles(__dirname),
			join(root, 'render', 'chart-3d-view-scene.ts'),
			join(root, 'smartart-3d', 'view-scene.ts'),
		];
		const offenders = files.filter((file) => RUNTIME_THREE_IMPORT.test(readFileSync(file, 'utf8')));
		expect(offenders).toStrictEqual([]);
	});
});
