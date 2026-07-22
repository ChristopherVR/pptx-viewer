// oxlint-disable react-hooks/rules-of-hooks
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxTheme,
} from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useAiBridge } from './useAiBridge';

/**
 * useAiBridge tests: the getDeckData / applyDeckData seam that backs the
 * presentation-level ("deck") MCP tools. getDeckData must expose the live
 * presentation-level state; applyDeckData must fan a mutated PptxData back out,
 * only touching a ref whose field actually changed, snapshotting history once
 * for the undoable slides/canvas fields.
 */
function makeBridge() {
	// Mirror production wiring (useLoadContent): object/array state is shallowRef
	// so `.value` is a raw (structuredClone-friendly) value, canvasSize is a ref.
	const slides = shallowRef<PptxSlide[]>([{ id: 's1', elements: [] } as unknown as PptxSlide]);
	const canvasSize = ref<CanvasSize>({ width: 960, height: 540 });
	const theme = shallowRef<PptxTheme | undefined>(undefined);
	const sections = shallowRef<PptxSection[]>([]);
	const presentationProperties = shallowRef<PptxPresentationProperties>({});
	const customProperties = shallowRef<PptxCustomProperty[]>([]);
	const coreProperties = shallowRef<PptxCoreProperties | undefined>(undefined);
	const appProperties = shallowRef<PptxAppProperties | undefined>(undefined);
	const pushHistory = vi.fn();
	const markDirty = vi.fn();

	const bridge = useAiBridge({
		slides,
		activeSlideIndex: ref(0),
		canvasSize,
		theme,
		handler: ref(null),
		sections,
		presentationProperties,
		customProperties,
		coreProperties,
		appProperties,
		fileName: () => undefined,
		pushHistory,
		markDirty,
		goTo: vi.fn(),
		setSelection: vi.fn(),
		applyThemeUpdates: vi.fn(),
	});

	return {
		bridge,
		slides,
		canvasSize,
		sections,
		presentationProperties,
		customProperties,
		coreProperties,
		appProperties,
		pushHistory,
		markDirty,
	};
}

describe('useAiBridge deck-data seam', () => {
	it('getDeckData exposes the live presentation-level state', () => {
		const h = makeBridge();
		h.sections.value = [{ id: 'sec1', name: 'Intro' } as PptxSection];
		h.coreProperties.value = { title: 'My Deck' } as PptxCoreProperties;

		const data = h.bridge.getDeckData?.();
		expect(data?.width).toBe(960);
		expect(data?.height).toBe(540);
		expect(data?.slides).toHaveLength(1);
		expect(data?.sections).toStrictEqual([{ id: 'sec1', name: 'Intro' }]);
		expect(data?.coreProperties).toStrictEqual({ title: 'My Deck' });
	});

	it('applyDeckData commits a canvas-size change through the undoable path', () => {
		const h = makeBridge();
		h.bridge.applyDeckData?.((data) => ({ ...data, width: 1280, height: 720 }), 'resize');

		expect(h.canvasSize.value).toStrictEqual({ width: 1280, height: 720 });
		expect(h.pushHistory).toHaveBeenCalledOnce();
		expect(h.markDirty).toHaveBeenCalledOnce();
	});

	it('applyDeckData fans out metadata and only touches changed fields', () => {
		const h = makeBridge();
		h.bridge.applyDeckData?.(
			(data) => ({
				...data,
				sections: [{ id: 'sec1', name: 'Part 1' } as PptxSection],
				coreProperties: { title: 'Renamed' } as PptxCoreProperties,
			}),
			'metadata',
		);

		expect(h.sections.value).toStrictEqual([{ id: 'sec1', name: 'Part 1' }]);
		expect(h.coreProperties.value).toStrictEqual({ title: 'Renamed' });
		// No slide/canvas change -> no history snapshot for this metadata-only edit.
		expect(h.pushHistory).not.toHaveBeenCalled();
		expect(h.markDirty).toHaveBeenCalledOnce();
	});

	it('applyDeckData is a no-op fan-out when nothing changed', () => {
		const h = makeBridge();
		const beforeSections = h.sections.value;
		h.bridge.applyDeckData?.((data) => data, 'noop');

		expect(h.sections.value).toBe(beforeSections);
		expect(h.pushHistory).not.toHaveBeenCalled();
	});
});
