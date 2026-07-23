import type { PptxElement } from 'pptx-viewer-core';
import type { SanitizedPresence } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { createRemoteSelectionOverlay } from './remote-selection-overlay';

function buildElement(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
): PptxElement {
	return { id, type: 'shape', x, y, width, height } as PptxElement;
}

function buildPresence(overrides: Partial<SanitizedPresence> = {}): SanitizedPresence {
	return {
		clientId: 1,
		userName: 'Ada',
		userColor: '#ff0000',
		activeSlideIndex: 0,
		cursorX: 0,
		cursorY: 0,
		lastUpdated: new Date().toISOString(),
		selectedElementId: 'el1',
		...overrides,
	};
}

const elements = [buildElement('el1', 40, 30, 200, 100), buildElement('el2', 300, 200, 50, 50)];

function boxes(el: HTMLElement): HTMLElement[] {
	return Array.from(el.querySelectorAll<HTMLElement>('.pptxv-remote-selection'));
}

describe('createRemoteSelectionOverlay', () => {
	it('draws one box per remote selection on the active slide, scaled and coloured', () => {
		const overlay = createRemoteSelectionOverlay(document);
		overlay.update([buildPresence()], elements, 0, 2);

		const drawn = boxes(overlay.el);
		expect(drawn).toHaveLength(1);
		expect(drawn[0].style.transform).toBe('translate(80px, 60px)');
		expect(drawn[0].style.width).toBe('400px');
		expect(drawn[0].style.height).toBe('200px');
		expect(drawn[0].style.borderColor).toBe('#ff0000');
	});

	it('labels each box with the peer name (truncated) on the peer colour', () => {
		const overlay = createRemoteSelectionOverlay(document);
		overlay.update(
			[buildPresence({ userName: 'An Extremely Long Collaborator Name' })],
			elements,
			0,
			1,
		);

		const label = overlay.el.querySelector<HTMLElement>('.pptxv-remote-selection-label');
		expect(label).not.toBeNull();
		expect(label?.textContent).toBe('An Extremely Long...');
		expect(label?.textContent?.length).toBe(20);
		expect(label?.style.backgroundColor).toBe('#ff0000');
	});

	it('skips peers on other slides, without a selection, or with unresolvable ids', () => {
		const overlay = createRemoteSelectionOverlay(document);
		overlay.update(
			[
				buildPresence({ clientId: 1, activeSlideIndex: 3 }),
				buildPresence({ clientId: 2, selectedElementId: undefined }),
				buildPresence({ clientId: 3, selectedElementId: 'nope' }),
			],
			elements,
			0,
			1,
		);
		expect(boxes(overlay.el)).toHaveLength(0);
	});

	it('removes stale boxes when a peer deselects or leaves', () => {
		const overlay = createRemoteSelectionOverlay(document);
		overlay.update(
			[buildPresence({ clientId: 1 }), buildPresence({ clientId: 2, selectedElementId: 'el2' })],
			elements,
			0,
			1,
		);
		expect(boxes(overlay.el)).toHaveLength(2);

		overlay.update([buildPresence({ clientId: 2, selectedElementId: 'el2' })], elements, 0, 1);
		const remaining = boxes(overlay.el);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].dataset.selectionKey).toBe('2-el2');
	});

	it('never intercepts stage input (aria-hidden + export-ignore host)', () => {
		const overlay = createRemoteSelectionOverlay(document);
		expect(overlay.el.getAttribute('aria-hidden')).toBe('true');
		expect(overlay.el.dataset.exportIgnore).toBe('true');
	});
});
