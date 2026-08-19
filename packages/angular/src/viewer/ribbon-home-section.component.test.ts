/**
 * Regression test for the Home tab's Reset button wiring.
 *
 * The button used to `resetSlide.emit()` to an output nobody listened to
 * (dead code, no effect when clicked). It now re-applies the active slide's
 * own layout through `EditorStateService.applyLayout`, deciding the target
 * path with the shared `resetSlideLayoutPath` function (React/Vue parity).
 *
 * `performResetSlide` is tested directly rather than through the component:
 * `RibbonHomeSectionComponent`'s constructor runs an `effect()` that needs a
 * full Angular `ChangeDetectionScheduler`, which this package's TestBed-free
 * unit tests don't provide (see `action-settings-panel.component.test.ts`).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorStateService } from './editor-state.service';
import { performResetSlide } from './ribbon-home-section.component';

function slide(id: string, layoutPath?: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [], layoutPath } as PptxSlide;
}

/** The narrow slice of `EditorStateService` the dispatch function reads/calls. */
function fakeEditor(slides: readonly PptxSlide[]): {
	editor: Pick<EditorStateService, 'slides' | 'applyLayout'>;
	applyLayout: ReturnType<typeof vi.fn>;
} {
	const applyLayout = vi.fn().mockResolvedValue(undefined);
	return { editor: { slides: () => slides, applyLayout }, applyLayout };
}

describe('performResetSlide', () => {
	it('re-applies the active slide layout when it has one', () => {
		const { editor, applyLayout } = fakeEditor([slide('s1', 'ppt/slideLayouts/slideLayout1.xml')]);

		performResetSlide(editor, 0);

		expect(applyLayout).toHaveBeenCalledWith(0, 'ppt/slideLayouts/slideLayout1.xml');
	});

	it('does nothing when the active slide records no layout', () => {
		const { editor, applyLayout } = fakeEditor([slide('s1')]);

		performResetSlide(editor, 0);

		expect(applyLayout).not.toHaveBeenCalled();
	});

	it('targets the slide at the given index, not always the first', () => {
		const { editor, applyLayout } = fakeEditor([
			slide('s1', 'ppt/slideLayouts/slideLayout1.xml'),
			slide('s2', 'ppt/slideLayouts/slideLayout2.xml'),
		]);

		performResetSlide(editor, 1);

		expect(applyLayout).toHaveBeenCalledWith(1, 'ppt/slideLayouts/slideLayout2.xml');
	});
});
