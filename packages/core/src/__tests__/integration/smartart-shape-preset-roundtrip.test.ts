/**
 * A layoutNode's own `dgm:shape` preset geometry overrides the arranger's
 * hardcoded family default shape: live preview + save round-trip.
 *
 * The interpreter previously hardcoded rect/circle/polygon purely by
 * arrangement family (`lin`/`snake` -> rect, `cycle` -> circle, `pyra` ->
 * trapezoid), ignoring `dgm:shape`/`dgm:adjLst` entirely, so a custom (or
 * third-party) layout definition naming a DIFFERENT preset for its item
 * template rendered with the wrong shape. This exercises the fix
 * (`smartart-layout-node-shape.ts` parsing it, `smartart-layout-shape-preset.ts`
 * + `smartart-layout-interpreter-preset-node.ts` honouring it in `lin`), once
 * in the live-preview render model, and once baked into the fabricated
 * cached `dsp:` drawing on save.
 *
 * No real fixture in this repo has a `lin`/`snake`/`cycle` item template whose
 * preset CHANGES the rendered KIND away from that family's own default (the
 * real ones checked - `smartart-chart-table-mix.pptx` `layout1.xml`/
 * `layout2.xml` - use `roundRect` on a `lin` list and `ellipse` on a `cycle`,
 * both already that family's default kind), so this uses a hand-built typed
 * `layoutDefinition` whose `lin` item template is an `ellipse`. The metadata
 * PARSE/round-trip itself (`smartart-layout-node-shape.test.ts`) is verified
 * against those real fixtures' actual `dgm:shape` XML.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition, PptxSmartArtNode } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';

/** A `lin` (list) layout whose item template is an `ellipse`, not the arranger's rect default. */
const ELLIPSE_ITEM_LIST_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: {
		name: 'diagram',
		algorithm: { type: 'lin' },
		children: [{ name: 'node', shape: { presetGeometry: 'ellipse' } }],
	},
};

const NODES: PptxSmartArtNode[] = [
	{ id: 'n1', text: 'One' },
	{ id: 'n2', text: 'Two' },
	{ id: 'n3', text: 'Three' },
];

async function presentationWithListSmartArt(nodes: PptxSmartArtNode[]): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-list',
		type: 'smartArt',
		x: 20,
		y: 30,
		width: 600,
		height: 200,
		smartArtData: { layout: 'basicBlockList', nodes },
	} as SmartArtPptxElement as PptxElement);
	return handler.save(data.slides);
}

function smartArt(slides: { elements: PptxElement[] }[]): SmartArtPptxElement {
	return slides[0].elements.find(
		(element): element is SmartArtPptxElement => element.type === 'smartArt',
	)!;
}

function shapes(elements: PptxElement[]): Extract<PptxElement, { type: 'shape' }>[] {
	return elements.filter(
		(el): el is Extract<PptxElement, { type: 'shape' }> => el.type === 'shape',
	);
}

describe('smartArt shape preset: dgm:shape overrides the arranger default', () => {
	it("renders ellipses (not the lin arranger's rect default) in the live-preview render model", async () => {
		const initial = await presentationWithListSmartArt(NODES);
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;
		data.layoutDefinition = ELLIPSE_ITEM_LIST_DEFINITION;
		data.nodes = NODES;

		const renderModel = shapes(
			computeSmartArtElementsWithoutCache(data, {
				x: element.x,
				y: element.y,
				width: element.width,
				height: element.height,
			})!,
		);

		expect(renderModel).toHaveLength(3);
		for (const shape of renderModel) {
			expect(shape.shapeType).toBe('ellipse');
		}
	});

	it('bakes the ellipse preset geometry into the fabricated cached dsp: drawing on save', async () => {
		const initial = await presentationWithListSmartArt(NODES);
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		element.smartArtData!.layoutDefinition = ELLIPSE_ITEM_LIST_DEFINITION;
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const drawingXml = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');

		expect(drawingXml).toContain('prst="ellipse"');
		expect(drawingXml).not.toContain('prst="roundRect"');
		expect(drawingXml.match(/prst="ellipse"/gu) ?? []).toHaveLength(3);
	});
});
