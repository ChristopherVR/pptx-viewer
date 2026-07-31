import type { PptxElement } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveInteractiveElementId } from './selection-geometry';

/**
 * Regression cover for the group hit-test.
 *
 * A group renders its children's `data-element-id` nodes inside its own, and
 * the resolver used to answer with the innermost one. That id is not in
 * `allElements`, so the lookup failed and a click on any child of a group
 * CLEARED the selection: Ungroup was reachable only through a gap between the
 * children, which a tightly packed group does not have.
 */
const box = { x: 0, y: 0, width: 100, height: 50 };

const elements = [
	{ ...box, id: 'group-1', type: 'group', children: [] },
	{ ...box, id: 'shape-1', type: 'shape' },
	{ ...box, id: 'layout-title', type: 'text' },
] as unknown as PptxElement[];

let child: HTMLElement;
let shape: HTMLElement;
let outside: HTMLElement;
let templateNode: HTMLElement;

beforeEach(() => {
	document.body.innerHTML = '';
	const group = document.createElement('div');
	group.dataset['elementId'] = 'group-1';
	child = document.createElement('div');
	child.dataset['elementId'] = 'child-1';
	const grandchild = document.createElement('span');
	child.appendChild(grandchild);
	group.appendChild(child);

	shape = document.createElement('div');
	shape.dataset['elementId'] = 'shape-1';

	templateNode = document.createElement('div');
	templateNode.dataset['elementId'] = 'layout-title';

	outside = document.createElement('div');
	document.body.append(group, shape, templateNode, outside);
});

describe('resolveInteractiveElementId', () => {
	it('selects the GROUP when the pointer lands on one of its children', () => {
		expect(resolveInteractiveElementId(child, elements, false)).toBe('group-1');
	});

	it('selects the group from a node nested deeper inside a child', () => {
		expect(resolveInteractiveElementId(child.firstElementChild, elements, false)).toBe('group-1');
	});

	it('still resolves an ungrouped element to itself', () => {
		expect(resolveInteractiveElementId(shape, elements, false)).toBe('shape-1');
	});

	it('clears the selection for a pointer outside every element', () => {
		expect(resolveInteractiveElementId(outside, elements, false)).toBeNull();
		expect(resolveInteractiveElementId(null, elements, false)).toBeNull();
	});

	it('keeps template elements inert unless edit-template mode is on', () => {
		expect(resolveInteractiveElementId(templateNode, elements, false)).toBeNull();
		expect(resolveInteractiveElementId(templateNode, elements, true)).toBe('layout-title');
	});
});
