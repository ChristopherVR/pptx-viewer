/**
 * Exercise the actual packed viewer files from an isolated consumer directory.
 * No framework or private workspace is installed there: a locale import must
 * load just its dictionary, in both Node module modes and TypeScript resolvers.
 * Run after building locales and the selected bindings:
 *   node scripts/check-locale-subpaths.mjs [react vue angular vanilla svelte]
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { rollup } from 'rollup';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bindings = process.argv.slice(2);
if (!bindings.length) {
	bindings.push('react', 'vue', 'angular', 'vanilla', 'svelte');
}
const locales = {
	fr: 'translationsFr',
	es: 'translationsEs',
	de: 'translationsDe',
	'zh-CN': 'translationsZhCN',
};
const temporary = mkdtempSync(join(tmpdir(), 'pptx-locale-consumer-'));
const cases = [];
const typeImports = [];

try {
	for (const binding of bindings) {
		assert.ok(['react', 'vue', 'angular', 'vanilla', 'svelte'].includes(binding));
		const packageDir = join(root, 'packages', binding);
		const packDir = binding === 'angular' ? join(packageDir, 'dist') : packageDir;
		const [packed] = JSON.parse(
			execFileSync(
				'npm',
				[
					'pack',
					'--offline',
					'--ignore-scripts',
					'--json',
					'--workspaces=false',
					'--pack-destination',
					temporary,
				],
				{ cwd: packDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
			),
		);
		const installed = join(temporary, 'node_modules', packed.name);
		mkdirSync(installed, { recursive: true });
		execFileSync('tar', [
			'-xzf',
			join(temporary, packed.filename),
			'-C',
			installed,
			'--strip-components=1',
		]);
		const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
		for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
			assert.ok(
				!manifest[field]?.['pptx-viewer-locales'],
				`${packed.name} must bundle its locales`,
			);
		}

		for (const [locale, symbol] of Object.entries(locales)) {
			const subpath = `./i18n/${locale}`;
			const entry = manifest.exports?.[subpath];
			assert.ok(entry, `${packed.name} is missing the public ${subpath} export`);
			const reference = await import(
				pathToFileURL(join(root, 'packages/locales/dist', locale, 'index.js'))
			);
			const specifier = `${packed.name}/i18n/${locale}`;
			cases.push({ specifier, symbol, dictionary: reference[symbol] });
			const alias = `dictionary${cases.length}`;
			typeImports.push(
				`import { ${symbol} as ${alias} } from '${specifier}';`,
				`const value${cases.length}: string = ${alias}['pptx.common.ok'];`,
				'// @ts-expect-error Translation values must remain strings, not any.',
				`const invalid${cases.length}: number = ${alias}['pptx.common.ok'];`,
			);
			// A bundler must not pull in the viewer, another language, or the private
			// workspace when an application opts into this one dictionary.
			const bundle = await rollup({ input: resolve(installed, entry.import.default) });
			try {
				const { output } = await bundle.generate({ format: 'esm' });
				assert.equal(output.length, 1);
				assert.deepEqual(output[0].exports, [symbol]);
				assert.equal(Object.keys(output[0].modules).length, 1);
				assert.deepEqual(output[0].imports, []);
			} finally {
				await bundle.close();
			}
		}
	}

	const consumer = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const { specifier, symbol, dictionary } of JSON.parse(readFileSync(0, 'utf8'))) {
  const esm = await import(specifier);
  const cjs = require(specifier);
  assert.deepEqual(Object.keys(esm), [symbol]);
  assert.deepEqual(Object.keys(cjs), [symbol]);
  assert.deepEqual(esm[symbol], dictionary);
  assert.deepEqual(cjs[symbol], dictionary);
  assert.ok(Object.keys(dictionary).length > 0);
  console.log(specifier + ': ESM and CommonJS match the reference dictionary');
}
`;
	const consumerFile = join(temporary, 'consumer.mjs');
	writeFileSync(consumerFile, consumer);
	process.stdout.write(
		execFileSync(process.execPath, [consumerFile], {
			cwd: temporary,
			input: JSON.stringify(cases),
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024,
		}),
	);
	for (const extension of ['mts', 'cts']) {
		writeFileSync(join(temporary, `consumer.${extension}`), typeImports.join('\n'));
	}
	for (const resolution of ['NodeNext', 'Bundler']) {
		execFileSync(
			process.execPath,
			[
				join(root, 'node_modules/typescript/lib/tsc.js'),
				'--noEmit',
				'--strict',
				'--target',
				'ES2022',
				'--module',
				resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
				'--moduleResolution',
				resolution,
				'--typeRoots',
				join(temporary, 'empty-types'),
				'consumer.mts',
				'consumer.cts',
			],
			{ cwd: temporary, stdio: 'pipe' },
		);
	}
	console.log(
		`Validated ${cases.length} packed locale subpaths, including NodeNext and Bundler declarations.`,
	);
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
