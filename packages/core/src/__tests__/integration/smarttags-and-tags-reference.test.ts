/**
 * `p:smartTags` (`CT_SmartTags`, a bare `@r:id` child of `p:presentation`)
 * and `p:tags` (`CT_TagsData`, a bare `@r:id` child of `p:custData` scoping a
 * tags part to one customer-data item) are both just relationship pointers -
 * no content of their own beyond the id.
 *
 * FINDING: this codebase's tags-package support
 * (`src/core/utils/tag-package.ts`) discovers and authors tag PARTS purely by
 * scanning `.rels` files for `Type=".../relationships/tags"` -
 * `discoverTagCollections` never reads a `<p:smartTags>` or `<p:tags>`
 * element, and `writeTagCollections` never writes one either (only the
 * relationship is upserted). A brand-new presentation-owned tag collection
 * therefore round-trips fine through THIS library (the reader doesn't need
 * the element), but produces a package where the relationship exists with no
 * `<p:smartTags r:id="..."/>` referencing it - real PowerPoint's smart-tags
 * feature keys off that element, not a bare relationship, so a collection
 * authored from scratch here would not surface in Word/PowerPoint's own
 * smart-tag UI. An element that was ALREADY authored by a real generator
 * survives because `presentationData` / a slide's parsed XML is mutated in
 * place and re-emitted wholesale, not because anything models the element.
 *
 * Given that, only `preserve` (survives an edit that does not touch it) is
 * promoted; `parse`/`edit`/`serialize` stay unassessed rather than claiming
 * capability that does not exist. See CLAUDE.md task notes / final report
 * for the write-up.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/** The builder emits an empty element as an open/close pair, not self-closed. */
const SMART_TAGS_ELEMENT = '<p:smartTags r:id="rIdSmartTags"></p:smartTags>';
const SMART_TAGS_REL =
	'<Relationship Id="rIdSmartTags" ' +
	'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/smartTags" ' +
	'Target="smartTags/tag1.xml"/>';
const SMART_TAGS_PART =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<p:smartTagLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
	'<p:smartTagType namespaceuri="urn:example" name="Example"/></p:smartTagLst>';

/** A `p:custData` carrying a nested `<p:tags r:id=".."/>` reference, as CT_CustomerData allows. */
const CUST_DATA_WITH_TAGS_REF =
	'<p:custDataLst><p:custData r:id="rIdCustom1"><p:tags r:id="rIdTagsForCustom1"/></p:custData></p:custDataLst>';

async function buildDeckWithSmartTagsAndCustDataTags() {
	const built = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await built.handler.save(built.data.slides);
	const zip = await JSZip.loadAsync(seed);

	zip.file('ppt/smartTags/tag1.xml', SMART_TAGS_PART);

	const relsPath = 'ppt/_rels/presentation.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const patchedRels = relsXml.replace('</Relationships>', `${SMART_TAGS_REL}</Relationships>`);
	expect(patchedRels).not.toBe(relsXml);
	zip.file(relsPath, patchedRels);

	const presentationPath = 'ppt/presentation.xml';
	const presentationXml = await zip.file(presentationPath)!.async('string');
	// Schema order (CT_Presentation): ... sldSz, notesSz, smartTags,
	// embeddedFontLst, custDataLst, ... defaultTextStyle, ...
	const withSmartTags = presentationXml.replace(
		'<p:defaultTextStyle>',
		`${SMART_TAGS_ELEMENT}${CUST_DATA_WITH_TAGS_REF}<p:defaultTextStyle>`,
	);
	expect(withSmartTags).not.toBe(presentationXml);
	zip.file(presentationPath, withSmartTags);

	const patched = await zip.generateAsync({ type: 'uint8array' });
	const handler = new PptxHandler();
	const data = await handler.load(patched.buffer as ArrayBuffer);
	return { handler, data };
}

describe('p:smartTags and p:custData/p:tags reference elements (preserve only)', () => {
	it('preserves an authored <p:smartTags r:id=".."/> through a no-edit round trip', async () => {
		const { handler, data } = await buildDeckWithSmartTagsAndCustDataTags();
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presentationXml).toContain(SMART_TAGS_ELEMENT);
	});

	it('preserves a nested <p:tags r:id=".."/> inside p:custData through a no-edit round trip', async () => {
		const { handler, data } = await buildDeckWithSmartTagsAndCustDataTags();
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presentationXml).toContain('<p:tags r:id="rIdTagsForCustom1"></p:tags>');
	});

	it('does not author a <p:smartTags> element for a brand-new presentation-owned tag collection (gap)', async () => {
		// This documents the finding above with a real assertion rather than
		// just prose: creating a tag collection through the public `tags` save
		// option produces a relationship with no owning element pointing at it.
		const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
		const saved = await handler.save(data.slides, {
			tags: [{ tags: [{ name: 'DECK_ID', value: 'abc-123' }] }],
		});
		const zip = await JSZip.loadAsync(saved);
		const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');

		expect(rels).toContain(
			'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags"',
		);
		expect(presentationXml).not.toContain('<p:smartTags');
	});
});
