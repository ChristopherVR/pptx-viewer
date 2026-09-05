import { describe, expect, it } from 'vitest';

import type { MediaPptxElement } from '../../types';
import {
	buildFreshMediaNvPr,
	buildMediaP14Extensions,
	hasMediaP14ExtensionData,
} from './media-p14-extension-write';

function media(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		id: 'm1',
		type: 'media',
		x: 0,
		y: 0,
		width: 100,
		height: 60,
		mediaType: 'video',
		...overrides,
	} as MediaPptxElement;
}

describe('hasMediaP14ExtensionData', () => {
	it('is false for a media element with no trim/fade/speed/bookmarks', () => {
		expect(hasMediaP14ExtensionData(media())).toBeFalsy();
	});

	it('is true when only trimEndMs is set', () => {
		expect(hasMediaP14ExtensionData(media({ trimEndMs: 5000 }))).toBeTruthy();
	});

	it('ignores a playbackSpeed of exactly 1x (the default, not worth writing)', () => {
		expect(hasMediaP14ExtensionData(media({ playbackSpeed: 1 }))).toBeFalsy();
		expect(hasMediaP14ExtensionData(media({ playbackSpeed: 1.5 }))).toBeTruthy();
	});

	it('is true when there is at least one bookmark', () => {
		expect(
			hasMediaP14ExtensionData(media({ bookmarks: [{ id: 'b1', time: 1, label: 'x' }] })),
		).toBeTruthy();
	});
});

describe('buildMediaP14Extensions', () => {
	it('returns nothing for a media element with no fields to write', () => {
		expect(buildMediaP14Extensions(media())).toStrictEqual([]);
	});

	it('writes p14:trim with p14:trim/@end as the distance from the tail, verbatim', () => {
		const exts = buildMediaP14Extensions(media({ trimStartMs: 1000, trimEndMs: 5000 }));
		expect(exts).toHaveLength(1);
		expect(exts[0]['@_uri']).toBe('{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}');
		const p14Media = exts[0]['p14:media'] as Record<string, unknown>;
		expect(p14Media['p14:trim']).toStrictEqual({ '@_st': '1000', '@_end': '5000' });
	});

	it('writes the embed relationship id onto p14:media/@r:embed when supplied', () => {
		const exts = buildMediaP14Extensions(media({ trimEndMs: 5000 }), 'rId7');
		const p14Media = exts[0]['p14:media'] as Record<string, unknown>;
		expect(p14Media['@_r:embed']).toBe('rId7');
	});

	it('leaves @r:embed unset when no relationship id is supplied', () => {
		const exts = buildMediaP14Extensions(media({ trimEndMs: 5000 }));
		const p14Media = exts[0]['p14:media'] as Record<string, unknown>;
		expect(p14Media['@_r:embed']).toBeUndefined();
	});

	it('converts fade seconds to milliseconds and speed to the OOXML percentage', () => {
		const exts = buildMediaP14Extensions(
			media({ fadeInDuration: 2, fadeOutDuration: 3, playbackSpeed: 1.5 }),
		);
		const p14Media = exts[0]['p14:media'] as Record<string, unknown>;
		expect(p14Media['p14:fade']).toStrictEqual({ '@_in': '2000', '@_out': '3000' });
		expect(p14Media['@_spd']).toBe('150000');
	});

	it('writes a separate p14:bmkLst extension for bookmarks', () => {
		const exts = buildMediaP14Extensions(
			media({ bookmarks: [{ id: 'b1', time: 5, label: 'Intro' }] }),
		);
		expect(exts).toHaveLength(1);
		expect(exts[0]['@_uri']).toBe('{C809E50D-3E49-4677-B9B1-B2B30C8E0B5F}');
		const bmkLst = exts[0]['p14:bmkLst'] as { 'p14:bmk': Record<string, unknown>[] };
		expect(bmkLst['p14:bmk']).toStrictEqual([{ '@_name': 'Intro', '@_time': '5000' }]);
	});

	it('writes both extensions when trim and bookmarks are both present', () => {
		const exts = buildMediaP14Extensions(
			media({ trimEndMs: 5000, bookmarks: [{ id: 'b1', time: 1, label: 'x' }] }),
		);
		expect(exts).toHaveLength(2);
	});
});

describe('buildFreshMediaNvPr', () => {
	it('returns an empty object when there is nothing to write', () => {
		expect(buildFreshMediaNvPr(media())).toStrictEqual({});
	});

	it('wraps a single extension bare (not in an array), matching the merge writer', () => {
		const nvPr = buildFreshMediaNvPr(media({ trimEndMs: 5000 }), 'rId3');
		const extLst = nvPr['p:extLst'] as { 'p:ext': Record<string, unknown> };
		expect(Array.isArray(extLst['p:ext'])).toBeFalsy();
		expect(extLst['p:ext']['@_uri']).toBe('{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}');
	});

	it('wraps multiple extensions in an array when both trim and bookmarks are present', () => {
		const nvPr = buildFreshMediaNvPr(
			media({ trimEndMs: 5000, bookmarks: [{ id: 'b1', time: 1, label: 'x' }] }),
		);
		const extLst = nvPr['p:extLst'] as { 'p:ext': unknown[] };
		expect(Array.isArray(extLst['p:ext'])).toBeTruthy();
		expect(extLst['p:ext']).toHaveLength(2);
	});
});
