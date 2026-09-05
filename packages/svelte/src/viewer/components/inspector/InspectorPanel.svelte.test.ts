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
	it('shows the deck panel without the "No slide selected" note when a slide is active', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountInspector(editor);

		expect(target.querySelector('aside')?.getAttribute('aria-label')).toBe('Properties');
		expect(target.querySelector('aside')?.hasAttribute('data-pptx-inspector')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-inspector-empty')).toBeNull();
		expect(target.querySelector('.pptx-svelte-inspector-grid')).toBeNull();
	});

	it('shows the "No slide selected" note only when there is genuinely no active slide', () => {
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = true;
		editor.setSlides([]);
		const { target } = mountInspector(editor);

		expect(target.querySelector('.pptx-svelte-inspector-empty')).not.toBeNull();
	});

	it('shows Position + Fill & Stroke + Text for a shape element (shapes carry text properties too)', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(target.querySelector('.pptx-svelte-inspector-grid')).toBeTruthy();
		expect(sectionTitles(target)).toStrictEqual([
			'Fill & Stroke',
			'Effects',
			'Text',
			'Accessibility',
			'Action',
		]);
		expect(target.querySelector('.pptx-svelte-inspector-empty')).toBeNull();
	});

	it('shows Position + Fill & Stroke + Text for a text element (text has shapeStyle too)', () => {
		const el = textEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual([
			'Fill & Stroke',
			'Effects',
			'Text',
			'Accessibility',
			'Action',
		]);
	});

	it('shows Position + Fill & Stroke + Image for an image element (no Text section)', () => {
		const el = imageEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Effects', 'Image', 'Action']);
	});

	it('shows only Position + Table for a table element (no Fill & Stroke or Text)', () => {
		const el = tableEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Table', 'Action']);
	});

	it('offers Quick Styles for a shape but not for an image (React FillStrokeProperties gating)', () => {
		const shape = shapeEl();
		const shapeEditor = makeEditor([shape]);
		shapeEditor.select(shape.id);
		const { target } = mountInspector(shapeEditor);
		expect(target.querySelector('.pptx-svelte-quick-styles')).not.toBeNull();
		cleanup?.();

		const image = imageEl();
		const imageEditor = makeEditor([image]);
		imageEditor.select(image.id);
		const { target: imageTarget } = mountInspector(imageEditor);
		expect(imageTarget.querySelector('.pptx-svelte-quick-styles')).toBeNull();
	});

	it('offers the alt-text field for an image, and alt-text + title for a shape', () => {
		const image = imageEl();
		const imageEditor = makeEditor([image]);
		imageEditor.select(image.id);
		const { target } = mountInspector(imageEditor);
		expect(target.querySelector('.pptx-svelte-alt-text')).not.toBeNull();
		// A picture has no title field: only the alt-text textarea, no title input.
		expect(target.querySelector('.pptx-svelte-alt-text input[type="text"]')).toBeNull();
		cleanup?.();

		// A plain shape now models both altText and title (PptxNonVisualDescription),
		// so its own Accessibility section renders both fields.
		const shape = shapeEl();
		const shapeEditor = makeEditor([shape]);
		shapeEditor.select(shape.id);
		const { target: shapeTarget } = mountInspector(shapeEditor);
		expect(shapeTarget.querySelector('.pptx-svelte-alt-text textarea')).not.toBeNull();
		expect(shapeTarget.querySelector('.pptx-svelte-alt-text input[type="text"]')).not.toBeNull();
	});

	it('has no header close button on the tab row (React InspectorPane parity)', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(target.querySelector('.pptx-svelte-inspector-close')).toBeNull();
		// Body is always present now that the standalone collapse toggle is gone.
		expect(target.querySelector('.pptx-svelte-inspector-body')).not.toBeNull();
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
			'Slide transition',
			'Notes & Handout',
			'Document',
			'Slide',
		]);
	});

	it('omits only Theme Override when no theme handler is wired', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountWithDeck(editor, new PresentationLoader());

		expect(sectionTitles(target)).toStrictEqual([
			'Presentation',
			'Theme',
			'Slide Size',
			'Slide transition',
			'Notes & Handout',
			'Document',
			'Slide',
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
