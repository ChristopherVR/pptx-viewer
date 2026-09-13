import type { TextSegment, TextStyle } from 'pptx-viewer-core';

/** Keep a runless paragraph's future body formatting in the same style edit. */
export function updateTextSegmentStyle(
	segment: TextSegment,
	updates: Partial<TextStyle>,
	options: { updateBodyStyle?: boolean } = {},
): TextSegment {
	return {
		...segment,
		...(options.updateBodyStyle === false ? {} : { style: { ...segment.style, ...updates } }),
		...(segment.paragraphInsertionStyle
			? { paragraphInsertionStyle: { ...segment.paragraphInsertionStyle, ...updates } }
			: {}),
	};
}
