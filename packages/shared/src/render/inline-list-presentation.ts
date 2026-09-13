import type { TextSegment } from 'pptx-viewer-core';

import { resolveParagraphBullet } from './bullet-list';
import { buildBulletMarkerStyle } from './paragraph-bullet-marker-style';
import type { RenderParagraph } from './paragraph-types';
import type { RunStyle } from './text-run-style';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

function quoted(value: string): string {
	return `"${value.replace(/["\\\n\r\f\0]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `)}"`;
}

function declarations(document: Document, values: RunStyle): string {
	const style = document.createElement('span').style;
	for (const [key, value] of Object.entries(values)) {
		const property = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
		style.setProperty(property, String(value), 'important');
	}
	return style.cssText;
}

/** Presentation only. Native children, their identities and Undo remain untouched. */
export function inlineListPresentationCss(
	document: Document,
	scope: string,
	paragraphs: RenderParagraph[],
	segments: TextSegment[],
	fontScale = 1,
): string {
	const carriers: Array<TextSegment | undefined> = [];
	let first = true;
	for (const segment of segments) {
		if (isParagraphSeparatorSegment(segment)) {
			if (first) {
				carriers.push(segment);
			}
			first = true;
		} else if (first) {
			carriers.push(segment);
			first = false;
		}
	}
	const selector = `[data-pptx-list-session="${scope}"]`;
	const rules = [
		`${selector} > :is(div,p) [data-pptx-bullet-marker] { display: none !important; }`,
	];
	for (const [index, paragraph] of paragraphs.entries()) {
		const block = `${selector} > :is(div,p):nth-child(${index + 1})`;
		const px = (value: number | undefined) => `${value ?? 0}px`;
		const style: RunStyle = {
			...paragraph.paragraphStyle,
			marginTop: px(paragraph.spaceBeforePx),
			marginBottom: px(paragraph.spaceAfterPx),
			marginLeft: paragraph.rtl ? '0px' : px(paragraph.marginLeftPx),
			marginRight: paragraph.rtl ? px(paragraph.marginLeftPx) : '0px',
			textIndent: px(paragraph.textIndentPx),
			lineHeight: paragraph.lineHeight ?? 'inherit',
			fontSize: paragraph.strutFontSizePx === undefined ? 'inherit' : px(paragraph.strutFontSizePx),
		};
		rules.push(`${block} { ${declarations(document, style)} }`);
		// The static renderer suppresses blank markers; the editor shows a new empty item.
		const emptyBullet = paragraph.isEmpty ? resolveParagraphBullet(carriers[index]) : undefined;
		const picture = paragraph.bulletPicture ?? emptyBullet?.picture;
		const marker = paragraph.bulletMarker ?? emptyBullet?.marker;
		const markerStyle: RunStyle = {
			...(emptyBullet
				? buildBulletMarkerStyle(emptyBullet, carriers[index], fontScale, paragraph.textIndentPx)
				: paragraph.bulletStyle),
			content: marker === undefined ? 'none' : quoted(marker),
		};
		if (picture?.src) {
			Object.assign(markerStyle, {
				content: quoted(''),
				display: 'inline-block',
				width: px(picture.sizePx),
				height: px(picture.sizePx),
				backgroundImage: `url(${quoted(picture.src)})`,
				backgroundSize: 'contain',
				backgroundRepeat: 'no-repeat',
				verticalAlign: 'middle',
				marginInlineEnd: '4px',
			});
		}
		rules.push(`${block}::before { ${declarations(document, markerStyle)} }`);
	}
	return rules.join('\n');
}
