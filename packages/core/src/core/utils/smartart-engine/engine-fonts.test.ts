/**
 * Font sizing in the per-point engine, pinned against the COM-authored
 * gallery corpus's cached drawings (`__tests__/fixtures/smartart-gallery`):
 * each expectation is the size PowerPoint itself wrote into the cached
 * `dsp:drawing`, not a hand-picked value.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { SmartArtPptxElement } from '../../types/elements';
import { FONT_ADVANCE_TABLES } from '../font-advance-widths.generated';
import { applyConstraint } from './constraint-eval';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';
import { runEngineLayout } from './engine-to-result';
import { resolveEngineFonts } from './font-groups';
import type { LdConstraint } from './layout-def-types';
import { presetAdjustments } from './shape-adjust';
import { nodeFontBounds } from './text-fit';
import { paragraphsFit, textMetricsFor } from './text-measure';

const GALLERY_DIR = path.resolve(__dirname, '../../../__tests__/fixtures/smartart-gallery');
const PX_PER_PT = 96 / 72;

async function engineFontsPt(file: string): Promise<Map<string, number>> {
	const buf = readFileSync(path.join(GALLERY_DIR, file));
	const handler = new PptxHandler();
	const { slides } = await handler.load(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
	);
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	const data = element?.smartArtData;
	if (!element || !data) {
		throw new Error(`${file} has no SmartArt`);
	}
	const result = runEngineLayout(
		data,
		{ width: element.width, height: element.height },
		data.nodes ?? [],
		['#4472C4'],
		data.style ?? 'flat',
	);
	const out = new Map<string, number>();
	for (const node of result?.nodes ?? []) {
		const text = (node as { text?: string }).text;
		if (text) {
			out.set(text, Math.round(((node as { fontSize: number }).fontSize / PX_PER_PT) * 100) / 100);
		}
	}
	return out;
}

function bareNode(name: string): EngineNode {
	return {
		name,
		point: { id: `p-${name}`, type: 'node', children: [] } satisfies DataPoint,
		alg: { type: 'tx', params: {} },
		presOf: [],
		hasPresOf: false,
		constraints: [],
		rules: [],
		vars: {},
		children: [],
		order: 0,
		values: new Map(),
		minValues: new Map(),
		maxValues: new Map(),
		deferred: [],
		groups: [],
		rotation: 0,
		box: { x: 0, y: 0, w: 100, h: 40 },
	};
}

function constraint(overrides: Partial<LdConstraint>): LdConstraint {
	return {
		type: 'w',
		for: 'self',
		ptType: 'all',
		refType: 'none',
		refFor: 'self',
		refPtType: 'all',
		op: 'none',
		val: 0,
		hasVal: false,
		fact: 1,
		...overrides,
	};
}

describe('engine text-frame margins are points', () => {
	it('reads a literal margin as points, not millimetres', () => {
		const n = bareNode('tx');
		applyConstraint(n, constraint({ type: 'rMarg', val: 20, hasVal: true }));
		expect(n.values.get('rMarg')).toBe(20);
	});

	it('reads a length-referenced margin as that length in millimetres', () => {
		const n = bareNode('tx');
		n.values.set('h', 128.1);
		applyConstraint(n, constraint({ type: 'tMarg', refType: 'h', fact: 0.28 }));
		// "Vertical Action List": a 128.1pt (45.19mm) box gets a 12.66pt tIns.
		expect(n.values.get('tMarg')).toBeCloseTo(12.65, 1);
	});
});

describe('resolveEngineFonts equalisation', () => {
	const metrics = textMetricsFor(FONT_ADVANCE_TABLES.Aptos);

	it('shrinks every member of an op="equ" group to the worst fit', () => {
		const parent = bareNode('parent');
		const a = bareNode('a');
		const b = bareNode('b');
		for (const n of [a, b]) {
			n.parent = parent;
			n.values.set('primFontSz', 40);
			n.rules = [{ type: 'primFontSz', for: 'self', ptType: 'all', val: 5, fact: NaN, max: NaN }];
		}
		parent.children = [a, b];
		parent.groups = [{ type: 'primFontSz', members: [a, b] }];
		const sizes = resolveEngineFonts(
			[
				{ node: a, text: { own: 'Hi', descendants: [] } },
				{ node: b, text: { own: 'A much longer label that has to wrap', descendants: [] } },
			],
			metrics,
		);
		expect(sizes.get(a)).toBe(sizes.get(b));
		expect(sizes.get(a)).toBeLessThan(40);
	});

	it('does not shrink text that has no primFontSz rule', () => {
		const n = bareNode('fixed');
		n.values.set('primFontSz', 40);
		const sizes = resolveEngineFonts(
			[{ node: n, text: { own: 'A much longer label that has to wrap', descendants: [] } }],
			metrics,
		);
		expect(sizes.get(n)).toBe(40);
	});
});

describe('same layout node, same size', () => {
	const metrics = textMetricsFor(FONT_ADVANCE_TABLES.Aptos);

	it('equalises nodes sharing a layout-node name with no op="equ" declared', () => {
		const a = bareNode('rootText');
		const b = bareNode('rootText');
		for (const n of [a, b]) {
			n.values.set('primFontSz', 40);
			n.rules = [{ type: 'primFontSz', for: 'self', ptType: 'all', val: 5, fact: NaN, max: NaN }];
		}
		const sizes = resolveEngineFonts(
			[
				{ node: a, text: { own: 'Hi', descendants: [] } },
				{ node: b, text: { own: 'A much longer label that has to wrap', descendants: [] } },
			],
			metrics,
		);
		expect(sizes.get(a)).toBe(sizes.get(b));
	});
});

describe('secFontSz-driven text', () => {
	it('follows secFontSz and its rules when primFontSz is declared as secFontSz', () => {
		const n = bareNode('acctTx');
		n.values.set('secFontSz', 65);
		n.deferred = [
			{ source: {}, type: 'primFontSz', op: 'none', ref: n, refType: 'secFontSz', fact: 1 },
		];
		n.rules = [{ type: 'secFontSz', for: 'self', ptType: 'all', val: 5, fact: NaN, max: NaN }];
		expect(nodeFontBounds(n)).toStrictEqual({ start: 65, floor: 5 });
	});
});

describe('presetAdjustments', () => {
	it('reads a length handle as a fraction and an angle handle as degrees', () => {
		expect(presetAdjustments('roundRect', { 1: 0.1 })).toStrictEqual({ adj: 10000 });
		expect(presetAdjustments('blockArc', { 1: 90, 3: 0.25 })).toStrictEqual({
			adj1: 5400000,
			adj3: 25000,
		});
	});
});

describe('paragraphsFit line pitch', () => {
	const metrics = textMetricsFor(FONT_ADVANCE_TABLES.Aptos);

	it('uses the 0.9 x 1.2207em SmartArt pitch, so four 36pt lines overflow 162.3pt', () => {
		// "Basic Block List" flat3 (cached 36pt): at 37pt the four-line label
		// needs 4 x 37 x 1.0986 = 162.6pt against 184.5 - 2 x 11.1 = 162.3pt.
		const text = { own: 'Beta has a noticeably longer label than the others', descendants: [] };
		expect(paragraphsFit(text, 36, 307.5 - 21.6, 184.5 - 21.6, metrics)).toBeTruthy();
		expect(paragraphsFit(text, 37, 307.5 - 22.2, 184.5 - 22.2, metrics)).toBeFalsy();
	});
});

describe('engine font sizes match the cached drawings', () => {
	it('vertical Action List: parentText 28pt, descendantText keeps 24pt', async () => {
		const fonts = await engineFontsPt('vertical-action-list--hier5.pptx');
		expect(fonts.get('Node One')).toBe(28);
		expect(fonts.get('Node Two has a longer label')).toBe(24);
	});

	it('basic Pie: moveWith carriers size the wedge text, equalised across wedges', async () => {
		const fonts = await engineFontsPt('basic-pie--hier5.pptx');
		const sizes = new Set(fonts.values());
		expect(sizes.size).toBe(1);
	});
});
