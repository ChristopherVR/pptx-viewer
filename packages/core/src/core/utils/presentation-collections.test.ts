import { describe, expect, it } from 'vitest';

import { buildSlideReferenceRemap } from '../core/builders/slide-reference-remap';
import { PptxXmlLookupService } from '../services';
import type { PptxSlide, XmlObject } from '../types';
import { applyCustomShows, applySections, parseCustomShows } from './presentation-collections';

const lookup = new PptxXmlLookupService();

function slide(id: string, rId: string, slideNumber: number): PptxSlide {
	return { id, rId, slideNumber, elements: [] };
}

describe('presentation collections', () => {
	it('parses custom shows by local name and retains their raw XML', () => {
		const data: XmlObject = {
			'x:presentation': {
				'x:custShowLst': {
					'x:custShow': {
						'@_name': 'Demo',
						'@_id': '7',
						'@_vendor:flag': 'keep',
						'x:sldLst': { 'x:sld': [{ '@_rel:id': 'rId2' }, { '@_rel:id': 'rId4' }] },
						'x:extLst': { 'x:ext': { '@_uri': 'vendor' } },
					},
				},
			},
		};
		const shows = parseCustomShows(data, lookup);
		expect(shows?.[0]).toMatchObject({ name: 'Demo', id: '7', slideRIds: ['rId2', 'rId4'] });
		expect(shows?.[0].rawXml?.['@_vendor:flag']).toBe('keep');
	});

	it('edits custom shows while preserving list, show, and slide extension data', () => {
		const presentation: XmlObject = {
			'x:custShowLst': {
				'@_vendor:list': 'keep',
				'x:custShow': {
					'@_name': 'Old',
					'@_id': '1',
					'@_vendor:show': 'keep',
					'x:sldLst': {
						'@_vendor:slides': 'keep',
						'x:sld': { '@_rel:id': 'rId2', '@_vendor:slide': 'keep' },
					},
				},
			},
		};
		applyCustomShows(presentation, [{ name: 'New', id: '1', slideRIds: ['rId2', 'rId3'] }], lookup);
		const list = presentation['x:custShowLst'] as XmlObject;
		const show = (list['x:custShow'] as XmlObject[])[0];
		expect(list['@_vendor:list']).toBe('keep');
		expect(show).toMatchObject({ '@_name': 'New', '@_vendor:show': 'keep' });
		const slideList = show['x:sldLst'] as XmlObject;
		expect(slideList['@_vendor:slides']).toBe('keep');
		expect((slideList['x:sld'] as XmlObject[])[0]['@_vendor:slide']).toBe('keep');
	});

	it('clears custom shows only when an empty edit is explicitly supplied', () => {
		const presentation: XmlObject = { 'p:custShowLst': { 'p:custShow': {} } };
		applyCustomShows(presentation, undefined, lookup);
		expect(presentation['p:custShowLst']).toBeDefined();
		applyCustomShows(presentation, [], lookup);
		expect(presentation['p:custShowLst']).toBeUndefined();
	});

	it('creates the standard section extension and preserves raw section markup', () => {
		const presentation: XmlObject = { 'p:sldSz': {}, 'p:extLst': { 'p:ext': [] } };
		applySections(
			presentation,
			[
				{
					id: '{A}',
					name: 'Intro',
					slideIds: ['256'],
					collapsed: false,
					color: '#AABBCC',
					rawXml: { '@_vendor:data': 'keep', 'v:extLst': { 'v:ext': {} } },
				},
			],
			lookup,
		);
		const extList = presentation['p:extLst'] as XmlObject;
		const ext = (extList['p:ext'] as XmlObject[])[0];
		expect(ext['@_uri']).toBe('{521415D9-36F7-43E2-AB2F-B90AF26B5E84}');
		const list = ext['p14:sectionLst'] as XmlObject;
		const section = (list['p14:section'] as XmlObject[])[0];
		expect(section['@_vendor:data']).toBe('keep');
		expect(section['v:extLst']).toBeDefined();
		expect(section['p15:sectionPr']).toMatchObject({ '@_collapsed': '0', '@_clr': 'AABBCC' });
	});

	it('clears an existing namespace-aliased section list', () => {
		const presentation: XmlObject = {
			'p:extLst': { 'p:ext': { '@_uri': 'sections', 'x:sectionLst': { 'x:section': {} } } },
		};
		applySections(presentation, [], lookup);
		const ext = (presentation['p:extLst'] as XmlObject)['p:ext'] as XmlObject;
		expect(ext['x:sectionLst']).toBeUndefined();
		expect(ext['@_uri']).toBe('sections');
	});

	// Issue #96: reordering/removing slides can drop a slide and reassign the
	// rId / numeric id of the survivors. Custom-show and section references must
	// follow the reconciled ids and must not dangle at the removed slide.
	it('remaps and drops custom-show / section references for a removed reordered slide', () => {
		// slide2 (rId3 / sldId 257) is removed; slide3 is reassigned rId4->rId9
		// and numeric 258->259; slide1 is unchanged.
		const remap = buildSlideReferenceRemap({
			slides: [
				slide('ppt/slides/slide1.xml', 'rId2', 1),
				slide('ppt/slides/slide3.xml', 'rId9', 2),
			],
			originalRIdToPath: new Map([
				['rId2', 'ppt/slides/slide1.xml'],
				['rId3', 'ppt/slides/slide2.xml'],
				['rId4', 'ppt/slides/slide3.xml'],
			]),
			originalSldIdToPath: new Map([
				['256', 'ppt/slides/slide1.xml'],
				['257', 'ppt/slides/slide2.xml'],
				['258', 'ppt/slides/slide3.xml'],
			]),
			rebuiltSlideIds: [
				{ '@_id': '256', '@_r:id': 'rId2' },
				{ '@_id': '259', '@_r:id': 'rId9' },
			],
		});

		expect(remap.changed).toBeTruthy();
		expect(remap.removedRIds.has('rId3')).toBeTruthy();
		expect(remap.removedSldIds.has('257')).toBeTruthy();
		expect(remap.rIdByOldRId.get('rId4')).toBe('rId9');
		expect(remap.sldIdByOldSldId.get('258')).toBe('259');

		const presentation: XmlObject = {};
		applyCustomShows(
			presentation,
			[{ name: 'Show', id: '1', slideRIds: ['rId2', 'rId3', 'rId4'] }],
			lookup,
			remap,
		);
		const show = ((presentation['p:custShowLst'] as XmlObject)['p:custShow'] as XmlObject[])[0];
		const showSlides = (show['p:sldLst'] as XmlObject)['p:sld'] as XmlObject[];
		expect(showSlides.map((entry) => entry['@_r:id'])).toStrictEqual(['rId2', 'rId9']);

		const sectionHost: XmlObject = { 'p:sldSz': {}, 'p:extLst': { 'p:ext': [] } };
		applySections(
			sectionHost,
			[{ id: '{S}', name: 'Sec', slideIds: ['256', '257', '258'] }],
			lookup,
			remap,
		);
		const ext = ((sectionHost['p:extLst'] as XmlObject)['p:ext'] as XmlObject[])[0];
		const section = ((ext['p14:sectionLst'] as XmlObject)['p14:section'] as XmlObject[])[0];
		const sectionSlides = (section['p14:sldIdLst'] as XmlObject)['p14:sldId'] as XmlObject[];
		expect(sectionSlides.map((entry) => entry['@_id'])).toStrictEqual(['256', '259']);
	});

	it('leaves references untouched for an unmodified round-trip (changed=false)', () => {
		const remap = buildSlideReferenceRemap({
			slides: [
				slide('ppt/slides/slide1.xml', 'rId2', 1),
				slide('ppt/slides/slide2.xml', 'rId3', 2),
			],
			originalRIdToPath: new Map([
				['rId2', 'ppt/slides/slide1.xml'],
				['rId3', 'ppt/slides/slide2.xml'],
			]),
			originalSldIdToPath: new Map([
				['256', 'ppt/slides/slide1.xml'],
				['257', 'ppt/slides/slide2.xml'],
			]),
			rebuiltSlideIds: [
				{ '@_id': '256', '@_r:id': 'rId2' },
				{ '@_id': '257', '@_r:id': 'rId3' },
			],
		});
		expect(remap.changed).toBeFalsy();

		const presentation: XmlObject = {};
		applyCustomShows(
			presentation,
			[{ name: 'Show', id: '1', slideRIds: ['rId2', 'rId3'] }],
			lookup,
			remap,
		);
		const show = ((presentation['p:custShowLst'] as XmlObject)['p:custShow'] as XmlObject[])[0];
		const showSlides = (show['p:sldLst'] as XmlObject)['p:sld'] as XmlObject[];
		expect(showSlides.map((entry) => entry['@_r:id'])).toStrictEqual(['rId2', 'rId3']);
	});
});
