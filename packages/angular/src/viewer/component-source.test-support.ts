/**
 * component-source.test-support.ts: read an Angular component's authored source
 * for the source-text guards in this package.
 *
 * This package has no TestBed (see `vitest.config.ts`), so a handful of specs
 * assert structural invariants by reading component sources as text. Components
 * whose markup outgrew the repo's 300 LOC file rule keep their template in a
 * sibling `.html` (and their CSS in a sibling `.css`), the convention already
 * used by `slides-panel` / `share-dialog` / `account-page`. Those specs care
 * about "what this component is", not "which file the compiler was handed", so
 * this helper stitches the two halves back together and the guards keep working
 * whether a component's template is inline or external.
 *
 * Not a `.test.ts` file on purpose: vitest's `include` is `src/**\/*.test.ts`,
 * and a shared helper is not a suite.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The full authored source of an Angular component: its `.ts`, followed by its
 * external template and stylesheet when it has them.
 *
 * @param dir Directory holding the component (normally `import.meta.dirname`).
 * @param file Component file name, e.g. `element-renderer.component.ts`.
 */
export function componentSource(dir: string, file: string): string {
	const base = path.join(dir, file.replace(/\.ts$/u, ''));
	const parts = [readFileSync(path.join(dir, file), 'utf8')];
	for (const ext of ['.html', '.css']) {
		if (existsSync(base + ext)) {
			parts.push(readFileSync(base + ext, 'utf8'));
		}
	}
	return parts.join('\n');
}
