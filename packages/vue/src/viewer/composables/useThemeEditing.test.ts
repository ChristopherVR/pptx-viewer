import type { PptxElement, PptxSlide, PptxTheme, PptxThemeColorScheme } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useThemeEditing } from './useThemeEditing';

const OFFICE_ACCENT1 = '#4472C4';
const ION_ACCENT1 = '#B01513';

const OFFICE_COLORS: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: OFFICE_ACCENT1,
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	hlink: '#0563C1',
	folHlink: '#954F72',
};

function makeTemplateShape(): PptxElement {
	return {
		type: 'shape',
		id: 'bg_1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeStyle: { fillColor: OFFICE_ACCENT1 },
	} as PptxElement;
}

describe('useThemeEditing', () => {
	it('re-colours templateElementsBySlideId alongside slides when applying a theme', () => {
		const slides = ref<PptxSlide[]>([{ elements: [], slideNumber: 1 } as PptxSlide]);
		const pptxTheme = ref<PptxTheme | undefined>({ colorScheme: OFFICE_COLORS } as PptxTheme);
		const themeColorMap = ref<Record<string, string> | undefined>({
			accent1: OFFICE_ACCENT1.replace('#', ''),
		});
		const templateElementsBySlideId = shallowRef<Record<string, PptxElement[]>>({
			'layout-slide-1': [makeTemplateShape()],
		});

		const themeEditing = useThemeEditing({
			slides,
			pptxTheme,
			themeColorMap,
			pushHistory: () => {},
			themeGalleryOpen: ref(false),
			themeEditorOpen: ref(false),
			templateElementsBySlideId,
		});

		themeEditing.applyTheme({ ...OFFICE_COLORS, accent1: ION_ACCENT1 }, undefined, 'Custom');

		const patched = templateElementsBySlideId.value['layout-slide-1']![0] as {
			shapeStyle?: { fillColor?: string };
		};
		expect(patched.shapeStyle?.fillColor).toBe(ION_ACCENT1);
	});
});
