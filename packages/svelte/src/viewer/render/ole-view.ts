import type { OlePptxElement } from 'pptx-viewer-core';
import type { ResolvedOleType } from 'pptx-viewer-shared';
import {
	formatBytes,
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleDisplayName,
	getOleTypeColor,
	getOleTypeLabel,
	getPlaceholderStyle,
	isBrowserOpenableMime,
	resolveOleType,
} from 'pptx-viewer-shared';

import { styleToString } from '../style';

/**
 * View-model builder for `ole` (embedded object) elements (port of the
 * vanilla binding's `renderOleElement`). Type resolution, brand colours,
 * labels, byte formatting, and MIME openability all come from
 * `pptx-viewer-shared`; this module only assembles the display strings and
 * the data-driven placeholder icon shapes for the `OleView` SFC.
 */
export interface OleView {
	type: ResolvedOleType;
	typeColor: string;
	typeLabel: string;
	badgeLabel: string;
	badgeFontSize: number;
	ariaLabel: string;
	/** Multi-line info caption (type, name, size, progId): the tooltip. */
	titleText: string;
	previewSrc: string | undefined;
	/** Primary display name in the placeholder box. */
	displayName: string;
	/** Type sublabel under the name; only shown when a fileName exists. */
	sublabel: string | undefined;
	/** Inline style string for the typed placeholder box. */
	placeholderStyle: string;
	/** Recovered embedded payload (data URL); enables the action bar. */
	embeddedData: string | undefined;
	downloadName: string;
	/** Compact human-readable payload size. */
	size: string | undefined;
	/** Whether the payload's MIME type is browser-renderable (Open button). */
	canOpen: boolean;
}

/** Build the full display view for an OLE element. */
export function buildOleView(element: OlePptxElement): OleView {
	const type = resolveOleType(element);
	const typeColor = getOleTypeColor(type);
	const typeLabel = getOleTypeLabel(type);
	const badgeLabel = getOleBadgeLabel(type);
	return {
		type,
		typeColor,
		typeLabel,
		badgeLabel,
		badgeFontSize: badgeLabel.length > 4 ? 6 : 10,
		ariaLabel: getOleAriaLabel(element),
		titleText: infoLines(element, typeLabel).join('\n'),
		previewSrc: element.previewImageData,
		// Prefers the user-editable `oleName` (see the inspector's Object Name
		// field), then the embedded/linked file name, then the type label.
		displayName: getOleDisplayName(element),
		sublabel: element.fileName ? typeLabel : undefined,
		placeholderStyle: styleToString({
			...getPlaceholderStyle(type),
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			pointerEvents: 'none',
			boxSizing: 'border-box',
		}),
		embeddedData: element.oleEmbeddedData,
		downloadName: element.oleEmbeddedFileName ?? element.fileName ?? typeLabel,
		size: formatBytes(element.oleEmbeddedByteSize),
		canOpen: isBrowserOpenableMime(element.oleEmbeddedMimeType),
	};
}

/** Info caption lines: type, name, size, producing application. */
function infoLines(el: OlePptxElement, typeLabel: string): string[] {
	const lines = [typeLabel];
	const name = el.oleEmbeddedFileName ?? el.fileName;
	if (name) {
		lines.push(name);
	}
	const size = formatBytes(el.oleEmbeddedByteSize);
	if (size) {
		lines.push(size);
	}
	if (el.oleProgId) {
		lines.push(el.oleProgId);
	}
	return lines;
}

/** One primitive of a data-driven placeholder icon. */
export interface OleIconShape {
	tag: 'rect' | 'line' | 'text';
	attrs: Record<string, string | number>;
	text?: string;
}

const rect = (x: number, y: number, width: number, height: number, rx: number): OleIconShape => ({
	tag: 'rect',
	attrs: { x, y, width, height, rx, 'stroke-width': 1.5, fill: 'none' },
});

const line = (
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	strokeWidth = 1,
	round = false,
): OleIconShape => ({
	tag: 'line',
	attrs: {
		x1,
		y1,
		x2,
		y2,
		'stroke-width': strokeWidth,
		...(round ? { 'stroke-linecap': 'round' } : {}),
	},
});

const text = (
	x: number,
	y: number,
	content: string,
	fontSize: number,
	italic = false,
): OleIconShape => ({
	tag: 'text',
	attrs: {
		x,
		y,
		'text-anchor': 'middle',
		'font-size': fontSize,
		'font-weight': 'bold',
		...(italic ? { 'font-style': 'italic' } : {}),
	},
	text: content,
});

/**
 * Type-specific placeholder icons (Excel grid, Word document, PDF, Visio
 * diagram, MathType `f(x)`, generic linked-objects glyph), mirroring the
 * vanilla / Vue inline SVG icons. The brand colour is applied in the SFC.
 */
const ICONS: Record<ResolvedOleType, OleIconShape[]> = {
	excel: [
		rect(3, 3, 18, 18, 2),
		line(3, 9, 21, 9),
		line(3, 15, 21, 15),
		line(9, 3, 9, 21),
		line(15, 3, 15, 21),
	],
	word: [
		rect(4, 2, 16, 20, 2),
		line(7, 7, 17, 7, 1.5, true),
		line(7, 11, 17, 11, 1.5, true),
		line(7, 15, 13, 15, 1.5, true),
	],
	pdf: [rect(4, 2, 16, 20, 2), text(12, 14, 'PDF', 7)],
	visio: [
		rect(8, 2, 8, 5, 1),
		line(12, 7, 12, 10, 1.5),
		line(6, 10, 18, 10, 1.5),
		line(6, 10, 6, 13, 1.5),
		line(18, 10, 18, 13, 1.5),
		rect(2, 13, 8, 5, 1),
		rect(14, 13, 8, 5, 1),
	],
	mathtype: [rect(2, 4, 20, 16, 2), text(12, 15, 'f(x)', 9, true)],
	unknown: [rect(2, 5, 9, 7, 1.5), rect(13, 12, 9, 7, 1.5), line(11, 8.5, 13, 15.5, 1.5, true)],
};

/** Icon primitives for a resolved OLE type. */
export function getOleIconShapes(type: ResolvedOleType): OleIconShape[] {
	return ICONS[type];
}
