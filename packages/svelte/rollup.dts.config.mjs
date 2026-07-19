import { dirname, resolve } from 'node:path';
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

function isExternal(id) {
	if (id.startsWith('.') || id.startsWith('/')) {
		return false;
	}
	return !bundledPackages.some((name) => id === name || id.startsWith(`${name}/`));
}

export default entries.map((entry) => ({
	input: `dist/${entry}.d.ts`,
	external: isExternal,
	plugins: [resolveInternalTypes, dts({ includeExternal: bundledPackages })],
	output: {
		file: `.types-bundle/${entry}.d.ts`,
		format: 'es',
	},
}));
