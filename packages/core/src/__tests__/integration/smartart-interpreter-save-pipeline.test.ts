/**
 * Save-pipeline unification tests for the SmartArt DiagramML interpreter.
 *
 * Before this change, `PptxHandlerRuntimeSaveDocumentParts.ts` fabricated the
 * cached `dsp:` diagram drawing with a much weaker engine
 * (`smartart-layout-engine.ts`, now deleted) that only implemented `lin`/
 * `snake`/`cycle`/`pyra`/`hierRoot`/`hierChild` and never interpreted control
 * flow, so a diagram whose LIVE PREVIEW used `composite`/`conn`/`sp`/`tx`
 * still got a plain linear-stack fallback baked into the saved file. These
 * tests prove the fabrication path now runs the same interpreter every
 * binding's preview uses, and that a real (PowerPoint-authored) cached
 * drawing still wins over fabrication.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';

/** A `composite` layout definition: two fixed left/right half-width slots. */
const COMPOSITE_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: {
		name: 'diagram',
		algorithm: { type: 'composite' },
		children: [
			{
				algorithm: { type: 'tx' },
				constraints: [
					{ type: 'l', factor: 0 },
					{ type: 't', factor: 0 },
					{ type: 'w', factor: 0.5 },
					{ type: 'h', factor: 1 },
				],
			},
			{
				algorithm: { type: 'tx' },
				constraints: [
					{ type: 'l', factor: 0.5 },
					{ type: 't', factor: 0 },
					{ type: 'w', factor: 0.5 },
					{ type: 'h', factor: 1 },
				],
			},
		],
	},
};

async function presentationWithTwoNodeSmartArt(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-composite',
		type: 'smartArt',
		x: 20,
		y: 30,
		width: 600,
		height: 300,
		smartArtData: {
			layout: 'basicBlockList',
			nodes: [
				{ id: 'n1', text: 'Left' },
				{ id: 'n2', text: 'Right' },
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

/**
 * Each `<dsp:sp>`'s shape-position `<a:off x="…" y="…"/>`, in EMU (the
 * `<a:xfrm>` one; `dsp:txXfrm` duplicates the same offset and is excluded so
 * each shape contributes exactly one pair).
 */
function shapeOffsets(drawingXml: string): Array<[number, number]> {
	return [...drawingXml.matchAll(/<a:xfrm[^>]*><a:off x="(\d+)" y="(\d+)"\/>/gu)].map((match) => [
		Number(match[1]),
		Number(match[2]),
	]);
}

describe('smartArt save pipeline: fabricated dsp: drawing uses the DiagramML interpreter', () => {
	it('positions composite slots side by side instead of a linear vertical stack', async () => {
		const initial = await presentationWithTwoNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);

		// Swap the SDK-generated `lin` layout definition for a `composite` one:
		// the interpreter has no XML to re-parse here because the typed model
		// (`layoutDefinition`) is exactly what `decomposeSmartArt` consumes.
		element.smartArtData!.layoutDefinition = COMPOSITE_DEFINITION;
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const drawing = await zip.file('ppt/diagrams/drawing1.xml')!.async('string');

		const offsets = shapeOffsets(drawing);
		expect(offsets).toHaveLength(2);
		const [[x0, y0], [x1, y1]] = offsets;
		// A linear ('lin') fallback stacks the two nodes vertically (same x,
		// increasing y - see the SDK-generated basicBlockList baseline). The
		// composite slots instead sit side by side: same y, increasing x.
		expect(y0).toBe(y1);
		expect(x1).toBeGreaterThan(x0);
		// Each slot is (approximately) half the 600px-wide frame.
		const extents = [...drawing.matchAll(/<a:ext cx="(\d+)" cy="(\d+)"\/>/gu)].map((match) => [
			Number(match[1]),
			Number(match[2]),
		]);
		const [[width0]] = extents;
		expect(width0).toBeGreaterThan(0);
		expect(width0).toBeLessThan(x1 + width0 + 1000);
	});

	it('keeps the cached drawing untouched when the fabrication path is not dirty', async () => {
		const initial = await presentationWithTwoNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const cachedShapes = element.smartArtData!.drawingShapes;
		expect(cachedShapes?.length).toBeGreaterThan(0);

		// Swap in the composite definition WITHOUT marking the drawing dirty:
		// a real load -> save round-trip where the user never touched the
		// diagram's layout should leave the cached `dsp:` part untouched.
		element.smartArtData!.layoutDefinition = COMPOSITE_DEFINITION;

		const savedZip = await JSZip.loadAsync(await handler.save(loaded.slides));
		const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		const offsets = shapeOffsets(drawing);
		// Still the original vertically-stacked linear geometry (same x,
		// different y), not the composite side-by-side geometry.
		expect(offsets).toHaveLength(2);
		expect(offsets[0][0]).toBe(offsets[1][0]);
		expect(offsets[0][1]).not.toBe(offsets[1][1]);
	});

	it('prefers existing drawingShapes over the interpreter when the fabrication path IS dirty', async () => {
		const initial = await presentationWithTwoNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const cachedShapes = element.smartArtData!.drawingShapes;
		expect(cachedShapes?.length).toBeGreaterThan(0);

		// Mark the drawing dirty (as an edit would) but leave `drawingShapes`
		// populated: `PptxHandlerRuntimeSaveDocumentParts.ts` must still prefer
		// them over re-running the interpreter against the swapped-in
		// composite definition, because they are the highest-fidelity source.
		element.smartArtData!.layoutDefinition = COMPOSITE_DEFINITION;
		element.smartArtData!.drawingDirty = true;

		const savedZip = await JSZip.loadAsync(await handler.save(loaded.slides));
		const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		const offsets = shapeOffsets(drawing);
		expect(offsets).toHaveLength(2);
		expect(offsets[0][0]).toBe(offsets[1][0]);
		expect(offsets[0][1]).not.toBe(offsets[1][1]);
	});
});
