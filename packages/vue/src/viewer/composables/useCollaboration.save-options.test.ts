/**
 * The elected-writer (`role: 'owner'`) write-back scheduler used to call
 * `handler.save(slides)` with NO options, so an owner's write-back file
 * silently dropped every session-level edit outside `slides` (table style
 * edits, view toggles, tags, deck properties, ...). This asserts
 * `useCollaboration` forwards `options.getSaveOptions` to
 * `createWriteBackScheduler` (whose own behaviour is covered in
 * `pptx-viewer-shared`'s `collaboration-writeback.test.ts`).
 */
import type { PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

const capturedDeps: { getSaveOptions?: () => PptxHandlerSaveOptions }[] = [];

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		createWriteBackScheduler: (deps: Parameters<typeof actual.createWriteBackScheduler>[0]) => {
			capturedDeps.push(deps);
			return actual.createWriteBackScheduler(deps);
		},
	};
});

const { useCollaboration } = await import('./useCollaboration');

describe('useCollaboration getSaveOptions wiring', () => {
	it('forwards options.getSaveOptions to createWriteBackScheduler', () => {
		const slides = ref<PptxSlide[]>([]);
		const getSaveOptions = vi.fn((): PptxHandlerSaveOptions => ({ viewProperties: {} }));
		const scope = effectScope();

		scope.run(() => useCollaboration({ slides, onRemoteSlides: vi.fn(), getSaveOptions }));

		expect(capturedDeps.at(-1)?.getSaveOptions).toBe(getSaveOptions);
		scope.stop();
	});
});
