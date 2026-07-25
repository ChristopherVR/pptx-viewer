import { describe, it, expect } from 'vitest';

import {
	extractOleChartBuilds,
	extractSmartArtBuilds,
	extractGraphicBuilds,
	isExclusiveNode,
	readTimingAttr,
	extractStartConditionDelayMs,
	extractChildBehaviourDurationMs,
} from './native-animation-extended-helpers';
import { ensureArray } from './native-animation-helpers';

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

// ==========================================================================
// Effect timing (issue #106)
// ==========================================================================

describe('readTimingAttr', () => {
	it('parses a millisecond count', () => {
		expect(readTimingAttr('400')).toBe(400);
	});

	it('treats absent and "indefinite" as no timing', () => {
		expect(readTimingAttr(undefined)).toBeUndefined();
		expect(readTimingAttr('')).toBeUndefined();
		// "indefinite" means "wait for a click", not a duration.
		expect(readTimingAttr('indefinite')).toBeUndefined();
	});
});

describe('extractStartConditionDelayMs', () => {
	// PowerPoint writes an effect's delay as a start CONDITION, not as `@delay`
	// on the effect's own `p:cTn`; reading only the attribute dropped it.
	it('reads the delay from p:stCondLst', () => {
		const cTn = { 'p:stCondLst': { 'p:cond': { '@_delay': '1000' } } };
		expect(extractStartConditionDelayMs(cTn)).toBe(1000);
	});

	it('ignores the indefinite (click) condition and takes the real delay', () => {
		const cTn = {
			'p:stCondLst': {
				'p:cond': [{ '@_delay': 'indefinite' }, { '@_delay': '2000' }],
			},
		};
		expect(extractStartConditionDelayMs(cTn)).toBe(2000);
	});

	it('returns undefined when there is no numeric delay', () => {
		expect(extractStartConditionDelayMs({})).toBeUndefined();
		expect(
			extractStartConditionDelayMs({ 'p:stCondLst': { 'p:cond': { '@_delay': 'indefinite' } } }),
		).toBeUndefined();
	});
});

describe('extractChildBehaviourDurationMs', () => {
	// The duration lives on the child behaviour's cTn, not the effect's.
	it('reads the duration from a child animEffect behaviour', () => {
		const cTn = {
			'p:childTnLst': {
				'p:animEffect': { 'p:cBhvr': { 'p:cTn': { '@_dur': '400' } } },
			},
		};
		expect(extractChildBehaviourDurationMs(cTn, ensureArray)).toBe(400);
	});

	// `p:set` is PowerPoint's 1ms visibility flip and must not mask the real one.
	it('ignores the 1ms visibility set and keeps the real duration', () => {
		const cTn = {
			'p:childTnLst': {
				'p:set': { 'p:cBhvr': { 'p:cTn': { '@_dur': '1' } } },
				'p:animEffect': { 'p:cBhvr': { 'p:cTn': { '@_dur': '400' } } },
			},
		};
		expect(extractChildBehaviourDurationMs(cTn, ensureArray)).toBe(400);
	});

	it('returns undefined when no behaviour carries a duration', () => {
		expect(extractChildBehaviourDurationMs({}, ensureArray)).toBeUndefined();
	});
});
