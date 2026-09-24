/**
 * Locks in the "no runtime `three` import" rule (see the 3D parity
 * programme's foundation docs and `three-view/types.ts`): shared is bundled
 * by tsup with `splitting: false`, so any dynamic import reachable from
 * `src/index.ts` is INLINED into `dist/index.mjs`. A real (non-type-only)
 * `import ... from 'three'` in a `<pptx-three-view>` scene module (reachable
 * through `three-view/scene-registry.ts`) would pull the whole three.js
 * runtime into every binding's main bundle, defeating the point of receiving
 * it lazily as `ctx.three`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Files reachable through the SmartArt `<pptx-three-view>` scene module. */
const SCENE_FILES = ['view-scene.ts', 'flat-mesh-object.ts', 'text-block-texture.ts'] as const;

/**
 * A non-type `from 'three'`/`from "three"` import: any `import` statement
 * naming the `three` module specifier that is NOT `import type ...`.
 */
const RUNTIME_THREE_IMPORT_RE = /^import(?!\s+type\s)[^;]*from\s+['"]three(?:\/[^'"]*)?['"]/mu;

describe('smartArt three-view scene files never import `three` at runtime', () => {
	for (const file of SCENE_FILES) {
		it(`${file} has no non-type-only 'three' import`, () => {
			const path = fileURLToPath(new URL(file, import.meta.url));
			const source = readFileSync(path, 'utf-8');
			expect(source).not.toMatch(RUNTIME_THREE_IMPORT_RE);
		});
	}
});
