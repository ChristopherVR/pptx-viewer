/**
 * Text-driven sizing (`font-search.ts`, `text-grow.ts`, `layout-font.ts`):
 * layouts whose boxes are sized from their own text's font size, pinned
 * against the COM-authored gallery corpus's cached drawings. Every expected
 * value is what PowerPoint itself wrote into the fixture's `dsp:drawing`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { SmartArtPptxElement } from '../../types/elements';
import { decomposeSmartArt } from '../smartart-decompose';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';
import { runEngineLayout } from './engine-to-result';
import { layoutFontOf } from './layout-font';
import { canGrow } from './text-grow';

const GALLERY_DIR = path.resolve(__dirname, '../../../__tests__/fixtures/smartart-gallery');
const PX_PER_PT = 96 / 72;

interface Placed {
	x: number;
	y: number;
	w: number;
	h: number;
	font: number;
}

/** Cached and engine shapes (points, frame-relative) keyed by text. */
async function compare(file: string): Promise<{
	cached: Map<string, Placed>;
	engine: Map<string, Placed>;
	frame: { w: number; h: number };
}> {
	const buf = readFileSync(path.join(GALLERY_DIR, file));
	const { slides } = await new PptxHandler().load(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
	);
	const element = slides
		.flatMap((s) => s.elements)
		.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
	const data = element?.smartArtData;
	if (!element || !data) {
		throw new Error(`${file} has no SmartArt`);
	}
	const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
	const cached = new Map<string, Placed>();
	for (const el of decomposeSmartArt(data, bounds) ?? []) {
		const text = el.type === 'shape' ? (el.text ?? '').trim() : '';
		if (el.type === 'shape' && text) {
			cached.set(text, {
				x: (el.x - bounds.x) / PX_PER_PT,
				y: (el.y - bounds.y) / PX_PER_PT,
				w: el.width / PX_PER_PT,
				h: el.height / PX_PER_PT,
				font: (el.textStyle?.fontSize ?? 0) / PX_PER_PT,
			});
		}
	}
	const result = runEngineLayout(data, bounds, data.nodes ?? [], ['#4472C4'], data.style ?? 'flat');
	const engine = new Map<string, Placed>();
	for (const node of result?.nodes ?? []) {
		if (node.kind !== 'rect' || !node.text.trim()) {
			continue;
		}
		engine.set(node.text.trim(), {
			x: node.x / PX_PER_PT,
			y: node.y / PX_PER_PT,
			w: node.width / PX_PER_PT,
			h: node.height / PX_PER_PT,
			font: node.fontSize / PX_PER_PT,
		});
	}
	return { cached, engine, frame: { w: bounds.width / PX_PER_PT, h: bounds.height / PX_PER_PT } };
}

async function expectMatchesCache(file: string, texts: string[]): Promise<void> {
	const { cached, engine, frame } = await compare(file);
	for (const text of texts) {
		const want = cached.get(text);
		const got = engine.get(text);
		expect(want, `${file}: cached "${text}"`).toBeDefined();
		expect(got, `${file}: engine "${text}"`).toBeDefined();
		if (!want || !got) {
			continue;
		}
		expect(Math.abs(got.x - want.x) / frame.w).toBeLessThan(0.01);
		expect(Math.abs(got.y - want.y) / frame.h).toBeLessThan(0.01);
		expect(Math.abs(got.w - want.w) / frame.w).toBeLessThan(0.01);
		expect(Math.abs(got.h - want.h) / frame.h).toBeLessThan(0.01);
		expect(got.font).toBeCloseTo(want.font, 0);
	}
}

