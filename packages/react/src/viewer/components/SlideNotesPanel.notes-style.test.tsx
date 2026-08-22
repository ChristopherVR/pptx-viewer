// @vitest-environment happy-dom
/**
 * Regression test for the notesStyle fidelity gap (P-H4): a deck's authored
 * `<p:notesStyle>` font size must reach the docked notes panel instead of
 * being silently replaced by this panel's own CSS default.
 *
 * No `@testing-library/react` is available in this workspace, so this follows
 * the same manual `createRoot` + `act` harness pattern used elsewhere (see
 * `useViewerBuildingBlocks.test.ts`).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SlideNotesPanel } from './SlideNotesPanel';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 's1', rId: 'rId2', slideNumber: 1, elements: [], ...overrides };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function findByText(text: string): HTMLElement | null {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
	let node = walker.nextNode();
	while (node) {
		if (node instanceof HTMLElement && node.textContent === text && node.children.length === 0) {
			return node;
		}
		node = walker.nextNode();
	}
	return null;
}

describe('slideNotesPanel notesStyle fidelity', () => {
	it("applies the deck's authored notesStyle level-0 font size to read-only notes text", () => {
		const slide = makeSlide({ notes: 'Speaker note text' });

		act(() => {
			root.render(
				<SlideNotesPanel
					activeSlide={slide}
					isExpanded
					canEdit={false}
					onToggle={() => {}}
					onUpdateNotes={() => {}}
					notesStyle={{ 0: { fontSize: 32 } }} // 32px -> 24pt
				/>,
			);
		});

		const span = findByText('Speaker note text');
		expect(span).not.toBeNull();
		expect(span?.style.fontSize).toBe('24pt');
	});

	it('renders no inline font size when the deck has no notesStyle', () => {
		const slide = makeSlide({ notes: 'Speaker note text' });

		act(() => {
			root.render(
				<SlideNotesPanel
					activeSlide={slide}
					isExpanded
					canEdit={false}
					onToggle={() => {}}
					onUpdateNotes={() => {}}
				/>,
			);
		});

		const span = findByText('Speaker note text');
		expect(span).not.toBeNull();
		expect(span?.style.fontSize).toBe('');
	});
});
