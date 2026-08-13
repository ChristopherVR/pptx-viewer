/**
 * presentation-file-kinds: the one place that answers "can the viewer open
 * this file?" and "what should the saved copy be called?".
 *
 * ## Why this is a shared decision and not five allow-lists
 *
 * The loader reads more formats than any single UI advertises. Legacy binary
 * `.ppt` (PowerPoint 97-2003) is the sharp example: `PptxHandler.load()` has
 * detected the OLE compound-file container and converted the binary deck
 * through the regular pptx pipeline for some time, but the product kept saying
 * it was unsupported, and a picker that filters the extension out makes a
 * working loader unreachable in practice. Whenever the loader learns a format,
 * exactly one list has to change.
 *
 * ## Read many, write one
 *
 * Input is a superset of output. We READ `.pptx`, `.ppsx`, `.pptm`, `.potx`,
 * legacy binary `.ppt` and portable `pptx-viewer-json`; we WRITE only the
 * OpenXML family. That asymmetry is deliberate (PowerPoint itself does the
 * same: open a 97-2003 deck and Save As offers `.pptx`), and it is why
 * {@link savedPresentationFileName} always REPLACES the source extension
 * rather than keeping it. A deck opened as `report.ppt` and saved as
 * `report.ppt` would be a file whose bytes and whose name disagree, which is
 * the kind of thing PowerPoint refuses to open.
 *
 * This module deliberately imports nothing, so any layer (render, export, a
 * binding, a host app) can depend on it without risking an import cycle.
 *
 * @module render/presentation-file-kinds
 */

/**
 * Extensions the built-in file picker offers, in the order it offers them.
 *
 * `.ppt` is in the list because the loader genuinely handles it, not as a
 * courtesy: see `packages/core/src/core/ppt/` and the `ppt-import` integration
 * suite, which asserts a `.ppt` loads to the same model as the `.pptx` it was
 * exported from.
 */
export const PRESENTATION_OPEN_EXTENSIONS = [
	'.pptx',
	'.ppsx',
	'.pptm',
	'.potx',
	'.ppt',
	'.json',
] as const;

/** Comma-separated `accept` attribute for a presentation file input. */
export const PPTX_OPEN_ACCEPT = PRESENTATION_OPEN_EXTENSIONS.join(',');

/**
 * Every extension the load path can consume, including the binary siblings
 * that share the `.ppt` record format and therefore load through the same
 * converter: `.pps` (97-2003 show) and `.pot` (97-2003 template). They are
 * recognised here but intentionally left out of {@link PRESENTATION_OPEN_EXTENSIONS}
 * so the picker advertises only what the test corpus actually covers.
 */
const LOADABLE_EXTENSION_PATTERN = /\.(?:pptx|ppsx|pptm|potx|ppt|pps|pot|json)$/iu;

/** Strip any directory prefix from a path, handling both separators. */
function baseNameOf(path: string): string {
	return path.replace(/\\/gu, '/').split('/').pop() ?? '';
}

/**
 * True when a picked / dropped file's name looks like something the loader can
 * open. Use this instead of a hand-rolled `endsWith` chain: a drop handler that
 * disagrees with the picker's `accept` list is a format that is supported by
 * mouse but not by drag, which is how `.ppt` stayed invisible.
 *
 * Extension-only, by design. The real answer comes from the container sniff in
 * `PptxHandler.load()`; this is only the cheap pre-filter a drop target needs
 * before it hands bytes to the loader.
 */
export function isSupportedPresentationFile(name: string | null | undefined): boolean {
	if (!name) {
		return false;
	}
	return LOADABLE_EXTENSION_PATTERN.test(baseNameOf(name));
}

/** True for the binary PowerPoint 97-2003 family, which we read but never write. */
export function isLegacyBinaryPresentation(name: string | null | undefined): boolean {
	if (!name) {
		return false;
	}
	return /\.(?:ppt|pps|pot)$/iu.test(baseNameOf(name));
}

/** The formats the save path can produce. Binary `.ppt` is deliberately absent. */
export type SavedPresentationFormat = 'pptx' | 'ppsx' | 'pptm';

/** Fallback stem when the host supplies no source file name. */
const DEFAULT_BASE_NAME = 'presentation';

/**
 * The stem of a presentation file name: directories and any loadable extension
 * removed. `C:\decks\report.ppt` becomes `report`; a name with no recognised
 * extension is kept whole, so `Untitled Presentation` survives intact rather
 * than losing everything after its last dot.
 */
export function presentationBaseName(
	sourceName: string | null | undefined,
	fallback: string = DEFAULT_BASE_NAME,
): string {
	const base = baseNameOf(sourceName ?? '')
		.replace(LOADABLE_EXTENSION_PATTERN, '')
		.trim();
	return base.length > 0 ? base : fallback;
}

/**
 * The name a saved copy should be offered under: the source stem plus the
 * extension of the format actually being written.
 *
 * This is what turns `report.ppt` into `report.pptx` on Save As. Output is
 * always an OpenXML package, so keeping the source extension would mislabel
 * the bytes.
 */
export function savedPresentationFileName(
	sourceName: string | null | undefined,
	format: SavedPresentationFormat = 'pptx',
): string {
	return `${presentationBaseName(sourceName)}.${format}`;
}
