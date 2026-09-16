// oxlint-disable react-hooks/rules-of-hooks
import { attachEditorImagePaste } from 'pptx-viewer-shared';
import type { EditorImagePasteOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref, shallowRef } from 'vue';

import { useCanvasImagePaste } from './useCanvasImagePaste';

vi.mock(import('pptx-viewer-shared'), () => ({ attachEditorImagePaste: vi.fn() }));
const cleanups: (() => void)[] = [];
let detach = vi.fn();
beforeEach(() => {
	detach = vi.fn();
	vi.mocked(attachEditorImagePaste).mockReset().mockReturnValue(detach);
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

function setup() {
	const scope = effectScope();
	const root = shallowRef(document.createElement('div'));
	const documentId = shallowRef({});
	const slideId = ref('slide-1');
	const eligible = ref(true);
	const options: EditorImagePasteOptions = {
		getCanvas: () => root.value,
		getTarget: () =>
			eligible.value
				? {
						documentId: documentId.value,
						slideId: slideId.value,
						canvasSize: { width: 960, height: 540 },
					}
				: null,
		insertElement: vi.fn(),
	};
	scope.run(() => useCanvasImagePaste(root, options));
	cleanups.push(() => scope.stop());
	return { scope, root, documentId, slideId, eligible, options };
}

describe('useCanvasImagePaste', () => {
	it('passes the current canvas, eligibility and existing insertion callback through', () => {
		const editor = setup();
		expect(attachEditorImagePaste).toHaveBeenCalledExactlyOnceWith(
			editor.root.value,
			editor.options,
		);
	});

	it.each(['permission', 'load', 'slide'])(
		'synchronously disposes on %s away-and-back',
		(change) => {
			const editor = setup();
			if (change === 'slide') {
				editor.slideId.value = 'slide-2';
				editor.slideId.value = 'slide-1';
			} else {
				editor.eligible.value = false;
				editor.eligible.value = true;
			}
			expect(detach).toHaveBeenCalledTimes(2);
		},
	);

	it('aborts on document replacement and unmount', () => {
		const editor = setup();
		editor.documentId.value = {};
		expect(detach).toHaveBeenCalledOnce();
		editor.scope.stop();
		expect(detach).toHaveBeenCalledTimes(2);
	});

	it('keeps a root listener when ineligible so nested viewer ownership is preserved', () => {
		const editor = setup();
		editor.eligible.value = false;
		expect(attachEditorImagePaste).toHaveBeenCalledTimes(2);
		expect(vi.mocked(attachEditorImagePaste).mock.lastCall![1].getTarget()).toBeNull();
	});
});
