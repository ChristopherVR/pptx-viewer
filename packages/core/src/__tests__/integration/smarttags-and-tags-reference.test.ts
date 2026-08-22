/**
 * Two different `@r:id` reference elements share the "smart tags" name in
 * casual usage, but are unrelated OOXML constructs:
 *
 * - `p:smartTags` (`CT_SmartTags`) is a direct child of `p:presentation`
 *   pointing at a smart-tag RECOGNIZER part (`p:smartTagLst`/`p:smartTagType`,
 *   the old Office "smart tags" feature). This codebase has no data model for
 *   authoring recognizer parts at all, so there is no way to create one
 *   through the public API; it is genuinely out of scope, not merely
 *   untested. An element already authored by a real generator survives a
 *   no-edit save because the owning part's XML is mutated in place and
 *   re-emitted wholesale.
 * - `p:tags` (`CT_TagsData`) is a child of `p:custDataLst`
 *   (`CT_CustomerDataList`, itself a child of `p:presentation` or a
 *   `p:cSld`-bearing part) pointing at a user-defined tags part
 *   (`p:tagLst`/`p:tag`, name/value pairs). THIS is what the public `tags`
 *   save option authors, and `src/core/utils/tag-package.ts` /
 *   `tag-package-owning-element.ts` now write the owning `<p:tags r:id=".."/>`
 *   element alongside the relationship (previously it authored only the
 *   relationship, an authoring gap fixed alongside this test - see
 *   `tag-part-authoring.test.ts` for the structural-correctness coverage).
 *
 * This file keeps the raw round-trip/preserve evidence for both constructs
 * and one negative assertion proving `p:smartTags` really is untouched.
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

/** `p:tags` is a SIBLING of `p:custData` inside `p:custDataLst` (CT_CustomerDataList), not nested. */
const CUST_DATA_WITH_TAGS_REF =
	'<p:custDataLst><p:custData r:id="rIdCustom1"/><p:tags r:id="rIdTagsForCustom1"/></p:custDataLst>';

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

describe('p:smartTags (preserve only) and p:custDataLst/p:tags (authored) reference elements', () => {
	it('preserves an authored <p:smartTags r:id=".."/> through a no-edit round trip', async () => {
		const { handler, data } = await buildDeckWithSmartTagsAndCustDataTags();
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presentationXml).toContain(SMART_TAGS_ELEMENT);
	});

	it('preserves a <p:tags r:id=".."/> sibling of p:custData inside p:custDataLst through a no-edit round trip', async () => {
		const { handler, data } = await buildDeckWithSmartTagsAndCustDataTags();
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presentationXml).toContain('<p:tags r:id="rIdTagsForCustom1"></p:tags>');
	});

	it('authors a <p:tags r:id=".."/> element matching the relationship for a brand-new presentation-owned tag collection (gap fixed)', async () => {
		// A brand-new tag collection authored through the public `tags` save
		// option now gets an owning element pointing at its relationship, not
		// just the relationship on its own. `p:smartTags` (the unrelated
		// recognizer-part element) is never authored, since nothing here models
		// recognizer content.
		const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
		const saved = await handler.save(data.slides, {
			tags: [{ tags: [{ name: 'DECK_ID', value: 'abc-123' }] }],
		});
		const zip = await JSZip.loadAsync(saved);
		const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');

		const relMatch = rels.match(
			/<Relationship Id="(rId\d+)" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/tags"/u,
		);
		expect(relMatch).toBeTruthy();
		expect(presentationXml).toContain(`<p:tags r:id="${relMatch![1]}"></p:tags>`);
		expect(presentationXml).not.toContain('<p:smartTags');
	});
});
