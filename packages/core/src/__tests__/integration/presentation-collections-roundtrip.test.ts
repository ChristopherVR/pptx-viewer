import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

describe('presentation collections round-trip', () => {
	it('creates, loads, edits, and clears custom shows and sections', async () => {
		const created = await PresentationBuilder.create();
		created.data.slides.push(created.createSlide('Blank').addText('One').build());
		const baseBytes = await created.handler.save(created.data.slides);
		const baseZip = await JSZip.loadAsync(baseBytes);
		const basePresentation = await baseZip.file('ppt/presentation.xml')!.async('string');
		const slideMatch = basePresentation.match(/<p:sldId\s+id="([^"]+)"\s+r:id="([^"]+)"/);
		expect(slideMatch).not.toBeNull();
		const [, slideId, slideRId] = slideMatch!;

		const handler = new PptxHandler();
		const data = await handler.load(baseBytes.buffer as ArrayBuffer);
		const editedBytes = await handler.save(data.slides, {
			customShows: [{ id: '3', name: 'Highlights', slideRIds: [slideRId] }],
			sections: [
				{
					id: '{11111111-1111-1111-1111-111111111111}',
					name: 'Opening',
					slideIds: [slideId],
					collapsed: false,
					color: '#336699',
				},
			],
		});

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(editedBytes.buffer as ArrayBuffer);
		expect(reloaded.customShows).toMatchObject([
			{ id: '3', name: 'Highlights', slideRIds: [slideRId] },
		]);
		expect(reloaded.sections).toMatchObject([
			{
				id: '{11111111-1111-1111-1111-111111111111}',
				name: 'Opening',
				slideIds: [slideId],
				collapsed: false,
				color: '#336699',
			},
		]);

		const clearedBytes = await reloader.save(reloaded.slides, { customShows: [], sections: [] });
		const clearedZip = await JSZip.loadAsync(clearedBytes);
		const clearedXml = await clearedZip.file('ppt/presentation.xml')!.async('string');
		expect(clearedXml).not.toContain('custShowLst');
		expect(clearedXml).not.toContain('sectionLst');
	});
});
