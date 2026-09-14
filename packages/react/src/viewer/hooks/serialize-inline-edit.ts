import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	overlayInlineTextSnapshot,
	overlayMasterViewInlineSnapshot,
	remapTextToSegments,
} from 'pptx-viewer-shared';
import type {
	InlineTextEditSnapshot,
	MasterViewDocument,
	MasterViewTarget,
} from 'pptx-viewer-shared';

interface InlineSaveDocument extends MasterViewDocument {
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	activeSlideIndex: number;
	editTemplateMode?: boolean;
	masterViewTarget?: MasterViewTarget | null;
}

/** Pending list Save has the same ownership as blur, without a history/dirty mutation. */
export function overlayPendingInlineEdit(
	document: InlineSaveDocument,
	elementId: string | null,
	text: string,
	snapshot?: InlineTextEditSnapshot,
	transformText?: (text: string) => string,
) {
	const rich = snapshot?.elementId === elementId && snapshot.text === text && snapshot.textSegments;
	const committedText = rich && transformText ? transformText(text) : text;
	if (rich && document.masterViewTarget) {
		return {
			...document,
			...overlayMasterViewInlineSnapshot(
				document,
				document.masterViewTarget,
				snapshot,
				committedText,
			),
		};
	}
	if (rich) {
		const active = document.slides[document.activeSlideIndex];
		if (!active) {
			return document;
		}
		if (document.editTemplateMode) {
			const templates = document.templateElementsBySlideId[active.id] ?? [];
			const elements = overlayInlineTextSnapshot(templates, snapshot, committedText);
			return elements === templates
				? document
				: {
						...document,
						templateElementsBySlideId: {
							...document.templateElementsBySlideId,
							[active.id]: [...elements],
						},
					};
		}
		const elements = overlayInlineTextSnapshot(active.elements, snapshot, committedText);
		return elements === active.elements
			? document
			: {
					...document,
					slides: document.slides.map((slide, index) =>
						index === document.activeSlideIndex ? { ...slide, elements: [...elements] } : slide,
					),
				};
	}
	// Keep the established plain-editor fallback for callers without a rich draft.
	return {
		...document,
		slides: document.slides.map((slide) =>
			!elementId
				? slide
				: {
						...slide,
						elements: slide.elements.map((element) =>
							element.id === elementId && hasTextProperties(element)
								? {
										...element,
										text,
										textSegments: remapTextToSegments(
											text,
											element.textSegments,
											element.textStyle,
										),
									}
								: element,
						),
					},
		),
	};
}
