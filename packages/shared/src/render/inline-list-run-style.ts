import type { TextStyle } from 'pptx-viewer-core';

/** Only supported authored inline changes, not computed browser defaults. */
export function inlineListStyleDelta(
	node: HTMLElement,
	baseline = '',
	inheritedColor?: string,
): TextStyle {
	const style: TextStyle = {};
	const original = node.ownerDocument.createElement('span').style;
	original.cssText = baseline;
	if (node.tagName === 'FONT' && !original.color) {
		// A native wrapper preserving the current resolved color is not a new
		// color command. Keep the validated body's authored theme reference.
		original.color = inheritedColor ?? '';
	}
	const css = node.ownerDocument.createElement('span').style;
	if (node.tagName === 'FONT') {
		// Chromium can preserve native typing color/face with legacy FONT nodes
		// after replacing the selected body. CSS parsing validates these values.
		css.color = node.getAttribute('color') ?? '';
		css.fontFamily = node.getAttribute('face') ?? '';
	}
	css.cssText += `;${node.style.cssText}`;
	if (css.fontWeight && css.fontWeight !== original.fontWeight) {
		style.bold = css.fontWeight === 'bold' || Number(css.fontWeight) >= 600;
	}
	if (css.fontStyle && css.fontStyle !== original.fontStyle) {
		style.italic = css.fontStyle === 'italic';
	}
	const decoration = css.textDecorationLine || css.textDecoration;
	if (decoration && decoration !== (original.textDecorationLine || original.textDecoration)) {
		style.underline = decoration.includes('underline');
		style.strikethrough = decoration.includes('line-through');
	}
	if (
		css.fontSize &&
		css.fontSize !== original.fontSize &&
		/^\d+(?:\.\d+)?px$/u.test(css.fontSize)
	) {
		style.fontSize = Number.parseFloat(css.fontSize);
	}
	if (css.color && css.color !== original.color) {
		const rgb = css.color.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/u);
		style.color = rgb
			? `#${rgb
					.slice(1)
					.map((channel) => Number(channel).toString(16).padStart(2, '0'))
					.join('')
					.toUpperCase()}`
			: css.color;
		style.colorRef = undefined;
		style.colorXml = undefined;
	}
	if (css.fontFamily && css.fontFamily !== original.fontFamily) {
		style.fontFamily = css.fontFamily
			.split(',')[0]
			.trim()
			.replace(/^['"]|['"]$/gu, '');
	}
	if (node.tagName === 'B' || node.tagName === 'STRONG') {
		style.bold = true;
	}
	if (node.tagName === 'I' || node.tagName === 'EM') {
		style.italic = true;
	}
	if (node.tagName === 'U' && !decoration.includes('none')) {
		style.underline = true;
	}
	return style;
}
