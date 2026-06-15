import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { groupElements, ungroupElements } from './group-ops';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a minimal shape element in slide-absolute coordinates. */
function makeShape(id: string, x: number, y: number, width: number, height: number): PptxElement {
	return {
		type: 'shape',
		id,
		name: id,
		x,
		y,
		width,
		height,
	};
}

/** Collect element ids in order. */
function ids(elements: readonly PptxElement[]): string[] {
	return elements.map((el) => el.id);
}

// ---------------------------------------------------------------------------
// groupElements — basic grouping of 2 elements
// ---------------------------------------------------------------------------

describe('groupElements — two elements', () => {
	const elA = makeShape('a', 10, 20, 100, 50); // right=110, bottom=70
	const elB = makeShape('b', 60, 40, 80, 60); // right=140, bottom=100
	const elements: PptxElement[] = [elA, elB];

	const { elements: result, groupId: gid } = groupElements(elements, ['a', 'b'], 'g1');

	it('returns the supplied groupId', () => {
		expect(gid).toBe('g1');
	});

	it('replaces the two source elements with a single group', () => {
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('g1');
		expect(result[0].type).toBe('group');
	});

	it('computes the union bounding box correctly', () => {
		const g = result[0];
		// minX=10, minY=20, maxX=140, maxY=100
		expect(g.x).toBe(10);
		expect(g.y).toBe(20);
		expect(g.width).toBe(130); // 140-10
		expect(g.height).toBe(80); // 100-20
	});

	it('stores children with group-relative coordinates', () => {
		if (result[0].type !== 'group') {
			throw new Error('Expected group element');
		}
		const children = result[0].children;
		expect(children).toHaveLength(2);

		// elA: absolute (10,20) → relative (0,0)
		expect(children[0].id).toBe('a');
		expect(children[0].x).toBe(0); // 10-10
		expect(children[0].y).toBe(0); // 20-20

		// elB: absolute (60,40) → relative (50,20)
		expect(children[1].id).toBe('b');
		expect(children[1].x).toBe(50); // 60-10
		expect(children[1].y).toBe(20); // 40-20
	});

	it('does not mutate the original elements array', () => {
		expect(elements).toHaveLength(2);
		expect(elements[0].id).toBe('a');
	});
});

// ---------------------------------------------------------------------------
// groupElements — insertion position tracks the first grouped element
// ---------------------------------------------------------------------------

describe('groupElements — insertion order', () => {
	// Elements: [x, a, b, y]. Group 'a' and 'b'. Group should be inserted at
	// index 1 (where 'a' was), with x before and y after.
	const elX = makeShape('x', 0, 0, 10, 10);
	const elA = makeShape('a', 100, 100, 50, 50);
	const elB = makeShape('b', 200, 200, 50, 50);
	const elY = makeShape('y', 300, 300, 10, 10);
	const elements: PptxElement[] = [elX, elA, elB, elY];

	const { elements: result } = groupElements(elements, ['a', 'b'], 'g2');

	it('places the group at the position of the first matched element', () => {
		expect(ids(result)).toStrictEqual(['x', 'g2', 'y']);
	});
});

// ---------------------------------------------------------------------------
// groupElements — no-op: fewer than 2 ids
// ---------------------------------------------------------------------------

