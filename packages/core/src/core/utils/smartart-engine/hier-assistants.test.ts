/**
 * Org-chart assistants and per-node `hierBranch` in the per-point engine,
 * pinned against COM-authored decks' cached drawings
 * (`__tests__/fixtures/corpus`): every expected box is the one PowerPoint
 * itself wrote into the deck's `dsp:drawing`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../types/elements';
import { decomposeSmartArt } from '../smartart-decompose';
import { runEngineLayout } from './engine-to-result';
import { placeTwoColumns } from './hier-assistants';
import type { HierShape } from './hier-shape';

const CORPUS_DIR = path.resolve(__dirname, '../../../__tests__/fixtures/corpus');

interface Deviation {
	matched: number;
	cached: number;
	worst: number;
	fontsMatched: number;
}

function keyed(elements: readonly PptxElement[]): Map<string, PptxElement & { type: 'shape' }> {
	const map = new Map<string, PptxElement & { type: 'shape' }>();
	for (const el of elements) {
		const text = el.type === 'shape' ? (el.text ?? '').trim() : '';
		if (el.type === 'shape' && text && !map.has(text)) {
			map.set(text, el);
		}
	}
	return map;
}

/** Engine vs cached drawing for every SmartArt of a corpus deck. */
async function deviations(file: string): Promise<Deviation[]> {
	const buf = readFileSync(path.join(CORPUS_DIR, file));
	const { slides } = await new PptxHandler().load(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
	);
	const out: Deviation[] = [];
	for (const element of slides.flatMap((s) => s.elements)) {
		if (element.type !== 'smartArt') {
			continue;
		}
		const data = (element as SmartArtPptxElement).smartArtData;
		if (!data) {
			continue;
		}
		const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
		const cached = keyed(decomposeSmartArt(data, bounds) ?? []);
		const result = runEngineLayout(
			data,
			bounds,
			data.nodes ?? [],
			['#4472C4'],
			data.style ?? 'flat',
		);
		const engine = new Map(
			(result?.nodes ?? [])
				.filter((n) => n.kind === 'rect' && n.text.trim())
				.map((n) => [n.text.trim(), n]),
		);
		let matched = 0;
		let worst = 0;
		let fontsMatched = 0;
		for (const [text, c] of cached) {
			const e = engine.get(text);
			if (!e || e.kind !== 'rect') {
				continue;
			}
			matched++;
			worst = Math.max(
				worst,
				Math.abs(bounds.x + e.x - c.x) / bounds.width,
				Math.abs(bounds.y + e.y - c.y) / bounds.height,
				Math.abs(e.width - c.width) / bounds.width,
				Math.abs(e.height - c.height) / bounds.height,
			);
			if (Math.abs(e.fontSize - (c.textStyle?.fontSize ?? 0)) < 0.5 * (96 / 72)) {
				fontsMatched++;
			}
		}
		out.push({ matched, cached: cached.size, worst, fontsMatched });
	}
	return out;
}

describe('org-chart assistants in the per-point engine', () => {
	it('places 1, 3 and 4 assistants in pairs about the manager, above its reports', async () => {
		const results = await deviations('smartart-orgchart-assistants.pptx');
		expect(results).toHaveLength(3);
		for (const r of results) {
			expect(r.matched).toBe(r.cached);
			expect(r.worst).toBeLessThan(0.01);
			expect(r.fontsMatched).toBe(r.cached);
		}
	});

	it("honours each manager's own hierBranch (Standard, Both, Left and Right Hanging)", async () => {
		const results = await deviations('smartart-orgchart-hierbranch.pptx');
		expect(results).toHaveLength(4);
		for (const r of results) {
			expect(r.matched).toBe(r.cached);
			expect(r.worst).toBeLessThan(0.01);
		}
	});

	it('lays out the fan-variant org charts, each with an assistant, within 1%', async () => {
		for (const r of await deviations('smartart-orgchart-fan-variants.pptx')) {
			expect(r.matched).toBe(r.cached);
			expect(r.worst).toBeLessThan(0.01);
		}
	});
});

function box(w: number, h: number): HierShape {
	const node = {} as HierShape['rects'][number]['node'];
	return { rects: [{ node, x: 0, y: 0, w, h }], head: { x: 0, y: 0, w, h } };
}

describe('placeTwoColumns', () => {
	it('alternates left and right of the line, a lone item on the left', () => {
		const { rects, bottom } = placeTwoColumns([box(10, 5), box(10, 5), box(10, 5)], 50, 0, 4, 2);
		expect(rects.map((r) => [r.x, r.y])).toStrictEqual([
			[38, 0],
			[38, 7],
			[52, 0],
		]);
		expect(bottom).toBe(12);
	});
});
