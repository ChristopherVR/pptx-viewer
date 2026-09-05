/**
 * The elected-writer (`role: 'owner'`) write-back scheduler used to call
 * `handler.save(slides)` with NO options, so an owner's write-back file
 * silently dropped every session-level edit outside `slides` (table style
 * edits, view toggles, tags, deck properties, ...). This asserts
 * `CollaborationController` forwards `deps.getSaveOptions` to
 * `createWriteBackScheduler` (whose own behaviour is covered in
 * `pptx-viewer-shared`'s `collaboration-writeback.test.ts`).
 */
import type { PptxHandlerSaveOptions } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

const capturedDeps: { getSaveOptions?: () => PptxHandlerSaveOptions | undefined }[] = [];

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

const { CollaborationController } = await import('./collaboration.svelte');

describe('collaborationController getSaveOptions wiring', () => {
	it('forwards deps.getSaveOptions to createWriteBackScheduler', () => {
		const saveOptions: PptxHandlerSaveOptions = { viewProperties: {} };
		const getSaveOptions = vi.fn(() => saveOptions);

		const dispose = $effect.root(() => {
			const controller = new CollaborationController({
				getSlides: () => [],
				applyRemoteSlides: vi.fn(),
				getConfig: () => undefined,
				getSaveOptions,
			});
			expect(controller).toBeDefined();
		});

		const captured = capturedDeps.at(-1);
		expect(captured?.getSaveOptions?.()).toBe(saveOptions);
		dispose();
	});
});
