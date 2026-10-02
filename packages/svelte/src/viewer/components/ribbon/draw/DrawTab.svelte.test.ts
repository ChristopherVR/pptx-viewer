import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import DrawTab from './DrawTab.svelte';

registerPptxWebControls();

/**
 * DrawTab tests: the five-tool selector (React parity: Freeform beside
 * select/pen/highlighter/eraser) and the colour/width labels the cross-binding
 * ribbon inventory diffs on.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountTab(editable = true): HTMLElement {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(DrawTab, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('drawTab', () => {
	it('offers all five drawing tools', () => {
		const target = mountTab();
		const labels = [...target.querySelectorAll('pptx-ui-ribbon-command')].map((button) =>
			button.getAttribute('label'),
		);
		expect(labels).toStrictEqual(['Select', 'Pen', 'Highlighter', 'Eraser', 'Freeform']);
	});

	it('names the colour and width controls the way React does', () => {
		const target = mountTab();
		expect(target.querySelector('summary')?.textContent).toContain('Colour');
		const width = [...target.querySelectorAll('label')].find((node) =>
			node.textContent?.includes('Width'),
		);
		// The shared slider and preset list keep the same explicit accessible name.
		expect(width?.querySelector('input')?.getAttribute('aria-label')).toBe('Width');
	});

	it('activates the freeform tool', () => {
		const target = mountTab();
		const freeform = target
			.querySelector('[data-ribbon-control="draw.tools.freeform"]')
			?.shadowRoot?.querySelector<HTMLButtonElement>('button');
		freeform?.click();
		flushSync();
		expect(freeform?.getAttribute('aria-pressed')).toBe('true');
	});

	it('disables every tool in a read-only viewer', () => {
		const target = mountTab(false);
		for (const command of target.querySelectorAll('pptx-ui-ribbon-command')) {
			expect(command.shadowRoot?.querySelector<HTMLButtonElement>('button')?.disabled).toBeTruthy();
		}
		expect(target.querySelector('pptx-ui-select')?.disabled).toBeTruthy();
	});
});
