/**
 * Relative `dgm:constr` (`@refType`/`@refFor`/`@refForName`) resolution: live
 * preview + save round-trip.
 *
 * Before `smartart-constraint-solver.ts` existed, `dgm:constr`/`dgm:rule` were
 * parsed and serialised (`smartart-constraint-rules.ts`) but a constraint that
 * only carried a reference (no literal `val`/`fact` of its own) resolved to
 * nothing anywhere in the interpreter, so relative-size layouts degraded to
 * flat defaults.
 *
 * The `constrLst` below is the exact shape genuine PowerPoint content uses:
 * `ppt/diagrams/layout1.xml` inside `e2e/fixtures/animation-builds-color.pptx`
 * (a `snake` list diagram) declares, on its root `diagram` layoutNode:
 *
 * ```xml
 * <dgm:constr type="w" for="ch" forName="node" refType="w"/>
 * <dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.6"/>
 * <dgm:constr type="w" for="ch" forName="sibTrans" refType="w" refFor="ch" refForName="node" fact="0.1"/>
 * <dgm:constr type="sp" refType="w" refFor="ch" refForName="sibTrans"/>
 * ```
 *
 * i.e. every item is 0.6x as tall as it is wide, and the gap between items
 * equals a spacer that is itself 0.1x an item's width - a three-hop chain with
 * no absolute value declared anywhere. This test exercises that resolution in
 * both the live-preview render model and the fabricated cached `dsp:` drawing
 * baked on save, following the same pattern as
 * `smartart-layout-rules-roundtrip.test.ts`.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';

/** The genuine `constrLst` above, as the already-parsed typed model. */
const RELATIVE_CONSTRAINT_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: {
		name: 'diagram',
		algorithm: { type: 'lin' },
		constraints: [
			{ type: 'w', for: 'ch', forName: 'node', referenceType: 'w' },
			{
				type: 'h',
				for: 'ch',
				forName: 'node',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'node',
				factor: 0.6,
			},
			{
				type: 'w',
				for: 'ch',
				forName: 'sibTrans',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'node',
				factor: 0.1,
			},
			{ type: 'sp', referenceType: 'w', referenceFor: 'ch', referenceForName: 'sibTrans' },
		],
		children: [{ name: 'node' }, { name: 'sibTrans' }],
	},
};

async function presentationWithThreeNodeSmartArt(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-relative',
		type: 'smartArt',
		x: 20,
		y: 30,
		width: 600,
		height: 300,
		smartArtData: {
			layout: 'basicBlockList',
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
				{ id: 'n3', text: 'Three' },
			],
		},
	} as SmartArtPptxElement as PptxElement);
	return handler.save(data.slides);
}

function smartArt(slides: { elements: PptxElement[] }[]): SmartArtPptxElement {
	return slides[0].elements.find(
		(element): element is SmartArtPptxElement => element.type === 'smartArt',
	)!;
}

describe('smartArt relative constraint round-trip: refType/refFor/refForName', () => {
	it('resolves the item aspect ratio and inter-item gap in the live-preview render model', async () => {
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;
		data.layoutDefinition = RELATIVE_CONSTRAINT_DEFINITION;

		const renderModel = computeSmartArtElementsWithoutCache(data, {
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		})!;

		expect(renderModel).toHaveLength(3);
		const shapes = renderModel.filter(
			(el): el is Extract<PptxElement, { type: 'shape' }> => el.type === 'shape',
		);
		expect(shapes).toHaveLength(3);

		// h = 0.6 * w on every item, resolved with no literal h/w declared
		// anywhere - only the reference chain above.
		for (const shape of shapes) {
			expect(shape.height / shape.width).toBeCloseTo(0.6, 1);
		}

		// The gap between consecutive items' left edges is (item width + the
		// resolved "sp" gap, 0.1x an item's width worth of ratio-scaled pixels).
		const xs = shapes.map((shape) => shape.x).sort((a, b) => a - b);
		const widths = shapes.map((shape) => shape.width);
		const step = xs[1] - xs[0];
		expect(step).toBeCloseTo(xs[2] - xs[1], 0);
		// step = mainExtent * (1 + sib) where sib resolves to 0.1.
		expect(step / widths[0]).toBeCloseTo(1.1, 1);
	});

	it('bakes the resolved relative geometry into the fabricated cached dsp: drawing on save', async () => {
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);

		element.smartArtData!.layoutDefinition = RELATIVE_CONSTRAINT_DEFINITION;
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		expect(drawing).toContain('<dsp:sp');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const cached = smartArt(reloaded.slides).smartArtData!.drawingShapes;
		expect(cached?.length).toBe(3);
		for (const shape of cached ?? []) {
			// Same 0.6 aspect ratio, now surviving a full save + reload of the
			// cached `dsp:` drawing part (rounded to whole px on write).
			expect(shape.height / shape.width).toBeCloseTo(0.6, 1);
		}
	});
});
