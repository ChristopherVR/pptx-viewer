import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { SmartArtPptxElement } from '../../core/types/elements';
import { reflowSmartArtLayout, switchSmartArtLayout } from '../../core/utils';
import { readCorpusFixture } from './real-world-corpus-helpers';

async function loadPyramid(): Promise<{
	handler: PptxHandler;
	slides: Awaited<ReturnType<PptxHandler['load']>>['slides'];
	element: SmartArtPptxElement;
}> {
	const handler = new PptxHandler();
	const loaded = await handler.load(readCorpusFixture('smartart-chart-table-mix.pptx'));
	const element = loaded.slides
		.flatMap((slide) => slide.elements)
		.find(
			(candidate): candidate is SmartArtPptxElement =>
				candidate.type === 'smartArt' && candidate.smartArtData?.resolvedLayoutType === 'pyramid',
		);
	if (!element) {
		throw new Error('PowerPoint-authored pyramid SmartArt fixture is missing');
	}
	return { handler, slides: loaded.slides, element };
}

describe('existing PowerPoint SmartArt geometry save', () => {
	it('loads cached drawing geometry from slide relationships', async () => {
		const { element } = await loadPyramid();
		expect(element.smartArtData?.drawingRelId).toBe('rId6');
		expect(element.smartArtData?.drawingShapes?.map((shape) => shape.shapeType)).toStrictEqual([
			'trapezoid',
			'trapezoid',
			'trapezoid',
		]);
	});

	it('writes edited cached drawing text without replacing its geometry', async () => {
		const { handler, slides, element } = await loadPyramid();
		const data = element.smartArtData!;
		data.drawingShapes = data.drawingShapes!.map((shape, index) =>
			index === 0 ? { ...shape, text: 'Updated vision' } : shape,
		);
		data.drawingDirty = true;

		const saved = await handler.save(slides);
		const zip = await JSZip.loadAsync(saved);
		const drawing = await zip.file('ppt/diagrams/drawing4.xml')!.async('string');
		expect(drawing).toContain('<a:t>Updated vision</a:t>');
		expect(drawing.match(/prst="trapezoid"/gu) ?? []).toHaveLength(3);
		expect(drawing).toContain('<dsp:txXfrm>');
	});

	it('retains non-node cached shapes when rewriting an existing drawing', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(readCorpusFixture('smartart-chart-table-mix.pptx'));
		const process = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(candidate): candidate is SmartArtPptxElement =>
					candidate.type === 'smartArt' && candidate.smartArtData?.resolvedLayoutType === 'process',
			);
		expect(process).toBeDefined();
		const originalShapeCount = process!.smartArtData!.drawingShapes!.length;
		expect(originalShapeCount).toBeGreaterThan(process!.smartArtData!.nodes.length);
		process!.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const drawing = await zip.file('ppt/diagrams/drawing1.xml')!.async('string');
		expect(drawing.match(/<dsp:sp\b/gu) ?? []).toHaveLength(originalShapeCount);
	});

	it('persists an edited layout identity and regenerated cached geometry', async () => {
		const { handler, slides, element } = await loadPyramid();
		const switched = switchSmartArtLayout(element.smartArtData!, 'cycle');
		switched.drawingShapes = reflowSmartArtLayout(switched, {
			width: element.width,
			height: element.height,
		});
		element.smartArtData = switched;

		const saved = await handler.save(slides);
		const zip = await JSZip.loadAsync(saved);
		const layout = await zip.file('ppt/diagrams/layout4.xml')!.async('string');
		const data = await zip.file('ppt/diagrams/data4.xml')!.async('string');
		const drawing = await zip.file('ppt/diagrams/drawing4.xml')!.async('string');

		expect(layout).toContain('uniqueId="urn:pptx-viewer/layout/cycle"');
		expect(layout).toContain('<dgm:title val="Cycle"/>');
		expect(data).toContain('loTypeId="urn:pptx-viewer/layout/cycle"');
		expect(drawing.match(/prst="ellipse"/gu)?.length).toBeGreaterThan(0);
	});

	it('round-trips edited DiagramML layout metadata without replacing layout behavior', async () => {
		const { handler, slides, element } = await loadPyramid();
		const definition = element.smartArtData!.layoutDefinition!;
		expect(definition.rootNode).toBeDefined();
		definition.uniqueId = 'urn:test/edited-layout';
		definition.minimumVersion = '16.0';
		definition.titles = [{ language: 'en-AU', value: 'Edited pyramid layout' }];
		definition.rootNode.name = 'editedRoot';
		definition.rootNode.childOrder = 't';
		element.smartArtData!.layoutDefinitionDirty = true;

		const saved = await handler.save(slides);
		const zip = await JSZip.loadAsync(saved);
		const layout = await zip.file('ppt/diagrams/layout4.xml')!.async('string');
		expect(layout).toContain('uniqueId="urn:test/edited-layout"');
		expect(layout).toContain('minVer="16.0"');
		expect(layout).toContain('val="Edited pyramid layout"');
		expect(layout).toContain('name="editedRoot"');
		expect(layout).toContain('chOrder="t"');
		expect(layout).toContain('<dgm:alg');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTripped = reloaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(candidate): candidate is SmartArtPptxElement =>
					candidate.type === 'smartArt' &&
					candidate.smartArtData?.layoutDefinition?.uniqueId === 'urn:test/edited-layout',
			);
		expect(roundTripped?.smartArtData?.layoutDefinition).toMatchObject({
			uniqueId: 'urn:test/edited-layout',
			minimumVersion: '16.0',
			titles: [{ language: 'en-AU', value: 'Edited pyramid layout' }],
			rootNode: { name: 'editedRoot', childOrder: 't' },
		});
	});
});
