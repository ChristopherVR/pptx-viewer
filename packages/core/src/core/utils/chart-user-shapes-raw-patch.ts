/**
 * chart-user-shapes-raw-patch.ts: in-place patches applied to a CLONED
 * verbatim (`rawXml`) chart overlay node before it is re-emitted, so the few
 * fields the inspector can edit on a `cdr:pic`/`cdr:graphicFrame` (alt text,
 * a grouped child's own transform) survive the save while everything else in
 * the node stays byte-for-byte what was parsed. Split out of
 * `chart-user-shapes-serializer.ts` (W2-F).
 *
 * @module core/utils/chart-user-shapes-raw-patch
 */

import type { XmlObject } from '../types';

/** A node's own local name, ignoring any namespace prefix (`"cdr:spPr"` -> `"spPr"`). */
function localName(key: string): string {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
}

/** Find a child element key by local name (any namespace prefix), ignoring attribute keys. */
function findChildKey(node: XmlObject | undefined, name: string): string | undefined {
	if (!node) {
		return undefined;
	}
	return Object.keys(node).find((k) => !k.startsWith('@_') && localName(k) === name);
}

/**
 * Patch a cloned `cdr:pic` node's alt text (`cdr:nvPicPr/cdr:cNvPr/@descr`)
 * in place, inserting `nvPicPr`/`cNvPr` when the source markup lacks them
 * (an SDK-authored picture with no prior alt text). No-op when `altText` is
 * `undefined` (nothing to write; the rest of the node, including the blip,
 * is untouched either way).
 */
export function applyPicAltText(node: XmlObject, altText: string | undefined): void {
	if (altText === undefined) {
		return;
	}
	const nvPicPrKey = findChildKey(node, 'nvPicPr') ?? 'cdr:nvPicPr';
	const nvPicPr = (node[nvPicPrKey] as XmlObject | undefined) ?? {};
	const cNvPrKey = findChildKey(nvPicPr, 'cNvPr') ?? 'cdr:cNvPr';
	const cNvPr = (nvPicPr[cNvPrKey] as XmlObject | undefined) ?? {};
	cNvPr['@_descr'] = altText;
	nvPicPr[cNvPrKey] = cNvPr;
	node[nvPicPrKey] = nvPicPr;
}

/**
 * Patch a cloned `cdr:pic`/`cdr:graphicFrame` group-child node's own
 * position/size (`a:xfrm/a:off`+`a:ext`) in place from the typed
 * `PptxChartUserShapeGroupChild.off`/`ext`, which is the field the
 * inspector's position/size controls actually edit. Unlike a top-level
 * anchor (whose `cdr:from`/`cdr:to`/`cdr:ext` markers are separate siblings
 * of the shape node and already govern position independently of any
 * embedded `a:xfrm`), a GROUPED child's position lives only inside its own
 * `a:xfrm`, which `rawXml` would otherwise re-emit stale. A `pic` carries
 * its `a:xfrm` under `spPr`; a `graphicFrame` carries it directly.
 */
export function applyChildXfrmToRawNode(
	node: XmlObject,
	off: { x: number; y: number },
	ext: { cx: number; cy: number },
): void {
	const spPrKey = findChildKey(node, 'spPr');
	const container = spPrKey ? ((node[spPrKey] as XmlObject | undefined) ?? node) : node;
	const xfrmKey = findChildKey(container, 'xfrm');
	if (!xfrmKey) {
		// No `a:xfrm` to patch (unusual, but defensive: leave the node as-is
		// rather than fabricate a transform shape not in the source schema
		// position).
		return;
	}
	const xfrm = container[xfrmKey] as XmlObject;
	const offKey = findChildKey(xfrm, 'off') ?? 'a:off';
	const extKey = findChildKey(xfrm, 'ext') ?? 'a:ext';
	xfrm[offKey] = { '@_x': String(Math.round(off.x)), '@_y': String(Math.round(off.y)) };
	xfrm[extKey] = { '@_cx': String(Math.round(ext.cx)), '@_cy': String(Math.round(ext.cy)) };
}

/**
 * Patch a cloned `cdr:pic`/`cdr:graphicFrame` node's own rotation/flip
 * (`a:xfrm/@rot`/`@flipH`/`@flipV`) in place from the typed model's
 * `rotation`/`flipH`/`flipV`, the other fields the inspector's position/size
 * controls can edit on a raw-passthrough shape (alongside {@link
 * applyChildXfrmToRawNode}'s `off`/`ext`, and independent of it: a
 * TOP-LEVEL anchor's own `a:xfrm` carries rotation/flip but no meaningful
 * `off`/`ext` of its own, see `PptxChartUserShape.rotation`'s doc, so this is
 * also called with no prior `applyChildXfrmToRawNode` call at that level).
 *
 * Always resyncs (never a no-op on `undefined`, unlike {@link
 * applyPicAltText}): `rotation`/`flipH`/`flipV` are optional-but-never-stale
 * fields (falsy means absent), so an untouched shape's stored value round-trips
 * byte-identical (re-deriving the same `@_rot` integer it was parsed from),
 * and an explicitly cleared one has its attribute deleted rather than left
 * stale. Fabricates a bare `a:xfrm` (no `off`/`ext`) only when there is
 * something to write and none exists yet; otherwise leaves a node with no
 * existing `a:xfrm` and nothing to write completely untouched.
 */
export function applyRotationFlipToRawNode(
	node: XmlObject,
	rotation: number | undefined,
	flipH: boolean | undefined,
	flipV: boolean | undefined,
): void {
	const spPrKey = findChildKey(node, 'spPr');
	const container = spPrKey ? ((node[spPrKey] as XmlObject | undefined) ?? node) : node;
	const xfrmKey = findChildKey(container, 'xfrm');
	const hasAny = Boolean(rotation) || Boolean(flipH) || Boolean(flipV);
	if (!xfrmKey && !hasAny) {
		return;
	}
	const xfrm = xfrmKey ? (container[xfrmKey] as XmlObject) : {};
	if (rotation) {
		xfrm['@_rot'] = String(Math.round(rotation * 60000));
	} else {
		delete xfrm['@_rot'];
	}
	if (flipH) {
		xfrm['@_flipH'] = '1';
	} else {
		delete xfrm['@_flipH'];
	}
	if (flipV) {
		xfrm['@_flipV'] = '1';
	} else {
		delete xfrm['@_flipV'];
	}
	container[xfrmKey ?? 'a:xfrm'] = xfrm;
	if (spPrKey) {
		node[spPrKey] = container;
	}
}
