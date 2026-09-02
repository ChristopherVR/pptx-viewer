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

export type { OleIconShape } from 'pptx-viewer-shared';
export { getOleIconShapes } from 'pptx-viewer-shared';

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
