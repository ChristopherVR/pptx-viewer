import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as ooxmlCore from '@christophervr/ooxml-core/pptx';
import * as ooxmlConverter from '@christophervr/ooxml-core/pptx/converter';
import * as ooxmlSignatureNode from '@christophervr/ooxml-core/pptx/signature-node';
import { describe, expect, it } from 'vitest';

import * as converter from './converter';
import * as core from './index';
import * as signatureNode from './signature-node';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
	dependencies: Record<string, string>;
	exports: Record<string, Record<string, string>>;
	bin: Record<string, string>;
};
const ooxmlManifest = JSON.parse(
	readFileSync(
		resolve(__dirname, '../node_modules/@christophervr/ooxml-core/package.json'),
		'utf8',
	),
) as { exports: Record<string, unknown> };

describe('pptx-viewer-core is a thin entry point over ooxml-core/pptx', () => {
	it.each([
		['.', core, ooxmlCore],
		['./converter', converter, ooxmlConverter],
		['./signature-node', signatureNode, ooxmlSignatureNode],
	])('%s re-exports exactly the ooxml-core area', (_entry, local, area) => {
		const names = Object.keys(area).sort();
		expect(names.length).toBeGreaterThan(0);
		expect(Object.keys(local).sort()).toStrictEqual(names);
		for (const name of names) {
			expect(local[name as keyof typeof local]).toBe(area[name as never]);
		}
	});

	it('keeps the published subpaths, each backed by an ooxml-core pptx subpath', () => {
		expect(Object.keys(manifest.exports)).toStrictEqual([
			'.',
			'./converter',
			'./cli',
			'./signature-node',
		]);
		for (const entry of Object.keys(manifest.exports)) {
			expect(ooxmlManifest.exports).toHaveProperty([
				`./pptx${entry === '.' ? '' : entry.slice(1)}`,
			]);
			expect(Object.keys(manifest.exports[entry]!)).toStrictEqual(['types', 'import', 'require']);
		}
		expect(manifest.bin).toStrictEqual({ pptx: './dist/cli/index.mjs' });
	});

	it('depends on nothing but ooxml-core', () => {
		expect(Object.keys(manifest.dependencies)).toStrictEqual(['@christophervr/ooxml-core']);
	});
});
