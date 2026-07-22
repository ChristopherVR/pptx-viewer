/**
 * Test-only in-memory {@link PptxAiBridge} implementation. Not referenced by any
 * build entry point, so it is never bundled into the published package; it
 * exists purely so the AI unit tests can exercise reads, navigation, and the
 * three write choke points against a synthetic deck.
 */

import type {
	PptxCoreProperties,
	PptxData,
	PptxSection,
	PptxSlide,
	PptxTheme,
} from 'pptx-viewer-core';

import type {
	PptxAiBridge,
	PptxAiDataUpdater,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiSlidesUpdater,
} from './bridge';
import { applyElementUpdate } from './tools/mutations';

/** A recorded history entry produced by a write choke point. */
export interface RecordedEdit {
	label: string;
	slideCount: number;
}

/** Build a minimal text element. */
export function textElement(id: string, text: string): PptxSlide['elements'][number] {
	return {
		id,
		type: 'text',
		x: 40,
		y: 40,
		width: 400,
		height: 80,
		text,
		textSegments: [{ text, style: {} }],
	} as unknown as PptxSlide['elements'][number];
}

/** Build a minimal slide with the given elements. */
export function makeSlide(index: number, elements: PptxSlide['elements']): PptxSlide {
	return {
		id: `slide-${index}`,
		rId: `rId${index}`,
		slideNumber: index + 1,
		elements,
	} as unknown as PptxSlide;
}

/** A configurable mock bridge plus the history/navigation it records. */
export interface MockBridge extends PptxAiBridge {
	edits: RecordedEdit[];
	navigations: number[];
	selections: { slideIndex: number; elementIds: string[] }[];
}

/** Create a mock bridge over a synthetic 2-slide deck (overridable). */
export function makeMockBridge(initial?: {
	slides?: PptxSlide[];
	theme?: PptxTheme;
	sections?: PptxSection[];
	coreProperties?: PptxCoreProperties;
}): MockBridge {
	let slides = initial?.slides ?? [
		makeSlide(0, [textElement('el-1', 'Title One'), textElement('el-2', 'Body copy')]),
		makeSlide(1, [textElement('el-3', 'Title Two')]),
	];
	let theme: PptxTheme | undefined = initial?.theme;
	let sections: PptxSection[] = initial?.sections ?? [];
	let coreProperties: PptxCoreProperties | undefined = initial?.coreProperties;
	let activeIndex = 0;
	const edits: RecordedEdit[] = [];
	const navigations: number[] = [];
	const selections: { slideIndex: number; elementIds: string[] }[] = [];

	return {
		edits,
		navigations,
		selections,
		getDeckMeta(): PptxAiDeckMeta {
			return { slideCount: slides.length, activeSlideIndex: activeIndex, width: 960, height: 540 };
		},
		getSlides: () => slides,
		getActiveSlideIndex: () => activeIndex,
		getTheme: () => theme,
		getHandler: () => undefined,
		goToSlide(index: number) {
			activeIndex = index;
			navigations.push(index);
		},
		selectElements(slideIndex: number, elementIds: string[]) {
			selections.push({ slideIndex, elementIds });
		},
		applySlidesUpdate(updater: PptxAiSlidesUpdater, label: string) {
			slides = updater(structuredClone(slides));
			edits.push({ label, slideCount: slides.length });
		},
		updateElement(slideIndex: number, elementId: string, updates: PptxAiElementUpdate) {
			const next = structuredClone(slides);
			const el = next[slideIndex]?.elements.find((e) => e.id === elementId);
			if (el) {
				applyElementUpdate(el, updates);
			}
			slides = next;
			edits.push({ label: `updateElement ${elementId}`, slideCount: slides.length });
		},
		applyTheme(updates: Partial<PptxTheme>) {
			theme = { ...(theme ?? {}), ...updates } as PptxTheme;
			edits.push({ label: 'applyTheme', slideCount: slides.length });
		},
		getDeckData(): PptxData {
			return { slides, width: 960, height: 540, theme, sections, coreProperties } as PptxData;
		},
		applyDeckData(updater: PptxAiDataUpdater, label: string) {
			const next = updater(
				structuredClone({
					slides,
					width: 960,
					height: 540,
					theme,
					sections,
					coreProperties,
				} as PptxData),
			);
			slides = next.slides;
			theme = next.theme;
			sections = next.sections ?? [];
			coreProperties = next.coreProperties;
			edits.push({ label, slideCount: slides.length });
		},
	};
}
