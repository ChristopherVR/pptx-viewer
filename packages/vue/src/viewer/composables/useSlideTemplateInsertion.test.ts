import type { PptxSlide, PptxTheme } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useSlideTemplateInsertion } from './useSlideTemplateInsertion';

function slide(id: string): PptxSlide {
	return { id, rId: '', slideNumber: 1, elements: [] };
}

describe('useSlideTemplateInsertion', () => {
	it('inserts the built template slide after the active slide and selects it', () => {
		const slides = ref<PptxSlide[]>([slide('s1'), slide('s2'), slide('s3')]);
		const activeSlideIndex = ref(1);
		let slideCountAtPush = -1;
		const pushHistory = vi.fn(() => {
			slideCountAtPush = slides.value.length;
		});

		const { insertSlideFromTemplate } = useSlideTemplateInsertion({
			canvasSize: ref({ width: 1280, height: 720 }),
			slides,
			activeSlideIndex,
			pushHistory,
			theme: shallowRef<PptxTheme | undefined>(undefined),
		});

		insertSlideFromTemplate('title');

		expect(slides.value).toHaveLength(4);
		const inserted = slides.value[2];
		expect(inserted?.id).not.toBe('s3');
		expect(inserted?.elements.length).toBeGreaterThan(0);
		expect(activeSlideIndex.value).toBe(2);
		// Undo contract: history snapshot is taken BEFORE the mutation.
		expect(pushHistory).toHaveBeenCalledOnce();
		expect(slideCountAtPush).toBe(3);
	});

	it('resolves template colours against the deck theme scheme', () => {
		const slides = ref<PptxSlide[]>([slide('s1')]);
		const theme = { colorScheme: { accent1: '#BA0021' } } as unknown as PptxTheme;

		const { insertSlideFromTemplate } = useSlideTemplateInsertion({
			canvasSize: ref({ width: 1280, height: 720 }),
			slides,
			activeSlideIndex: ref(0),
			pushHistory: vi.fn(),
			theme: shallowRef<PptxTheme | undefined>(theme),
		});

		insertSlideFromTemplate('title');

		expect(JSON.stringify(slides.value[1]).toLowerCase()).toContain('#ba0021');
	});
});
