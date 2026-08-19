import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ReviewCommentsPanel from './ReviewCommentsPanel.svelte';

/**
 * ReviewCommentsPanel `embedded` regression test: the mobile action sheet
 * wraps this panel in `MobileSheet`, which already renders a "Comments"
 * title + close button. Without `embedded`, the panel's own heading stacked
 * a second "Comments" header underneath it.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [], comments: [] }]);
	return editor;
}

function mountPanel(editor: EditorState, embedded?: boolean): HTMLDivElement {
	const target = document.createElement('div'),
		instance = mount(ReviewCommentsPanel, { target, props: { editor, embedded } });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

describe('reviewCommentsPanel: embedded', () => {
	it('renders its own heading by default', () => {
		const target = mountPanel(makeEditor());
		expect(target.querySelector('.pptx-svelte-comments-heading')).not.toBeNull();
		expect(target.querySelector('#pptx-svelte-comments-title')).not.toBeNull();
	});

	it('suppresses the heading when embedded, keeping the compose form', () => {
		const target = mountPanel(makeEditor(), true);
		expect(target.querySelector('.pptx-svelte-comments-heading')).toBeNull();
		expect(target.querySelector('textarea')).not.toBeNull();
	});
});
