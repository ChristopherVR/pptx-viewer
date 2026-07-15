import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useVersionHistoryWiring } from './useVersionHistoryWiring';

const slide = (id: string): PptxSlide => ({ id, elements: [] }) as PptxSlide;

describe('useVersionHistoryWiring external comparison', () => {
	it('compares an incoming deck and accepts it through history', () => {
		const slides = ref([slide('current')]);
		const pushHistory = vi.fn();
		const wiring = useVersionHistoryWiring({ slides, pushHistory });

		wiring.compareWithSlides([{ ...slide('incoming'), backgroundColor: '#123456' }]);
		expect(wiring.showCompare.value).toBeTruthy();
		expect(wiring.compareResult.value?.changedCount).toBeGreaterThan(0);

		wiring.onCompareAcceptAll();
		expect(pushHistory).toHaveBeenCalledOnce();
		expect(slides.value.map(({ id }) => id)).toStrictEqual(['incoming']);
		expect(wiring.showCompare.value).toBeFalsy();
	});
});
