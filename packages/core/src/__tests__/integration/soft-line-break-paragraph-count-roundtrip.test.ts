import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Core round-trip audit 2026-09-24, item 2: soft line breaks (`a:br`) become
 * paragraph breaks on a dirty save when every run in the body shares one
 * style AND no paragraph in the body authored an `a:pPr`.
 *
 * `preserveParagraphScopedState` (paragraph-scoped-segment-state.ts) used to
 * check `states.every(isEmptyState)` BEFORE checking whether the source
 * segments carried a soft line break, so a body with no per-paragraph state
 * at all (a very common shape: a title placeholder with no explicit `a:pPr`)
 * returned the caller's `baseSegments` (`undefined`, the flat-string path)
 * before ever reaching the soft-break preservation check. The flat string
 * spells a soft break "\n", exactly like a paragraph terminator, so rebuilding
 * from it turned every `a:br` into a new paragraph.
 *
 * Measured on `e2e/fixtures/absolute-path-rels.pptx`: a title shape's single
 * paragraph (`<a:p><a:r>LETTER </a:r><a:br/><a:r>FROM THE GENERATION</a:r></a:p>`,
 * no `a:pPr` anywhere in the body) became two paragraphs on a no-edit dirty
 * save, and the audit's broader corpus run reported 9 paragraphs becoming 11
 * on that fixture.
 */
describe('soft line break survives an untouched, pPr-less body on dirty save', () => {
	it('keeps a:r + a:br + a:r as one paragraph when no a:pPr is authored anywhere', async () => {
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
			<p:sp>
				<p:nvSpPr>
					<p:cNvPr id="5" name="Title 4"/>
					<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
					<p:nvPr><p:ph type="title"/></p:nvPr>
				</p:nvSpPr>
				<p:spPr>
					<a:xfrm><a:off x="1226150" y="596200"/><a:ext cx="4758948" cy="1938529"/></a:xfrm>
				</p:spPr>
				<p:txBody>
					<a:bodyPr/>
					<a:lstStyle/>
					<a:p>
						<a:r><a:rPr lang="en-US" dirty="0"/><a:t>LETTER </a:t></a:r>
						<a:br><a:rPr lang="en-US" dirty="0"/></a:br>
						<a:r><a:rPr lang="en-US" dirty="0"/><a:t>FROM THE GENERATION</a:t></a:r>
					</a:p>
				</p:txBody>
			</p:sp>
		</p:spTree>
	</p:cSld>
</p:sld>`;

		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const baseBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		const loadHandler = new PptxHandler();
		const reloaded = await loadHandler.load(patchedBytes.buffer as ArrayBuffer);
		const title = reloaded.slides[0]!.elements.find((e) => (e.name ?? '') === 'Title 4');
		expect(title, 'title shape was not parsed').toBeDefined();
		expect((title as { text?: string }).text).toBe('LETTER \nFROM THE GENERATION');

		// Force-dirty save without editing the text.
		reloaded.slides[0]!.isDirty = true;
		const savedBytes = await loadHandler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// Still exactly one paragraph, carrying the soft break.
		expect(savedSlideXml.match(/<a:p>/g) || []).toHaveLength(1);
		expect(savedSlideXml).toContain('<a:br');
		expect(savedSlideXml).toContain('FROM THE GENERATION');

		// Re-loading must still read it back as one paragraph with a soft break.
		const handler2 = new PptxHandler();
		const reloaded2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const title2 = reloaded2.slides[0]!.elements.find((e) => (e.name ?? '') === 'Title 4');
		expect((title2 as { text?: string } | undefined)?.text).toBe('LETTER \nFROM THE GENERATION');
	});
});
