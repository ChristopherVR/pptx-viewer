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
