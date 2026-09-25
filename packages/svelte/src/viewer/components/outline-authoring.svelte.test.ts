import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import {
	buildEditorContextMenuEntries,
	runContextMenuCommand,
} from '../editor/context-menu-dispatch';
import { EditorController } from '../editor/editor-controller.svelte';
import { EditorState } from '../editor/editor-state.svelte';
import OutlineAuthoringLayer from './OutlineAuthoringLayer.svelte';
import InsertTab from './ribbon/insert/InsertTab.svelte';

/**
 * Edit Points and the Freeform: Shape / Curve tools in the Svelte binding:
 * the context-menu entry, the overlay the shared `EditPointsSession` drives,
 * and the Insert tab's drawing tools. Behaviour is the shared session's; these
 * tests pin the WIRING (targets rendered, events forwarded, commits reaching
 * the editor as undoable patches), which no shared test can see.
 */

const CANVAS = { width: 960, height: 540 };

let cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups) {
		cleanup();
	}
	cleanups = [];
});

function rect(extra: Partial<ShapePptxElement> = {}): ShapePptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#4472c4' },
		...extra,
	};
}

function makeEditor(elements: PptxElement[] = [rect()]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements }]);
	return editor;
}

function mountInto<P extends Record<string, unknown>>(
	component: Parameters<typeof mount>[0],
	props: P,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	flushSync();
	cleanups.push(() => {
		unmount(instance);
		target.remove();
	});
	return target;
}

function pointer(type: string, clientX: number, clientY: number, extra: PointerEventInit = {}) {
	return new PointerEvent(type, { pointerId: 1, clientX, clientY, bubbles: true, ...extra });
}

function node(target: HTMLElement, id: string): Element {
	const found = target.querySelector(`[data-pptx-edit-points-target="${id}"]`);
	if (!found) {
		throw new Error(`no target ${id}`);
	}
	return found;
}

describe('edit points context-menu entry', () => {
	it('is offered for a shape and starts Edit Points', () => {
		const editor = makeEditor();
		editor.selection.set('shape-1');
		const entry = buildEditorContextMenuEntries({ editor }).find((e) => e.id === 'edit-points');
		expect(entry).toBeDefined();
		expect(entry?.disabled).toBeFalsy();
		runContextMenuCommand('edit-points', { editor });
		expect(editor.outlineOps.editPointsId).toBe('shape-1');
	});

	it('is greyed out for a noEditPoints lock and refuses to start', () => {
		const editor = makeEditor([rect({ locks: { noEditPoints: true } })]);
		editor.selection.set('shape-1');
		const entry = buildEditorContextMenuEntries({ editor }).find((e) => e.id === 'edit-points');
		expect(entry?.disabled).toBeTruthy();
		editor.outlineOps.startEditPoints('shape-1');
		expect(editor.outlineOps.editPointsId).toBeNull();
	});
});

