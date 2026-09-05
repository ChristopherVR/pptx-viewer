import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { resolveP14MediaForGraphicFrame } from './media-p14-extension-resolve';

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
}

describe('resolveP14MediaForGraphicFrame', () => {
	it('returns nothing for an undefined nvPr (a graphicFrame with no extension at all)', () => {
		expect(resolveP14MediaForGraphicFrame(undefined, 's1', ensureArray)).toStrictEqual({});
	});

	it('reads trim/fade/speed/bookmarks off p:nvPr/p:extLst, the shape a fresh media insert writes', () => {
		const nvPr: XmlObject = {
			'p:extLst': {
				'p:ext': [
					{
						'@_uri': '{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}',
						'p14:media': {
							'@_r:embed': 'rId2',
							'p14:trim': { '@_st': '1000', '@_end': '5000' },
							'p14:fade': { '@_in': '2000', '@_out': '3000' },
							'@_spd': '150000',
						},
					},
					{
						'@_uri': '{C809E50D-3E49-4677-B9B1-B2B30C8E0B5F}',
						'p14:bmkLst': {
							'p14:bmk': [{ '@_name': 'Intro', '@_time': '5000' }],
						},
					},
				],
			},
		};

		const result = resolveP14MediaForGraphicFrame(nvPr, 's1', ensureArray);

		expect(result.trimStartMs).toBe(1000);
		// p14:trim/@end is the distance from the clip's TAIL, not an absolute
		// stop (COM-verified); this resolver passes it through verbatim.
		expect(result.trimEndMs).toBe(5000);
		expect(result.fadeInDuration).toBe(2);
		expect(result.fadeOutDuration).toBe(3);
		expect(result.playbackSpeed).toBe(1.5);
		expect(result.bookmarks).toStrictEqual([{ id: expect.any(String), time: 5, label: 'Intro' }]);
	});

	it('omits fields the extension does not carry, so a caller can spread the result safely', () => {
		const nvPr: XmlObject = {
			'p:extLst': {
				'p:ext': {
					'@_uri': '{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}',
					'p14:media': { 'p14:trim': { '@_end': '5000' } },
				},
			},
		};

		const result = resolveP14MediaForGraphicFrame(nvPr, 's1', ensureArray);

		expect(result).toStrictEqual({ trimEndMs: 5000 });
		expect('trimStartMs' in result).toBeFalsy();
		expect('bookmarks' in result).toBeFalsy();
	});
});
