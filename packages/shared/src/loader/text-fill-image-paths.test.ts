import type { PptxElement, TextPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyTextFillBlipPatches, collectTextFillBlipPaths } from './text-fill-image-paths';

function textElement(id: string, segmentUrls: Array<string | undefined>): TextPptxElement {
	return {
		id,
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		textSegments: segmentUrls.map((url, i) => ({
			text: `run${i}`,
			style: url ? { textFillBlipUrl: url } : {},
		})),
	} as unknown as TextPptxElement;
}

describe('collectTextFillBlipPaths', () => {
	it('collects an unresolved picture-fill path from a run', () => {
		const el = textElement('el1', ['ppt/media/image1.png']);
		const result = collectTextFillBlipPaths([{ id: 's1', elements: [el] }] as never);
		expect([...result.paths]).toStrictEqual(['ppt/media/image1.png']);
		expect(result.refs).toStrictEqual([
			{ element: el, segmentIndex: 0, path: 'ppt/media/image1.png' },
		]);
	});

	it('collects multiple runs across multiple elements', () => {
		const el1 = textElement('el1', ['ppt/media/a.png', undefined]);
		const el2 = textElement('el2', ['ppt/media/b.png']);
		const result = collectTextFillBlipPaths([{ id: 's1', elements: [el1, el2] }] as never);
		expect([...result.paths].sort()).toStrictEqual(['ppt/media/a.png', 'ppt/media/b.png']);
		expect(result.refs).toHaveLength(2);
	});

	it('skips an already-external URL', () => {
		const el = textElement('el1', ['https://example.test/image.png']);
		const result = collectTextFillBlipPaths([{ id: 's1', elements: [el] }] as never);
		expect(result).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('skips a data: URL', () => {
		const el = textElement('el1', ['data:image/png;base64,AAAA']);
		const result = collectTextFillBlipPaths([{ id: 's1', elements: [el] }] as never);
		expect(result).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('recurses into group children', () => {
		const child = textElement('el1', ['ppt/media/image1.png']);
		const group = {
			id: 'grp1',
			type: 'group',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			children: [child],
		} as unknown as PptxElement;
		const result = collectTextFillBlipPaths([{ id: 's1', elements: [group] }] as never);
		expect([...result.paths]).toStrictEqual(['ppt/media/image1.png']);
	});

	it('ignores an element with no text segments', () => {
		const el = { id: 'sh1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		const result = collectTextFillBlipPaths([{ id: 's1', elements: [el] }] as never);
		expect(result).toStrictEqual({ paths: new Set(), refs: [] });
	});
});

describe('applyTextFillBlipPatches', () => {
	it('patches only the matching run, leaving siblings untouched', () => {
		const el = textElement('el1', ['ppt/media/a.png', undefined]);
		const { refs } = collectTextFillBlipPaths([{ id: 's1', elements: [el] }] as never);
		const resolvedMap = new Map([['ppt/media/a.png', 'blob:resolved-a']]);

		const [patched] = applyTextFillBlipPatches([el], resolvedMap, refs);
		const patchedEl = patched as TextPptxElement;

		expect(patched).not.toBe(el);
		expect(patchedEl.textSegments?.[0]?.style?.textFillBlipUrl).toBe('blob:resolved-a');
		expect(patchedEl.textSegments?.[1]?.style).toStrictEqual(el.textSegments![1]!.style);
		// The original element is untouched (immutable patch).
		expect(el.textSegments?.[0]?.style?.textFillBlipUrl).toBe('ppt/media/a.png');
	});

	it('returns the same reference when nothing resolved', () => {
		const el = textElement('el1', ['ppt/media/a.png']);
		const { refs } = collectTextFillBlipPaths([{ id: 's1', elements: [el] }] as never);
		const elements = [el];
		const patched = applyTextFillBlipPatches(elements, new Map(), refs);
		expect(patched).toBe(elements);
	});
});
