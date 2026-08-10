import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref, shallowRef } from 'vue';

import type { EditorOperations } from './useEditorOperations';
import { useElementInsertion } from './useElementInsertion';

describe('useElementInsertion fields', () => {
	it('inserts a centred dynamic field and selects it', () => {
		const addElement = vi.fn<(element: PptxElement) => void>();
		const selectedElementIds = ref<string[]>([]);
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement } as unknown as EditorOperations,
			selectedElementIds,
			slides: ref([{ id: 'slide-1', elements: [] } as PptxSlide]),
			activeSlideIndex: ref(0),
			pushHistory: vi.fn(),
			handler: shallowRef(null),
		});

		insertion.addField('slidenum');

		expect(addElement).toHaveBeenCalledOnce();
		const element = addElement.mock.calls[0]?.[0];
		expect(element).toMatchObject({
			type: 'shape',
			text: '1',
			x: 380,
			y: 250,
			width: 200,
			height: 40,
		});
		expect(element?.type === 'shape' ? element.textSegments?.[0]?.fieldType : undefined).toBe(
			'slidenum',
		);
		expect(selectedElementIds.value).toStrictEqual([element?.id]);
	});
});

describe('useElementInsertion.applyLayoutToActiveSlide', () => {
	function useHarness(handlerImpl: unknown) {
		const slides = ref([
			{ id: 'slide-1', elements: [] } as PptxSlide,
			{ id: 'slide-2', elements: [] } as PptxSlide,
		]);
		const pushHistory = vi.fn();
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement: vi.fn() } as unknown as EditorOperations,
			selectedElementIds: ref<string[]>([]),
			slides,
			activeSlideIndex: ref(1),
			pushHistory,
			handler: shallowRef(handlerImpl as never),
		});
		return { insertion, slides, pushHistory };
	}

	it('swaps the inherited layout artwork over to the new layout', async () => {
		const remapped = {
			id: 'slide-2',
			elements: [
				{ id: 'layout-new', type: 'shape' } as PptxElement,
				{ id: 'own', type: 'shape' } as PptxElement,
			],
			layoutPath: 'ppt/slideLayouts/slideLayout3.xml',
		} as unknown as PptxSlide;
		const templateElementsBySlideId = ref({
			'slide-2': [{ id: 'layout-old', type: 'shape' } as PptxElement],
		});
		const slides = ref([
			{ id: 'slide-1', elements: [] } as PptxSlide,
			{ id: 'slide-2', elements: [] } as PptxSlide,
		]);
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement: vi.fn() } as unknown as EditorOperations,
			selectedElementIds: ref<string[]>([]),
			slides,
			activeSlideIndex: ref(1),
			pushHistory: vi.fn(),
			handler: shallowRef({ applyLayoutToSlide: vi.fn().mockResolvedValue(remapped) } as never),
			templateElementsBySlideId,
		});

		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout3.xml');

		// The deck keeps only the slide's own elements ...
		expect(slides.value[1]!.elements.map((el) => el.id)).toStrictEqual(['own']);
		// ... and the previous layout's artwork is replaced, not merged.
		expect(templateElementsBySlideId.value['slide-2']!.map((el) => el.id)).toStrictEqual([
			'layout-new',
		]);
	});

	it('replaces the active slide with the re-mapped one', async () => {
		const remapped = {
			id: 'slide-2',
			elements: [],
			layoutPath: 'ppt/slideLayouts/slideLayout3.xml',
		} as unknown as PptxSlide;
		const applyLayoutToSlide = vi.fn().mockResolvedValue(remapped);
		const { insertion, slides, pushHistory } = useHarness({ applyLayoutToSlide });

		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout3.xml');

		expect(applyLayoutToSlide).toHaveBeenCalledWith(1, 'ppt/slideLayouts/slideLayout3.xml', [
			expect.objectContaining({ id: 'slide-1' }),
			expect.objectContaining({ id: 'slide-2' }),
		]);
		expect(slides.value).toHaveLength(2);
		// Vue's deep reactivity proxies the stored slide, so compare by value.
		expect(slides.value[1]).toStrictEqual(remapped);
		expect(pushHistory).toHaveBeenCalledOnce();
	});

	it('leaves the deck and history alone when the core call fails', async () => {
		const applyLayoutToSlide = vi.fn().mockRejectedValue(new Error('missing layout'));
		const { insertion, slides, pushHistory } = useHarness({ applyLayoutToSlide });
		const before = slides.value;

		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout9.xml');

		expect(slides.value).toStrictEqual(before);
		expect(pushHistory).not.toHaveBeenCalled();
	});

	it('does nothing before a deck is loaded', async () => {
		const { insertion, pushHistory } = useHarness(null);
		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout3.xml');
		expect(pushHistory).not.toHaveBeenCalled();
	});
});
