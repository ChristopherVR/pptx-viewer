/**
 * group-drill-canvas.test.ts: selecting inside a group, the Angular canvas's
 * side (mirrors React's `useCanvasInteractions.group-drill.test.tsx`). Shared
 * `group-drill` decides; these pin that the canvas asks it with the right
 * inputs and acts on its answer: the first press selects the group, a press on
 * a member of the selected group selects that member, a press on another
 * member moves to it, the selected member stays selected (its text opens on
 * release), a double-click goes straight to the member under the pointer, and
 * Escape steps a member back out to its group. Member updates arrive in slide
 * space and are written back into the group.
 */

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	moveElementBy,
	resizeElement,
	setElementPosition,
	updateElementById,
} from './element-operations';
import {
	enteredGroupBox,
	escapeSelectionTarget,
	groupDrillChain,
	placeTextareaCaretAt,
	renderedTextOffsetAt,
	resolveGroupDoubleClickTarget,
	resolveGroupPressTarget,
	withGroupMembers,
} from './group-drill-canvas';
import { computeSelectionBoxes, computeSingleSelected } from './selection-geometry';

const card = (id: string, x: number) =>
	({
		id,
		type: 'shape',
		x,
		y: 0,
		width: 100,
		height: 60,
		shapeType: 'roundRect',
		text: `${id} title`,
	}) as unknown as PptxElement;
// A group at (200, 100) with two cards side by side (children are group-relative).
const cards = {
	id: 'cards',
	type: 'group',
	x: 200,
	y: 100,
	width: 220,
	height: 60,
	children: [card('a', 0), card('b', 120)],
} as unknown as PptxElement;
const plain = card('plain', 0);
const slideElements: PptxElement[] = [plain, cards];

// Slide-space points over card a, card b, and the gap between them.
const overA = { x: 250, y: 130 };
const overB = { x: 370, y: 130 };
const overGap = { x: 310, y: 130 };

type Tree = PptxElement & { children?: Tree[] };
const childOf = (elements: readonly PptxElement[], id: string) =>
	(elements.find((el) => el.id === 'cards') as Tree).children?.find((el) => el.id === id);

describe('resolveGroupPressTarget', () => {
	it('selects the group on the first press', () => {
		expect(resolveGroupPressTarget(slideElements, 'cards', overA, [])).toBe('cards');
		expect(resolveGroupPressTarget(slideElements, 'cards', overA, ['plain'])).toBe('cards');
	});

	it('selects the member under the pointer once the group is selected', () => {
		expect(resolveGroupPressTarget(slideElements, 'cards', overA, ['cards'])).toBe('a');
		expect(resolveGroupPressTarget(slideElements, 'cards', overB, ['cards'])).toBe('b');
	});

	it('moves to another member of the entered group', () => {
		expect(resolveGroupPressTarget(slideElements, 'cards', overB, ['a'])).toBe('b');
	});

	it('keeps the selected member selected (its text opens on release)', () => {
		expect(resolveGroupPressTarget(slideElements, 'cards', overA, ['a'])).toBe('a');
	});

	it('keeps the group on a press between its members', () => {
		expect(resolveGroupPressTarget(slideElements, 'cards', overGap, ['cards'])).toBe('cards');
	});

	it('leaves non-groups, rotated groups and multi-selections alone', () => {
		expect(resolveGroupPressTarget(slideElements, 'plain', { x: 10, y: 10 }, ['plain'])).toBe(
			'plain',
		);
		const rotated = [{ ...cards, rotation: 30 } as PptxElement];
		expect(resolveGroupPressTarget(rotated, 'cards', overA, ['cards'])).toBe('cards');
		expect(groupDrillChain(rotated, 'cards', overA)).toBeNull();
		expect(resolveGroupPressTarget(slideElements, 'cards', overA, ['cards', 'plain'])).toBe(
			'cards',
		);
	});
});

describe('resolveGroupDoubleClickTarget', () => {
	it('goes straight to the member under the pointer', () => {
		expect(resolveGroupDoubleClickTarget(slideElements, 'cards', overB)).toBe('b');
	});

	it('stays on the group between members, and on a plain shape', () => {
		expect(resolveGroupDoubleClickTarget(slideElements, 'cards', overGap)).toBe('cards');
		expect(resolveGroupDoubleClickTarget(slideElements, 'plain', { x: 1, y: 1 })).toBe('plain');
	});
});

describe('escapeSelectionTarget', () => {
	it('steps a selected member up to its group, then clears', () => {
		expect(escapeSelectionTarget(slideElements, ['a'])).toBe('cards');
		expect(escapeSelectionTarget(slideElements, ['cards'])).toBeNull();
		expect(escapeSelectionTarget(slideElements, [])).toBeNull();
		expect(escapeSelectionTarget(undefined, ['a'])).toBeNull();
	});
});

