/**
 * Rule-shrunk snake grids (`snake-rule-fit.ts`) and lin runs that only a
 * uniform reference shrink or a content-sized nested run fits
 * (`alg-linear.ts`), pinned against the gallery corpus's cached drawings.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { SmartArtPptxElement } from '../../types/elements';
import { decomposeSmartArt } from '../smartart-decompose';
import { runEngineLayout } from './engine-to-result';

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

describe('rule-shrunk snake grids and uniform lin shrink', () => {
	it('bisects Meet the Team cards to 73.44mm in one row of three', async () => {
		await expectMatchesCache('meet-the-team--flat3.pptx', ['Alpha', 'Gamma']);
	});

	it('keeps the fifth probe that fits for four Meet the Team cards', async () => {
		const { cached, engine, frame } = await compare('meet-the-team--hier5.pptx');
		for (const text of ['Node One', 'Node Four', 'Node Five']) {
			const want = cached.get(text);
			const got = engine.get(text);
			expect(want && got).toBeTruthy();
			if (want && got) {
				expect(Math.abs(got.x - want.x) / frame.w).toBeLessThan(0.01);
				expect(Math.abs(got.y - want.y) / frame.h).toBeLessThan(0.01);
				expect(Math.abs(got.w - want.w) / frame.w).toBeLessThan(0.01);
			}
		}
	});

	it('shrinks Process List headers on both axes and hangs the columns from a centred band', async () => {
		await expectMatchesCache('process-list--hier5.pptx', [
			'Node One',
			'Node Two has a longer label',
			'Node Three',
			'Node Four',
			'Node Five',
		]);
	});
});
