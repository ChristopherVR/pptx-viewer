/**
 * Test-only in-memory {@link PptxAiBridge} for the React AI hook tests. Kept out
 * of any build entry point (only imported from `*.test.*`).
 */
import type { PptxSlide, PptxTheme } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiFocusedTarget,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';

function defaultSlides(): PptxSlide[] {
	return [
		{
			id: 's0',
			slideNumber: 1,
			elements: [{ id: 'el-1', type: 'text', x: 10, y: 10, width: 100, height: 40, text: 'Title' }],
		},
	] as unknown as PptxSlide[];
}

export interface TestBridgeOptions {
	slides?: PptxSlide[];
	theme?: PptxTheme;
	focusedTargets?: PptxAiFocusedTarget[];
}

export function makeTestBridge(options: TestBridgeOptions = {}): PptxAiBridge {
	const slides = options.slides ?? defaultSlides();
	return {
		getDeckMeta(): PptxAiDeckMeta {
			return { slideCount: slides.length, activeSlideIndex: 0, width: 960, height: 540 };
		},
		getSlides: () => slides,
		getActiveSlideIndex: () => 0,
		getTheme: () => options.theme,
		getHandler: () => undefined,
		goToSlide: () => {},
		selectElements: () => {},
		applySlidesUpdate: (_updater: PptxAiSlidesUpdater, _label: string) => {},
		updateElement: (_s: number, _id: string, _u: PptxAiElementUpdate) => {},
		applyTheme: () => {},
		getFocusedTargets: () => options.focusedTargets ?? [],
	};
}
