import { describe, it, expect } from 'vitest';

import type { PptxElementAnimation, XmlObject } from '../types';
import { reconcileBuildList } from './animation-timing-build-surgical';

describe('reconcileBuildList', () => {
	it('does nothing when no animation has an opinion on sequence', () => {
		const bldLst: XmlObject = { 'p:bldP': { '@_spid': 'sp1', '@_grpId': '0', '@_build': 'p' } };
		const rawTiming: XmlObject = { 'p:tnLst': {}, 'p:bldLst': bldLst };
		const animations: PptxElementAnimation[] = [{ elementId: 'sp1', entrance: 'fadeIn' }];

		reconcileBuildList(rawTiming, animations);

		expect(rawTiming['p:bldLst']).toStrictEqual(bldLst);
	});

	it('adds a new p:bldP for an animation whose sequence the editor just set', () => {
		const rawTiming: XmlObject = { 'p:tnLst': {} };
		const animations: PptxElementAnimation[] = [
			{ elementId: 'sp1', entrance: 'fadeIn', sequence: 'byParagraph' },
		];

		reconcileBuildList(rawTiming, animations);

		const bldP = (rawTiming['p:bldLst'] as XmlObject)['p:bldP'] as XmlObject;
		expect(bldP['@_spid']).toBe('sp1');
		expect(bldP['@_build']).toBe('p');
	});

	it('rewrites the build type of an existing p:bldP, preserving unmodelled attributes', () => {
		const bldLst: XmlObject = {
			'p:bldP': { '@_spid': 'sp1', '@_grpId': '3', '@_build': 'p', '@_rev': '1' },
		};
		const rawTiming: XmlObject = { 'p:tnLst': {}, 'p:bldLst': bldLst };
		const animations: PptxElementAnimation[] = [
			{ elementId: 'sp1', entrance: 'fadeIn', sequence: 'byWord' },
		];

		reconcileBuildList(rawTiming, animations);

		const bldP = (rawTiming['p:bldLst'] as XmlObject)['p:bldP'] as XmlObject;
		expect(bldP['@_build']).toBe('word');
		// Fields this editor does not model are carried over untouched.
		expect(bldP['@_grpId']).toBe('3');
		expect(bldP['@_rev']).toBe('1');
	});

	it('replaces an existing p:tmplLst when buildTemplates changes', () => {
		const oldTnLst: XmlObject = { 'p:par': { 'p:cTn': { '@_id': '1' } } };
		const bldLst: XmlObject = {
			'p:bldP': {
				'@_spid': 'sp1',
				'@_grpId': '0',
				'@_build': 'p',
				'p:tmplLst': { 'p:tmpl': { '@_lvl': '1', 'p:tnLst': oldTnLst } },
			},
		};
		const rawTiming: XmlObject = { 'p:tnLst': {}, 'p:bldLst': bldLst };
		const newTnLst: XmlObject = { 'p:par': { 'p:cTn': { '@_id': '2' } } };
		const animations: PptxElementAnimation[] = [
			{
				elementId: 'sp1',
				entrance: 'fadeIn',
				sequence: 'byParagraph',
				buildTemplates: [{ level: 2, timeNodeList: newTnLst, rawXml: { '@_lvl': '2' } }],
			},
		];

		reconcileBuildList(rawTiming, animations);

		const bldP = (rawTiming['p:bldLst'] as XmlObject)['p:bldP'] as XmlObject;
		const tmpl = (bldP['p:tmplLst'] as XmlObject)['p:tmpl'] as XmlObject;
		expect(tmpl['@_lvl']).toBe('2');
		expect(tmpl['p:tnLst']).toStrictEqual(newTnLst);
	});

	it('removes an owned p:bldP when the editor sets sequence back to "asOne"', () => {
		const bldLst: XmlObject = {
			'p:bldP': { '@_spid': 'sp1', '@_grpId': '0', '@_build': 'p' },
		};
		const rawTiming: XmlObject = { 'p:tnLst': {}, 'p:bldLst': bldLst };
		const animations: PptxElementAnimation[] = [
			{ elementId: 'sp1', entrance: 'fadeIn', sequence: 'asOne' },
		];

		reconcileBuildList(rawTiming, animations);

		expect(rawTiming['p:bldLst']).toBeUndefined();
	});

	it('leaves an untouched sibling p:bldP alone while updating another animation', () => {
		const bldLst: XmlObject = {
			'p:bldP': [
				{ '@_spid': 'sp1', '@_grpId': '0' },
				{ '@_spid': 'sp2', '@_grpId': '0', '@_build': 'p' },
			],
		};
		const rawTiming: XmlObject = { 'p:tnLst': {}, 'p:bldLst': bldLst };
		const animations: PptxElementAnimation[] = [
			{ elementId: 'sp1', entrance: 'fadeIn' },
			{ elementId: 'sp2', entrance: 'fadeIn', sequence: 'byWord' },
		];

		reconcileBuildList(rawTiming, animations);

		const nodes = (rawTiming['p:bldLst'] as XmlObject)['p:bldP'] as XmlObject[];
		const sp1 = nodes.find((n) => n['@_spid'] === 'sp1')!;
		const sp2 = nodes.find((n) => n['@_spid'] === 'sp2')!;
		expect(sp1).toStrictEqual({ '@_spid': 'sp1', '@_grpId': '0' });
		expect(sp2['@_build']).toBe('word');
	});

	it('never reads or writes unrelated p:bldLst children (p:bldDgm)', () => {
		const bldDgm: XmlObject = { '@_spid': 'dgm1', '@_bg': '1' };
		const bldLst: XmlObject = { 'p:bldDgm': bldDgm };
		const rawTiming: XmlObject = { 'p:tnLst': {}, 'p:bldLst': bldLst };
		const animations: PptxElementAnimation[] = [
			{ elementId: 'sp1', entrance: 'fadeIn', sequence: 'byParagraph' },
		];

		reconcileBuildList(rawTiming, animations);

		expect((rawTiming['p:bldLst'] as XmlObject)['p:bldDgm']).toStrictEqual(bldDgm);
		expect((rawTiming['p:bldLst'] as XmlObject)['p:bldP']).toBeDefined();
	});
});
