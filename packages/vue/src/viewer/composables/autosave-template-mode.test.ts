// oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks
/**
 * Is an edit made in edit-template mode autosaved?
 *
 * It was not. A template element (a master or layout shape, id prefixed
 * `master-` / `layout-`) does not live in `slide.elements`; it lives in the
 * separate `templateElementsBySlideId` map. So `commitTemplateElements` rebuilds
 * only that map and never reassigns `slides` - and Vue infers "the document
 * changed" from a `watch(slides)`. The result was that a user editing a master
 * or a layout got no crash recovery whatsoever, silently, while the status
 * kept saying everything was saved.
 *
 * React and Angular were never exposed to this because their dirty flag is
 * raised by an explicit commit call, and Svelte was not because its effect
 * reads a value that already folds the template map in. Vue alone inferred it
 * from one of the two stores.
 *
 * The two real composables are wired to each other here exactly as
 * `PowerPointViewer.vue` wires them, and the edit is driven through the real
 * `ops.updateElement`, so this fails if either half of the wiring is undone.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref, shallowRef } from 'vue';
import type { EffectScope } from 'vue';

import type { TemplateElementMap } from './template-editing';
import type { UseAutosaveWiringResult } from './useAutosaveWiring';
import type { EditorOperations } from './useEditorOperations';

// There is no IndexedDB here, and the wiring's snapshot write is deliberately
// fire-and-forget, so an unstubbed one surfaces as an unhandled rejection.
// Everything else in the shared package stays real.
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: () => Promise.resolve(true),
}));

const { useAutosaveWiring } = await import('./useAutosaveWiring');
const { useEditorOperations } = await import('./useEditorOperations');

const SLIDE_ID = 'ppt/slides/slide1.xml';
const TEMPLATE_ELEMENT_ID = 'layout-shape-0';

function slide(): PptxSlide {
	return { id: SLIDE_ID, elements: [] } as unknown as PptxSlide;
}

function templateElement(x: number): PptxElement {
	return { id: TEMPLATE_ELEMENT_ID, type: 'shape', x, y: 0, width: 10, height: 10 } as PptxElement;
}

interface Harness {
	ops: EditorOperations;
	autosave: UseAutosaveWiringResult['autosave'];
	templateElementsBySlideId: ReturnType<typeof shallowRef<TemplateElementMap>>;
	slides: ReturnType<typeof shallowRef<PptxSlide[]>>;
	saves: number;
	scope: EffectScope;
}

/** Wire the real composables together the way the viewer component does. */
function harness(): Harness {
	const slides = shallowRef<PptxSlide[]>([slide()]);
	const activeSlideIndex = ref(0);
	const templateElementsBySlideId = shallowRef<TemplateElementMap>({
		[SLIDE_ID]: [templateElement(0)],
	});
	const loading = ref(false);
	const result: Harness = {
		ops: undefined as unknown as EditorOperations,
		autosave: undefined as unknown as UseAutosaveWiringResult['autosave'],
		templateElementsBySlideId,
		slides,
		saves: 0,
		scope: effectScope(),
	};
	result.scope.run(() => {
		result.ops = useEditorOperations({
			slides,
			activeSlideIndex,
			pushHistory: () => {},
			templateElementsBySlideId,
		});
		({ autosave: result.autosave } = useAutosaveWiring({
			slides,
			templateElements: templateElementsBySlideId,
			loading,
			canEdit: () => true,
			autosaveEnabledByHost: () => true,
			intervalMs: () => 2000,
			snapshotName: () => 'deck.pptx',
			getRecoverySnapshot: () => {
				result.saves += 1;
				return Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
			},
			emitAutosave: () => {},
			captureVersion: () => {},
		}));
	});
	return result;
}

describe('edit-template-mode edits reach autosave', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('marks the document dirty and saves after a template-only edit', async () => {
		const h = harness();
		expect(h.autosave.isDirty.value).toBeFalsy();

		// A master/layout shape nudged in edit-template mode. This rebuilds the
		// template map and leaves `slides` untouched, which is the whole point.
		const slidesBefore = h.slides.value;
		h.ops.updateElement(TEMPLATE_ELEMENT_ID, { x: 42 } as Partial<PptxElement>);

		expect(h.templateElementsBySlideId.value[SLIDE_ID]?.[0]?.x).toBe(42);
		expect(
			h.slides.value,
			'the premise of the bug: a template edit does not touch the slide array',
		).toBe(slidesBefore);

		expect(
			h.autosave.isDirty.value,
			'a template edit that leaves the document reading clean is never recovered',
		).toBeTruthy();

		vi.advanceTimersByTime(2000);
		await vi.runOnlyPendingTimersAsync();
		expect(h.saves).toBe(1);
		expect(h.autosave.isDirty.value).toBeFalsy();

		h.scope.stop();
	});

	it('still saves an ordinary slide edit, which was never the broken half', async () => {
		const h = harness();

		h.ops.addElement({ id: 'e1', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement);
		expect(h.autosave.isDirty.value).toBeTruthy();

		vi.advanceTimersByTime(2000);
		await vi.runOnlyPendingTimersAsync();
		expect(h.saves).toBe(1);

		h.scope.stop();
	});
});
