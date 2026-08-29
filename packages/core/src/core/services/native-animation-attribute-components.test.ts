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
});
