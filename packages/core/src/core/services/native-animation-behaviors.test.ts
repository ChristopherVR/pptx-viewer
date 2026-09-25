import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { capturedPresetNativeAnimation } from './animation-behavior-native';
import { extractBehaviors } from './native-animation-behaviors';

function cBhvr(attr: string | undefined, cTn: XmlObject, extra: XmlObject = {}): XmlObject {
	return {
		...extra,
		'p:cTn': cTn,
		'p:tgtEl': { 'p:spTgt': { '@_spid': '2' } },
		...(attr ? { 'p:attrNameLst': { 'p:attrName': attr } } : {}),
	};
}

describe('extractBehaviors', () => {
	it('keeps every behaviour with its own timing, additive mode and values', () => {
		const behaviors = extractBehaviors({
			'p:set': {
				'p:cBhvr': cBhvr('style.visibility', { '@_dur': '1', '@_fill': 'hold' }),
				'p:to': { 'p:strVal': { '@_val': 'visible' } },
			},
			'p:anim': [
				{
					'@_calcmode': 'lin',
					'@_valueType': 'num',
					'p:cBhvr': cBhvr('ppt_y', {
						'@_dur': '664',
						'@_tmFilter': '0,0; 1,1',
						'p:stCondLst': { 'p:cond': { '@_delay': '664' } },
					}),
					'p:tavLst': {
						'p:tav': [
							{
								'@_tm': '0',
								'@_fmla': '#ppt_y-sin(pi*$)/9',
								'p:val': { 'p:fltVal': { '@_val': '0' } },
							},
							{ '@_tm': '100000', 'p:val': { 'p:fltVal': { '@_val': '1' } } },
						],
					},
				},
				{
					'@_by': '(#ppt_h/3+#ppt_w*0.1)',
					'p:cBhvr': cBhvr(
						'ppt_x',
						{ '@_dur': '200', '@_decel': '100000', '@_autoRev': '1' },
						{ '@_additive': 'sum' },
					),
				},
			],
			'p:animEffect': {
				'@_transition': 'in',
				'@_filter': 'wipe(down)',
				'p:cBhvr': cBhvr(undefined, { '@_dur': '580' }),
			},
			'p:animScale': {
				'p:cBhvr': cBhvr(undefined, { '@_dur': '26', '@_repeatCount': '2000' }),
				'p:to': { '@_x': '100000', '@_y': '60000' },
			},
			'p:animRot': { '@_by': '21600000', 'p:cBhvr': cBhvr('r', { '@_dur': '1000' }) },
			'p:animMotion': {
				'@_path': 'M 0 0 L 0.1 0 E',
				'@_origin': 'layout',
				'p:cBhvr': cBhvr('ppt_x', { '@_dur': '1000' }),
			},
		})!;

		expect(behaviors.map((b) => b.kind)).toStrictEqual([
			'set',
			'anim',
			'anim',
			'animEffect',
			'animScale',
			'animRot',
			'animMotion',
		]);
		expect(behaviors[0]).toMatchObject({ value: 'visible', timing: { durationMs: 1 } });
		expect(behaviors[1]).toMatchObject({
			attrNames: ['ppt_y'],
			timing: { durationMs: 664, delayMs: 664, tmFilter: '0,0; 1,1' },
		});
		expect(behaviors[1].kind === 'anim' && behaviors[1].keyframes[0].fmla).toBe(
			'#ppt_y-sin(pi*$)/9',
		);
		expect(behaviors[2]).toMatchObject({
			additive: 'sum',
			by: '(#ppt_h/3+#ppt_w*0.1)',
			timing: { durationMs: 200, decel: 1, autoReverse: true },
		});
		expect(behaviors[3]).toMatchObject({ filter: 'wipe(down)', transition: 'in' });
		expect(behaviors[4]).toMatchObject({ to: { x: 1, y: 0.6 }, timing: { repeatCount: 2 } });
		expect(behaviors[5]).toMatchObject({ by: 360 });
		expect(behaviors[6]).toMatchObject({ path: 'M 0 0 L 0.1 0 E', origin: 'layout' });
	});

	it('returns undefined for an empty child list', () => {
		expect(extractBehaviors({})).toBeUndefined();
		expect(extractBehaviors(undefined)).toBeUndefined();
	});
});

describe('effect timing from composed behaviours', () => {
	it("spans Swish's three sequential legs, not its longest single one", () => {
		const swish = capturedPresetNativeAnimation('entr', 38, 0, 2000)!;
		expect(swish.durationMs).toBe(2000);
		expect(swish.behaviors?.length).toBeGreaterThan(4);
	});

	it('does not replay Light Speed as its 400 ms reversing wobble', () => {
		const lightSpeed = capturedPresetNativeAnimation('entr', 34, 0, 1000)!;
		expect(lightSpeed.durationMs).toBe(1000);
		expect(lightSpeed.autoReverse).toBeUndefined();
	});
});
