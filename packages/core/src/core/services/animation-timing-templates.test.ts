import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { extractBldPTemplates, serializeBldPTemplates } from './animation-timing-templates';

/**
 * Hand-built markup: no fixture under `e2e/fixtures` or the corpus under
 * `packages/core/src/__tests__/fixtures/corpus` contains a `p:tmplLst`, so
 * these trees are constructed straight from ECMA-376 §19.5.84/§19.5.85
 * (CT_TLTemplateList / CT_TLTemplate).
 */
function buildTnLst(): XmlObject {
	return {
		'p:par': {
			'p:cTn': {
				'@_id': '9',
				'@_presetClass': 'entr',
				'@_presetID': '2',
				'p:childTnLst': {
					'p:set': { '@_id': '10' },
				},
			},
		},
	};
}

describe('extractBldPTemplates', () => {
	it('returns an empty array when the bldP has no tmplLst', () => {
		expect(extractBldPTemplates({ '@_spid': '3' })).toStrictEqual([]);
	});

	it('parses a single p:tmpl entry with its level and tnLst', () => {
		const tnLst = buildTnLst();
		const bldP: XmlObject = {
			'@_spid': '3',
			'p:tmplLst': {
				'p:tmpl': { '@_lvl': '1', 'p:tnLst': tnLst },
			},
		};

		const templates = extractBldPTemplates(bldP);
		expect(templates).toHaveLength(1);
		expect(templates[0].level).toBe(1);
		expect(templates[0].timeNodeList).toBe(tnLst);
	});

	it('defaults @lvl to 0 when absent, per ST_TLLevel', () => {
		const bldP: XmlObject = {
			'p:tmplLst': { 'p:tmpl': { 'p:tnLst': buildTnLst() } },
		};
		expect(extractBldPTemplates(bldP)[0].level).toBe(0);
	});

	it('parses multiple p:tmpl entries, one per build level', () => {
		const bldP: XmlObject = {
			'p:tmplLst': {
				'p:tmpl': [
					{ '@_lvl': '0', 'p:tnLst': buildTnLst() },
					{ '@_lvl': '1', 'p:tnLst': buildTnLst() },
				],
			},
		};
		const templates = extractBldPTemplates(bldP);
		expect(templates).toHaveLength(2);
		expect(templates.map((t) => t.level)).toStrictEqual([0, 1]);
	});

	it('drops a p:tmpl entry with no p:tnLst child (required by schema)', () => {
		const bldP: XmlObject = {
			'p:tmplLst': { 'p:tmpl': { '@_lvl': '2' } },
		};
		expect(extractBldPTemplates(bldP)).toStrictEqual([]);
	});
});

describe('serializeBldPTemplates', () => {
	it('returns undefined for an empty template list', () => {
		expect(serializeBldPTemplates([])).toBeUndefined();
	});

	it('round-trips a single-entry p:tmplLst', () => {
		const bldP: XmlObject = {
			'@_spid': '3',
			'p:tmplLst': {
				'p:tmpl': { '@_lvl': '1', 'p:tnLst': buildTnLst() },
			},
		};
		const templates = extractBldPTemplates(bldP);
		expect(serializeBldPTemplates(templates)).toStrictEqual(bldP['p:tmplLst']);
	});

	it('round-trips a multi-entry p:tmplLst, preserving unmodelled attributes', () => {
		const tmplLst: XmlObject = {
			'p:tmpl': [
				{ '@_lvl': '0', '@_future': 'kept', 'p:tnLst': buildTnLst() },
				{ '@_lvl': '2', 'p:tnLst': buildTnLst() },
			],
		};
		const templates = extractBldPTemplates({ 'p:tmplLst': tmplLst });
		expect(serializeBldPTemplates(templates)).toStrictEqual(tmplLst);
	});
});
