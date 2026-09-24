/**
 * A structurally edited 3D SmartArt still renders its quick style's bevel /
 * scene 3D in the shared 3D scene, before AND after save.
 *
 * Ground truth: `e2e/fixtures/three-d-parity/three-d-smartart.pptx` (slide 1
 * Simple Fill, slide 6 Polished bevel, slide 10 Brick Scene).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { PptxSlide, SmartArtPptxElement } from 'pptx-viewer-core';
import { PptxHandler, addSmartArtNode, removeSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSmartArt3DSpecForElement } from './smartart-3d-element';
import { withRegeneratedSmartArt3DDrawing } from './smartart-3d-regenerated-drawing';

const fixture = fileURLToPath(
	new URL('../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

async function loadDeck(): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const bytes = readFileSync(fixture);
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, slides: data.slides };
}

function smartArtOn(slides: PptxSlide[], slideIndex: number): SmartArtPptxElement {
	const element = slides[slideIndex].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element?.smartArtData) {
		throw new Error(`slide ${slideIndex + 1} has no smartArt element`);
	}
	return element;
}

/** Add a node to the slide's diagram in place (drops the cached drawing). */
function addNode(slides: PptxSlide[], slideIndex: number): SmartArtPptxElement {
	const element = smartArtOn(slides, slideIndex);
	const data = element.smartArtData!;
	element.smartArtData = addSmartArtNode(data, 'Added', data.nodes[0].id);
	expect(element.smartArtData.drawingShapes).toStrictEqual([]);
	return element;
}

describe('structurally edited SmartArt in the shared 3D scene', () => {
	it('bevel (slide 6): an added node keeps the bevel path before and after save', async () => {
		const { handler, slides } = await loadDeck();
		const edited = addNode(slides, 5);
		const before = buildSmartArt3DSpecForElement(edited);
		expect(before?.styleCategory).toBe('bevel');
		expect(before?.meshes).toHaveLength(5);
		expect(before?.lighting?.rig).toBe('flat');

		const saved = await handler.save(slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const after = buildSmartArt3DSpecForElement(smartArtOn(reloaded.slides, 5));
		expect(after?.styleCategory).toBe('bevel');
		expect(after?.meshes).toHaveLength(5);
		expect(after?.lighting).toStrictEqual(before?.lighting);
	});

	it('scene (slide 10): a removed node keeps the scene camera', async () => {
		const { slides } = await loadDeck();
		const element = smartArtOn(slides, 9);
		const data = element.smartArtData!;
		element.smartArtData = removeSmartArtNode(data, data.nodes[0].id);
		const spec = buildSmartArt3DSpecForElement(element);
		expect(spec?.styleCategory).toBe('scene');
		expect(spec?.meshes).toHaveLength(3);
		expect(spec?.camera).toBeDefined();
	});

	it('flat (slide 1) and intact diagrams are left untouched', async () => {
		const { slides } = await loadDeck();
		const flat = addNode(slides, 0);
		const size = { width: flat.width, height: flat.height };
		expect(withRegeneratedSmartArt3DDrawing(flat.smartArtData!, size)).toBe(flat.smartArtData);
		const intact = smartArtOn(slides, 5).smartArtData!;
		expect(withRegeneratedSmartArt3DDrawing(intact, size)).toBe(intact);
	});
});
