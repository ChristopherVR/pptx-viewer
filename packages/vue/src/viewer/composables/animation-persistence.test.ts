import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { mergeElementAnimations, replaceSlideAnimations } from './animation-persistence';
import { useEditorHistory } from './useEditorHistory';

function slide(): PptxSlide {
	return {
		id: 'slide-1',
		elements: [],
		animations: [
			{ elementId: 'a', entrance: 'fadeIn', order: 0 },
			{ elementId: 'b', entrance: 'flyIn', order: 1 },
		],
	} as PptxSlide;
}

describe('vue animation persistence adapter', () => {
	it('merges element-scoped edits without dropping other slide animations', () => {
		const result = mergeElementAnimations(slide(), 'a', [
			{ elementId: 'a', entrance: 'zoomIn', order: 0 },
		]);
		expect(result.animations?.map((animation) => animation.elementId).sort()).toStrictEqual([
			'a',
			'b',
		]);
		expect(result.animations?.find((animation) => animation.elementId === 'a')?.entrance).toBe(
			'zoomIn',
		);
	});

	it('makes full timeline reorder undoable and redoable', () => {
		const slides = ref([slide()]);
		const history = useEditorHistory(slides);
		history.pushHistory();
		slides.value = replaceSlideAnimations(slides.value, 0, [
			{ elementId: 'b', entrance: 'flyIn', order: 0 },
			{ elementId: 'a', entrance: 'fadeIn', order: 1 },
		]);
		expect(slides.value[0].animations?.[0].elementId).toBe('b');
		history.undo();
		expect(slides.value[0].animations?.[0].elementId).toBe('a');
		history.redo();
		expect(slides.value[0].animations?.[0].elementId).toBe('b');
	});
});
