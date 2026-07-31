/**
 * Outline view, VanillaJS binding.
 *
 * The outline's rules are proved once in `pptx-viewer-shared`
 * (`render/outline-view` + `render/outline-view-edit`). What is worth proving
 * here is the glue: that the pane carries the neutral DOM contract `e2e/`
 * addresses all five viewers through, that a keystroke reaches the deck through
 * the viewer's own whole-deck commit (which is what makes undo work), and that
 * a read-only viewer stays read-only.
 */
import type { PptxElement, PptxSlide, TextPptxElement, TextSegment } from 'pptx-viewer-core';
import {
	OUTLINE_LEVEL_ATTR,
	OUTLINE_ROW_ATTR,
	OUTLINE_SLIDE_ATTR,
	OUTLINE_VIEW_ATTR,
} from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { OutlineViewOptions } from './outline-view';
import { openOutlineViewOverlay } from './outline-view';

const t = createTranslator();
const CANVAS = { width: 960, height: 540 };

function textElement(id: string, text: string, segments?: TextSegment[]): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 400,
		height: 80,
		text,
		textSegments: segments ?? [{ text, style: {} }],
	};
}

/** Two body paragraphs, the second nested one authored level deeper. */
const BODY_SEGMENTS: TextSegment[] = [
	{ text: 'Alpha', style: {} },
	{ text: '\n', style: {}, isParagraphBreak: true },
	{ text: 'Beta', style: {}, paragraphLevel: 1 },
];

function deck(): PptxSlide[] {
	return [
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [textElement('t1', 'Intro'), textElement('b1', 'Alpha\nBeta', BODY_SEGMENTS)],
		},
		// No elements at all: the outline still has to show the slide.
		{ id: 's2', rId: 'rId2', slideNumber: 2, elements: [] },
	];
}

interface Opened {
	root: HTMLElement;
	commit: ReturnType<typeof vi.fn>;
	onClose: ReturnType<typeof vi.fn>;
}

function open(over: Partial<OutlineViewOptions> = {}): Opened {
	const commit = vi.fn();
	const onClose = vi.fn();
	openOutlineViewOverlay(document, document.body, t, {
		slides: deck(),
		canvasSize: CANVAS,
		canEdit: true,
		commit,
		onClose,
		...over,
	});
	return {
		root: document.querySelector<HTMLElement>(`[${OUTLINE_VIEW_ATTR}]`)!,
		commit,
		onClose,
	};
}

function rows(root: HTMLElement): HTMLInputElement[] {
	return [...root.querySelectorAll<HTMLInputElement>(`input[${OUTLINE_ROW_ATTR}]`)];
}

function levels(root: HTMLElement): (string | null)[] {
	return rows(root).map((input) => input.getAttribute(OUTLINE_LEVEL_ATTR));
}

function type(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(input: HTMLInputElement, key: string, shiftKey = false): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
	input.dispatchEvent(event);
	return event;
}

/** The deck the last commit handed back to the viewer. */
function committed(commit: ReturnType<typeof vi.fn>): PptxSlide[] {
	return commit.mock.calls.at(-1)?.[0] as PptxSlide[];
}

