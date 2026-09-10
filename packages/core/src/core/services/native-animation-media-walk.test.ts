import { describe, expect, it } from 'vitest';

import type { PptxNativeAnimation, XmlObject } from '../types';
import { parseMediaAnimations } from './native-animation-media-walk';

describe('parseMediaAnimations', () => {
	it("captures the media node's own p:cTn/@id as nodeId", () => {
		const timing: XmlObject = {
			'p:audio': [
				{
					'p:cMediaNode': {
						'p:cTn': { '@_id': '42', '@_dur': '5000' },
						'p:tgtEl': { 'p:spTgt': { '@_spid': '7' } },
					},
				},
			],
		};
		const animations: PptxNativeAnimation[] = [];
		parseMediaAnimations(timing, animations);
		expect(animations).toHaveLength(1);
		expect(animations[0]).toMatchObject({
			kind: 'media',
			mediaType: 'audio',
			targetId: '7',
			nodeId: 42,
			durationMs: 5000,
		});
	});

	it('leaves nodeId undefined when p:cTn has no @_id', () => {
		const timing: XmlObject = {
			'p:video': [
				{
					'p:cMediaNode': {
						'p:cTn': {},
						'p:tgtEl': { 'p:spTgt': { '@_spid': '3' } },
					},
				},
			],
		};
		const animations: PptxNativeAnimation[] = [];
		parseMediaAnimations(timing, animations);
		expect(animations[0]?.nodeId).toBeUndefined();
	});

	it('finds media nodes nested inside p:par/p:seq containers', () => {
		const timing: XmlObject = {
			'p:par': [
				{
					'p:audio': [
						{
							'p:cMediaNode': {
								'p:cTn': { '@_id': '9' },
								'p:tgtEl': { 'p:spTgt': { '@_spid': '5' } },
							},
						},
					],
				},
			],
		};
		const animations: PptxNativeAnimation[] = [];
		parseMediaAnimations(timing, animations);
		expect(animations).toHaveLength(1);
		expect(animations[0]?.nodeId).toBe(9);
	});
});
