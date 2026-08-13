import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * On-canvas enforcement of the authored `a:spLocks` interaction locks.
 *
 * Angular read `element.locks` in exactly ONE place (the inspector's Lock
 * button), so the button locked nothing: a `noSelect` shape still answered the
 * hit-test, a `noMove` shape still armed a drag, and a `noResize` /
 * `noRotation` shape still grew its eight resize handles and its rotate knob.
 * These tests pin every one of those gates to the shared `element-locks`
 * decision function.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeResizeHandleBoxes,
	computeRotateHandleBox,
	computeSingleSelected,
	resolveInteractiveElementId,
} from './selection-geometry';
import { isElementInteractive } from './template-mode';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function shape(id: string, locks?: PptxElement['locks']): PptxElement {
	return {
		type: 'shape',
		id,
		name: id,
		x: 10,
		y: 20,
		width: 100,
		height: 60,
		...(locks ? { locks } : {}),
	} as PptxElement;
}

/** A rendered element node, as every binding stamps it. */
function node(id: string): Element {
	const el = document.createElement('div');
	el.setAttribute('data-element-id', id);
	document.body.appendChild(el);
	return el;
}

const box = (element: PptxElement) => computeSingleSelected([element], [element.id]);

// ---------------------------------------------------------------------------
// noSelect: not an interactive hit, not marquee-selectable
// ---------------------------------------------------------------------------

describe('noSelect', () => {
	it('makes an element non-interactive, so a marquee never sweeps it up', () => {
		expect(isElementInteractive(shape('free'), true, false)).toBeTruthy();
		expect(isElementInteractive(shape('pinned', { noSelect: true }), true, false)).toBeFalsy();
	});

	it('stops the pointer hit-test resolving the element', () => {
		const locked = shape('locked', { noSelect: true });
		const free = shape('free');
		const all = [locked, free];
		expect(resolveInteractiveElementId(node('free'), all, false)).toBe('free');
		expect(resolveInteractiveElementId(node('locked'), all, false)).toBeNull();
	});

	it('subsumes every other gesture (a no-select shape resizes and rotates nowhere)', () => {
		const locked = shape('locked', { noSelect: true });
		expect(computeResizeHandleBoxes(locked, box(locked), true, 24, 1)).toStrictEqual([]);
		expect(computeRotateHandleBox(locked, box(locked), true, 24, 24, 1)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// noResize / noRotation: no handles rendered
// ---------------------------------------------------------------------------

describe('noResize', () => {
	it('yields no resize handle boxes', () => {
		const locked = shape('locked', { noResize: true });
		expect(computeResizeHandleBoxes(locked, box(locked), true, 24, 1)).toStrictEqual([]);
	});

	it('leaves an unlocked element with its eight handles', () => {
		const free = shape('free');
		expect(computeResizeHandleBoxes(free, box(free), true, 24, 1)).toHaveLength(8);
	});

	it('still allows rotation: each lock gates exactly one gesture', () => {
		const locked = shape('locked', { noResize: true });
		expect(computeRotateHandleBox(locked, box(locked), true, 24, 24, 1)).not.toBeNull();
	});
});

describe('noRotation', () => {
	it('yields no rotate handle', () => {
		const locked = shape('locked', { noRotation: true });
		expect(computeRotateHandleBox(locked, box(locked), true, 24, 24, 1)).toBeNull();
	});

	it('still allows resizing', () => {
		const locked = shape('locked', { noRotation: true });
		expect(computeResizeHandleBoxes(locked, box(locked), true, 24, 1)).toHaveLength(8);
	});
});

// ---------------------------------------------------------------------------
// noMove / noTextEdit: gated in the component's pointer paths
//
// The canvas component needs a TestBed to drive real pointer events (this
// package has none: see `vitest.config.ts`), so its two remaining gates are
// pinned against the component SOURCE, exactly as
// `slide-canvas-handle-labels.test.ts` pins the accessible names. Both
// assertions fail on the pre-change file, which armed the move drag and opened
// the inline editor with no lock check at all.
// ---------------------------------------------------------------------------

const component = readFileSync(join(__dirname, 'slide-canvas.component.ts'), 'utf8');

describe('slide-canvas pointer gates', () => {
	it('refuses to arm a move drag on a noMove element', () => {
		expect(component).toContain(`if (!canInteractWithElement(el, 'move')) {`);
	});

	it('gates inline text editing on noTextEdit', () => {
		expect(component).toContain(`'textEdit',`);
		expect(component).toContain('this.canTextEdit(id)');
	});

	it('guards the resize and rotate handle pointer-downs, not just their rendering', () => {
		expect(component).toContain(`!canInteractWithElement(this.singleSelectedElement(), 'resize')`);
		expect(component).toContain(`!canInteractWithElement(el, 'rotate')`);
	});
});
