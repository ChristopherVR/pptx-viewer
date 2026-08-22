import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyTableStyleImagePatches,
	collectTableStyleImagePaths,
} from './table-style-image-paths';

function mapWith(
	styleId: string,
	entry: Partial<ParsedTableStyleMap[string]>,
): ParsedTableStyleMap {
	return { [styleId]: { styleId, ...entry } };
}

describe('collectTableStyleImagePaths', () => {
	it('collects an unresolved whole-table image-fill path', () => {
		const map = mapWith('{S1}', {
			wholeTblFill: { schemeColor: '', image: { path: 'ppt/media/tex1.png' } },
		});

		const result = collectTableStyleImagePaths(map);

		expect([...result.paths]).toStrictEqual(['ppt/media/tex1.png']);
		expect(result.refs).toStrictEqual([
			{ styleId: '{S1}', fillKey: 'wholeTblFill', path: 'ppt/media/tex1.png' },
		]);
	});

	it('collects across multiple section fills and styles', () => {
		const map: ParsedTableStyleMap = {
			...mapWith('{S1}', {
				wholeTblFill: { schemeColor: '', image: { path: 'ppt/media/a.png' } },
				firstRowFill: { schemeColor: '', image: { path: 'ppt/media/b.png' } },
			}),
			...mapWith('{S2}', {
				band1HFill: { schemeColor: '', image: { path: 'ppt/media/c.png' } },
			}),
		};

		const result = collectTableStyleImagePaths(map);
		expect([...result.paths].sort()).toStrictEqual([
			'ppt/media/a.png',
			'ppt/media/b.png',
			'ppt/media/c.png',
		]);
		expect(result.refs).toHaveLength(3);
	});

	it('skips a fill whose image already resolved to data', () => {
		const map = mapWith('{S1}', {
			wholeTblFill: {
				schemeColor: '',
				image: { path: 'ppt/media/tex1.png', data: 'blob:already' },
			},
		});
		expect(collectTableStyleImagePaths(map)).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('skips an already-external URL', () => {
		const map = mapWith('{S1}', {
			wholeTblFill: { schemeColor: '', image: { path: 'https://example.test/tex.png' } },
		});
		expect(collectTableStyleImagePaths(map)).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('returns empty for an undefined map', () => {
		expect(collectTableStyleImagePaths(undefined)).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('ignores a section fill with no image', () => {
		const map = mapWith('{S1}', { wholeTblFill: { schemeColor: 'accent1' } });
		expect(collectTableStyleImagePaths(map)).toStrictEqual({ paths: new Set(), refs: [] });
	});
});

describe('applyTableStyleImagePatches', () => {
	it('patches the resolved URL onto the matching style/section only', () => {
		const map = mapWith('{S1}', {
			wholeTblFill: { schemeColor: '', image: { path: 'ppt/media/tex1.png' } },
			firstRowFill: { schemeColor: '', color: '#FF0000' },
		});
		const { refs } = collectTableStyleImagePaths(map);
		const resolvedMap = new Map([['ppt/media/tex1.png', 'blob:resolved-1']]);

		const patched = applyTableStyleImagePatches(map, resolvedMap, refs);

		expect(patched).not.toBe(map);
		expect(patched['{S1}'].wholeTblFill?.image?.data).toBe('blob:resolved-1');
		// Untouched sections/fields are not mutated in place.
		expect(patched['{S1}'].firstRowFill).toBe(map['{S1}'].firstRowFill);
		expect(map['{S1}'].wholeTblFill?.image?.data).toBeUndefined();
	});

	it('returns the same reference when nothing resolved', () => {
		const map = mapWith('{S1}', {
			wholeTblFill: { schemeColor: '', image: { path: 'ppt/media/tex1.png' } },
		});
		const { refs } = collectTableStyleImagePaths(map);
		const patched = applyTableStyleImagePatches(map, new Map(), refs);
		expect(patched).toBe(map);
	});
});
