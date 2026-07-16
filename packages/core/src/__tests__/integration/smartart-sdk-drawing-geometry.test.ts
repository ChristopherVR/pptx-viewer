import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import type { PptxSmartArtDrawingShape, SmartArtLayout } from '../../core/types/smart-art';
import { decomposeSmartArt } from '../../core/utils';

/**
 * Regression tests for SDK-created SmartArt losing per-node shape geometry on
 * save.
 *
 * Before the fix, `createSmartArtElementXml` fabricated only the
 * data/layout/quickStyle/colors parts. With no cached `drawingN.xml`,
 * PowerPoint recomputed the diagram from the deliberately simplified
 * fabricated layout (every node a `roundRect`), so pyramids, cycles, chevrons,
 * etc. all reopened as the same default rounded rectangle: the reported "all
 * shapes became the same default shape" symptom.
 *
 * After the fix, the viewer-computed `drawingShapes` are serialized into a
 * cached `dsp:drawing` whose `dsp:sp` shapes each carry their own
 * `a:prstGeom`, linked from the slide rels + a `dsp:dataModelExt`.
 */

const PYRAMID_SHAPES: PptxSmartArtDrawingShape[] = [
	{ id: 'engine-n1', shapeType: 'triangle', x: 250, y: 40, width: 100, height: 90, text: 'Top' },
	{
		id: 'engine-n2',
		shapeType: 'trapezoid',
		x: 200,
		y: 140,
		width: 200,
		height: 90,
		text: 'Middle',
	},
	{
		id: 'engine-n3',
		shapeType: 'trapezoid',
		x: 150,
		y: 240,
		width: 300,
		height: 90,
		text: 'Bottom',
	},
];

const CUSTOM_SHAPE: PptxSmartArtDrawingShape = {
	id: 'engine-n1',
	shapeType: 'custom',
	x: 100,
	y: 50,
	width: 200,
	height: 200,
	text: 'Top',
	customGeometryPaths: [
		{
			width: 100,
			height: 100,
			segments: [
				{ type: 'moveTo', pt: { x: 100, y: 50 } },
				{ type: 'lineTo', pt: { x: 100, y: 0 } },
				{ type: 'arcTo', wR: 50, hR: 50, stAng: 0, swAng: 10800000 },
				{ type: 'lineTo', pt: { x: 0, y: 50 } },
				{ type: 'close' },
			],
		},
	],
};

function makePyramid(
	layout: SmartArtLayout,
	drawingShapes?: PptxSmartArtDrawingShape[],
): SmartArtPptxElement {
	return {
		id: 'element-pyramid-smartart',
		type: 'smartArt',
		x: 100,
		y: 80,
		width: 620,
		height: 380,
		smartArtData: {
			layout,
			colorScheme: 'colorful1',
			style: 'flat',
			nodes: [
				{ id: 'n1', text: 'Top' },
				{ id: 'n2', text: 'Middle' },
				{ id: 'n3', text: 'Bottom' },
			],
			...(drawingShapes ? { drawingShapes } : {}),
		},
	} as SmartArtPptxElement;
}

async function saveWithSmartArt(el: SmartArtPptxElement): Promise<JSZip> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push(el as PptxElement);
	const saved = await handler.save(data.slides);
	return JSZip.loadAsync(saved);
}

