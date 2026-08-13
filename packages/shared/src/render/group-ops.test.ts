import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ungroupElements } from './group-ops';

/** A minimal shape in the coordinate space its container uses. */
function shape(id: string, x = 0, y = 0): PptxElement {
	return { type: 'shape', id, name: id, x, y, width: 10, height: 10 };
}

/** A group holding a nested group, as a real `p:grpSp` inside `p:grpSp` loads. */
function nestedGroup(id: string, innerId: string, leafId: string): GroupPptxElement {
	return {
		type: 'group',
		id,
		x: 100,
		y: 50,
		width: 200,
		height: 200,
		children: [
			{
				type: 'group',
				id: innerId,
				x: 5,
				y: 5,
				width: 50,
				height: 50,
				children: [shape(leafId, 1, 2)],
			},
			shape('leaf-b', 20, 30),
		],
	};
}

/** Every id in an element subtree, depth first. */
function collectIds(element: PptxElement): string[] {
	const ids = [element.id];
	if (element.type === 'group') {
		for (const child of element.children) {
			ids.push(...collectIds(child));
		}
	}
	return ids;
}

describe('ungroupElements: nested groups', () => {
	// Every binding renamed the top-level children only. Edits route by id
	// prefix (`master-` / `layout-` = template store), so a promoted nested
	// group carrying plain descendants had its inside edited into the slide
	// store and dropped on save.
	it('re-ids the descendants of a promoted nested group into the template store', () => {
		const group = nestedGroup('master-g', 'inner', 'leaf-a');
		const { elements, childIds } = ungroupElements([group], 'master-g', [
			'master-el-1',
			'master-el-2',
		]);

		expect(childIds).toStrictEqual(['master-el-1', 'master-el-2']);
		const promoted = elements[0];
		for (const id of collectIds(promoted)) {
			expect(id).toMatch(/^master-/);
		}
	});

	it('leaves descendant ids alone when they already route to the right store', () => {
		const group = nestedGroup('g', 'inner', 'leaf-a');
		const { elements } = ungroupElements([group], 'g', ['el-1', 'el-2']);

		// The promoted nested group takes the caller's id; ids animations and
		// collaborators still refer to, further down, are not churned.
		expect(collectIds(elements[0])).toStrictEqual(['el-1', 'leaf-a']);
	});

	it('deep-clones the promoted subtree so the original group is untouched', () => {
		const group = nestedGroup('g', 'inner', 'leaf-a');
		const { elements } = ungroupElements([group], 'g', ['el-1', 'el-2']);

		const promoted = elements[0] as GroupPptxElement;
		promoted.children[0].x = 999;
		promoted.children[0].id = 'renamed';

		const originalInner = group.children[0] as GroupPptxElement;
		expect(originalInner.children[0].x).toBe(1);
		expect(originalInner.children[0].id).toBe('leaf-a');
	});

	it('promotes children into slide-absolute coordinates', () => {
		const group = nestedGroup('g', 'inner', 'leaf-a');
		const { elements } = ungroupElements([group], 'g', ['el-1', 'el-2']);

		// inner sat at (5, 5) inside a group at (100, 50).
		expect(elements[0].x).toBe(105);
		expect(elements[0].y).toBe(55);
		// The leaf stays relative to the group it is still inside.
		expect((elements[0] as GroupPptxElement).children[0].x).toBe(1);
	});
});
