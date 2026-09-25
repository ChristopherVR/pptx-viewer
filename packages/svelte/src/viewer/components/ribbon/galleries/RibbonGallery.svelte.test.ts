import type { PptxElement } from 'pptx-viewer-core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { CONTEXTUAL_TAB_GROUPS, FIXED_TAB_GALLERIES } from 'pptx-viewer-shared';
import type { RibbonGalleryPlacement } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import { createRibbonGalleryHost, ribbonGalleryHostContext } from './ribbon-gallery-host';
import RibbonGallery from './RibbonGallery.svelte';

/**
 * The generic gallery against the real Shape Styles descriptor: tiles come
 * from shared, a pick runs through the editor's undoable element patch.
 */
let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shape(): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#FF0000', fillMode: 'solid' },
	} as PptxElement;
}

function makeEditor(select = true): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.theme = {
		name: 'Office',
		colorScheme: THEME_PRESETS[0].colorScheme,
		fontScheme: THEME_PRESETS[0].fontScheme,
	};
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [shape()] }]);
	if (select) {
		editor.select('shape-1');
	}
	return editor;
}

function mountGallery(editor: EditorState, placement: RibbonGalleryPlacement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(RibbonGallery, {
		target,
		props: { placement },
		context: ribbonGalleryHostContext(createRibbonGalleryHost(editor)),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

const INLINE = CONTEXTUAL_TAB_GROUPS.shapeFormat[0].galleries[0];
const DROPDOWN = FIXED_TAB_GALLERIES[0];

function styleOf(editor: EditorState): unknown {
	const el = editor.slides[0]?.elements[0];
	return el && 'shapeStyle' in el ? el.shapeStyle : undefined;
}

describe('ribbonGallery', () => {
	it('renders the inline strip with the DOM contract', () => {
		const target = mountGallery(makeEditor(), INLINE);
		const wrapper = target.querySelector(`[data-ribbon-control="${INLINE.control}"]`);
		expect(wrapper).not.toBeNull();
		const tiles = wrapper?.querySelectorAll('[data-gallery-item]') ?? [];
		expect(tiles).toHaveLength(6);
		expect(tiles[0]?.getAttribute('aria-pressed')).toBe('false');
		expect(tiles[0]?.querySelector('svg')).not.toBeNull();
		const more = wrapper?.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		expect(more?.getAttribute('aria-label')).toBe('More Shape Styles');
	});

	it('applies a tile through the undoable element patch and marks it applied', () => {
		const editor = makeEditor();
		const before = styleOf(editor);
		const target = mountGallery(editor, INLINE);
		const tile = target.querySelector<HTMLButtonElement>('[data-gallery-item]');
		const id = tile?.getAttribute('data-gallery-item');
		tile?.click();
		flushSync();

		expect(styleOf(editor)).not.toStrictEqual(before);
		expect(editor.canUndo).toBeTruthy();
		expect(target.querySelector(`[data-gallery-item="${id}"]`)?.getAttribute('aria-pressed')).toBe(
			'true',
		);

		editor.undo();
		expect(styleOf(editor)).toStrictEqual(before);
	});

	it('opens every section in the popup and closes it after a pick', () => {
		const editor = makeEditor();
		const target = mountGallery(editor, DROPDOWN);
		const trigger = target.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		expect(trigger?.textContent?.trim()).toBe('Shape Styles');
		trigger?.click();
		flushSync();

		const popup = target.querySelector('[data-ribbon-gallery-popup="shapeStyles"]');
		expect(popup?.querySelectorAll('[data-gallery-item]').length).toBeGreaterThan(6);
		popup?.querySelector<HTMLButtonElement>('[data-gallery-item]')?.click();
		flushSync();
		expect(target.querySelector('[data-ribbon-gallery-popup]')).toBeNull();
		expect(editor.canUndo).toBeTruthy();
	});

	it('is disabled without a shape selection', () => {
		const target = mountGallery(makeEditor(false), DROPDOWN);
		const trigger = target.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		expect(trigger?.disabled).toBeTruthy();
	});
});
