import { describe, it, expect } from 'vitest';

import type { PptxSlide, ShapePptxElement, XmlObject } from '../../types';
import {
	applyShapeIdMapToSlide,
	hasStructuralIdDefects,
	prescanStructuralPart,
	spTreeOfPartRoot,
	structuralPartRootTag,
} from './save-structural-id-gate';

const ensureArray = (value: unknown): unknown[] => {
	if (Array.isArray(value)) {
		return value;
	}
	return value === undefined || value === null ? [] : [value];
};

describe('structuralPartRootTag', () => {
	it('maps every covered part folder to its root tag and nothing else', () => {
		expect(structuralPartRootTag('ppt/slides/slide1.xml')).toBe('p:sld');
		expect(structuralPartRootTag('ppt/slideLayouts/slideLayout2.xml')).toBe('p:sldLayout');
		expect(structuralPartRootTag('ppt/slideMasters/slideMaster1.xml')).toBe('p:sldMaster');
		expect(structuralPartRootTag('ppt/notesSlides/notesSlide1.xml')).toBe('p:notes');
		expect(structuralPartRootTag('ppt/notesMasters/notesMaster1.xml')).toBe('p:notesMaster');
		expect(structuralPartRootTag('ppt/handoutMasters/handoutMaster1.xml')).toBe('p:handoutMaster');
		expect(structuralPartRootTag('ppt/slides/_rels/slide1.xml.rels')).toBeUndefined();
		expect(structuralPartRootTag('ppt/presentation.xml')).toBeUndefined();
		expect(structuralPartRootTag('ppt/charts/chart1.xml')).toBeUndefined();
	});
});

describe('prescanStructuralPart', () => {
	it('passes a part whose ids are unique UInt32s and whose placeholders are canonical', () => {
		const xml =
			'<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr>' +
			'<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr></p:sp>' +
			'</p:spTree></p:cSld></p:sld>';
		expect(prescanStructuralPart(xml)).toStrictEqual({
			suspectIds: false,
			placeholderCasing: false,
		});
	});

	it('flags an out-of-range id, a repeated id and a mis-cased placeholder type', () => {
		expect(prescanStructuralPart('<p:cNvPr id="4294967296" name="x"/>').suspectIds).toBeTruthy();
		expect(
			prescanStructuralPart('<p:cNvPr id="2"/><p:cNvPr name="x" id="2"/>').suspectIds,
		).toBeTruthy();
		expect(prescanStructuralPart("<p14:cNvPr id='abc'/>").suspectIds).toBeTruthy();
		expect(prescanStructuralPart('<p:ph type="ctrtitle"/>').placeholderCasing).toBeTruthy();
		expect(prescanStructuralPart('<p:ph idx="1" type="sldnum"/>').placeholderCasing).toBeTruthy();
		expect(prescanStructuralPart('<p:ph type="notatype"/>').placeholderCasing).toBeFalsy();
	});
});

describe('hasStructuralIdDefects', () => {
	const sp = (id: string): XmlObject => ({ 'p:nvSpPr': { 'p:cNvPr': { '@_id': id } } });

	it('accepts a tree with unique valid ids', () => {
		const spTree: XmlObject = {
			'p:nvGrpSpPr': { 'p:cNvPr': { '@_id': '1' } },
			'p:sp': [sp('2'), sp('3')],
		};
		expect(hasStructuralIdDefects(spTree, ensureArray)).toBeFalsy();
	});

	it('flags invalid and duplicated ids, including inside groups', () => {
		expect(hasStructuralIdDefects({ 'p:sp': sp('4294967296') }, ensureArray)).toBeTruthy();
		expect(hasStructuralIdDefects({ 'p:sp': [sp('2'), sp('2')] }, ensureArray)).toBeTruthy();
		const grouped: XmlObject = {
			'p:sp': sp('2'),
			'p:grpSp': { 'p:nvGrpSpPr': { 'p:cNvPr': { '@_id': '3' } }, 'p:sp': sp('2') },
		};
		expect(hasStructuralIdDefects(grouped, ensureArray)).toBeTruthy();
	});

	it('treats an mc:Choice shape and its mc:Fallback twin under one id as a single shape', () => {
		// Real PowerPoint declares an ink content part and its fallback picture
		// with the SAME id (verified on its own output): that is not a defect,
		// and the gate must leave such a slide byte-identical.
		const spTree: XmlObject = {
			'p:sp': sp('2'),
			'mc:AlternateContent': {
				'mc:Choice': {
					'p:contentPart': { 'p14:nvContentPartPr': { 'p14:cNvPr': { '@_id': '7' } } },
				},
				'mc:Fallback': { 'p:pic': { 'p:nvPicPr': { 'p:cNvPr': { '@_id': '7' } } } },
			},
		};
		expect(hasStructuralIdDefects(spTree, ensureArray)).toBeFalsy();
		// ...but an envelope colliding with an ordinary shape is still a defect.
		(spTree['p:sp'] as XmlObject)['p:nvSpPr'] = { 'p:cNvPr': { '@_id': '7' } };
		expect(hasStructuralIdDefects(spTree, ensureArray)).toBeTruthy();
	});
});

describe('spTreeOfPartRoot', () => {
	it('returns the shape tree or undefined', () => {
		const spTree = {};
		expect(spTreeOfPartRoot({ 'p:cSld': { 'p:spTree': spTree } })).toBe(spTree);
		expect(spTreeOfPartRoot({})).toBeUndefined();
		expect(spTreeOfPartRoot(undefined)).toBeUndefined();
	});
});

describe('applyShapeIdMapToSlide', () => {
	it('remaps own elements, rawTiming targets and ActiveX controls but not template copies', () => {
		const own = {
			id: 'sp-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			shapeId: '5',
			rawXml: { 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5' } } },
		} as ShapePptxElement;
		const template = {
			...own,
			id: 'layout-sp-1',
			rawXml: { 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5' } } },
		} as ShapePptxElement;
		const slide: PptxSlide = {
			id: 'ppt/slides/slide1.xml',
			rId: 'rId2',
			slideNumber: 1,
			elements: [own, template],
			rawTiming: { 'p:tnLst': { 'p:spTgt': { '@_spid': '5' } } },
			activeXControls: [
				{ relId: 'rId9', shapeId: '5' },
				{ relId: 'rId10', shapeId: '6' },
			],
		};
		applyShapeIdMapToSlide(slide, new Map([['5', '9']]));
		expect(own.shapeId).toBe('9');
		expect(template.shapeId).toBe('5');
		expect(((slide.rawTiming as XmlObject)['p:tnLst'] as XmlObject)['p:spTgt']).toStrictEqual({
			'@_spid': '9',
		});
		expect(slide.activeXControls?.map((c) => c.shapeId)).toStrictEqual(['9', '6']);
	});
});
