import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as ooxmlChart from 'ooxml-core/chart';
import * as ooxmlColor from 'ooxml-core/color';
import * as ooxmlGeometry from 'ooxml-core/geometry';
import * as ooxmlMath from 'ooxml-core/math';
import * as ooxmlCore from 'ooxml-core/pptx';
import * as ooxmlConverter from 'ooxml-core/pptx/converter';
import * as ooxmlSignatureNode from 'ooxml-core/pptx/signature-node';
import * as ooxmlText from 'ooxml-core/text';
import { describe, expect, it } from 'vitest';

import * as chart from './chart';
import * as color from './color';
import * as converter from './converter';
import * as geometry from './geometry';
import * as core from './index';
import * as math from './math';
import * as signatureNode from './signature-node';
import * as text from './text';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
	dependencies: Record<string, string>;
	exports: Record<string, Record<string, string>>;
	bin: Record<string, string>;
};
const ooxmlManifest = JSON.parse(
	readFileSync(resolve(__dirname, '../node_modules/ooxml-core/package.json'), 'utf8'),
) as { exports: Record<string, unknown> };

describe('pptx-viewer-core is a thin entry point over ooxml-core', () => {
	it.each([
		['.', core, ooxmlCore],
		['./converter', converter, ooxmlConverter],
		['./signature-node', signatureNode, ooxmlSignatureNode],
		['./math', math, ooxmlMath],
		['./chart', chart, ooxmlChart],
		['./text', text, ooxmlText],
		['./geometry', geometry, ooxmlGeometry],
		['./color', color, ooxmlColor],
	])('%s re-exports exactly the ooxml-core area', (_entry, local, area) => {
		const names = Object.keys(area).sort();
		expect(names.length).toBeGreaterThan(0);
		expect(Object.keys(local).sort()).toStrictEqual(names);
		for (const name of names) {
			expect(local[name as keyof typeof local]).toBe(area[name as never]);
		}
	});

	it('keeps the published subpaths backed by their canonical ooxml-core area', () => {
		expect(Object.keys(manifest.exports)).toStrictEqual([
			'.',
			'./converter',
			'./cli',
			'./signature-node',
			'./math',
			'./chart',
			'./text',
			'./geometry',
			'./color',
		]);
		for (const entry of Object.keys(manifest.exports)) {
			expect(ooxmlManifest.exports).toHaveProperty([
				['./math', './chart', './text', './geometry', './color'].includes(entry)
					? entry
					: `./pptx${entry === '.' ? '' : entry.slice(1)}`,
			]);
			expect(Object.keys(manifest.exports[entry]!)).toStrictEqual(['types', 'import', 'require']);
		}
		expect(manifest.bin).toStrictEqual({ pptx: './dist/cli/index.mjs' });
	});

	it('depends on nothing but ooxml-core', () => {
		expect(Object.keys(manifest.dependencies)).toStrictEqual(['ooxml-core']);
	});
});