describe('sDK-created SmartArt preserves per-node shape geometry on save', () => {
	it("emits a cached drawing part carrying each shape's distinct preset geometry", async () => {
		const zip = await saveWithSmartArt(makePyramid('basicPyramid', PYRAMID_SHAPES));

		const drawing = await zip.file('ppt/diagrams/drawing1.xml')?.async('string');
		expect(drawing, 'drawing1.xml was not written').toBeTruthy();
		// Distinct geometries survive, not a single default shape.
		expect(drawing).toContain('prst="triangle"');
		expect(drawing).toContain('prst="trapezoid"');
		expect(drawing).not.toContain('prst="roundRect"');
		// Two trapezoids + one triangle => three cached shapes.
		expect(drawing!.match(/<dsp:sp\b/gu) || []).toHaveLength(3);
	});

	it('registers the drawing content type and links it from the owning slide', async () => {
		const zip = await saveWithSmartArt(makePyramid('basicPyramid', PYRAMID_SHAPES));

		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain('drawingml.diagramDrawing+xml');

		const dataXml = await zip.file('ppt/diagrams/data1.xml')!.async('string');
		expect(dataXml).toContain('dataModelExt');
		const drawingRelId = /dsp:dataModelExt[^>]*relId="([^"]+)"/u.exec(dataXml)?.[1];
		expect(drawingRelId).toBeTruthy();

		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(slideRels).toContain(`Id="${drawingRelId}"`);
		expect(slideRels).toContain('relationships/diagramDrawing');
		expect(slideRels).toContain('Target="../diagrams/drawing1.xml"');
		expect(zip.file('ppt/diagrams/_rels/data1.xml.rels')).toBeNull();
	});

	it('correlates cached shape model ids with the data-model point ids', async () => {
		const zip = await saveWithSmartArt(makePyramid('basicPyramid', PYRAMID_SHAPES));
		const drawing = await zip.file('ppt/diagrams/drawing1.xml')!.async('string');
		const dataXml = await zip.file('ppt/diagrams/data1.xml')!.async('string');

		const shapeModelIds = [...drawing.matchAll(/<dsp:sp modelId="(\{[^"]+\})"/gu)].map((m) => m[1]);
		expect(shapeModelIds).toHaveLength(3);
		// Every cached shape targets a presentation point, not a semantic node.
		for (const id of shapeModelIds) {
			expect(dataXml, `data model missing presentation point ${id}`).toMatch(
				new RegExp(
					`<dgm:pt modelId="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" type="pres">`,
					'u',
				),
			);
		}
		expect(dataXml.match(/presAssocID="\{/gu) ?? []).toHaveLength(3);
		expect(dataXml.match(/type="presOf"/gu) ?? []).toHaveLength(3);
	});

	it('round-trips through the loader with distinct geometries intact', async () => {
		const zip = await saveWithSmartArt(makePyramid('basicPyramid', PYRAMID_SHAPES));
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const reloaded = await handler.load(bytes.buffer as ArrayBuffer);
		const el = reloaded.slides[0].elements.find((e) => e.type === 'smartArt') as
			| SmartArtPptxElement
			| undefined;
		expect(el, 'reloaded smartArt element missing').toBeDefined();
		expect(el?.smartArtData?.drawingShapes?.map((s) => s.shapeType)).toStrictEqual([
			'triangle',
			'trapezoid',
			'trapezoid',
		]);
	});

	it('round-trips cached custom geometry through save, load, and decomposition', async () => {
		const zip = await saveWithSmartArt(makePyramid('basicPyramid', [CUSTOM_SHAPE]));
		const drawing = await zip.file('ppt/diagrams/drawing1.xml')!.async('string');
		expect(drawing).toContain('<a:custGeom>');
		expect(drawing).toContain('<a:arcTo wR="50" hR="50" stAng="0" swAng="10800000"/>');
		expect(drawing).not.toContain('<a:prstGeom');
		const sourcePath = /<a:path\b[^>]*>([\s\S]*?)<\/a:path>/u.exec(drawing)?.[1] ?? '';
		expect(
			[...sourcePath.matchAll(/<a:(moveTo|lnTo|arcTo|close)\b/gu)].map((match) => match[1]),
		).toStrictEqual(['moveTo', 'lnTo', 'arcTo', 'lnTo', 'close']);

		const bytes = await zip.generateAsync({ type: 'uint8array' });
		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		const element = reloaded.slides[0].elements.find(
			(candidate): candidate is SmartArtPptxElement => candidate.type === 'smartArt',
		);
		const cached = element?.smartArtData?.drawingShapes?.[0];
		expect(cached).toMatchObject({ shapeType: 'custom', pathWidth: 100, pathHeight: 100 });
		expect(cached?.pathData).toContain('A 50 50');
		expect(cached?.customGeometryPaths?.[0].segments.map((segment) => segment.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'arcTo',
			'lineTo',
			'close',
		]);

		const decomposed = decomposeSmartArt(element!.smartArtData!, {
			x: element!.x,
			y: element!.y,
			width: element!.width,
			height: element!.height,
		});
		expect(decomposed?.[0]).toMatchObject({
			shapeType: 'custom',
			pathWidth: 100,
			pathHeight: 100,
		});
		expect((decomposed?.[0] as { pathData?: string } | undefined)?.pathData).toContain('A 50 50');

		element!.smartArtData!.drawingDirty = true;
		const savedAgain = await reloadHandler.save(reloaded.slides);
		const secondZip = await JSZip.loadAsync(savedAgain);
		const secondDrawing = await secondZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		const secondPath = /<a:path\b[^>]*>([\s\S]*?)<\/a:path>/u.exec(secondDrawing)?.[1] ?? '';
		expect(
			[...secondPath.matchAll(/<a:(moveTo|lnTo|arcTo|close)\b/gu)].map((match) => match[1]),
		).toStrictEqual(['moveTo', 'lnTo', 'arcTo', 'lnTo', 'close']);
	});

	it('caches viewer-computed geometry when the element has no drawingShapes', async () => {
		// Inserted diagrams carry no `drawingShapes`; the fabrication path must
		// run the same decompose/layout algorithms the viewer renders with and
		// cache the result, so PowerPoint reopens matching what the user saw
		// (WYSIWYG parity) instead of recomputing the simplified layout.
		const el = makePyramid('basicCycle');
		const zip = await saveWithSmartArt(el);

		const drawing = await zip.file('ppt/diagrams/drawing1.xml')?.async('string');
		expect(drawing, 'drawing1.xml was not written from decompose output').toBeTruthy();

		// The cached geometry must equal the viewer's decompose output (parity).
		const expected = decomposeSmartArt(el.smartArtData!, {
			x: 0,
			y: 0,
			width: el.width,
			height: el.height,
		})!.filter((e) => e.type === 'shape');
		const cachedPrsts = [...drawing!.matchAll(/prst="([^"]+)"/gu)].map((m) => m[1]);
		expect(cachedPrsts).toHaveLength(expected.length);
		expect(cachedPrsts).toStrictEqual(
			expected.map((e) => (e as { shapeType?: string }).shapeType ?? 'rect'),
		);

		const dataXml = await zip.file('ppt/diagrams/data1.xml')!.async('string');
		expect(dataXml).toContain('dataModelExt');
	});

	it('omits the drawing part when the diagram has no nodes to draw', async () => {
		const empty = makePyramid('basicPyramid');
		(empty.smartArtData as { nodes: unknown[] }).nodes = [];
		const zip = await saveWithSmartArt(empty);
		expect(zip.file('ppt/diagrams/drawing1.xml')).toBeNull();
		const dataXml = await zip.file('ppt/diagrams/data1.xml')!.async('string');
		expect(dataXml).not.toContain('dataModelExt');
	});
});
