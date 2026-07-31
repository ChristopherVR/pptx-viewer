/**
 * Outline view, Svelte binding.
 *
 * The outline's rules are proved once in `pptx-viewer-shared/render/outline-view`
 * and `.../outline-view-edit`, and the ribbon control that opens this pane is
 * covered by `ribbon/view/ViewTab.svelte.test.ts`. What is worth proving here is
 * the glue: that the pane carries the neutral DOM contract `e2e/` addresses all
 * five viewers through, and above all that a keystroke in a row actually reaches
 * the deck. Both have been the thing that broke in a past parity wave, never the
 * shared maths.
 *
 * Named `*.svelte.test.ts` so the harness's props object can be wrapped in
 * `$state(...)`: the overlay hands a new deck back on every edit, and without a
 * reactive props object it would never re-render with the deck it just produced.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { OUTLINE_LEVEL_ATTR, OUTLINE_ROW_ATTR, OUTLINE_VIEW_ATTR } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import OutlineViewOverlay from './OutlineViewOverlay.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

// ---------------------------------------------------------------------------
// Fixtures (the shape the React binding's own outline test uses)
// ---------------------------------------------------------------------------

function textElement(id: string, partial: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id,
		name: 'Text Box',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: '',
		...partial,
	} as PptxElement;
}

const placeholder = (phType: string): Record<string, unknown> => ({
	'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': phType } } },
});

function deck(): PptxSlide[] {
	return [
		{
			id: 's1',
			rId: '',
			slideNumber: 1,
			elements: [
				textElement('t', { text: 'Agenda', rawXml: placeholder('title') }),
				textElement('b', {
					rawXml: placeholder('body'),
					text: 'First\nSecond',
					textSegments: [
						{ text: 'First', style: {} },
						{ text: '\n', style: {}, isParagraphBreak: true },
						{ text: 'Second', style: {} },
					],
				}),
			],
		},
		// A slide with no text at all: it must still appear, or the outline hides it.
		{ id: 's2', rId: '', slideNumber: 2, elements: [] },
	] as PptxSlide[];
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
	target: HTMLElement;
	/** The live deck: every commit the overlay makes is fed straight back in. */
	slides: () => PptxSlide[];
	activeSlide: () => number;
	closed: () => number;
}

/**
 * Mount the overlay over a deck that is echoed back on commit, which is exactly
 * what `EditorState.commitSlides` does for it in the real binding.
 */
function mountOverlay(canEdit = true): Harness {
	const target = document.createElement('div');
	document.body.appendChild(target);
	let active = 0;
	let closes = 0;
	const props = $state({
		slides: deck(),
		canvasSize: { width: 960, height: 540 },
		canEdit,
		oncommit: (next: PptxSlide[]) => {
			props.slides = next;
		},
		onactiveslide: (index: number) => {
			active = index;
		},
		onclose: () => {
			closes += 1;
		},
	});
	const instance = mount(OutlineViewOverlay, { target, props });
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return {
		target,
		slides: () => props.slides,
		activeSlide: () => active,
		closed: () => closes,
	};
}

const rowInputs = (target: HTMLElement): HTMLInputElement[] => [
	...target.querySelectorAll<HTMLInputElement>(`[${OUTLINE_ROW_ATTR}]`),
];

const levels = (target: HTMLElement): (string | null)[] =>
	rowInputs(target).map((input) => input.getAttribute(OUTLINE_LEVEL_ATTR));

const bodyText = (harness: Harness): string | undefined => {
	const element = harness.slides()[0].elements.find((candidate) => candidate.id === 'b');
	return (element as { text?: string } | undefined)?.text;
};

