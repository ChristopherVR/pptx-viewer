/**
 * OLE renderer helpers for the Angular binding.
 *
 * The pure type-resolution helpers (resolveOleType / getOleType* / aria / badge /
 * display name / placeholder style) and the size/MIME helpers (formatBytes /
 * isBrowserOpenableMime) now live in `pptx-viewer-shared` and are re-exported
 * here so the component (and tests) keep importing them from one local module.
 *
 * The presentational action-model builders below stay local for now; they are
 * pure but small and binding-shaped. They build on the shared helpers.
 *
 * `buildOleInfoRows` / `buildOleActionModel` accept an optional `TranslateService`
 * so callers with access to one get translated row labels; callers without one
 * (e.g. plain unit tests) still get the English fallback.
 */
import type { TranslateService } from '@ngx-translate/core';
import type { OlePptxElement } from 'pptx-viewer-core';

import {
	formatBytes,
	getOleTypeLabel,
	isBrowserOpenableMime,
	resolveOleType,
} from '../internal/shared';

// Re-export the shared pure helpers so existing local imports keep working.
export {
	formatBytes,
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleDisplayName,
	getOleTypeColor,
	getOleTypeLabel,
	getPlaceholderStyle,
	isBrowserOpenableMime,
	resolveOleType,
} from '../internal/shared';
export type { ResolvedOleType } from '../internal/shared';

// ==========================================================================
// Embedded-payload actions (Download / Open) + richer info
// ==========================================================================

/**
 * Resolve the file name to use for the download anchor's `download` attribute:
 * the recovered embedded name, then the authored file name, then a generic
 * fallback so the saved file is never nameless.
 */
export function getOleDownloadFileName(el: OlePptxElement): string {
	return el.oleEmbeddedFileName ?? el.fileName ?? 'embedded-object';
}

/** A single descriptive info row for the OLE caption / overlay. */
export interface OleInfoRow {
	/** Stable key for `@for` tracking (e.g. `'type'`, `'file'`). */
	key: string;
	/** Display label (e.g. `'Application'`). */
	label: string;
	/** Display value (e.g. `'Excel.Sheet.12'`). */
	value: string;
}

/**
 * Build the descriptive info rows shown in the OLE caption.
 *
 * Rows: object type label, original file name (`oleEmbeddedFileName ?? fileName`),
 * human-readable size (`oleEmbeddedByteSize`), and application (`oleProgId`).
 * A row is omitted when its value is unknown, so the result may contain only
 * the always-present type row.
 */
export function buildOleInfoRows(el: OlePptxElement, translate?: TranslateService): OleInfoRow[] {
	const t = (key: string, fallback: string): string =>
		translate ? translate.instant(key) : fallback;
	const rows: OleInfoRow[] = [
		{ key: 'type', label: t('pptx.ole.type', 'Type'), value: getOleTypeLabel(resolveOleType(el)) },
	];
	const fileName = el.oleEmbeddedFileName ?? el.fileName;
	if (fileName) {
		rows.push({ key: 'file', label: t('pptx.hyperlink.tabFile', 'File'), value: fileName });
	}
	const sizeLabel = formatBytes(el.oleEmbeddedByteSize);
	if (sizeLabel) {
		rows.push({ key: 'size', label: t('pptx.effects.size', 'Size'), value: sizeLabel });
	}
	if (el.oleProgId) {
		rows.push({
			key: 'application',
			label: t('pptx.documentProperties.statistics.application', 'Application'),
			value: el.oleProgId,
		});
	}
	return rows;
}

/**
 * Presentational action model for an OLE element's embedded payload, derived
 * purely from the core-recovered fields. The binding wires the actual
 * `<a download>` / new-tab open; this only decides what is offered and with
 * what attributes.
 */
export interface OleActionModel {
	/** True when an embedded payload data-URL is available to download. */
	canDownload: boolean;
	/** True when the payload can additionally be opened in a browser tab. */
	canOpen: boolean;
	/** Data-URL for the download anchor `href`, when available. */
	downloadHref: string | undefined;
	/** Suggested file name for the download anchor `download` attribute. */
	downloadFileName: string;
	/** Human-readable size, when known (e.g. `"2.3 MB"`). */
	sizeLabel: string | undefined;
	/** Descriptive info rows (type / file / size / application). */
	info: OleInfoRow[];
}

/**
 * Build the full action model for an OLE element. Download is offered whenever a
 * non-empty embedded data-URL exists; Open is additionally offered when the
 * payload's MIME type is one a browser can render inline (PDF / image / text).
 */
export function buildOleActionModel(
	el: OlePptxElement,
	translate?: TranslateService,
): OleActionModel {
	const downloadHref = el.oleEmbeddedData;
	const canDownload = typeof downloadHref === 'string' && downloadHref.length > 0;
	const canOpen = canDownload && isBrowserOpenableMime(el.oleEmbeddedMimeType);
	return {
		canDownload,
		canOpen,
		downloadHref,
		downloadFileName: getOleDownloadFileName(el),
		sizeLabel: formatBytes(el.oleEmbeddedByteSize),
		info: buildOleInfoRows(el, translate),
	};
}
