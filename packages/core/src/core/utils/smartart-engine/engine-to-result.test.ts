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

describe('runEngineLayout moveWith carrier merging', () => {
	it(
		'folds a hideGeom moveWith carrier into its target instead of rendering ' +
			'both (Numbered Title List: nodeText presents the SAME point as bgRect, ' +
			'plus any demoted descendant, so both painting would double every item)',
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
			const withText = (result?.nodes ?? []).filter(
				(n) => (n as { text?: string }).text === 'Node One',
			);
			// Exactly one shape presents "Node One": bgRect. nodeText (hideGeom,
			// moveWith="bgRect", presOf desOrSelf) must not ALSO render as its own
			// shape carrying the same self text.
			expect(withText).toHaveLength(1);
			const bgRect = withText[0] as { foldedNodeIds?: string[]; presetOverride?: string };
			// nodeText's extra (descendant) source id folds onto bgRect, so the
			// downstream bridge's text projection produces the combined
			// "Node One\nNode Two has a longer label" PowerPoint actually shows.
			expect(bgRect.foldedNodeIds?.length ?? 0).toBeGreaterThan(0);
			expect(bgRect.presetOverride).toBe('roundRect');
		},
	);

	it(
		'does NOT merge a hideGeom moveWith carrier whose presented points are ' +
			'disjoint from its target (Detailed Process: childNode presents a ' +
			"DIFFERENT demoted sibling point than bgRect's own self point, so " +
			'PowerPoint paints them as two separate, independently positioned cards)',
		async () => {
			const handler = new PptxHandler();
			const { slides } = await handler.load(readFixture('detailed-process--hier5.pptx'));
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
			// Both the promoted step's own card AND its demoted child's card
			// still render as their own shapes; neither was folded away.
			expect(texts).toContain('Node One');
			expect(texts).toContain('Node Two has a longer label');
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

describe('runEngineLayout presented text and typeless shapes', () => {
	async function engineNodes(file: string): Promise<{ text?: string; nodeId?: string }[]> {
		const handler = new PptxHandler();
		const { slides } = await handler.load(readFixture(file));
		const element = slides
			.flatMap((s) => s.elements)
			.find((el): el is SmartArtPptxElement => el.type === 'smartArt');
		const data = element?.smartArtData;
		if (!element || !data?.layoutDefinition) {
			throw new Error(`${file} missing a layout definition`);
		}
		const bounds = { width: element.width, height: element.height };
		const result = runEngineLayout(
			data,
			bounds,
			data.nodes ?? [],
			['#4472C4'],
			data.style ?? 'flat',
		);
		return (result?.nodes ?? []) as { text?: string; nodeId?: string }[];
	}

	it('draws a borderless box whose first presented point is an empty placeholder', async () => {
		// "Small Dots Vertical": Node Two's `descText` presents an empty point,
		// then Node Three; the cached drawing gives Node Three its own box.
		const nodes = await engineNodes('small-dots-vertical--hier5.pptx');
		const boxes = nodes.filter(
			(n) => (n as { foldedNodeIds?: string[] }).foldedNodeIds?.length && n.text === '',
		);
		// Before the fix no borderless descendant box survived, so Node Three
		// folded into Node Two's own title instead.
		expect(boxes.length).toBeGreaterThan(0);
	});

	it('does not draw a dgm:shape that declares no type', async () => {
		// "Organization Chart"'s rootComposite/hierRoot carriers host presOf only.
		const nodes = await engineNodes('organization-chart--flat3.pptx');
		const withText = nodes.filter((n) => (n.text ?? '').length > 0);
		expect(withText).toHaveLength(3);
	});
});
