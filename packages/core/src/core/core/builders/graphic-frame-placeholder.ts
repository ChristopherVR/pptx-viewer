/**
 * @fileoverview Placeholder reference on a `p:graphicFrame`.
 *
 * A table, chart, SmartArt, OLE or media frame that fills a layout
 * placeholder carries `p:nvGraphicFramePr/p:nvPr/p:ph`, exactly like a
 * `p:sp` carries `p:nvSpPr/p:nvPr/p:ph`. The frame parser used to ignore the
 * node, so `placeholderType` was never set on those elements and a frame with
 * no usable transform of its own had nothing to inherit position from.
 */
import type { XmlObject } from '../../types';
import { normalizePlaceholderIndex } from '../../utils/placeholder-index';

/** The `p:ph` attributes a graphic frame can carry, normalised. */
export interface GraphicFramePlaceholder {
	/** `@idx`, normalised (PowerPoint's `4294967295` sentinel is erased). */
	idx?: string;
	/** `@type`, lower-cased (`tbl`, `chart`, `dgm`, `obj`, `media`, ...). */
	type?: string;
	/** `@sz`, lower-cased. */
	sz?: string;
	/** `@orient`, only ever `vert` when present. */
	orient?: 'vert';
}

function asNode(value: unknown): XmlObject | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

/**
 * Read `p:nvGraphicFramePr/p:nvPr/p:ph` off a graphic frame.
 *
 * A bare `<p:ph/>` parses to `''` (fast-xml-parser collapses empty elements)
 * and still means "this frame is a placeholder", so it yields an empty record
 * rather than `undefined`.
 *
 * @returns the placeholder reference, or `undefined` when the frame is not a
 *   placeholder
 */
export function readGraphicFramePlaceholder(
	frame: XmlObject | undefined,
): GraphicFramePlaceholder | undefined {
	const nvPr = asNode(asNode(frame?.['p:nvGraphicFramePr'])?.['p:nvPr']);
	if (!nvPr || !('p:ph' in nvPr)) {
		return undefined;
	}
	const ph = asNode(nvPr['p:ph']);
	if (!ph) {
		return {};
	}
	const orientRaw = ph['@_orient'];
	const orient =
		orientRaw !== undefined && String(orientRaw).trim().toLowerCase() === 'vert'
			? ('vert' as const)
			: undefined;
	const type = ph['@_type'];
	const sz = ph['@_sz'];
	return {
		idx: normalizePlaceholderIndex(ph['@_idx']),
		type: type !== undefined ? String(type).toLowerCase() : undefined,
		sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
		orient,
	};
}

/** Whether an `a:xfrm` / `p:xfrm` node carries a usable offset and extent. */
export function hasUsableTransform(xfrm: XmlObject | undefined): boolean {
	const off = asNode(xfrm?.['a:off']);
	const ext = asNode(xfrm?.['a:ext']);
	return (
		off !== undefined && ext !== undefined && ext['@_cx'] !== undefined && ext['@_cy'] !== undefined
	);
}

/**
 * The transform an inherited placeholder node contributes.
 *
 * The layout/master counterpart of a graphic-frame placeholder is normally a
 * `p:sp` (PowerPoint writes layout placeholders as shapes), whose transform
 * sits at `p:spPr/a:xfrm`; a frame authored as the counterpart keeps it at
 * `p:xfrm`. Both spellings are accepted.
 */
export function readInheritedTransform(inherited: XmlObject | undefined): XmlObject | undefined {
	if (!inherited) {
		return undefined;
	}
	const own = asNode(inherited['p:xfrm']);
	if (hasUsableTransform(own)) {
		return own;
	}
	const fromSpPr = asNode(asNode(inherited['p:spPr'])?.['a:xfrm']);
	return hasUsableTransform(fromSpPr) ? fromSpPr : undefined;
}
