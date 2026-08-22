/**
 * table-style-image.ts - resolve a table cell's image fill (`a:tcPr/a:blipFill`)
 * to CSS.
 *
 * A table cell filled with an image parsed to no fill at all before this
 * module existed: `applyCellFillStyle` (core) had no `a:blipFill` branch, so
 * `PptxTableCellStyle.fillMode` never became `'image'`. Now that the core
 * parser resolves the blip relationship to a path (see
 * `backgroundImageFillPath` / `backgroundImageFillData` on
 * {@link PptxTableCellStyle}), this is the one place that path becomes CSS,
 * consumed by {@link cellStyleToCss} (and, through it, `tableCellCss`) so all
 * five bindings render it identically.
 *
 * Table parsing is synchronous, so the archive-relative path is resolved
 * lazily by the viewer's load pipeline (mirroring picture elements parsed
 * with `eagerDecodeImages: false`): `backgroundImageFillPath` starts out as a
 * raw archive path, which is not a usable CSS `url()`, and is patched to
 * `backgroundImageFillData` (a `data:`/`blob:` URL) once resolved. An
 * already-external `http(s):`/`data:` target is usable immediately from
 * either field.
 */
import type { PptxTableCellStyle } from 'pptx-viewer-core';

/** Resolved CSS for a table cell's image fill. */
export interface CellImageFillCss {
	backgroundImage: string;
	backgroundSize: string;
	backgroundPosition: string;
	backgroundRepeat: string;
}

/** A URL usable directly as a CSS `url(...)` value, with no further resolution needed. */
function isDisplayableImageUrl(url: string): boolean {
	return (
		url.startsWith('data:') ||
		url.startsWith('blob:') ||
		url.startsWith('http://') ||
		url.startsWith('https://')
	);
}

/**
 * Resolve a cell's image fill to CSS background properties.
 *
 * Returns `null` when the style is not an image fill, or when the only
 * available reference is a raw archive path the load pipeline has not
 * resolved to a displayable URL yet (the cell then falls back to whatever
 * lower-priority background the caller applies, exactly like an unresolved
 * picture element shows no image until its path resolves).
 */
export function cellImageFillCss(style: PptxTableCellStyle): CellImageFillCss | null {
	if (style.fillMode !== 'image') {
		return null;
	}
	const url = style.backgroundImageFillData ?? style.backgroundImageFillPath;
	if (!url || !isDisplayableImageUrl(url)) {
		return null;
	}
	return {
		backgroundImage: `url("${url}")`,
		backgroundSize: 'cover',
		backgroundPosition: 'center',
		backgroundRepeat: 'no-repeat',
	};
}
