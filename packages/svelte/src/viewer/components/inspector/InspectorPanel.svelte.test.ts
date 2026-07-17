import type { PptxElement, PptxHandler } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import { createInspectorDeckActions, INSPECTOR_DECK_CONTEXT_KEY } from '../../state/inspector-deck';
import { PresentationLoader } from '../../state/presentation-loader.svelte';
import InspectorPanel from './InspectorPanel.svelte';

/**
 * InspectorPanel tests: the orchestrator that gates each element-type-aware
 * section (Fill & Stroke, and more as they land) on the selected element's
 * `type` discriminant, plus the always-present Position section and the
 * empty/no-selection state. Named `*.svelte.test.ts` per the mounted-props
 * convention (see `notes-panel.svelte.test.ts`); here the selection itself
 * changes reactively via `editor.select(...)`, which the panel's own
 * `$derived(editor.selectedElement)` already tracks, so no manual prop
 * refresh is needed between assertions.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {},
	} as PptxElement;
}

function textEl(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		textStyle: {},
	} as PptxElement;
}

function imageEl(): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imagePath: 'ppt/media/image1.png',
	} as PptxElement;
}

function tableEl(): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: { rows: [{ cells: [{ text: 'A' }] }], columnWidths: [1] },
	} as PptxElement;
}

function makeEditor(elements: PptxElement[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements }]);
	return editor;
}

function mountInspector(editor: EditorState): { target: HTMLElement } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(InspectorPanel, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target };
}

function sectionTitles(target: HTMLElement): string[] {
	return Array.from(target.querySelectorAll('.pptx-svelte-inspector-section h4')).map(
		(h) => h.textContent ?? '',
	);
}

describe('inspectorPanel', () => {
	it('shows the empty state when nothing is selected', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountInspector(editor);

		expect(target.querySelector('aside')?.getAttribute('aria-label')).toBe('Properties');
		expect(target.querySelector('aside')?.hasAttribute('data-pptx-inspector')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-inspector-empty')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-inspector-grid')).toBeNull();
	});

	it('shows Position + Fill & Stroke + Text for a shape element (shapes carry text properties too)', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(target.querySelector('.pptx-svelte-inspector-grid')).toBeTruthy();
		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Text']);
		expect(target.querySelector('.pptx-svelte-inspector-empty')).toBeNull();
	});

	it('shows Position + Fill & Stroke + Text for a text element (text has shapeStyle too)', () => {
		const el = textEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Text']);
	});

	it('shows Position + Fill & Stroke + Image for an image element (no Text section)', () => {
		const el = imageEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Image']);
	});

	it('shows only Position + Table for a table element (no Fill & Stroke or Text)', () => {
		const el = tableEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Table']);
	});

	it('collapses and expands via the header close toggle (standalone, no ChromeUiState)', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		const closeButton = target.querySelector<HTMLButtonElement>('.pptx-svelte-inspector-close');
		expect(closeButton?.getAttribute('aria-expanded')).toBe('true');
		closeButton?.click();
		flushSync();
		expect(closeButton?.getAttribute('aria-expanded')).toBe('false');
		expect(target.querySelector('.pptx-svelte-inspector-body')).toBeNull();
	});

	it('renders the [Elements | Properties | Comments] tab strip with Properties active by default', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountInspector(editor);

		const tabs = Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-inspector-tabs [role="tab"]'),
		);
		expect(tabs.map((tab) => tab.textContent?.trim())).toStrictEqual([
			'Elements',
			'Properties',
			'Comments',
		]);
		expect(tabs[1].getAttribute('aria-selected')).toBe('true');
	});

	it('shows the layer-order list on the Elements tab and selects an element on click', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		const { target } = mountInspector(editor);

		const elementsTab = target.querySelector<HTMLButtonElement>(
			'.pptx-svelte-inspector-tabs [role="tab"]',
		);
		elementsTab?.click();
		flushSync();

		const item = target.querySelector<HTMLButtonElement>('.pptx-svelte-layers-item');
		expect(item).not.toBeNull();
		item?.click();
		flushSync();
		expect(editor.selectedElementId).toBe(el.id);
	});
});

describe('inspectorPanel deck properties (no selection)', () => {
	function mountWithDeck(
		editor: EditorState,
		loader: PresentationLoader,
		withThemeOverride = false,
	): { target: HTMLElement } {
		const deck = createInspectorDeckActions({ loader, editor });
		const target = document.createElement('div');
		document.body.appendChild(target);
		const props = withThemeOverride
			? {
					editor,
					handler: {} as unknown as PptxHandler,
					onthemechange: (): void => undefined,
				}
			: { editor };
		const instance = mount(InspectorPanel, {
			target,
			props,
			context: new Map<symbol, unknown>([[INSPECTOR_DECK_CONTEXT_KEY, deck]]),
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		return { target };
	}

	it('renders the deck sections in React order with no selection', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountWithDeck(editor, new PresentationLoader(), true);

		expect(sectionTitles(target)).toStrictEqual([
			'Presentation',
			'Theme',
			'Theme Override',
			'Slide Size',
			'Notes & Handout',
			'Document',
		]);
	});

	it('omits only Theme Override when no theme handler is wired', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountWithDeck(editor, new PresentationLoader());

		expect(sectionTitles(target)).toStrictEqual([
			'Presentation',
			'Theme',
			'Slide Size',
			'Notes & Handout',
			'Document',
		]);
	});

	it('writes slide-size edits to the canvas size and marks the deck dirty', () => {
		const editor = makeEditor([shapeEl()]);
		const loader = new PresentationLoader();
		const { target } = mountWithDeck(editor, loader);

		const width = target.querySelector('.pptx-svelte-slide-size input') as HTMLInputElement;
		expect(width).not.toBeNull();
		width.value = '1280';
		width.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		expect(loader.canvasSize.width).toBe(1280);
		expect(editor.dirty).toBeTruthy();
	});

	it('commits a document title edit into editor state and marks it dirty', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountWithDeck(editor, new PresentationLoader());

		const title = target.querySelector('.pptx-svelte-doc-props input') as HTMLInputElement;
		expect(title).not.toBeNull();
		title.value = 'Quarterly Review';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(editor.coreProperties?.title).toBe('Quarterly Review');
		expect(editor.dirty).toBeTruthy();
	});

	it('adds a custom document property via the Add button', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountWithDeck(editor, new PresentationLoader());

		const add = target.querySelector('.pptx-svelte-custom-props button') as HTMLButtonElement;
		expect(add).not.toBeNull();
		add.click();
		flushSync();

		expect(editor.customProperties).toStrictEqual([
			{ name: 'Property 1', value: '', type: 'lpwstr' },
		]);
		expect(editor.dirty).toBeTruthy();
	});
});
