/**
 * Ship the standalone locale artifacts inside each viewer package. Run after
 * that binding's build (which may clean dist), with packages/locales built first.
 * The internal locale workspace remains the only source of dictionary values.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(localesDir, 'package.json'), 'utf8'));
const output = resolve('dist/i18n');
mkdirSync(output, { recursive: true });

for (const [subpath, entry] of Object.entries(manifest.exports)) {
	if (subpath === '.') {
		continue;
	}
	const locale = subpath.slice(2);
	copyFileSync(resolve(localesDir, entry.import), resolve(output, `${locale}.mjs`));
	copyFileSync(resolve(localesDir, entry.require), resolve(output, `${locale}.cjs`));
	// The declarations are standalone too. Drop the source-map reference because
	// it names the internal workspace's index.d.ts.map, not a published file here.
	const declarations = readFileSync(resolve(localesDir, entry.types), 'utf8').replace(
		/^\/\/# sourceMappingURL=.*$/gmu,
		'',
	);
	for (const extension of ['d.mts', 'd.cts']) {
		writeFileSync(resolve(output, `${locale}.${extension}`), declarations);
	}
}
