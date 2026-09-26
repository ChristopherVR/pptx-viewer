/**
 * The per-point engine reports each shape's presentation style label and
 * draws 2-D connectors (transition arrows) as shapes, checked against what
 * PowerPoint recorded in the 3D parity ground-truth deck
 * (`e2e/fixtures/three-d-parity/three-d-smartart.pptx`: slide 15 Basic
 * Process, 29 Basic Cycle, 43 Organization Chart, 57 Basic Pyramid).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxData, SmartArtPptxElement } from '../../types';
import type { RenderedRectNode } from '../smartart-layout-types';
import { runEngineLayout } from './engine-to-result';

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

let deck: Promise<PptxData> | undefined;

function loadDeck(): Promise<PptxData> {
	deck ??= (async () => {
		const bytes = readFileSync(fixture);
		return new PptxHandler().load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
	})();
	return deck;
}

async function engineShapes(slideNumber: number): Promise<RenderedRectNode[]> {
	const data = await loadDeck();
	const element = data.slides[slideNumber - 1].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	const smartArt = element?.smartArtData;
	if (!element || !smartArt) {
		throw new Error(`slide ${slideNumber} has no smartArt element`);
	}
	const result = runEngineLayout(
		smartArt,
		{ width: element.width, height: element.height },
		smartArt.nodes,
		['#156082'],
		'flat',
	);
	if (!result) {
		throw new Error(`engine declined slide ${slideNumber}`);
	}
	return result.nodes as RenderedRectNode[];
}

/** 1px in EMU, and the cached `a:xfrm` of a shape in px. */
const EMU_PER_PX = 9525;
const px = (emu: number) => emu / EMU_PER_PX;

describe('engine style labels', () => {
	it("reports Basic Pyramid's tier as node1 and its text box as revTx", async () => {
		const shapes = await engineShapes(57);
		const tiers = shapes.filter((s) => s.presetOverride === 'trapezoid');
		expect(tiers).toHaveLength(4);
		expect(tiers.every((s) => s.styleLabel === 'node1')).toBeTruthy();
		const texts = shapes.filter((s) => s.presetOverride === 'rect');
		expect(texts.map((s) => s.styleLabel)).toStrictEqual(['revTx', 'revTx', 'revTx', 'revTx']);
	}, 30000);

	it("derives Organization Chart's node0 / node2 from the layout and the data depth", async () => {
		const shapes = await engineShapes(43);
		const labelled = shapes.filter((s) => s.text);
		expect(labelled.map((s) => s.styleLabel)).toStrictEqual(['node0', 'node2', 'node2', 'node2']);
	}, 30000);
});

describe('engine 2-D connector arrows', () => {
	it("draws Basic Cycle's sibTrans arrows where PowerPoint cached them", async () => {
		const shapes = await engineShapes(29);
		const arrows = shapes.filter((s) => s.presetOverride === 'rightArrow');
		expect(arrows).toHaveLength(4);
		// drawing29.xml: rightArrow rot 45/135/225/315, 454329 x 575964 EMU.
		expect(arrows.map((s) => s.rotation)).toStrictEqual([45, 135, 225, 315]);
		for (const arrow of arrows) {
			expect(arrow.styleLabel).toBe('sibTrans2D1');
			expect(arrow.shapeAdjustments).toStrictEqual({ adj1: 60000, adj2: 50000 });
			expect(arrow.text).toBe('');
			expect(arrow.width).toBeCloseTo(px(454329), 0);
			expect(arrow.height).toBeCloseTo(px(575964), 0);
		}
		const first = arrows[0];
		expect(first.x).toBeCloseTo(px(5750178), 0);
		expect(first.y).toBeCloseTo(px(1463489), 0);
	}, 30000);

	it('fills an arrow from its own label colour list, not the node palette', async () => {
		const data = await loadDeck();
		const element = data.slides[28].elements.find(
			(el): el is SmartArtPptxElement => el.type === 'smartArt',
		);
		const expected = element?.smartArtData?.colorTransform?.roleColors?.sibTrans2D1?.fill[0];
		expect(expected).toBeDefined();
		const arrows = (await engineShapes(29)).filter((s) => s.presetOverride === 'rightArrow');
		expect(arrows.every((s) => s.fill === expected)).toBeTruthy();
	}, 30000);
});
