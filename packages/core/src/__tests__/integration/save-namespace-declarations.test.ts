/**
 * Regression: a re-serialized slide wrote `<adec:decorative>` (Mark as
 * decorative) without declaring `xmlns:adec`, so PowerPoint refused the saved
 * package outright ("The file or directory is corrupted and unreadable").
 * The builder now declares every used, known prefix on the part root.
 */
import { describe, expect, it } from 'vitest';

import { declareUsedNamespaces } from '../../core/utils/xml-namespace-declarations';
import { markAllDirty, partText, roundTrip, undeclaredPrefixes } from './save-fidelity-harness';

describe('save declares every namespace prefix it uses', () => {
	it('declares adec on a re-serialized slide carrying decorative pictures', async () => {
		const { saved } = await roundTrip('accessibility-images.pptx', { mutate: markAllDirty });
		const slide = await partText(saved, 'ppt/slides/slide1.xml');
		expect(slide).toContain('adec:decorative');
		expect(slide).toContain(
			'xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative"',
		);
		await expect(undeclaredPrefixes(saved)).resolves.toStrictEqual([]);
	});

	it('leaves already well-formed output untouched', () => {
		const xml = '<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:x a:y="1"/></p:sld>';
		expect(declareUsedNamespaces(xml)).toBe(xml);
	});

	it('reuses a leaf-level declaration for an out-of-scope sibling', () => {
		const xml =
			'<p:sld xmlns:p="urn:p"><p:a><ahyp:c xmlns:ahyp="urn:custom"/></p:a><ahyp:c/></p:sld>';
		expect(declareUsedNamespaces(xml)).toBe(
			'<p:sld xmlns:ahyp="urn:custom" xmlns:p="urn:p"><p:a><ahyp:c xmlns:ahyp="urn:custom"/></p:a><ahyp:c/></p:sld>',
		);
	});
});
