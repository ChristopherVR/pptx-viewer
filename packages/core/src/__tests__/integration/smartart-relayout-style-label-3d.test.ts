/**
 * A structurally re-laid-out SmartArt styles each regenerated shape from its
 * OWN presentation style label, not the `node1` fallback: Basic Cycle's
 * transition arrows (`sibTrans2D1`) come back, with the arrow bevel
 * PowerPoint cached on them, and Basic Pyramid's hidden text boxes (`revTx`)
 * stay flat while every tier keeps the `node1` bevel.
 *
 * Ground truth: `e2e/fixtures/three-d-parity/three-d-smartart.pptx`, slide 34
 * (Basic Cycle, Polished) and slide 62 (Basic Pyramid, Polished).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, SmartArtPptxElement } from '../../core/types';
import { addSmartArtNode, relayoutSmartArt } from '../../core/utils';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
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

async function smartArtOn(slideNumber: number): Promise<SmartArtPptxElement> {
	const data = await loadDeck();
	const element = data.slides[slideNumber - 1].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element?.smartArtData) {
		throw new Error(`slide ${slideNumber} has no smartArt element`);
	}
	return element;
}

describe('relayout styles regenerated shapes by their own style label', () => {
	it('basic Cycle (Polished): arrows come back with the sibTrans2D1 bevel', async () => {
		const element = await smartArtOn(34);
		const data = element.smartArtData!;
		const cached = data.drawingShapes ?? [];
		const cachedArrow = cached.find((s) => s.shapeType === 'rightArrow');
		const cachedNode = cached.find((s) => s.shapeType === 'ellipse');
		expect(cachedArrow?.shape3d?.bevelTopWidth).toBe(50800);

		const edited = addSmartArtNode(data, 'Added', data.nodes[1].id);
		const shapes = relayoutSmartArt(edited, element.width, element.height);
		const arrows = shapes.filter((s) => s.shapeType === 'rightArrow');
		const nodes = shapes.filter((s) => s.shapeType === 'ellipse');
		expect(nodes).toHaveLength(edited.nodes.length);
		expect(arrows).toHaveLength(edited.nodes.length);
		for (const arrow of arrows) {
			expect(arrow.styleLabel).toBe('sibTrans2D1');
			expect(arrow.shape3d).toStrictEqual(cachedArrow?.shape3d);
			expect(arrow.scene3d).toStrictEqual(cachedArrow?.scene3d);
		}
		for (const node of nodes) {
			expect(node.shape3d).toStrictEqual(cachedNode?.shape3d);
		}
	}, 30000);

	it('basic Pyramid (Polished): tiers keep the node1 bevel, text boxes stay flat', async () => {
		const element = await smartArtOn(62);
		const data = element.smartArtData!;
		const cachedTier = data.drawingShapes?.[0];
		expect(cachedTier?.shape3d?.bevelTopWidth).toBeGreaterThan(0);

		const shapes = relayoutSmartArt(data, element.width, element.height);
		const tiers = shapes.filter((s) => s.shapeType === 'trapezoid');
		const texts = shapes.filter((s) => s.shapeType === 'rect');
		expect(tiers).toHaveLength(4);
		expect(tiers.every((s) => s.styleLabel === 'node1')).toBeTruthy();
		for (const tier of tiers) {
			expect(tier.shape3d).toStrictEqual(cachedTier?.shape3d);
		}
		expect(texts.every((s) => s.styleLabel === 'revTx' && !s.shape3d && !s.scene3d)).toBeTruthy();
	}, 30000);
});
