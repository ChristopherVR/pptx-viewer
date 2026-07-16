import { DEFAULT_VIEWER_PREFERENCES } from 'pptx-viewer-shared';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ViewTab from './ViewTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('viewTab', () => {
	it('disables editing commands when the editor is read-only', () => {
		const target = document.createElement('div');
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = false;
		const noop = vi.fn();
		const instance = mount(ViewTab, {
			target,
			props: {
				editor,
				preferences: DEFAULT_VIEWER_PREFERENCES,
				onpreferenceschange: noop,
				zoomPercent: 100,
				onzoomin: noop,
				onzoomout: noop,
				onzoomfit: noop,
				isFullscreen: false,
				onfullscreen: noop,
				onselectionpane: noop,
				onslidesorter: noop,
				showGuides: false,
				onshowguideschange: noop,
				snapToShape: false,
				onsnapToShapechange: noop,
				onaddguide: noop,
			},
		});
		cleanup = () => unmount(instance);

		const eyedropper = [...target.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Eyedropper',
		) as HTMLButtonElement;
		const slideMaster = target.querySelector<HTMLButtonElement>(
			'button[title="Edit slide masters and layouts"]',
		);
		const templateEditing = target.querySelector<HTMLButtonElement>(
			'[data-testid="template-edit-toggle"]',
		);

		expect(eyedropper.disabled).toBeTruthy();
		expect(slideMaster?.disabled).toBeTruthy();
		expect(templateEditing?.disabled).toBeTruthy();
	});
});
