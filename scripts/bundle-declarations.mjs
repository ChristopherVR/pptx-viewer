import { join, resolve } from 'node:path';

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
	if (id.startsWith('.') || id.startsWith('/')) {
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

for (const entry of entries) {
	const bundle = await rollup({
		input: join('dist', `${entry}.d.ts`),
		external: isExternal,
		plugins: [resolveInternalTypes, dts({ includeExternal: bundledPackages })],
	});
	await bundle.write({ file: join('.types-bundle', `${entry}.d.ts`), format: 'es' });
	await bundle.close();
}
