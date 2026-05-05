import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Phase 3 Stream B — CH-H4 regression test.
 *
 * Before the fix:
 *   - `processSlideElement` had no `case 'contentPart'` branch.  The
 *     parsed `ContentPartPptxElement` carried a `<p:contentPart>`-shaped
 *     `rawXml` but `isGraphicFrameShape` returns false for it (no
 *     `p:nvGraphicFramePr` / `a:graphic`), so the node landed in
 *     `collectors.shapes`.
 *   - The slide writer then assigned `spTree['p:sp'] = collectors.shapes`,
 *     emitting `<p:sp><p:contentPart …/></p:sp>` — schema-invalid output
 *     that triggers PowerPoint's file-repair dialog.
 *
 * After the fix the contentPart is routed through a dedicated
 * `collectors.contentParts` slot and emitted as a direct child of
 * `<p:spTree>` per CT_GroupShape (§19.3.1.42).
 */
describe('p:contentPart save round-trip (CH-H4)', () => {
	it('round-trips contentPart as a direct child of spTree (not inside p:sp)', async () => {
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr>
				<p:cNvPr id="1" name=""/>
				<p:cNvGrpSpPr/>
				<p:nvPr/>
			</p:nvGrpSpPr>
			<p:grpSpPr>
				<a:xfrm>
					<a:off x="0" y="0"/>
					<a:ext cx="0" cy="0"/>
					<a:chOff x="0" y="0"/>
					<a:chExt cx="0" cy="0"/>
				</a:xfrm>
			</p:grpSpPr>
			<p:contentPart r:id="rId2">
				<p:nvContentPartPr>
					<p:cNvPr id="2" name="Ink content part"/>
					<p:cNvContentPartPr/>
					<p:nvPr/>
				</p:nvContentPartPr>
				<p:xfrm>
					<a:off x="914400" y="914400"/>
					<a:ext cx="1828800" cy="914400"/>
				</p:xfrm>
			</p:contentPart>
		</p:spTree>
	</p:cSld>
</p:sld>`;
		const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../ink/ink1.xml"/>
</Relationships>`;

		const {
			handler: srcHandler,
			data: srcData,
			createSlide: srcCreateSlide,
		} = await PresentationBuilder.create();
		srcData.slides.push(srcCreateSlide('Blank').build());
		const baseBytes = await srcHandler.save(srcData.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsXml);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		// Load and confirm the contentPart is recognised.
		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
		const cpEl = reloaded.slides[0].elements.find((e) => e.type === 'contentPart');
		expect(cpEl, 'contentPart was not parsed').toBeDefined();
		expect(cpEl!.rawXml).toBeDefined();

		// Force-dirty save and inspect the raw XML.
		reloaded.slides[0].isDirty = true;
		const savedBytes = await handler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// `<p:contentPart>` MUST appear as a direct child of `<p:spTree>`.
		expect(savedSlideXml).toContain('<p:contentPart');

		// `<p:contentPart>` MUST NOT be nested inside a `<p:sp>` wrapper.
		// Strip whitespace between tags before scanning so cosmetic
		// formatting does not let an erroneous nesting slip past.
		const minified = savedSlideXml.replace(/>\s+</g, '><');
		expect(minified).not.toMatch(/<p:sp[\s>][^]*?<p:contentPart/);

		// And reloading it gives us the contentPart again — no parse failure.
		const handler2 = new PptxHandler();
		const reloaded2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const cpEl2 = reloaded2.slides[0].elements.find((e) => e.type === 'contentPart');
		expect(cpEl2, 'contentPart did not survive round-trip').toBeDefined();
	});
});
