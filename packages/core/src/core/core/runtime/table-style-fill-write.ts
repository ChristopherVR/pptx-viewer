/**
 * table-style-fill-write.ts - write-side mirror of `table-style-fill-parse.ts`
 * for a table-style section's fill choice (`a:tcStyle/a:fill`) and the
 * table-level background (`a:tblBg`'s `a:fill`/`a:fillRef` choice).
 *
 * An `a:blipFill` texture fill (`ParsedTableStyleFill.image`) is left
 * untouched on write: synthesising a new image relationship is out of scope
 * for a section-level XML merge with no access to the archive's rels/parts.
 *
 * @module table-style-fill-write
 */
import type {
	ParsedTableBackground,
	ParsedTableStyleFill,
	ParsedTableStyleGradient,
	ParsedTableStylePattern,
	XmlObject,
} from '../../types';
import { colorChoiceXml, ensureChild } from './table-style-xml-helpers';

function buildGradFillXml(gradient: ParsedTableStyleGradient): XmlObject {
	const gs = gradient.stops.map((stop) => ({
		'@_pos': String(Math.round(stop.position * 1000)),
		...colorChoiceXml(stop.fill),
	}));
	const node: XmlObject = { 'a:gsLst': { 'a:gs': gs } };
	if (gradient.type === 'radial') {
		node['a:path'] = { '@_path': 'circle' };
	} else {
		node['a:lin'] = {
			'@_ang': String(Math.round(((gradient.angle ?? 0) * 60000) % 21600000)),
			'@_scaled': '1',
		};
	}
	return node;
}

function buildPattFillXml(pattern: ParsedTableStylePattern): XmlObject {
	const node: XmlObject = { '@_prst': pattern.preset };
	if (pattern.foreground) {
		node['a:fgClr'] = colorChoiceXml(pattern.foreground);
	}
	if (pattern.background) {
		node['a:bgClr'] = colorChoiceXml(pattern.background);
	}
	return node;
}

/**
 * Write a resolved fill's chosen XML representation (`a:noFill`/`a:solidFill`/
 * `a:gradFill`/`a:pattFill`) into an already-cleared wrapper object. Skips an
 * `image` fill entirely (see module docblock); the caller must not have
 * cleared the wrapper's existing content in that case.
 */
export function writeFillChoiceInto(target: XmlObject, fill: ParsedTableStyleFill): void {
	if (fill.noFill) {
		target['a:noFill'] = {};
		return;
	}
	if (fill.gradient) {
		target['a:gradFill'] = buildGradFillXml(fill.gradient);
		return;
	}
	if (fill.pattern) {
		target['a:pattFill'] = buildPattFillXml(fill.pattern);
		return;
	}
	if (fill.schemeColor || fill.color) {
		target['a:solidFill'] = colorChoiceXml(fill);
	}
}

/**
 * Replace a table-style section's fill (`a:tcStyle/a:fill`). An `image` fill
 * is a no-op (see module docblock): whatever fill/fillRef the section already
 * had is left untouched rather than being cleared with nothing to replace it.
 */
export function writeTableStyleSectionFill(section: XmlObject, fill: ParsedTableStyleFill): void {
	if (fill.image) {
		return;
	}
	const tcStyle = ensureChild(section, 'a:tcStyle');
	// `fill`/`fillRef` are the EG_FillProperties choice: an explicit fill wins.
	delete tcStyle['a:fillRef'];
	const fillWrap = ensureChild(tcStyle, 'a:fill');
	for (const key of Object.keys(fillWrap)) {
		delete fillWrap[key];
	}
	writeFillChoiceInto(fillWrap, fill);
}

/**
 * Write `<a:tblBg>`'s fill choice (`a:fill` inline, or `a:fillRef` style-
 * matrix reference). `hasEffectLst` is presence-only on the parse side (no
 * typed effect chain for `tblBg`, unlike `a:tblPr`'s own effects): any
 * existing `a:effectLst` is left untouched here.
 */
export function writeTableBackground(
	styleNode: XmlObject,
	background: ParsedTableBackground,
): void {
	const tblBg = ensureChild(styleNode, 'a:tblBg');
	if (background.fill) {
		delete tblBg['a:fillRef'];
		const fillWrap = ensureChild(tblBg, 'a:fill');
		for (const key of Object.keys(fillWrap)) {
			delete fillWrap[key];
		}
		writeFillChoiceInto(fillWrap, background.fill);
	} else if (background.fillRef) {
		delete tblBg['a:fill'];
		const fillRefNode: XmlObject = { '@_idx': String(background.fillRef.idx) };
		if (background.fillRef.color) {
			Object.assign(fillRefNode, colorChoiceXml(background.fillRef.color));
		}
		tblBg['a:fillRef'] = fillRefNode;
	}
}
