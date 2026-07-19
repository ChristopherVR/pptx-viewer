import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A representative `ppt/viewProps.xml` part: root-level `lastView` /
 * `showComments`, a normal-view splitter block, and a slide view with an
 * 80% zoom scale.
 */
const VIEW_PROPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" lastView="sldView" showComments="0">
	<p:normalViewPr showOutlineIcons="1">
		<p:restoredLeft sz="15620"/>
		<p:restoredTop sz="94660"/>
	</p:normalViewPr>
	<p:slideViewPr>
		<p:cSldViewPr snapToGrid="0" snapToObjects="1" showGuides="1">
			<p:cViewPr varScale="1">
				<p:scale>
					<a:sx n="80" d="100"/>
					<a:sy n="80" d="100"/>
				</p:scale>
				<p:origin x="-1452" y="-90"/>
			</p:cViewPr>
		</p:cSldViewPr>
	</p:slideViewPr>
	<p:gridSpacing cx="76200" cy="76200"/>
</p:viewPr>`;

/** Build a minimal PPTX buffer that carries a `ppt/viewProps.xml` part. */
async function createPptxWithViewProps(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank').addText('Test slide', { x: 50, y: 50, width: 400, height: 50 }).build(),
	);
	const bytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(bytes);
	zip.file('ppt/viewProps.xml', VIEW_PROPS_XML);

	// Register the part in presentation.xml.rels so the save-side path
	// resolution finds it via the relationship (not just the fallback).
	const relsPath = 'ppt/_rels/presentation.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const relId = `rId${Date.now() % 100000}`;
	const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>`;
	zip.file(relsPath, relsXml.replace('</Relationships>', `${rel}</Relationships>`));

	// Content-type override, as a real PowerPoint package would carry.
	const ctXml = await zip.file('[Content_Types].xml')!.async('string');
	const override = `<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>`;
	zip.file('[Content_Types].xml', ctXml.replace('</Types>', `${override}</Types>`));

	return zip.generateAsync({ type: 'arraybuffer' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('view properties round-trip (issue #90)', () => {
	it('populates data.viewProperties on load', async () => {
		const buf = await createPptxWithViewProps();

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		expect(data.viewProperties).toBeDefined();
		expect(data.viewProperties!.lastView).toBe('sldView');
		// showComments="0" -> false
		expect(data.viewProperties!.showComments).toBeFalsy();
		expect(data.viewProperties!.normalViewPr?.showOutlineIcons).toBeTruthy();
		// 80% zoom scale on the slide view.
		expect(data.viewProperties!.slideViewPr?.scale).toStrictEqual({ n: 80, d: 100 });
		expect(data.viewProperties!.slideViewPr?.snapToGrid).toBeFalsy();
		expect(data.viewProperties!.gridSpacing).toStrictEqual({ cx: 76200, cy: 76200 });
	});

	it('round-trips the typed model on an unmodified load -> save', async () => {
		const buf = await createPptxWithViewProps();

		const handler = new PptxHandler();
		const data = await handler.load(buf);
		expect(data.viewProperties).toBeDefined();

		// Save without passing any viewProperties override — the loaded model
		// must be re-emitted by default.
		const savedBytes = await handler.save(data.slides);

		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);

		expect(data2.viewProperties).toBeDefined();
		expect(data2.viewProperties!.lastView).toBe('sldView');
		expect(data2.viewProperties!.showComments).toBeFalsy();
		expect(data2.viewProperties!.slideViewPr?.scale).toStrictEqual({ n: 80, d: 100 });
		expect(data2.viewProperties!.gridSpacing).toStrictEqual({ cx: 76200, cy: 76200 });

		// The part must still be present in the output package.
		const zip = await JSZip.loadAsync(savedBytes);
		expect(zip.file('ppt/viewProps.xml')).not.toBeNull();
	});

	it('persists an edit to viewProperties passed via save options', async () => {
		const buf = await createPptxWithViewProps();

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		const edited = { ...data.viewProperties!, showComments: true };
		const savedBytes = await handler.save(data.slides, { viewProperties: edited });

		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);

		expect(data2.viewProperties!.showComments).toBeTruthy();
	});
});
