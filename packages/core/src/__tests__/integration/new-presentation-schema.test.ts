import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';

/**
 * Regression tests for the blank-presentation template in PresentationBuilder.
 *
 * These exercise package-level invariants that PowerPoint's OPC loader enforces
 * *before* OOXML schema validation runs, so violations show up as the
 * "file is corrupted, repair?" dialog with HRESULT 0x80070570 rather than as
 * DocumentFormat.OpenXml validator errors.
 */
describe('new-presentation template schema conformance', () => {
	it('title Slide layout uses type="title" (ST_SlideLayoutType) not "ctrTitle"', async () => {
		// `ctrTitle` is a placeholder type (ST_PlaceholderType), not a slide-
		// layout type. Emitting it on <p:sldLayout type="…"> makes PowerPoint
		// reject the entire package with ERROR_FILE_CORRUPT.
		const { handler, data } = await PresentationBuilder.create();
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);

		const layoutXml = await zip.file('ppt/slideLayouts/slideLayout1.xml')!.async('string');
		const typeMatch = layoutXml.match(/<p:sldLayout\b[^>]*\btype="([^"]*)"/);
		expect(typeMatch, '<p:sldLayout type="…"> must be present').not.toBeNull();
		expect(typeMatch![1]).toBe('title');
		expect(typeMatch![1]).not.toBe('ctrTitle');
	});

	it('presentation.xml emits <p:sldIdLst> before <p:sldSz> (CT_Presentation child order)', async () => {
		// PowerPoint silently drops the slide list when it appears out of
		// schema order — the file opens without a repair dialog but shows
		// zero slides. Previously the reconciler assigned p:sldIdLst onto
		// a presentation object that didn't already have the key (because
		// the blank template omits it for empty decks), which pushed it
		// past every other child.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText('hello', { x: 10, y: 10, width: 200, height: 50 }).build(),
		);
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const presXml = await zip.file('ppt/presentation.xml')!.async('string');

		const idx = (tag: string) => presXml.indexOf(`<${tag}`);
		const sldMasterIdx = idx('p:sldMasterIdLst');
		const sldIdLstIdx = idx('p:sldIdLst');
		const sldSzIdx = idx('p:sldSz');
		const defaultTextStyleIdx = idx('p:defaultTextStyle');

		expect(sldMasterIdx).toBeGreaterThanOrEqual(0);
		expect(sldIdLstIdx).toBeGreaterThan(sldMasterIdx);
		expect(sldSzIdx).toBeGreaterThan(sldIdLstIdx);
		if (defaultTextStyleIdx >= 0) {
			expect(defaultTextStyleIdx).toBeGreaterThan(sldIdLstIdx);
		}
	});

	it('docProps/app.xml Override uses the openxmlformats namespace', async () => {
		// The `application/vnd.ms-officedocument.extended-properties+xml` token
		// is not a real content type — the correct one uses the
		// `openxmlformats-officedocument` prefix. The ms-* form produces a
		// dangling content-type reference that some OPC loaders reject.
		const { handler, data } = await PresentationBuilder.create();
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const ct = await zip.file('[Content_Types].xml')!.async('string');

		expect(ct).not.toContain('application/vnd.ms-officedocument.extended-properties+xml');
		expect(ct).toContain('application/vnd.openxmlformats-officedocument.extended-properties+xml');
	});
});
