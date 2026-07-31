import { DEFAULT_VIEWER_PREFERENCES } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ViewTab from './ViewTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountTab(overrides: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	const noop = vi.fn();
	const instance = mount(ViewTab, {
		target,
		props: {
			editor,
			preferences: DEFAULT_VIEWER_PREFERENCES,
			onpreferenceschange: noop,
			onzoomfit: noop,
			onselectionpane: noop,
			onslidesorter: noop,
			showGuides: false,
			onshowguideschange: noop,
			snapToShape: false,
			onsnapToShapechange: noop,
			onaddguide: noop,
			...overrides,
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

/** Every button on the tab, keyed by the accessible name the e2e inventory reads. */
function buttons(target: HTMLElement): Map<string, HTMLButtonElement> {
	return new Map(
		[...target.querySelectorAll<HTMLButtonElement>('button')].map((button) => [
			button.textContent?.trim() ?? '',
			button,
		]),
	);
}

describe('viewTab', () => {
	it('disables editing commands when the editor is read-only', () => {
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = false;
		const target = mountTab({ editor });

		const found = buttons(target);
		expect(found.get('Eyedropper')?.disabled).toBeTruthy();
		expect(
			target.querySelector<HTMLButtonElement>('button[title="Edit slide masters and layouts"]')
				?.disabled,
		).toBeTruthy();
		expect(
			target.querySelector<HTMLButtonElement>('[data-testid="template-edit-toggle"]')?.disabled,
		).toBeTruthy();
	});

	it('offers React’s presentation-view, master-view, zoom and window commands', () => {
		const found = buttons(mountTab());

		for (const name of ['Normal', 'Slide Sorter', 'Reading View', 'Slide Master', 'Zoom to Fit']) {
			expect(found.get(name), `${name} is missing from the View tab`).toBeDefined();
			expect(found.get(name)?.disabled, `${name} should be usable`).toBeFalsy();
		}
		for (const name of ['Handout Master', 'Notes Master', 'Zoom', 'Macros']) {
			expect(found.get(name), `${name} is missing from the View tab`).toBeDefined();
			expect(found.get(name)?.disabled, `${name} is a disabled placeholder in React`).toBeTruthy();
		}
	});

	it('routes Normal, Slide Sorter and Reading View to their view switches', () => {
		// Reading View shipped as a permanently disabled placeholder in all five
		// bindings; this asserts the control is really wired, not just enabled.
		const onnormal = vi.fn();
		const onslidesorter = vi.fn();
		const onreadingview = vi.fn();
		const target = mountTab({ onnormal, onslidesorter, onreadingview });

		buttons(target).get('Normal')?.click();
		buttons(target).get('Slide Sorter')?.click();
		buttons(target).get('Reading View')?.click();

		expect(onnormal).toHaveBeenCalledOnce();
		expect(onslidesorter).toHaveBeenCalledOnce();
		expect(onreadingview).toHaveBeenCalledOnce();
	});

	it('drives guide visibility from Guides and snapping from Snap to Shape', () => {
		// The two used to be crossed: one checkbox set both flags while the
		// control actually labelled 'Snap to shape' was a disabled placeholder.
		const onshowguideschange = vi.fn();
		const onsnapToShapechange = vi.fn();
		const target = mountTab({ onshowguideschange, onsnapToShapechange });

		const guides = [...target.querySelectorAll('label')].find((label) =>
			label.textContent?.includes('Guides'),
		);
		const input = guides?.querySelector('input');
		expect(input).toBeTruthy();
		input!.checked = true;
		input!.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(onshowguideschange).toHaveBeenCalledWith(true);
		expect(onsnapToShapechange).not.toHaveBeenCalled();

		const snap = buttons(target).get('Snap to Shape');
		expect(snap?.disabled).toBeFalsy();
		snap?.click();
		flushSync();
		expect(onsnapToShapechange).toHaveBeenCalledWith(true);
	});
});
