import { describe, expect, it } from 'vitest';

import {
	parsePrintProperties,
	serializePrintProperties,
	setPresentationPropertiesChild,
	slidesPerPageToPrintOutput,
} from './pptx-print-properties';

describe('presentationML print properties', () => {
	it('parses every CT_PrintProperties attribute and XML boolean spelling', () => {
		const raw = {
			'@_prnWhat': 'handouts6',
			'@_clrMode': 'gray',
			'@_hiddenSlides': 'true',
			'@_scaleToFitPaper': '0',
			'@_frameSlides': '1',
		};

		expect(parsePrintProperties(raw)).toStrictEqual({
			printWhat: 'handouts6',
			colorMode: 'gray',
			hiddenSlides: true,
			scaleToFitPaper: false,
			frameSlides: true,
			rawXml: raw,
		});
	});

	it('ignores invalid typed values while retaining their raw attributes', () => {
		const raw = { '@_prnWhat': 'poster', '@_clrMode': 'sepia', '@_hiddenSlides': 'maybe' };
		const parsed = parsePrintProperties(raw);

		expect(parsed.printWhat).toBeUndefined();
		expect(parsed.colorMode).toBeUndefined();
		expect(parsed.hiddenSlides).toBeUndefined();
		expect(serializePrintProperties(parsed)).toStrictEqual(raw);
	});

	it('edits and removes known attributes while preserving unknown data and extLst', () => {
		const raw = {
			'@_prnWhat': 'slides',
			'@_vendor:keep': 'yes',
			'p14:future': { '@_val': 'kept' },
			'x:extLst': { 'x:ext': { '@_uri': 'urn:test' } },
		};
		const serialized = serializePrintProperties({
			rawXml: raw,
			printWhat: 'notes',
			colorMode: 'bw',
			hiddenSlides: false,
			scaleToFitPaper: true,
			frameSlides: null,
		});

		expect(serialized).toStrictEqual({
			'@_prnWhat': 'notes',
			'@_vendor:keep': 'yes',
			'@_clrMode': 'bw',
			'@_hiddenSlides': '0',
			'@_scaleToFitPaper': '1',
			'p14:future': { '@_val': 'kept' },
			'x:extLst': { 'x:ext': { '@_uri': 'urn:test' } },
		});
	});

	it('rejects invalid runtime enum values and handout counts', () => {
		expect(() => serializePrintProperties({ printWhat: 'poster' as 'slides' })).toThrow(
			'Invalid PresentationML print output',
		);
		expect(() => serializePrintProperties({ colorMode: 'sepia' as 'clr' })).toThrow(
			'Invalid PresentationML print color mode',
		);
		expect(() => slidesPerPageToPrintOutput(5)).toThrow('1, 2, 3, 4, 6, or 9');
	});

	it('inserts and removes prnPr in CT_PresentationProperties schema order', () => {
		const root = {
			'@_xmlns:q': 'urn:p',
			'q:showPr': {},
			'q:extLst': {},
			'q:webPr': {},
		};
		const inserted = setPresentationPropertiesChild(root, 'prnPr', { '@_prnWhat': 'slides' });

		expect(Object.keys(inserted)).toStrictEqual([
			'@_xmlns:q',
			'q:webPr',
			'p:prnPr',
			'q:showPr',
			'q:extLst',
		]);
		expect(Object.keys(setPresentationPropertiesChild(inserted, 'prnPr', null))).not.toContain(
			'p:prnPr',
		);
	});
});
