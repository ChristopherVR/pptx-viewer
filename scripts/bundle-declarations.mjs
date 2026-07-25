import { isAbsolute, join, resolve } from 'node:path';

import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';

const entries = process.argv.slice(2);
const packageDirectory = process.cwd();
const bundledPackages = ['pptx-viewer-core', 'pptx-viewer-shared'];
const internalTypes = new Map([
	['pptx-viewer-core', resolve(packageDirectory, '../core/dist/index.d.ts')],
	['pptx-viewer-shared', resolve(packageDirectory, '../shared/dist/index.d.ts')],
	['pptx-viewer-shared/i18n', resolve(packageDirectory, '../shared/dist/i18n/index.d.ts')],
]);

function isExternal(id) {
	// `isAbsolute` rather than a leading-slash test: rollup re-runs `external`
	// against RESOLVED ids, which on Windows look like `D:\...\shared\dist\index.d.ts`.
	// Treating those as external emitted the developer's own absolute path as a
	// module specifier into the published `.d.ts`, silently breaking every type
	// re-exported from `pptx-viewer-shared` / `pptx-viewer-core` in local builds.
	if (id.startsWith('.') || isAbsolute(id)) {
		return false;
	}
	return !bundledPackages.some((name) => id === name || id.startsWith(`${name}/`));
}

const resolveInternalTypes = {
	name: 'resolve-internal-types',
	resolveId(source) {
		return internalTypes.get(source) ?? null;
	},
};

/**
 * Flattening `.d.ts` files routinely leaves an `import` whose bindings are only
 * referenced by declarations that got inlined elsewhere (e.g. core re-exporting
 * `emf-converter`'s converters, which this package's surface never names).
 * Rollup drops the statement anyway, so the warning is pure noise here; every
 * other diagnostic still reaches the console.
 */
function onwarn(warning, warn) {
	if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
		return;
	}
	warn(warning);
}

for (const entry of entries) {
	const bundle = await rollup({
		input: join('dist', `${entry}.d.ts`),
		external: isExternal,
		onwarn,
		plugins: [resolveInternalTypes, dts({ includeExternal: bundledPackages })],
	});
	await bundle.write({ file: join('.types-bundle', `${entry}.d.ts`), format: 'es' });
	await bundle.close();
}
