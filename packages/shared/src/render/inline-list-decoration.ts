import type { TextStyle } from 'pptx-viewer-core';

/** Presentation-only defaults after the list editor removes ancestor decoration. */
export function withInlineListDecorationDefaults(
	style: TextStyle,
	defaults?: TextStyle,
): TextStyle {
	return {
		...style,
		underline: style.underlineExplicitNone ? false : (style.underline ?? defaults?.underline),
		underlineStyle: style.underlineStyle ?? defaults?.underlineStyle,
		underlineColor: style.underlineColor ?? defaults?.underlineColor,
		underlineLine: style.underlineLine ?? defaults?.underlineLine,
		strikethrough: style.strikethrough ?? defaults?.strikethrough,
		strikeType: style.strikeType ?? defaults?.strikeType,
	};
}
