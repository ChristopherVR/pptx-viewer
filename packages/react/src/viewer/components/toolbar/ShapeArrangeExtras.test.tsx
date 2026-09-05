// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ShapeArrangeExtras } from './ShapeArrangeExtras';
import type { ShapeArrangeExtrasProps } from './ShapeArrangeExtras';

/**
 * Pins the repoint onto the shared `canGroupSelection` / `canUngroupSelection`
 * / `canSetStrokeWidth` / `strokeWidthOf` (render/arrange-extras.ts): Group
 * needs >=2 selected, Ungroup needs a group element, and the stroke-width
 * spinner defaults to 1 for a shape without one.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function baseProps(overrides: Partial<ShapeArrangeExtrasProps> = {}): ShapeArrangeExtrasProps {
	return {
		canEdit: true,
		selectedElement: null,
		selectedCount: 0,
		selectionGroupable: true,
		onGroupElements: () => {},
		onUngroupElement: () => {},
		onUpdateElementStyle: () => {},
		...overrides,
	};
}

function shapeElement(strokeWidth?: number): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeStyle: strokeWidth === undefined ? undefined : { strokeWidth },
	} as unknown as PptxElement;
}

describe('shapeArrangeExtras', () => {
	it('disables Group with fewer than two selected, enables it with two', () => {
		act(() => root.render(<ShapeArrangeExtras {...baseProps({ selectedCount: 1 })} />));
		const buttons = container.querySelectorAll('button');
		expect((buttons[0] as HTMLButtonElement).disabled).toBeTruthy();

		act(() => root.render(<ShapeArrangeExtras {...baseProps({ selectedCount: 2 })} />));
		const buttons2 = container.querySelectorAll('button');
		expect((buttons2[0] as HTMLButtonElement).disabled).toBeFalsy();
	});

	it('disables Group when a:spLocks/@noGrp locks a selected element even with two selected', () => {
		act(
			() =>
				void root.render(
					<ShapeArrangeExtras {...baseProps({ selectedCount: 2, selectionGroupable: false })} />,
				),
		);
		const buttons = container.querySelectorAll('button');
		expect((buttons[0] as HTMLButtonElement).disabled).toBeTruthy();
	});

	it('enables Ungroup only when the selection is a group element', () => {
		act(
			() =>
				void root.render(
					<ShapeArrangeExtras {...baseProps({ selectedElement: shapeElement() })} />,
				),
		);
		const buttons = container.querySelectorAll('button');
		expect((buttons[1] as HTMLButtonElement).disabled).toBeTruthy();

		const group = { id: 'g1', type: 'group', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		act(() => root.render(<ShapeArrangeExtras {...baseProps({ selectedElement: group })} />));
		const buttons2 = container.querySelectorAll('button');
		expect((buttons2[1] as HTMLButtonElement).disabled).toBeFalsy();
	});

	it('disables Ungroup when a:grpSpLocks/@noGrp is set on the group itself', () => {
		const lockedGroup = {
			id: 'g1',
			type: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			locks: { noGrouping: true },
		} as PptxElement;
		act(() => root.render(<ShapeArrangeExtras {...baseProps({ selectedElement: lockedGroup })} />));
		const buttons = container.querySelectorAll('button');
		expect((buttons[1] as HTMLButtonElement).disabled).toBeTruthy();
	});

	it('defaults the stroke-width spinner to 1 for a shape with no strokeWidth set', () => {
		act(
			() =>
				void root.render(
					<ShapeArrangeExtras {...baseProps({ selectedElement: shapeElement() })} />,
				),
		);
		const input = container.querySelector('input[type="number"]') as HTMLInputElement;
		expect(input.value).toBe('1');
		expect(input.disabled).toBeFalsy();
	});

	it('reflects an explicit strokeWidth and disables the spinner for a non-shape element', () => {
		act(
			() =>
				void root.render(
					<ShapeArrangeExtras {...baseProps({ selectedElement: shapeElement(4) })} />,
				),
		);
		const input = container.querySelector('input[type="number"]') as HTMLInputElement;
		expect(input.value).toBe('4');

		const group = { id: 'g1', type: 'group', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		act(() => root.render(<ShapeArrangeExtras {...baseProps({ selectedElement: group })} />));
		const inputGroup = container.querySelector('input[type="number"]') as HTMLInputElement;
		expect(inputGroup.disabled).toBeTruthy();
	});
});