describe('edit points overlay', () => {
	function start() {
		const editor = makeEditor();
		editor.selection.set('shape-1');
		editor.outlineOps.startEditPoints('shape-1');
		const target = mountInto(OutlineAuthoringLayer, { editor, canvasSize: CANVAS, scale: 1 });
		const svg = target.querySelector('[data-pptx-edit-points-overlay]') as SVGSVGElement;
		svg.setPointerCapture = () => undefined;
		svg.releasePointerCapture = () => undefined;
		return { editor, target, svg };
	}

	it('renders a target per vertex and segment', () => {
		const { target, svg } = start();
		expect(svg.getAttribute('data-pptx-edit-points-element')).toBe('shape-1');
		expect(target.querySelectorAll('[data-pptx-edit-points-node-type]')).toHaveLength(4);
		expect(node(target, 'segment:0:0')).toBeTruthy();
	});

	it('commits a node drag as one custom-geometry patch', () => {
		const { editor, target } = start();
		const vertex = node(target, 'node:0:2');
		vertex.dispatchEvent(pointer('pointerdown', 300, 200, { button: 0 }));
		vertex.dispatchEvent(pointer('pointermove', 340, 240));
		vertex.dispatchEvent(pointer('pointerup', 340, 240));
		flushSync();
		const shape = editor.slides[0].elements[0] as ShapePptxElement;
		expect(shape.shapeType).toBe('custom');
		expect(shape.width).toBeCloseTo(240, 6);
		expect(shape.height).toBeCloseTo(140, 6);
		expect(shape.customGeometryPaths?.[0].segments[0].type).toBe('moveTo');
		expect(editor.canUndo).toBeTruthy();
	});

	it('opens the vertex menu and runs a command from it', () => {
		const { editor, target } = start();
		node(target, 'node:0:1').dispatchEvent(
			new MouseEvent('contextmenu', { clientX: 300, clientY: 100, bubbles: true }),
		);
		flushSync();
		const menu = target.querySelector('[data-pptx-edit-points-menu]');
		expect(menu?.getAttribute('role')).toBe('menu');
		const smooth = target.querySelector(
			'[data-pptx-edit-points-command="smooth-point"] button',
		) as HTMLButtonElement;
		expect(smooth.getAttribute('role')).toBe('menuitemcheckbox');
		smooth.click();
		flushSync();
		const shape = editor.slides[0].elements[0] as ShapePptxElement;
		expect(
			shape.customGeometryPaths?.[0].segments.some((s) => s.type === 'cubicBezTo'),
		).toBeTruthy();
		expect(target.querySelector('[data-pptx-edit-points-menu]')).toBeNull();
	});

	it('leaves the mode on Escape', () => {
		const { editor, target } = start();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		expect(editor.outlineOps.editPointsId).toBeNull();
		expect(target.querySelector('[data-pptx-edit-points-overlay]')).toBeNull();
	});

	it('hides the resize chrome of the shape being edited', () => {
		const { editor } = start();
		const controller = new EditorController(editor, {
			getScale: () => 1,
			getCurrent: () => 0,
			getPresenting: () => false,
			getStageRoot: () => null,
			getHolderEl: () => null,
		});
		expect(controller.overlayBox).toBeNull();
		editor.outlineOps.exitEditPoints();
		expect(controller.overlayBox).not.toBeNull();
	});
});

describe('freeform drawing tools', () => {
	it('arm from the Insert tab and insert a custom shape on double-click', () => {
		const editor = makeEditor([]);
		const tab = mountInto(InsertTab, { editor, canvasSize: CANVAS });
		const button = tab.querySelector(
			'[data-pptx-drawing-tool="freeformShape"]',
		) as HTMLButtonElement;
		expect(tab.querySelector('[data-pptx-drawing-tool="curve"]')).toBeTruthy();
		button.click();
		flushSync();
		expect(editor.outlineOps.freeformTool).toBe('freeformShape');
		expect(button.getAttribute('aria-pressed')).toBe('true');

		const layer = mountInto(OutlineAuthoringLayer, { editor, canvasSize: CANVAS, scale: 1 });
		const svg = layer.querySelector('[data-pptx-freeform-tool-overlay]') as SVGSVGElement;
		expect(svg.getAttribute('data-pptx-freeform-tool-overlay')).toBe('freeformShape');
		svg.setPointerCapture = () => undefined;
		svg.releasePointerCapture = () => undefined;
		for (const [x, y] of [
			[100, 100],
			[300, 100],
			[200, 250],
			[200, 250],
		]) {
			svg.dispatchEvent(pointer('pointerdown', x, y, { button: 0 }));
			svg.dispatchEvent(pointer('pointerup', x, y));
		}
		svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		flushSync();
		const inserted = editor.slides[0].elements[0] as ShapePptxElement;
		expect(inserted.shapeType).toBe('custom');
		expect(inserted.customGeometryPaths?.[0].segments.map((s) => s.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'lineTo',
		]);
		expect(editor.outlineOps.freeformTool).toBeNull();
		expect(editor.selection.ids).toStrictEqual([inserted.id]);
	});

	it('arming a tool ends Edit Points', () => {
		const editor = makeEditor();
		editor.outlineOps.startEditPoints('shape-1');
		editor.outlineOps.armFreeformTool('curve');
		expect(editor.outlineOps.editPointsId).toBeNull();
		expect(editor.outlineOps.freeformTool).toBe('curve');
	});
});
