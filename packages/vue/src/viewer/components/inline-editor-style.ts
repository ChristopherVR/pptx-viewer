import type { PptxElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';

/** Native editor geometry stays in the slide's scaled coordinate space. */
export function inlineEditorStyle(el: PptxElement, rich: boolean): CSSProperties {
	const style = (el as { textStyle?: Record<string, unknown> }).textStyle ?? {};
	const fontSize = typeof style.fontSize === 'number' ? `${style.fontSize}px` : undefined;
	const align =
		typeof style.align === 'string' ? (style.align as CSSProperties['textAlign']) : undefined;
	return {
		position: 'absolute',
		left: `${el.x}px`,
		top: `${el.y}px`,
		width: `${el.width}px`,
		height: `${el.height}px`,
		display: rich ? 'block' : 'flex',
		flexDirection: 'column',
		justifyContent: 'center',
		boxSizing: 'border-box',
		padding: '2px 4px',
		margin: 0,
		outline: '2px solid var(--pptx-vue-selection-color, #3b82f6)',
		// Transparent: the element's shape fill remains rendered underneath. Only
		// its static text is suppressed, so non-white authored fills stay visible.
		background: 'transparent',
		color: typeof style.color === 'string' ? style.color : '#111827',
		fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : 'inherit',
		fontSize: fontSize ?? 'inherit',
		fontWeight: style.bold ? 700 : 'normal',
		fontStyle: style.italic ? 'italic' : 'normal',
		...(rich ? { textDecoration: 'none', textDecorationLine: 'none' } : {}),
		textAlign: align ?? 'left',
		overflow: 'hidden',
		whiteSpace: 'pre-wrap',
		cursor: 'text',
		zIndex: 60,
	};
}
