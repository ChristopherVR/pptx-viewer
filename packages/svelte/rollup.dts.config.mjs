import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dts } from 'rollup-plugin-dts';

const entries = ['index', 'viewer/index', 'i18n'];
const bundledPackages = ['pptx-viewer-core', 'pptx-viewer-shared'];
const packageDirectory = dirname(fileURLToPath(import.meta.url));
const internalTypes = new Map([
	['pptx-viewer-core', resolve(packageDirectory, '../core/dist/index.d.ts')],
	['pptx-viewer-shared', resolve(packageDirectory, '../shared/dist/index.d.ts')],
	['pptx-viewer-shared/i18n', resolve(packageDirectory, '../shared/dist/i18n/index.d.ts')],
	['pptx-viewer-shared/ai', resolve(packageDirectory, '../shared/dist/ai/index.d.ts')],
]);

const resolveInternalTypes = {
	name: 'resolve-internal-types',
	resolveId(source) {
		return internalTypes.get(source) ?? null;
	},
};

// `unplugin-dts` emits absolute paths for anything that resolves outside this
// package (the bundled `pptx-viewer-core` / `pptx-viewer-shared` declarations),
// so those must be treated as internal and inlined. `isAbsolute` is required
// rather than a `startsWith('/')` test: on Windows the emitted paths look like
// `D:\...\packages\shared\dist\index.d.ts`, which would otherwise be classed as
// external and leak a machine-local path into the published `.d.ts`.
function isExternal(id) {
	if (id.startsWith('.') || isAbsolute(id)) {
		return false;
	}
	return !bundledPackages.some((name) => id === name || id.startsWith(`${name}/`));
}

// `pptx-viewer-core` re-exports a handful of `emf-converter` values that this
// package's public surface does not, so bundling core's declarations pulls in
// an external import whose bindings are then tree-shaken away. Rollup drops the
// import from the emitted `.d.ts` (verified: no `emf-converter` reference
// survives in `dist/`), which makes `UNUSED_EXTERNAL_IMPORT` a purely
// informational note about a declaration bundle. Everything else still warns.
function onwarn(warning, warn) {
	if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
		return;
	}
	warn(warning);
}

export default entries.map((entry) => ({
	input: `dist/${entry}.d.ts`,
	external: isExternal,
	onwarn,
	plugins: [resolveInternalTypes, dts({ includeExternal: bundledPackages })],
	output: {
		file: `.types-bundle/${entry}.d.ts`,
		format: 'es',
	},
}));