describe('member chrome in slide space', () => {
	const lookup = withGroupMembers(slideElements, slideElements);

	it('adds every member in slide space after the top-level elements', () => {
		expect(lookup.map((el) => el.id)).toStrictEqual(['plain', 'cards', 'a', 'b']);
		expect(withGroupMembers([plain], [plain])).toStrictEqual([plain]);
	});

	it('draws the selected member where it is on the slide', () => {
		expect(computeSingleSelected(lookup, ['b'])).toStrictEqual({
			id: 'b',
			x: 320,
			y: 100,
			width: 100,
			height: 60,
		});
		expect(computeSelectionBoxes(lookup, ['a'])).toStrictEqual([
			{ id: 'a', x: 200, y: 100, width: 100, height: 60 },
		]);
	});

	it('frames the entered group while one of its members is selected', () => {
		expect(enteredGroupBox(slideElements, ['a'])).toStrictEqual({
			id: 'cards',
			x: 200,
			y: 100,
			width: 220,
			height: 60,
		});
		expect(enteredGroupBox(slideElements, ['cards'])).toBeNull();
		expect(enteredGroupBox(slideElements, ['a', 'b'])).toBeNull();
	});
});

describe('member updates are written back into the group', () => {
	it('translates a slide-space move/position back into group space', () => {
		const moved = updateElementById(slideElements, 'b', { x: 340, y: 110 });
		expect(childOf(moved, 'b')?.x).toBe(140);
		expect(childOf(moved, 'b')?.y).toBe(10);
		expect(moved[0]).toBe(plain);

		const positioned = setElementPosition(slideElements, 'a', 210, 100);
		expect(childOf(positioned, 'a')?.x).toBe(10);

		const nudged = moveElementBy(slideElements, 'a', 5, -2);
		expect(childOf(nudged, 'a')?.x).toBe(5);
		expect(childOf(nudged, 'a')?.y).toBe(-2);
	});

	it('resizes and patches text on a member, keeping its type', () => {
		const resized = resizeElement(slideElements, 'a', 0, 80);
		expect(childOf(resized, 'a')?.width).toBe(1);
		expect(childOf(resized, 'a')?.height).toBe(80);
		const typed = updateElementById(slideElements, 'a', {
			text: 'new',
			type: 'image',
		} as unknown as Partial<PptxElement>);
		expect(childOf(typed, 'a')?.type).toBe('shape');
		expect((childOf(typed, 'a') as { text?: string }).text).toBe('new');
	});

	it('keeps top-level updates as before', () => {
		const next = updateElementById(slideElements, 'plain', { x: 7 });
		expect(next[0].x).toBe(7);
		expect(next[1]).toBe(cards);
	});
});

describe('placeTextareaCaretAt', () => {
	type CaretDoc = Document & {
		caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
	};

	it('puts the caret at the click point, read against a mirror of the textarea', () => {
		const textarea = document.createElement('textarea');
		textarea.value = 'hello world';
		textarea.getBoundingClientRect = () =>
			({
				left: 0,
				top: 0,
				right: 200,
				bottom: 50,
				width: 200,
				height: 50,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;
		document.body.appendChild(textarea);
		const doc = document as CaretDoc;
		const original = doc.caretPositionFromPoint;
		// The browser answers with the mirror's text node (the last thing appended while measuring).
		doc.caretPositionFromPoint = () => ({
			offsetNode: document.body.lastElementChild!.firstChild!,
			offset: 3,
		});
		try {
			placeTextareaCaretAt(textarea, { clientX: 10, clientY: 10 });
			expect(textarea.selectionStart).toBe(3);
			expect(textarea.selectionEnd).toBe(3);
		} finally {
			doc.caretPositionFromPoint = original;
			textarea.remove();
		}
	});

	it('falls back to the end without a point or a usable position', () => {
		const textarea = document.createElement('textarea');
		textarea.value = 'hello';
		document.body.appendChild(textarea);
		const doc = document as CaretDoc;
		const original = doc.caretPositionFromPoint;
		doc.caretPositionFromPoint = () => ({ offsetNode: document.body, offset: 1 });
		try {
			placeTextareaCaretAt(textarea, null);
			expect(textarea.selectionStart).toBe(5);
			textarea.setSelectionRange(0, 0);
			placeTextareaCaretAt(textarea, { clientX: 1, clientY: 1 });
			expect(textarea.selectionStart).toBe(5);
		} finally {
			doc.caretPositionFromPoint = original;
			textarea.remove();
		}
	});

	it('maps a click on the rendered text to the editor text offset, across paragraphs', () => {
		// "Scale" on line 1 (y 0..30), "Up to" on line 2 (y 40..60); 10px per character.
		const root = document.createElement('div');
		root.innerHTML = '<p>Scale</p><p>Up to</p>';
		document.body.appendChild(root);
		const lines = [...root.querySelectorAll('p')].map((p) => p.firstChild);
		const proto = Range.prototype as unknown as { getBoundingClientRect: () => DOMRect };
		const original = proto.getBoundingClientRect;
		proto.getBoundingClientRect = function (this: Range) {
			const line = lines.indexOf(this.startContainer as ChildNode);
			const top = line === 0 ? 0 : 40;
			const left = this.startOffset * 10;
			return {
				left,
				right: left + 10,
				top,
				bottom: top + (line === 0 ? 30 : 20),
				width: 10,
				height: 20,
				x: left,
				y: top,
				toJSON: () => ({}),
			} as DOMRect;
		};
		try {
			expect(renderedTextOffsetAt(root, 'Scale\nUp to', 22, 15)).toBe(2); // "Sc|ale"
			expect(renderedTextOffsetAt(root, 'Scale\nUp to', 7, 50)).toBe(7); // "U|p to", after the break
			expect(renderedTextOffsetAt(root, 'Scale\nUp to', 22, 35)).toBeNull(); // between the lines
		} finally {
			proto.getBoundingClientRect = original;
			root.remove();
		}
	});
});
