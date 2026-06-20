/**
 * Inline the internal, non-published `pptx-viewer-shared` package into this
 * Angular library before compilation.
 *
 * ng-packagr externalizes bare-specifier dependencies and cannot reliably
 * compile source from outside the package directory. So we copy
 * `packages/shared/src` into `packages/angular/src/internal/shared-src` (a
 * generated, git-ignored directory) and import it locally. The result is that
 * the shared code ships **inlined** in the FESM and `pptx-viewer-shared` never
 * appears in the published `package.json`; it stays a private workspace
 * package.
 *
 * Runs before `build`, `typecheck`, and `test`. Test files are excluded.
 */
import { cpSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../shared/src');
const dest = resolve(here, '../src/internal/shared-src');

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, {
	recursive: true,
	filter: (path) => !path.endsWith('.test.ts'),
});

console.log(`[inline-shared] copied ${src} -> ${dest}`);
