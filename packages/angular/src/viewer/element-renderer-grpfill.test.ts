import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `a:grpFill` inheritance through NESTED groups, for the Angular renderer.
 *
 * `a:grpFill` resolves against the nearest ANCESTOR group that has a fill, not
 * the immediate parent. Angular carried a hand-inlined copy of the shared
 * helper that returned the immediate group's own fill only, so once a
 * `p:grpSp` inside a `p:grpSp` loaded as a real nested group, a shape two
 * levels down painted transparent. PowerPoint paints it with the outer group's
 * fill (confirmed by exporting such a deck through PowerPoint COM).
 *
 * TestBed rendering is unavailable in this package (see `vitest.config.ts`), so
 * two things are pinned instead: the shared decision function the component's
 * `childParentGroupFill()` delegates to, and the fact that it delegates at all
 * (an inlined copy is exactly how this drifted the first time).
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getGroupChildParentFill, resolveGroupChildFill } from '../internal/shared';
import { componentSource as readComponentSource } from './component-source.test-support';

const componentSource = readComponentSource(
	dirname(fileURLToPath(import.meta.url)),
	'element-renderer.component.ts',
);

function group(groupFill: ShapeStyle | undefined): PptxElement {
	return {
		type: 'group',
		id: 'g',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		children: [],
		groupFill,
	} as unknown as PptxElement;
}

function grpFillLeaf(): PptxElement {
	return {
		type: 'shape',
		id: 'leaf',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeStyle: { fillMode: 'group' },
	} as PptxElement;
}

describe('the shared rule the renderer delegates to', () => {
	it('passes an inherited fill through a nested group that has none of its own', () => {
		const inherited = getGroupChildParentFill(group(undefined), { fillColor: '#ff0000' });
		expect(resolveGroupChildFill(grpFillLeaf(), inherited)?.backgroundColor).toBe('#ff0000');
	});

	it('passes an inherited fill through a nested group that is itself grpFill', () => {
		const inherited = getGroupChildParentFill(group({ fillMode: 'group' }), {
			fillColor: '#ff0000',
		});
		expect(resolveGroupChildFill(grpFillLeaf(), inherited)?.backgroundColor).toBe('#ff0000');
	});

	it('prefers a nested group own fill over the inherited one', () => {
		const inherited = getGroupChildParentFill(group({ fillColor: '#00ff00' }), {
			fillColor: '#ff0000',
		});
		expect(resolveGroupChildFill(grpFillLeaf(), inherited)?.backgroundColor).toBe('#00ff00');
	});
});

describe('the component wiring', () => {
	it('computes the child fill from the shared helper, chaining its own inherited fill', () => {
		expect(componentSource).toContain(
			'getGroupChildParentFill(this.element(), this.parentGroupFill())',
		);
	});

	it('keeps no hand-inlined copy of the helper', () => {
		expect(componentSource).not.toContain("el.type === 'group' ? el.groupFill : undefined");
	});

	it('hands the computed fill to each rendered group child', () => {
		expect(componentSource).toContain('[parentGroupFill]="childParentGroupFill()"');
	});
});
