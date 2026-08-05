import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guard against issue #143's defect class reappearing in this binding.
 *
 * `pptx-svelte-viewer` and `pptx-viewer` (React) each shipped a STATIC named
 * import from an optional peer AI SDK package (`@ai-sdk/svelte`, `@ai-sdk/react`).
 * A consumer who has not installed that peer gets an empty stub module from
 * their bundler's optional-peer-dependency handling, and a static named import
 * asks Rollup to validate the binding at link time, failing the CONSUMER's own
 * production build outright, even though the AI panel is only reached once the
 * user opens it.
 *
 * Unlike React/Vue/Svelte, this binding has no `@ai-sdk/vanilla` package to
 * misuse: it reuses `pptx-viewer-shared/ai`'s already-safe dynamic loader
 * (`loader.ts`, a genuine `await import('ai')`) instead of a framework SDK.
 * `ai` itself is still an optional peer here, so the same class of bug would
 * reappear if a future change statically imports a VALUE from `ai` directly in
 * this package rather than going through the shared loader (or uses only
 * `import type`, which is always safe: type-only imports are erased and never
 * emit a runtime import statement). This test scans the whole `viewer/ai`
 * directory for that regression.
 */
function walk(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			files.push(...walk(full));
		} else if (extname(full) === '.ts') {
			files.push(full);
		}
	}
	return files;
}

describe('no static value import of the optional ai peer in packages/vanilla/src/viewer/ai', () => {
	it('every import of "ai" or "@ai-sdk/*" is type-only', () => {
		const offenders: string[] = [];
		for (const file of walk(import.meta.dirname)) {
			const source = readFileSync(file, 'utf-8');
			for (const match of source.matchAll(
				/^import\s+(?!type\s).*from\s+['"](ai|@ai-sdk\/[^'"]+)['"]/gmu,
			)) {
				offenders.push(`${file}: ${match[0]}`);
			}
		}
		expect(offenders).toStrictEqual([]);
	});
});
