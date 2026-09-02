import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import type { InspectorDeckActions } from '../../state/inspector-deck';
import TemplateBackgroundSection from './TemplateBackgroundSection.svelte';

/**
 * The SLIDE BACKGROUND card's template rows: React/Vue/Angular's shortcut to
 * edit the active slide's LAYOUT and MASTER background colour directly,
 * without leaving the slide for the separate Master Views overlay. Svelte
 * had no path to this at all before.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const SLIDE_WITH_LAYOUT: PptxSlide = {
	id: 's1',
	rId: 'rId1',
	slideNumber: 1,
	elements: [],
	layoutPath: 'ppt/slideLayouts/slideLayout1.xml',
	layoutName: 'Title Slide',
} as unknown as PptxSlide;

const MASTER: PptxSlideMaster = {
	path: 'ppt/slideMasters/slideMaster1.xml',
	name: 'Office Theme',
	layoutPaths: ['ppt/slideLayouts/slideLayout1.xml'],
} as unknown as PptxSlideMaster;

function makeDeck(overrides: Partial<InspectorDeckActions> = {}): InspectorDeckActions {
	return {
		themeOptions: [],
		canvasSize: { width: 1280, height: 720 },
		notesCanvasSize: undefined,
		slideSize: undefined,
		applyThemeByPath: vi.fn(),
		updateCanvasSize: vi.fn(),
		updateSlideSize: vi.fn(),
		updatePresentationProperties: vi.fn(),
		updateCoreProperties: vi.fn(),
		updateAppProperties: vi.fn(),
		updateCustomProperties: vi.fn(),
		setTemplateBackground: vi.fn(),
		getTemplateBackgroundColor: vi.fn().mockReturnValue(undefined),
		...overrides,
	};
}

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	return editor;
}

function render(props: {
	activeSlide: PptxSlide;
	slideMasters: readonly PptxSlideMaster[];
	deck: InspectorDeckActions;
	canEdit?: boolean;
	editor?: EditorState;
}): { target: HTMLElement; editor: EditorState } {
	const editor = props.editor ?? makeEditor();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TemplateBackgroundSection, {
		target,
		props: { canEdit: true, ...props, editor },
	});
	flushSync();
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	return { target, editor };
}

describe('templateBackgroundSection', () => {
	it('renders nothing when the slide has no layout or master to edit', () => {
		const { target } = render({
			activeSlide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as PptxSlide,
			slideMasters: [],
			deck: makeDeck(),
		});
		expect(target.querySelectorAll('input[type="color"]')).toHaveLength(0);
	});

	it('shows a row per layout and master, labelled from the slide/master', () => {
		const { target } = render({
			activeSlide: SLIDE_WITH_LAYOUT,
			slideMasters: [MASTER],
			deck: makeDeck(),
		});
		const values = [...target.querySelectorAll('.value')].map((el) => el.textContent);
		expect(values).toStrictEqual(['Title Slide', 'Office Theme']);
	});

	it('seeds each colour input from getTemplateBackgroundColor', () => {
		const deck = makeDeck({ getTemplateBackgroundColor: vi.fn().mockReturnValue('#336699') });
		const { target } = render({ activeSlide: SLIDE_WITH_LAYOUT, slideMasters: [MASTER], deck });
		const inputs = [...target.querySelectorAll<HTMLInputElement>('input[type="color"]')];
		expect(inputs[0].value).toBe('#336699');
	});

	it('commits a colour change to the right path via deck.setTemplateBackground, and pushes the recent-colours list', () => {
		const deck = makeDeck();
		const { target, editor } = render({
			activeSlide: SLIDE_WITH_LAYOUT,
			slideMasters: [MASTER],
			deck,
		});
		const input = target.querySelector<HTMLInputElement>('input[type="color"]')!;
		input.value = '#ff0000';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(deck.setTemplateBackground).toHaveBeenCalledWith(
			'ppt/slideLayouts/slideLayout1.xml',
			'#ff0000',
		);
		// The shared MRU list normalises hex to upper-case (`normalizeRecentColor`).
		expect(editor.mruColors).toContain('#FF0000');
	});

	it('disables the colour inputs when canEdit is false', () => {
		const { target } = render({
			activeSlide: SLIDE_WITH_LAYOUT,
			slideMasters: [MASTER],
			deck: makeDeck(),
			canEdit: false,
		});
		const input = target.querySelector<HTMLInputElement>('input[type="color"]')!;
		expect(input.disabled).toBeTruthy();
	});
});
