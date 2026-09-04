import { describe, it, expect } from 'vitest';

import type { PptxPresentationProperties, XmlObject } from '../../types';
import { hasShowPropertyEdits, rebuildShowProperties } from './pptx-show-properties';

function browseOf(result: XmlObject | undefined): XmlObject {
	return (result?.['p:browse'] ?? {}) as XmlObject;
}

describe('hasShowPropertyEdits', () => {
	it('returns false for an empty properties object', () => {
		expect(hasShowPropertyEdits({})).toBeFalsy();
	});

	it('returns true when showScrollbar is set (P1-G1)', () => {
		expect(hasShowPropertyEdits({ showScrollbar: false })).toBeTruthy();
	});

	it('returns true when penColor is set', () => {
		expect(hasShowPropertyEdits({ penColor: '#FF0000' })).toBeTruthy();
	});
});

describe('rebuildShowProperties - p:browse/@showScrollbar (P1-G1)', () => {
	it('returns undefined for a plain load-save with no p:showPr and no edits', () => {
		expect(rebuildShowProperties(undefined, {})).toBeUndefined();
	});

	it('carries the typed showScrollbar onto a freshly-constructed p:browse', () => {
		const result = rebuildShowProperties(undefined, {
			showType: 'browsed',
			showScrollbar: false,
		});
		expect(browseOf(result)['@_showScrollbar']).toBe('0');
	});

	it('emits "1" for an explicit true', () => {
		const result = rebuildShowProperties(undefined, { showType: 'browsed', showScrollbar: true });
		expect(browseOf(result)['@_showScrollbar']).toBe('1');
	});

	it(
		'preserves the existing showScrollbar="0" when an UNRELATED show field is edited ' +
			'(regression: this used to silently drop it via an unconditional `p:browse = {}`)',
		() => {
			const existingShowPr: XmlObject = {
				'@_showNarration': '1',
				'p:browse': { '@_showScrollbar': '0' },
				'p:sldAll': {},
			};
			const properties: PptxPresentationProperties = {
				showType: 'browsed',
				loopContinuously: true,
			};
			const result = rebuildShowProperties(existingShowPr, properties);
			expect(browseOf(result)['@_showScrollbar']).toBe('0');
		},
	);

	it('omits the attribute (schema default true applies) when neither the caller nor the source authored it', () => {
		const result = rebuildShowProperties(
			{ 'p:browse': {} },
			{ showType: 'browsed', loopContinuously: true },
		);
		expect(browseOf(result)['@_showScrollbar']).toBeUndefined();
	});

	it('lets an explicit typed override win over the existing attribute', () => {
		const existingShowPr: XmlObject = { 'p:browse': { '@_showScrollbar': '0' } };
		const result = rebuildShowProperties(existingShowPr, {
			showType: 'browsed',
			showScrollbar: true,
		});
		expect(browseOf(result)['@_showScrollbar']).toBe('1');
	});
});

describe('rebuildShowProperties - p:penClr (P1-G2)', () => {
	it('re-emits the original scheme colour XML verbatim when penColor is unchanged from parse', () => {
		const originalPenClr: XmlObject = { 'a:schemeClr': { '@_val': 'accent2' } };
		const properties: PptxPresentationProperties = {
			loopContinuously: true,
			penColor: '#123456',
			penColorOriginal: '#123456',
			penColorXml: originalPenClr,
		};
		const result = rebuildShowProperties({}, properties);
		expect(result?.['p:penClr']).toBe(originalPenClr);
	});

	it('rebuilds a fresh a:srgbClr when the pen colour was actually edited', () => {
		const originalPenClr: XmlObject = { 'a:schemeClr': { '@_val': 'accent2' } };
		const properties: PptxPresentationProperties = {
			loopContinuously: true,
			penColor: '#FF0000',
			penColorOriginal: '#123456',
			penColorXml: originalPenClr,
		};
		const result = rebuildShowProperties({}, properties);
		expect(result?.['p:penClr']).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
	});

	it('rebuilds a fresh a:srgbClr when there is no preserved original (API-authored colour)', () => {
		const result = rebuildShowProperties({}, { loopContinuously: true, penColor: '#00FF00' });
		expect(result?.['p:penClr']).toStrictEqual({ 'a:srgbClr': { '@_val': '00FF00' } });
	});
});
