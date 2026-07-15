import { describe, it, expect } from 'vitest';

import {
	extractOleChartBuilds,
	extractSmartArtBuilds,
	extractGraphicBuilds,
	isExclusiveNode,
} from './native-animation-extended-helpers';

describe('extractOleChartBuilds', () => {
	it('returns empty array when bldLst is undefined', () => {
		expect(extractOleChartBuilds(undefined)).toStrictEqual([]);
	});

	it('returns empty array when bldLst has no p:bldOleChart entries', () => {
		expect(extractOleChartBuilds({})).toStrictEqual([]);
		expect(extractOleChartBuilds({ 'p:bldP': { '@_spid': '1' } })).toStrictEqual([]);
	});

	it('parses a single bldOleChart entry with all attributes', () => {
		const bldLst = {
			'p:bldOleChart': {
				'@_spid': '100',
				'@_grpId': '2',
				'@_bld': 'series',
				'@_animBg': '1',
			},
		};
		expect(extractOleChartBuilds(bldLst)).toStrictEqual([
			{ spid: '100', grpId: '2', bld: 'series', animBg: true },
		]);
	});

	it('parses multiple bldOleChart entries', () => {
		const bldLst = {
			'p:bldOleChart': [
				{ '@_spid': '10', '@_grpId': '1', '@_bld': 'series' },
				{ '@_spid': '20', '@_grpId': '3', '@_bld': 'category' },
			],
		};
		const result = extractOleChartBuilds(bldLst);
		expect(result).toHaveLength(2);
		expect(result[0]).toStrictEqual({
			spid: '10',
			grpId: '1',
			bld: 'series',
			animBg: undefined,
		});
		expect(result[1]).toStrictEqual({
			spid: '20',
			grpId: '3',
			bld: 'category',
			animBg: undefined,
		});
	});

	it('filters out entries without @_spid', () => {
		const bldLst = {
			'p:bldOleChart': [{ '@_spid': '5', '@_bld': 'series' }, { '@_bld': 'category' }],
		};
		const result = extractOleChartBuilds(bldLst);
		expect(result).toHaveLength(1);
		expect(result[0].spid).toBe('5');
	});

	it("defaults grpId to '0' when not present", () => {
		const bldLst = {
			'p:bldOleChart': { '@_spid': '42' },
		};
		const result = extractOleChartBuilds(bldLst);
		expect(result[0].grpId).toBe('0');
	});

	it("defaults bld to 'allAtOnce' when not present", () => {
		const bldLst = {
			'p:bldOleChart': { '@_spid': '42' },
		};
		const result = extractOleChartBuilds(bldLst);
		expect(result[0].bld).toBe('allAtOnce');
	});

	it("sets animBg to true when @_animBg is '1'", () => {
		const bldLst = {
			'p:bldOleChart': { '@_spid': '1', '@_animBg': '1' },
		};
		expect(extractOleChartBuilds(bldLst)[0].animBg).toBeTruthy();
	});

	it("sets animBg to undefined when @_animBg is not '1'", () => {
		const bldLst = {
			'p:bldOleChart': { '@_spid': '1', '@_animBg': '0' },
		};
		expect(extractOleChartBuilds(bldLst)[0].animBg).toBeUndefined();
	});

	it('sets animBg to undefined when @_animBg is absent', () => {
		const bldLst = {
			'p:bldOleChart': { '@_spid': '1' },
		};
		expect(extractOleChartBuilds(bldLst)[0].animBg).toBeUndefined();
	});
});

describe('extractSmartArtBuilds', () => {
	it('returns empty array for undefined bldLst', () => {
		expect(extractSmartArtBuilds(undefined)).toStrictEqual([]);
	});

	it('returns empty array when no p:bldDgm entries', () => {
		expect(extractSmartArtBuilds({})).toStrictEqual([]);
	});

	it('parses single entry with spid and bld', () => {
		const bldLst = {
			'p:bldDgm': { '@_spid': '300', '@_bld': 'one' },
		};
		expect(extractSmartArtBuilds(bldLst)).toStrictEqual([{ spid: '300', bld: 'one' }]);
	});

	it("defaults bld to 'whole' when not present", () => {
		const bldLst = {
			'p:bldDgm': { '@_spid': '7' },
		};
		expect(extractSmartArtBuilds(bldLst)[0].bld).toBe('whole');
	});

	it('filters entries without spid', () => {
		const bldLst = {
			'p:bldDgm': [{ '@_spid': '8', '@_bld': 'lvlOne' }, { '@_bld': 'lvlAtOnce' }],
		};
		const result = extractSmartArtBuilds(bldLst);
		expect(result).toHaveLength(1);
		expect(result[0].spid).toBe('8');
	});
});

describe('extractGraphicBuilds', () => {
	it('returns empty array for undefined bldLst', () => {
		expect(extractGraphicBuilds(undefined)).toStrictEqual([]);
	});

	it('parses the bldAsOne schema choice', () => {
		const bldLst = {
			'p:bldGraphic': {
				'@_spid': '55',
				'@_grpId': '7',
				'p:bldAsOne': {},
			},
		};
		const result = extractGraphicBuilds(bldLst);
		expect(result[0].shapeId).toBe('55');
		expect(result[0].groupId).toBe('7');
		expect(result[0].build.mode).toBe('asOne');
	});

	it('parses nested chart build properties', () => {
		const bldLst = {
			'p:bldGraphic': {
				'@_spid': '99',
				'@_grpId': '3',
				'p:bldSub': {
					'a:bldChart': { '@_bld': 'seriesEl', '@_animBg': '0' },
				},
			},
		};
		expect(extractGraphicBuilds(bldLst)[0].build).toMatchObject({
			mode: 'sub',
			kind: 'chart',
			build: 'seriesEl',
			animateBackground: false,
		});
	});
});

describe('isExclusiveNode', () => {
	it('returns false for undefined input', () => {
		expect(isExclusiveNode(undefined)).toBeFalsy();
	});

	it('returns false when no p:excl children', () => {
		expect(isExclusiveNode({})).toBeFalsy();
		expect(isExclusiveNode({ 'p:par': {} })).toBeFalsy();
	});

	it('returns true when p:excl exists', () => {
		expect(isExclusiveNode({ 'p:excl': { 'p:cTn': {} } })).toBeTruthy();
	});

	it('returns true when p:excl is an array', () => {
		expect(isExclusiveNode({ 'p:excl': [{ 'p:cTn': {} }] })).toBeTruthy();
	});
});
