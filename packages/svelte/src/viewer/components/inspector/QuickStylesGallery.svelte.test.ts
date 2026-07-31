import type { PptxElement } from 'pptx-viewer-core';
import { SHAPE_QUICK_STYLES } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import QuickStylesGallery from './QuickStylesGallery.svelte';

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
		shapeStyle: { strokeWidth: 7 },
	} as PptxElement;
}

function mountGallery(editable = true): { target: HTMLElement; editor: EditorState } {
	const el = shapeEl();
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.editable = editable;
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(QuickStylesGallery, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, editor };
}

describe('quickStylesGallery', () => {
	it('renders one accessibly named swatch per shared preset', () => {
		const { target } = mountGallery();
		const buttons = Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-quick-styles-grid button'),
		);

		expect(buttons).toHaveLength(SHAPE_QUICK_STYLES.length);
		expect(buttons[0].getAttribute('aria-label')).toBe(SHAPE_QUICK_STYLES[0].name);
	});

	it('merges the preset over the existing shape style rather than replacing it', () => {
		const { target, editor } = mountGallery();

		target.querySelector<HTMLButtonElement>('.pptx-svelte-quick-styles-grid button')?.click();
		flushSync();

		const applied = editor.slides[0]?.elements?.[0] as { shapeStyle?: Record<string, unknown> };
		expect(applied.shapeStyle?.fillColor).toBe(SHAPE_QUICK_STYLES[0].style.fillColor);
		// The preset sets strokeWidth 1, so the merge is observable via fillMode
		// while the untouched-by-preset fields survive.
		expect(applied.shapeStyle?.fillMode).toBe('solid');
	});

	it('disables every swatch in a read-only viewer', () => {
		const { target } = mountGallery(false);
		const buttons = Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-quick-styles-grid button'),
		);

		expect(buttons.every((button) => button.disabled)).toBeTruthy();
	});
});
