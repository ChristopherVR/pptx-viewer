/**
 * Regression coverage for the `hideGeom` fix in `collectRenderedNodes`/
 * `buildRenderedNode`: ECMA-376 Part 1, 21.4.7.16 `ST_OnOffStyleType`
 * `hideGeom` means the node draws no visible border/fill, not that it is
 * not a node. The engine previously dropped every `hideGeom` node outright,
 * losing item-role-split shapes (a child's own text rendered as a second,
 * borderless box under a sibling's card) that PowerPoint's cached drawing
 * does render - see `vertical-action-list--hier5.pptx` and
 * `descending-block-list--hier5.pptx` in the gallery corpus, both of which
 * moved onto `engine-first-allowlist.ts` once this was fixed (measured with
 * `scripts/measure-smartart-engine-vs-legacy.ts`).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { SmartArtPptxElement } from '../../types/elements';
import { runEngineLayout } from './engine-to-result';

const GALLERY_DIR = path.resolve(__dirname, '../../../__tests__/fixtures/smartart-gallery');

function readFixture(fileName: string): ArrayBuffer {
	const buf = readFileSync(path.join(GALLERY_DIR, fileName));
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('runEngineLayout hideGeom handling', () => {
	it('still renders a hideGeom node that presents real text, as a borderless shape', async () => {
		const handler = new PptxHandler();
		const { slides } = await handler.load(readFixture('vertical-action-list--hier5.pptx'));
		const element = slides
			.flatMap((s) => s.elements)
			.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
		const data = element?.smartArtData;
		expect(data?.layoutDefinition).toBeDefined();
		if (!data?.layoutDefinition) {
			return;
		}
		const bounds = { width: element!.width, height: element!.height };
		const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
		const result = runEngineLayout(data, bounds, data.nodes ?? [], palette, data.style ?? 'flat');
		expect(result).toBeDefined();
		const texts = result?.nodes.map((n) => (n as { text?: string }).text ?? '') ?? [];
		// All five node texts render as their own shape: the three top-level
		// item cards, PLUS the two nested "descendant" text boxes that used to
		// be dropped entirely because they carry `hideGeom="1"`.
		expect(texts).toContain('Node Two has a longer label');
		expect(texts).toContain('Node Five');

		const descendant = result?.nodes.find(
			(n) => (n as { text?: string }).text === 'Node Two has a longer label',
		) as { fill?: string; stroke?: string } | undefined;
		expect(descendant).toBeDefined();
		// hideGeom: no visible border/fill, only the text itself.
		expect(descendant?.fill).toBe('none');
		expect(descendant?.stroke).toBe('none');
	});

	it('still drops a hideGeom node with no presented text', async () => {
		const handler = new PptxHandler();
		const { slides } = await handler.load(readFixture('vertical-action-list--hier5.pptx'));
		const element = slides
			.flatMap((s) => s.elements)
			.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
		const data = element?.smartArtData;
		if (!data?.layoutDefinition) {
			throw new Error('fixture missing a layout definition');
		}
		const bounds = { width: element!.width, height: element!.height };
		const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
		const result = runEngineLayout(data, bounds, data.nodes ?? [], palette, data.style ?? 'flat');
		// "Node Three" and "Node Four" have no descendant of their own, so their
		// empty-text, borderless (`hideGeom`) descendant boxes must not appear
		// as phantom shapes; the transition-point ellipses (also empty-text,
		// but NOT `hideGeom`) are unrelated and unaffected by this fix.
		const phantomHideGeomBoxes = (result?.nodes ?? []).filter(
			(n) =>
				(n as { text?: string; fill?: string }).text === '' &&
				(n as { text?: string; fill?: string }).fill === 'none',
		);
		expect(phantomHideGeomBoxes).toHaveLength(0);
	});
});

describe('runEngineLayout zero-area shape handling', () => {
	it(
		'does not decline the WHOLE diagram over a zero-area conn/hierChild placeholder ' +
			'(real "Hierarchy": a connRout="bend" connector and a childless-leaf hierChild ' +
			'continuation both legitimately render with a {w:0, h:0} box, and previously ' +
			'failed isFiniteGeometry outright)',
		async () => {
			const handler = new PptxHandler();
			const { slides } = await handler.load(readFixture('hierarchy--flat3.pptx'));
			const element = slides
				.flatMap((s) => s.elements)
				.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
			const data = element?.smartArtData;
			expect(data?.layoutDefinition).toBeDefined();
			if (!data?.layoutDefinition) {
				return;
			}
			const bounds = { width: element!.width, height: element!.height };
			const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
			const result = runEngineLayout(data, bounds, data.nodes ?? [], palette, data.style ?? 'flat');
			expect(result).toBeDefined();
			const texts = result?.nodes.map((n) => (n as { text?: string }).text ?? '') ?? [];
			expect(texts).toContain('Alpha');
			expect(texts).toContain('Beta has a noticeably longer label than the others');
			expect(texts).toContain('Gamma');
			// No `conn`-alg shape (routed separately, never converted to a rect
			// - see `collectRenderedNodes`'s own doc comment) should have leaked
			// through as a rendered node.
			const presets = result?.nodes.map((n) => (n as { presetOverride?: string }).presetOverride);
			expect(presets).not.toContain('conn');
		},
	);
});

describe('runEngineLayout sibTrans ordinal-badge text', () => {
	it(
		'renders a sibTrans-presented ordinal badge\'s own literal text ("1"/"2"/"3"), ' +
			'not a blank shape (real "Numbered Title List": DataPoint.label was only ever ' +
			'attached to parTrans, never sibTrans, so a layout presenting the SIBLING ' +
			'transition dropped its badge text entirely)',
		async () => {
			const handler = new PptxHandler();
			const { slides } = await handler.load(readFixture('numbered-title-list--hier5.pptx'));
			const element = slides
				.flatMap((s) => s.elements)
				.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
			const data = element?.smartArtData;
			expect(data?.layoutDefinition).toBeDefined();
			if (!data?.layoutDefinition) {
				return;
			}
			const bounds = { width: element!.width, height: element!.height };
			const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
			const result = runEngineLayout(data, bounds, data.nodes ?? [], palette, data.style ?? 'flat');
			expect(result).toBeDefined();
			const texts = result?.nodes.map((n) => (n as { text?: string }).text ?? '') ?? [];
			expect(texts).toContain('1');
			expect(texts).toContain('2');
			expect(texts).toContain('3');
			// The card's own self text (folding onto its descendant happens
			// downstream in `interpretedLayoutToElements` via `foldedNodeIds`,
			// not here) still renders too - this fix is additive, not a
			// regression on the desOrSelf presOf mapping.
			expect(texts).toContain('Node One');
		},
	);
});