/** The named element, narrowed to the text type the outline writes back. */
function textElementOf(slides: PptxSlide[], id: string): TextPptxElement | undefined {
	const found = slides
		.flatMap((slide) => slide.elements ?? [])
		.find((element) => element.id === id);
	return found?.type === 'text' ? found : undefined;
}

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('outline view overlay', () => {
	it('exposes the neutral outline DOM contract', () => {
		const { root } = open();
		expect(root.getAttribute('role')).toBe('region');
		expect(root.getAttribute('aria-label')).toBe(t('pptx.view.outlineView'));
		expect(rows(root)).toHaveLength(4);
		expect(rows(root).map((input) => input.getAttribute(OUTLINE_SLIDE_ATTR))).toStrictEqual([
			'1',
			'1',
			'1',
			'2',
		]);
	});

	it('shows the deck as a title per slide with its body lines stepped in', () => {
		const { root } = open();
		expect(rows(root).map((input) => input.value)).toStrictEqual(['Intro', 'Alpha', 'Beta', '']);
		// A title is the leftmost column, so an authored level 0 bullet reads as
		// outline level 1 and its nested sibling as 2.
		expect(levels(root)).toStrictEqual(['0', '1', '2', '0']);
		expect(rows(root)[0].getAttribute('aria-label')).toBe(t('pptx.outline.titleLine'));
		expect(rows(root)[1].getAttribute('aria-label')).toBe(t('pptx.outline.bodyLine'));
	});

	/**
	 * Hiding a slide from the one view whose entire job is to show the deck's
	 * structure is the worst failure this feature has.
	 */
	it('gives a slide with no text a title row of its own', () => {
		const { root } = open();
		const last = rows(root).at(-1)!;
		expect(last.value).toBe('');
		expect(last.getAttribute(OUTLINE_SLIDE_ATTR)).toBe('2');
		expect(last.getAttribute('aria-label')).toBe(t('pptx.outline.titleLine'));
	});

	it('numbers only the title row, so the pane reads as a list of slides', () => {
		const { root } = open();
		const numbers = [...root.querySelectorAll('.pptxv-outline-view-number')].map(
			(node) => node.textContent,
		);
		expect(numbers).toStrictEqual(['1', '', '', '2']);
	});

	it('sends a typed line to the slide through the viewer whole-deck commit', () => {
		const { root, commit } = open();
		type(rows(root)[0], 'Kickoff');
		expect(commit).toHaveBeenCalledOnce();
		expect(textElementOf(committed(commit), 't1')?.text).toBe('Kickoff');
		expect(commit.mock.calls[0][1]).toBe(0);
	});

	it('demotes on Tab and promotes on Shift+Tab', () => {
		const { root, commit } = open();
		const tab = press(rows(root)[1], 'Tab');
		// Without preventDefault, Tab walks straight out of the outline.
		expect(tab.defaultPrevented).toBeTruthy();
		expect(levels(root)).toStrictEqual(['0', '2', '2', '0']);

		press(rows(root)[2], 'Tab', true);
		expect(levels(root)).toStrictEqual(['0', '2', '1', '0']);
		expect(textElementOf(committed(commit), 'b1')?.textSegments?.[0].paragraphLevel).toBe(1);
	});

	it('starts a new slide when Enter is pressed on a title row', () => {
		const { root, commit } = open();
		const enter = press(rows(root)[0], 'Enter');
		expect(enter.defaultPrevented).toBeTruthy();
		expect(committed(commit)).toHaveLength(3);
		// The editor lands on the slide the outline just created.
		expect(commit.mock.calls[0][1]).toBe(1);
		expect(rows(root).map((input) => input.getAttribute(OUTLINE_SLIDE_ATTR))).toStrictEqual([
			'1',
			'1',
			'1',
			'2',
			'3',
		]);
		// The caret follows the new slide, so a title can be typed immediately.
		expect(document.activeElement).toBe(rows(root)[3]);
	});

	it('adds a body line when Enter is pressed on a body row', () => {
		const { root, commit } = open();
		press(rows(root)[1], 'Enter');
		expect(committed(commit)).toHaveLength(2);
		expect(rows(root).map((input) => input.value)).toStrictEqual([
			'Intro',
			'Alpha',
			'',
			'Beta',
			'',
		]);
	});

	it('renders read-only and refuses every edit when the viewer cannot edit', () => {
		const { root, commit } = open({ canEdit: false });
		expect(rows(root).every((input) => input.readOnly)).toBeTruthy();
		type(rows(root)[0], 'Kickoff');
		press(rows(root)[1], 'Tab');
		press(rows(root)[0], 'Enter');
		expect(commit).not.toHaveBeenCalled();
		expect(rows(root)).toHaveLength(4);
	});

	/**
	 * Undo (and a collaborator's edit) replaces the deck underneath an open pane.
	 * A pane still showing its opening snapshot would write that stale deck back
	 * on the next keystroke.
	 */
	it('follows the deck when it changes underneath', () => {
		let publish: ((slides: readonly PptxSlide[]) => void) | undefined;
		const { root } = open({
			subscribe: (listener) => {
				publish = listener;
				return () => {
					publish = undefined;
				};
			},
		});
		publish?.([
			{ id: 's9', rId: 'rId9', slideNumber: 1, elements: [textElement('t9', 'Reverted')] },
		]);
		expect(rows(root).map((input) => input.value)).toStrictEqual(['Reverted']);
	});

	it('returns to Normal view and drops its subscription on close', () => {
		const stop = vi.fn();
		const { root, onClose } = open({ subscribe: () => stop });
		const exit = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.getAttribute('aria-label') === t('pptx.statusBar.normalView'),
		)!;
		exit.click();
		expect(onClose).toHaveBeenCalledOnce();
		expect(stop).toHaveBeenCalledOnce();
		expect(document.querySelector(`[${OUTLINE_VIEW_ATTR}]`)).toBeNull();
	});
});
