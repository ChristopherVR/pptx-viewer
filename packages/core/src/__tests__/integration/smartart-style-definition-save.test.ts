import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { SmartArtPptxElement } from '../../core/types/elements';
import { readCorpusFixture } from './real-world-corpus-helpers';

describe('powerPoint-authored SmartArt definition save', () => {
	it('round-trips typed quick-style edits without replacing the style payload', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(readCorpusFixture('smartart-chart-table-mix.pptx'));
		const element = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(candidate): candidate is SmartArtPptxElement =>
					candidate.type === 'smartArt' && Boolean(candidate.smartArtData?.quickStyle),
			);
		expect(element).toBeDefined();
		const data = element!.smartArtData!;
		const originalLabel = data.quickStyle!.labels?.[0];
		expect(originalLabel).toBeDefined();
		data.quickStyle = {
			...data.quickStyle!,
			titles: [{ value: 'Wave 10 edited style', language: 'en-AU' }],
			labels: [{ name: 'wave10-label' }, ...(data.quickStyle!.labels?.slice(1) ?? [])],
		};
		data.quickStyleDirty = true;

		const zip = await JSZip.loadAsync(await handler.save(loaded.slides));
		const stylePaths = Object.keys(zip.files).filter((path) =>
			/ppt\/diagrams\/quickStyle\d+\.xml/u.test(path),
		);
		const styleParts = await Promise.all(stylePaths.map((path) => zip.file(path)!.async('string')));
		const edited = styleParts.find((xml) => xml.includes('Wave 10 edited style'));
		expect(edited).toContain('lang="en-AU"');
		expect(edited).toContain('name="wave10-label"');
		// PowerPoint-authored shape/effect payload is preserved by the surgical merge.
		expect(edited).toMatch(/<(?:[a-z]+:)?(?:scene3d|sp3d|style)\b/u);
	});

	it('round-trips typed color-definition metadata and retains color choices', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(readCorpusFixture('smartart-chart-table-mix.pptx'));
		const element = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(candidate): candidate is SmartArtPptxElement =>
					candidate.type === 'smartArt' && Boolean(candidate.smartArtData?.colorTransform?.labels),
			);
		expect(element).toBeDefined();
		const data = element!.smartArtData!;
		data.colorTransform = {
			...data.colorTransform!,
			descriptions: [{ value: 'Wave 10 edited colors' }],
			labels: [
				{
					...data.colorTransform!.labels![0],
					name: 'wave10-color-label',
					fill: { method: 'cycle', hueDirection: 'ccw' },
				},
				...data.colorTransform!.labels!.slice(1),
			],
		};
		data.colorTransformDirty = true;

		const zip = await JSZip.loadAsync(await handler.save(loaded.slides));
		const colorPaths = Object.keys(zip.files).filter((path) =>
			/ppt\/diagrams\/colors\d+\.xml/u.test(path),
		);
		const colorParts = await Promise.all(colorPaths.map((path) => zip.file(path)!.async('string')));
		const edited = colorParts.find((xml) => xml.includes('Wave 10 edited colors'));
		expect(edited).toContain('name="wave10-color-label"');
		expect(edited).toContain('meth="cycle"');
		expect(edited).toContain('hueDir="ccw"');
		expect(edited).toMatch(/<a:(?:schemeClr|srgbClr)\b/u);
	});
});
