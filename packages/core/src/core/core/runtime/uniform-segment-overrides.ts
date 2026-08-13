import type { TextStyle, TextSegment } from '../../types';

/**
 * Determine which style keys are uniform across all segments and apply parent
 * overrides.
 *
 * This is the RUN-scope channel through which an element-level edit reaches
 * runs that were previously uniform: when every segment agrees on a key, the
 * element-level value replaces it. Keys where the segments disagree are left
 * alone so a mixed-format paragraph is not flattened.
 *
 * Extracted from `PptxHandlerRuntimeSaveParagraphHelpers` (which is
 * paragraph-scope only) to keep that module inside the 300 LOC budget; it is
 * still re-exported from there so existing importers are unaffected.
 */
export function computeUniformSegmentOverrides(
	textStyle: TextStyle | undefined,
	textSegments: TextSegment[],
): Partial<TextStyle> {
	const uniformSegmentOverrides: Partial<TextStyle> = {};
	const styleKeys: Array<keyof TextStyle> = [
		'fontFamily',
		'fontSize',
		'bold',
		'italic',
		'underline',
		'strikethrough',
		'rtl',
		'hyperlink',
		'color',
		'align',
	];
	styleKeys.forEach((styleKey) => {
		const nextValue = textStyle?.[styleKey];
		if (nextValue === undefined) {
			return;
		}
		const firstValue = textSegments[0]?.style?.[styleKey];
		const isUniform = textSegments.every((segment) => segment.style?.[styleKey] === firstValue);
		if (isUniform) {
			if (styleKey === 'fontFamily' && typeof nextValue === 'string') {
				uniformSegmentOverrides.fontFamily = nextValue;
			} else if (styleKey === 'fontSize' && typeof nextValue === 'number') {
				uniformSegmentOverrides.fontSize = nextValue;
			} else if (styleKey === 'bold' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.bold = nextValue;
			} else if (styleKey === 'italic' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.italic = nextValue;
			} else if (styleKey === 'underline' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.underline = nextValue;
			} else if (styleKey === 'strikethrough' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.strikethrough = nextValue;
			} else if (styleKey === 'rtl' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.rtl = nextValue;
			} else if (styleKey === 'hyperlink' && typeof nextValue === 'string') {
				uniformSegmentOverrides.hyperlink = nextValue;
			} else if (styleKey === 'color' && typeof nextValue === 'string') {
				uniformSegmentOverrides.color = nextValue;
			} else if (
				styleKey === 'align' &&
				(nextValue === 'left' ||
					nextValue === 'center' ||
					nextValue === 'right' ||
					nextValue === 'justify')
			) {
				uniformSegmentOverrides.align = nextValue;
			}
		}
	});

	return uniformSegmentOverrides;
}
