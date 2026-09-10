import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { renderShapeFilterDefs } from './shape-filter-defs';

/**
 * `a:sp3d` bevel lighting: the SVG-filter lighting model that replaced the old
 * CSS box-shadow bevel approximation (see shared
 * `render/visual-3d-bevel-lighting.ts`). `getComputed3dStyle` already folds a
 * `url(#bevel-light-<id>)` CSS reference into the shape's `filter`; this test
 * asserts the matching `<filter>` DEFINITION is actually injected, or the
 * reference resolves to nothing and the bevel silently disappears.
 */
function bevelShape(): PptxElement {
	return {
		id: 'bevel-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 120,
		shapeType: 'rect',
		shapeStyle: {
			fillColor: '#4472C4',
			shape3d: {
				bevelTopType: 'circle',
				bevelTopWidth: 76200,
				bevelTopHeight: 76200,
			},
		},
	} as unknown as PptxElement;
}

function plainShape(): PptxElement {
	return {
		id: 'plain-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 120,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#4472C4' },
	} as unknown as PptxElement;
}

describe('renderShapeFilterDefs bevel lighting', () => {
	it('injects a bevel-light filter definition for a shape with a bevel', () => {
		const svg = renderShapeFilterDefs(document, bevelShape());
		expect(svg).not.toBeNull();
		const markup = svg?.outerHTML ?? '';
		expect(markup).toContain('id="bevel-light-bevel-1"');
		expect(markup).toContain('feDiffuseLighting');
	});

	it('does not inject a bevel-light filter for a shape with no bevel', () => {
		const svg = renderShapeFilterDefs(document, plainShape());
		// No duotone/soft-edge/bevel filter applies to this shape at all, so
		// `renderShapeFilterDefs` returns null (mirrors the existing "no filters
		// needed" convention).
		expect(svg).toBeNull();
	});
});