describe('groupElements — no-op with fewer than 2 ids', () => {
	const elements: PptxElement[] = [makeShape('a', 0, 0, 100, 100)];

	it('returns the original elements when only 1 id is provided', () => {
		const { elements: result, groupId } = groupElements(elements, ['a'], 'g3');
		expect(groupId).toBeNull();
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('a');
	});

	it('returns the original elements when 0 ids are provided', () => {
		const { elements: result, groupId } = groupElements(elements, [], 'g4');
		expect(groupId).toBeNull();
		expect(result).toHaveLength(1);
	});

	it('returns no-op when the ids do not match any elements', () => {
		const { elements: result, groupId } = groupElements(elements, ['z1', 'z2'], 'g5');
		expect(groupId).toBeNull();
		expect(result).toHaveLength(1);
	});

	it('returns no-op when only 1 of 2 ids exists in the array', () => {
		const { elements: result, groupId } = groupElements(elements, ['a', 'missing'], 'g6');
		expect(groupId).toBeNull();
		expect(result).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// ungroupElements — basic ungrouping
// ---------------------------------------------------------------------------

describe('ungroupElements — basic', () => {
	// Construct a group manually (children are group-relative).
	const groupEl: PptxElement = {
		type: 'group',
		id: 'g1',
		name: 'Group',
		x: 10,
		y: 20,
		width: 130,
		height: 80,
		children: [
			makeShape('a-rel', 0, 0, 100, 50), // slide-abs should be (10,20)
			makeShape('b-rel', 50, 20, 80, 60), // slide-abs should be (60,40)
		],
	};
	const elements: PptxElement[] = [groupEl];
	const { elements: result, childIds: used } = ungroupElements(elements, 'g1', ['new-a', 'new-b']);

	it('removes the group and expands to its children', () => {
		expect(result).toHaveLength(2);
		expect(ids(result)).toStrictEqual(['new-a', 'new-b']);
	});

	it('restores slide-absolute coordinates', () => {
		// child 0: relative (0,0) + group (10,20) = absolute (10,20)
		expect(result[0].x).toBe(10);
		expect(result[0].y).toBe(20);

		// child 1: relative (50,20) + group (10,20) = absolute (60,40)
		expect(result[1].x).toBe(60);
		expect(result[1].y).toBe(40);
	});

	it('applies the supplied child ids in order', () => {
		expect(used).toStrictEqual(['new-a', 'new-b']);
	});

	it('does not mutate the original elements array', () => {
		expect(elements).toHaveLength(1);
		expect(elements[0].type).toBe('group');
	});
});

// ---------------------------------------------------------------------------
// ungroupElements — group surrounded by other elements preserves order
// ---------------------------------------------------------------------------

describe('ungroupElements — insertion order', () => {
	const elX = makeShape('x', 0, 0, 10, 10);
	const groupEl: PptxElement = {
		type: 'group',
		id: 'g1',
		name: 'Group',
		x: 50,
		y: 50,
		width: 100,
		height: 100,
		children: [makeShape('c1', 0, 0, 40, 40), makeShape('c2', 50, 50, 40, 40)],
	};
	const elY = makeShape('y', 300, 300, 10, 10);
	const elements: PptxElement[] = [elX, groupEl, elY];

	const { elements: result } = ungroupElements(elements, 'g1', ['n1', 'n2']);

	it('expands children in place of the group', () => {
		expect(ids(result)).toStrictEqual(['x', 'n1', 'n2', 'y']);
	});
});

// ---------------------------------------------------------------------------
// ungroupElements — no-op cases
// ---------------------------------------------------------------------------

describe('ungroupElements — no-op', () => {
	const elements: PptxElement[] = [makeShape('a', 0, 0, 100, 100)];

	it('returns the original elements when groupId is not found', () => {
		const { elements: result, childIds } = ungroupElements(elements, 'does-not-exist', ['n1']);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('a');
		expect(childIds).toHaveLength(0);
	});

	it('returns the original elements when the found element is not a group', () => {
		const { elements: result, childIds } = ungroupElements(elements, 'a', ['n1']);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('a');
		expect(childIds).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Round-trip: group then ungroup returns geometrically equivalent positions
// ---------------------------------------------------------------------------

describe('round-trip: group → ungroup', () => {
	const elA = makeShape('a', 10, 20, 100, 50);
	const elB = makeShape('b', 60, 40, 80, 60);
	const original: PptxElement[] = [elA, elB];

	// Step 1: group.
	const { elements: grouped, groupId: gid } = groupElements(original, ['a', 'b'], 'g-rt');
	if (gid === null) {
		throw new Error('Expected a group to be created');
	}

	// Step 2: supply new child ids to ungroup.
	const { elements: ungrouped } = ungroupElements(grouped, gid, ['a2', 'b2']);

	it('produces the same number of elements as before grouping', () => {
		expect(ungrouped).toHaveLength(original.length);
	});

	it('restores slide-absolute x for the first child', () => {
		const el = ungrouped.find((e) => e.id === 'a2');
		expect(el).toBeDefined();
		expect(el!.x).toBe(elA.x);
		expect(el!.y).toBe(elA.y);
	});

	it('restores slide-absolute x for the second child', () => {
		const el = ungrouped.find((e) => e.id === 'b2');
		expect(el).toBeDefined();
		expect(el!.x).toBe(elB.x);
		expect(el!.y).toBe(elB.y);
	});

	it('preserves width and height through the round-trip', () => {
		const a2 = ungrouped.find((e) => e.id === 'a2');
		const b2 = ungrouped.find((e) => e.id === 'b2');
		expect(a2!.width).toBe(elA.width);
		expect(a2!.height).toBe(elA.height);
		expect(b2!.width).toBe(elB.width);
		expect(b2!.height).toBe(elB.height);
	});
});
