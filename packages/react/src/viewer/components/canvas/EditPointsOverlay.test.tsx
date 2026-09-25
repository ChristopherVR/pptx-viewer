// @vitest-environment happy-dom
import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import type { EditPointsElementPatch } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditPointsOverlay } from './EditPointsOverlay';
import { FreeformToolOverlay } from './FreeformToolOverlay';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const RECT: ShapePptxElement = {
	id: 'r1',
	type: 'shape',
	x: 100,
	y: 100,
	width: 200,
	height: 100,
	shapeType: 'rect',
};
const CANVAS = { width: 1280, height: 720 };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** happy-dom lays nothing out, so a client position IS the slide position. */
function pointer(target: Element, type: string, x: number, y: number, init: MouseEventInit = {}) {
	act(() => {
		target.dispatchEvent(
			new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, ...init }),
		);
	});
}

function renderEditPoints(element: PptxElement = RECT) {
	const onCommit = vi.fn<(id: string, patch: EditPointsElementPatch) => void>();
	const onExit = vi.fn();
	act(() => {
		root.render(
			<EditPointsOverlay
				element={element}
				canvasSize={CANVAS}
				scale={1}
				onCommit={onCommit}
				onExit={onExit}
			/>,
		);
	});
	return { onCommit, onExit };
}

describe('editPointsOverlay', () => {
	it('draws one target per vertex and segment of the converted preset', () => {
		renderEditPoints();
		expect(container.querySelector('[data-pptx-edit-points-overlay]')).not.toBeNull();
		expect(container.querySelectorAll('[data-pptx-edit-points-target^="node:"]')).toHaveLength(4);
		expect(container.querySelectorAll('[data-pptx-edit-points-target^="segment:"]')).toHaveLength(
			4,
		);
	});

	it('commits a vertex drag as a custom-geometry patch', () => {
		const { onCommit } = renderEditPoints();
		const node = container.querySelector('[data-pptx-edit-points-target="node:0:2"]')!;
		pointer(node, 'pointerdown', 300, 200);
		pointer(node, 'pointermove', 340, 240);
		pointer(node, 'pointerup', 340, 240);
		expect(onCommit).toHaveBeenCalledOnce();
		const [id, patch] = onCommit.mock.calls[0];
		expect(id).toBe('r1');
		expect(patch).toMatchObject({ shapeType: 'custom', width: 240, height: 140 });
	});

	it('opens the vertex menu on right-click and runs a command from it', () => {
		const { onCommit } = renderEditPoints();
		const node = container.querySelector('[data-pptx-edit-points-target="node:0:1"]')!;
		act(() => {
			node.dispatchEvent(
				new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 100, button: 2 }),
			);
		});
		const menu = container.querySelector('[data-pptx-edit-points-menu]');
		expect(menu?.getAttribute('role')).toBe('menu');
		const smooth = container.querySelector('[data-pptx-edit-points-command="smooth-point"] button');
		expect(smooth?.getAttribute('role')).toBe('menuitemcheckbox');
		act(() => (smooth as HTMLButtonElement).click());
		expect(onCommit).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-pptx-edit-points-menu]')).toBeNull();
	});

	it('leaves the mode on Escape and on a click away from the shape', () => {
		const { onExit } = renderEditPoints();
		act(() => {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(onExit).toHaveBeenCalledOnce();
		act(() => root.render(<div />));
		const again = renderEditPoints();
		const background = container.querySelector('[data-pptx-edit-points-overlay] rect')!;
		pointer(background, 'pointerdown', 900, 600);
		expect(again.onExit).toHaveBeenCalledOnce();
	});
});

describe('freeformToolOverlay', () => {
	it('inserts a closed freeform when the start point is clicked again', () => {
		const onCommit = vi.fn<(element: ShapePptxElement) => void>();
		const onCancel = vi.fn();
		act(() => {
			root.render(
				<FreeformToolOverlay
					tool='freeformShape'
					canvasSize={CANVAS}
					scale={1}
					onCommit={onCommit}
					onCancel={onCancel}
				/>,
			);
		});
		const svg = container.querySelector('[data-pptx-freeform-tool-overlay="freeformShape"]')!;
		for (const [x, y] of [
			[100, 100],
			[300, 120],
			[200, 260],
			[101, 101],
		]) {
			pointer(svg, 'pointerdown', x, y);
			pointer(svg, 'pointerup', x, y);
		}
		expect(onCommit).toHaveBeenCalledOnce();
		expect(onCommit.mock.calls[0][0].customGeometryPaths?.[0].segments.at(-1)?.type).toBe('close');
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('finishes an open curve on double-click', () => {
		const onCommit = vi.fn<(element: ShapePptxElement) => void>();
		act(() => {
			root.render(
				<FreeformToolOverlay
					tool='curve'
					canvasSize={CANVAS}
					scale={1}
					onCommit={onCommit}
					onCancel={() => undefined}
				/>,
			);
		});
		const svg = container.querySelector('[data-pptx-freeform-tool-overlay="curve"]')!;
		for (const [x, y] of [
			[100, 100],
			[200, 50],
			[300, 100],
		]) {
			pointer(svg, 'pointerdown', x, y);
			pointer(svg, 'pointerup', x, y);
		}
		act(() => {
			svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 300, clientY: 100 }));
		});
		expect(onCommit).toHaveBeenCalledOnce();
		expect(onCommit.mock.calls[0][0].customGeometryPaths?.[0].segments[1].type).toBe('cubicBezTo');
	});
});