function typeInto(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

function press(input: HTMLInputElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	input.dispatchEvent(event);
	flushSync();
	return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('outlineViewOverlay', () => {
	it('exposes the neutral outline DOM contract', () => {
		const { target } = mountOverlay();
		const root = target.querySelector(`[${OUTLINE_VIEW_ATTR}]`);

		expect(root).toBeTruthy();
		expect(root?.getAttribute('role')).toBe('region');
		expect(root?.getAttribute('aria-label')).toBe('Outline View');
		expect(rowInputs(target)[0].getAttribute('aria-label')).toBe('Slide title');
		expect(rowInputs(target)[1].getAttribute('aria-label')).toBe('Outline line');
	});

	it('reflects the deck: title, body lines, and the titleless slide', () => {
		const { target } = mountOverlay();

		expect(rowInputs(target).map((input) => input.value)).toStrictEqual([
			'Agenda',
			'First',
			'Second',
			'',
		]);
		expect(levels(target)).toStrictEqual(['0', '1', '1', '0']);
		// Only a title row is numbered, so the outline reads as a list of slides.
		const numbers = [...target.querySelectorAll('.pptx-svelte-outline-number')];
		expect(numbers.map((node) => node.textContent)).toStrictEqual(['1', '', '', '2']);
	});

	it('an edit reaches the slide', () => {
		const harness = mountOverlay();

		typeInto(rowInputs(harness.target)[1], 'Rewritten');

		expect(bodyText(harness)).toBe('Rewritten\nSecond');
		expect(rowInputs(harness.target)[1].value).toBe('Rewritten');
		expect(harness.activeSlide()).toBe(0);
	});

	it('typing into a titleless slide creates its title', () => {
		const harness = mountOverlay();

		typeInto(rowInputs(harness.target)[3], 'Brand new');

		expect(harness.slides()[1].elements).toHaveLength(1);
		expect(rowInputs(harness.target)[3].value).toBe('Brand new');
		expect(harness.activeSlide()).toBe(1);
	});

	it('demotes a body line with Tab and promotes it with Shift+Tab', () => {
		const { target } = mountOverlay();

		// Tab must not walk out of the outline, which is why it is prevented.
		const demote = press(rowInputs(target)[1], { key: 'Tab' });
		expect(demote.defaultPrevented).toBeTruthy();
		expect(levels(target)).toStrictEqual(['0', '2', '1', '0']);

		press(rowInputs(target)[1], { key: 'Tab', shiftKey: true });
		expect(levels(target)).toStrictEqual(['0', '1', '1', '0']);
	});

	it('adds a slide when Enter is pressed on a title row', () => {
		const harness = mountOverlay();

		press(rowInputs(harness.target)[0], { key: 'Enter' });

		expect(harness.slides()).toHaveLength(3);
		expect(rowInputs(harness.target)).toHaveLength(5);
		expect(harness.activeSlide()).toBe(1);
	});

	/**
	 * The row an edit produced is a brand-new element, so focus has to be handed
	 * to it after the re-render. Without this the caret fell back to the document
	 * and the next keystroke went nowhere.
	 */
	it('moves the caret to the row the edit created, at its end', () => {
		const harness = mountOverlay();

		// The new slide lands after slide 1, so its title row follows slide 1's
		// three rows rather than sitting directly under the row Enter was pressed in.
		press(rowInputs(harness.target)[0], { key: 'Enter' });
		expect(document.activeElement).toBe(rowInputs(harness.target)[3]);

		typeInto(rowInputs(harness.target)[3], 'Second slide');
		const focused = document.activeElement as HTMLInputElement;
		expect(focused.value).toBe('Second slide');
		expect(focused.selectionStart).toBe('Second slide'.length);
	});

	/**
	 * A read-only deck still gets a readable outline. The failure to avoid is a
	 * viewer that accepts edits it could never save.
	 */
	it('is read-only when the viewer cannot edit', () => {
		const harness = mountOverlay(false);

		expect(rowInputs(harness.target).every((input) => input.readOnly)).toBeTruthy();

		press(rowInputs(harness.target)[1], { key: 'Tab' });
		expect(levels(harness.target)).toStrictEqual(['0', '1', '1', '0']);

		typeInto(rowInputs(harness.target)[1], 'Ignored');
		expect(bodyText(harness)).toBe('First\nSecond');
	});

	it('offers a way back to the normal view', () => {
		const harness = mountOverlay();

		harness.target.querySelector<HTMLButtonElement>('button[aria-label="Normal view"]')?.click();
		flushSync();

		expect(harness.closed()).toBe(1);
	});
});
