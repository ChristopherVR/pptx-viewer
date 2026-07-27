/**
 * Resolve `workspace:*` ranges in the built `dist/package.json` to concrete
 * versions, after ng-packagr has generated it.
 *
 * An ng-packagr library is published from `dist/`, which is NOT a workspace
 * member, so nothing downstream can resolve `workspace:*` there. Doing it here
 * means `bun pm pack` from `dist/` (and any local tarball smoke test) already
 * sees real ranges, rather than only the release pipeline.
 *
 * The rewrite itself lives in `scripts/publish-manifest.mjs` at the repo root:
 * `npm publish` ships a manifest verbatim, so EVERY publish path has to run the
 * same resolution or the package becomes uninstallable (issue #129). One
 * implementation, used by both this build step and the release workflow.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writePublishManifest } from '../../../scripts/publish-manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const distPkgPath = resolve(here, '../dist/package.json');

const resolved = writePublishManifest(distPkgPath);
console.log(`[finalize-dist] resolved workspace ranges in dist/package.json (${resolved.name})`);