describe('text-driven SmartArt sizing', () => {
	it('grows Vertical Bullet List parents to their text and picks the 46pt that fits', async () => {
		await expectMatchesCache('vertical-bullet-list--hier5.pptx', [
			'Node One',
			'Node Two has a longer label',
			'Node Three',
			'Node Four',
			'Node Five',
		]);
	});

	it('grows a wrapped Vertical Bullet List label to two lines at 40pt', async () => {
		await expectMatchesCache('vertical-bullet-list--flat3.pptx', ['Alpha', 'Gamma']);
	});

	it('overlaps Vertical Box List children by half the parent box and grows them under a 1.64em top margin', async () => {
		await expectMatchesCache('vertical-box-list--hier5.pptx', [
			'Node One',
			'Node Two has a longer label',
			'Node Three',
			'Node Five',
		]);
	});

	it('stops Horizontal Bullet List at the size its widest word fits in the capped header', async () => {
		await expectMatchesCache('horizontal-bullet-list--hier5.pptx', [
			'Node One',
			'Node Two has a longer label',
			'Node Three',
			'Node Five',
		]);
	});

	it('fills Basic Chevron Process rows exactly despite the fixed -6mm overlaps', async () => {
		await expectMatchesCache('basic-chevron-process--hier5.pptx', [
			'Node One',
			'Node Two has a longer label',
			'Node Three',
			'Node Four',
		]);
		await expectMatchesCache('basic-chevron-process--flat3.pptx', ['Alpha', 'Gamma']);
	});

	it('draws Sub-Step Process sub-steps as their own boxes', async () => {
		const { engine } = await compare('sub-step-process--hier5.pptx');
		expect(engine.has('Node Two has a longer label')).toBeTruthy();
		expect(engine.has('Node Five')).toBeTruthy();
		expect(engine.has('Node One')).toBeTruthy();
	});
});

function bareNode(name: string, parent?: EngineNode): EngineNode {
	const node: EngineNode = {
		name,
		point: { id: `p-${name}`, type: 'node', children: [] } satisfies DataPoint,
		alg: { type: 'tx', params: {} },
		presOf: [],
		hasPresOf: false,
		presOfAnchored: false,
		constraints: [],
		rules: [],
		vars: {},
		children: [],
		parent,
		order: 0,
		values: new Map(),
		minValues: new Map(),
		maxValues: new Map(),
		deferred: [],
		groups: [],
		rotation: 0,
	};
	parent?.children.push(node);
	return node;
}

describe('layout-time font links', () => {
	it('follows a primFontSz link to the node the search fixed', () => {
		const root = bareNode('linear');
		const parent = bareNode('parentText', root);
		const child = bareNode('childText', root);
		child.deferred.push({
			source: {},
			type: 'primFontSz',
			op: 'equ',
			ref: parent,
			refType: 'primFontSz',
			fact: 1,
		});
		expect(layoutFontOf(child)).toBeUndefined();
		parent.forcedFontPt = 46;
		expect(layoutFontOf(child)).toBe(46);
	});

	it("reads a primary-sized node's secFontSz as 0.78 of its size", () => {
		const root = bareNode('root');
		const header = bareNode('parTx', root);
		const body = bareNode('desTx', root);
		body.deferred.push({
			source: {},
			type: 'primFontSz',
			op: 'none',
			ref: body,
			refType: 'secFontSz',
			fact: 1,
		});
		body.deferred.push({
			source: {},
			type: 'secFontSz',
			op: 'equ',
			ref: header,
			refType: 'secFontSz',
			fact: 1,
		});
		header.forcedFontPt = 32;
		expect(layoutFontOf(body)).toBe(25);
	});

	it('grows only where a rule lets the height run to INF', () => {
		const root = bareNode('root');
		const grows = bareNode('parentText', root);
		const fixed = bareNode('spacer', root);
		grows.rules.push({
			type: 'h',
			for: 'self',
			ptType: 'all',
			val: Number.POSITIVE_INFINITY,
			fact: NaN,
			max: NaN,
		});
		root.rules.push({
			type: 'h',
			for: 'ch',
			forName: 'other',
			ptType: 'all',
			val: Number.POSITIVE_INFINITY,
			fact: NaN,
			max: NaN,
		});
		expect(canGrow(grows, 'h')).toBeTruthy();
		expect(canGrow(fixed, 'h')).toBeFalsy();
	});
});
