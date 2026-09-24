import { describe, expect, it } from 'vitest';

import { extractAttributeAnimations } from './native-animation-attribute-components';

describe('extractAttributeAnimations', () => {
	it('preserves sibling width, height, and rotation behaviours', () => {
		const component = (attrName: string, from: number, to: string | number) => ({
			'p:cBhvr': {
				'p:cTn': { '@_dur': '1000' },
				'p:attrNameLst': { 'p:attrName': attrName },
			},
			'p:tavLst': {
				'p:tav': [
					{ '@_tm': '0', 'p:val': { 'p:fltVal': { '@_val': String(from) } } },
					{
						'@_tm': '100000',
						'p:val':
							typeof to === 'number'
								? { 'p:fltVal': { '@_val': String(to) } }
								: { 'p:strVal': { '@_val': to } },
					},
				],
			},
		});

		const result = extractAttributeAnimations({
			'p:anim': [
				component('ppt_w', 0, '#ppt_w'),
				component('ppt_h', 0, '#ppt_h'),
				component('style.rotation', 90, 0),
			],
		});

		expect(result).toHaveLength(3);
		expect(result?.map((entry) => entry.attrName)).toStrictEqual([
			'ppt_w',
			'ppt_h',
			'style.rotation',
		]);
		expect(result?.every((entry) => entry.durationMs === 1000)).toBeTruthy();
	});

	it('extracts from/to/by attributes when there is no p:tavLst (Grow And Turn ground truth)', () => {
		const result = extractAttributeAnimations({
			'p:anim': [
				{
					'@_calcmode': 'lin',
					'@_from': '(-#ppt_w/2)',
					'@_to': '(#ppt_x)',
					'p:cBhvr': {
						'p:cTn': { '@_dur': '600' },
						'p:attrNameLst': { 'p:attrName': 'ppt_x' },
					},
				},
				{
					'@_by': '(#ppt_h/3+#ppt_w*0.1)',
					'p:cBhvr': {
						'@_additive': 'sum',
						'p:cTn': { '@_dur': '200' },
						'p:attrNameLst': { 'p:attrName': 'ppt_x' },
					},
				},
			],
		});

		expect(result).toHaveLength(2);
		expect(result?.[0]).toMatchObject({
			attrName: 'ppt_x',
			calcMode: 'lin',
			from: '(-#ppt_w/2)',
			keyframes: [],
			to: '(#ppt_x)',
		});
		expect(result?.[1]).toMatchObject({
			attrName: 'ppt_x',
			by: '(#ppt_h/3+#ppt_w*0.1)',
			keyframes: [],
		});
	});

	it('normalizes p14:bounceEnd to a 0-1 fraction (Fly In Bounce End ground truth)', () => {
		const result = extractAttributeAnimations({
			'p:anim': [
				{
					'@_calcmode': 'lin',
					'@_valueType': 'num',
					'@_p14:bounceEnd': '66000',
					'p:cBhvr': {
						'p:cTn': { '@_dur': '1000' },
						'p:attrNameLst': { 'p:attrName': 'ppt_x' },
					},
					'p:tavLst': {
						'p:tav': [
							{ '@_tm': '0', 'p:val': { 'p:strVal': { '@_val': '1+#ppt_w/2' } } },
							{ '@_tm': '100000', 'p:val': { 'p:strVal': { '@_val': '#ppt_x' } } },
						],
					},
				},
			],
		});

		expect(result).toHaveLength(1);
		expect(result?.[0].bounceEnd).toBeCloseTo(0.66);
	});

	it('leaves bounceEnd undefined when p14:bounceEnd is absent', () => {
		const result = extractAttributeAnimations({
			'p:anim': [
				{
					'@_from': '0',
					'@_to': '1',
					'p:cBhvr': {
						'p:cTn': { '@_dur': '500' },
						'p:attrNameLst': { 'p:attrName': 'style.opacity' },
					},
				},
			],
		});

		expect(result?.[0].bounceEnd).toBeUndefined();
	});

	it('still drops a p:anim with no attrName, no keyframes, and no from/to/by', () => {
		const result = extractAttributeAnimations({
			'p:anim': [
				{
					'p:cBhvr': {
						'p:cTn': { '@_dur': '200' },
						'p:attrNameLst': { 'p:attrName': 'ppt_x' },
					},
				},
			],
		});

		expect(result).toBeUndefined();
	});
});
