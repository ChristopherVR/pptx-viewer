/**
 * A compact spelling of an OOXML colour choice for gallery catalogues:
 * `'accent1 satMod:200000 tint:72000'` is `<a:schemeClr val="accent1"><a:satMod
 * val="200000"/><a:tint val="72000"/></a:schemeClr>` and `'#7D7D7D alpha:73000'`
 * is the `a:srgbClr` twin. Transforms keep their written order, which OOXML
 * applies in sequence, so a catalogue line reads exactly like the captured XML.
 *
 * @module render/ribbon-galleries/gallery-color-spec
 */
import type { PptxThemeColorRef, XmlObject } from 'pptx-viewer-core';
import { themeColorRefFromColorChoice } from 'pptx-viewer-core';

import { parseDrawingColorChoice } from '../drawing-color';

/** The colour-choice node (`{ 'a:schemeClr': {...} }` / `{ 'a:srgbClr': {...} }`). */
export function colorSpecXml(spec: string): XmlObject {
	const [base, ...transforms] = spec.trim().split(/\s+/u);
	const node: XmlObject = { '@_val': base.startsWith('#') ? base.slice(1).toUpperCase() : base };
	for (const transform of transforms) {
		const [name, value] = transform.split(':');
		node[`a:${name}`] = { '@_val': value };
	}
	const wrapper: XmlObject = {};
	wrapper[base.startsWith('#') ? 'a:srgbClr' : 'a:schemeClr'] = node;
	return wrapper;
}

/** The `a:alpha` of a spec as a 0-1 opacity, or undefined when opaque. */
export function colorSpecOpacity(spec: string): number | undefined {
	const match = /\balpha:(\d+)/u.exec(spec);
	return match ? Number(match[1]) / 100000 : undefined;
}

/** A resolved colour spec: hex (no alpha), opacity, the XML node and a typed ref when expressible. */
export interface ResolvedColorSpec {
	hex: string;
	opacity?: number;
	xml: XmlObject;
	ref?: PptxThemeColorRef;
}

/** Resolve `spec` against the deck's `themeColorMap` exactly as the load path would. */
export function resolveColorSpec(
	spec: string,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): ResolvedColorSpec {
	const xml = colorSpecXml(spec);
	const overrides = { ...themeColorMap } as Record<string, string | undefined>;
	const hex = parseDrawingColorChoice(xml, overrides) ?? '#000000';
	const ref = themeColorRefFromColorChoice(xml);
	const opacity = colorSpecOpacity(spec);
	return { hex, xml, ...(ref && { ref }), ...(opacity !== undefined && { opacity }) };
}
