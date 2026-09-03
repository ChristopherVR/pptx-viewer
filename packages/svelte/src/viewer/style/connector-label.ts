import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import type { CssStyleMap } from 'pptx-viewer-shared';

/**
 * Style computation for connector text labels (port of the Vue
 * `ConnectorTextOverlay` computed styles).
 */

/** Container alignment: justify variants collapse; default centre. */
export function connectorLabelContainerStyle(textStyle: TextStyle | undefined): CssStyleMap {
	const align = textStyle?.align;
	const textAlign =
		align === 'justLow' || align === 'dist' || align === 'thaiDist'
			? 'justify'
			: (align ?? 'center');
	return { textAlign };
}

/** Paragraph-level inline style applied to the inner text block. */
export function connectorLabelBlockStyle(textStyle: TextStyle | undefined): CssStyleMap {
	return {
		fontFamily: textStyle?.fontFamily ?? 'inherit',
		fontSize: textStyle?.fontSize ? `${textStyle.fontSize}px` : '10px',
		color: textStyle?.color ?? '#000000',
		fontWeight: textStyle?.bold ? 'bold' : 'normal',
		fontStyle: textStyle?.italic ? 'italic' : 'normal',
		textDecoration: textStyle?.underline ? 'underline' : 'none',
	};
}

/** Per-segment inline style, falling back to the paragraph-level style. */
export function connectorLabelSegmentStyle(
	seg: TextSegment,
	textStyle: TextStyle | undefined,
): CssStyleMap {
	const s = seg.style;
	const style: CssStyleMap = {
		fontFamily: s?.fontFamily ?? textStyle?.fontFamily ?? 'inherit',
		color: s?.color ?? textStyle?.color ?? '#000000',
		fontWeight: s?.bold || textStyle?.bold ? 'bold' : 'normal',
		fontStyle: s?.italic || textStyle?.italic ? 'italic' : 'normal',
		textDecoration: s?.underline ? 'underline' : 'none',
	};
	if (s?.fontSize) {
		style.fontSize = `${s.fontSize}px`;
	}
	return style;
}
