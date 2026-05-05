import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { reorderObjectKeys, SHAPE_STYLE_ORDER } from '../../utils/xml-reorder';

/**
 * Round-trip test for `<p:style>` (CT_ShapeStyle §20.1.2.2.36).
 *
 * Replicates the parse → resolve → save path covered by:
 * - PptxHandlerRuntimeThemeRefResolution.ts (parse + persist refs)
 * - PptxHandlerRuntimeSaveShapeStyleWriter.applyShapeStyleRefs (emit refs)
 *
 * The full runtime is hard to instantiate without a presentation, so we
 * exercise just the per-ref logic in isolation using the same helpers the
 * runtime uses.
 */

const COLOR_CHOICE_KEYS = [
	'a:scrgbClr',
	'a:srgbClr',
	'a:hslClr',
	'a:sysClr',
	'a:schemeClr',
	'a:prstClr',
] as const;

function extractRefColorXml(refNode: XmlObject | undefined): XmlObject | undefined {
	if (!refNode) {
		return undefined;
	}
	for (const key of COLOR_CHOICE_KEYS) {
		const child = refNode[key];
		if (child !== undefined) {
			return { [key]: child } as XmlObject;
		}
	}
	return undefined;
}

function persistLnRefOnStyle(refNode: XmlObject, style: ShapeStyle): void {
	const idx = parseInt(String(refNode['@_idx'] ?? '0'), 10);
	if (Number.isFinite(idx) && idx > 0) {
		style.lnRefIdx = idx;
	}
	const colorXml = extractRefColorXml(refNode);
	if (colorXml) {
		style.lnRefColorXml = colorXml;
	}
}

function persistFillRefOnStyle(refNode: XmlObject, style: ShapeStyle): void {
	const idx = parseInt(String(refNode['@_idx'] ?? '0'), 10);
	if (Number.isFinite(idx) && idx > 0) {
		style.fillRefIdx = idx;
	}
	const colorXml = extractRefColorXml(refNode);
	if (colorXml) {
		style.fillRefColorXml = colorXml;
	}
}

function persistEffectRefOnStyle(refNode: XmlObject, style: ShapeStyle): void {
	const idx = parseInt(String(refNode['@_idx'] ?? '0'), 10);
	if (Number.isFinite(idx) && idx > 0) {
		style.effectRefIdx = idx;
	}
	const colorXml = extractRefColorXml(refNode);
	if (colorXml) {
		style.effectRefColorXml = colorXml;
	}
}

function persistFontRefOnStyle(refNode: XmlObject, style: ShapeStyle): void {
	const idxAttr = String(refNode['@_idx'] ?? '').trim();
	if (idxAttr.length > 0) {
		style.fontRefIdx = idxAttr;
	}
	const colorXml = extractRefColorXml(refNode);
	if (colorXml) {
		style.fontRefColorXml = colorXml;
	}
}

function replaceRefColorChoice(refNode: XmlObject, colorXml: XmlObject | undefined): void {
	for (const key of COLOR_CHOICE_KEYS) {
		delete refNode[key];
	}
	if (!colorXml) {
		return;
	}
	for (const [key, value] of Object.entries(colorXml)) {
		refNode[key] = value;
	}
}

/**
 * Mirrors `PptxHandlerRuntimeSaveShapeStyleWriter.applyShapeStyleRefs`.
 */
function applyShapeStyleRefs(shape: XmlObject, style: ShapeStyle): void {
	const hasAnyRef =
		style.lnRefIdx !== undefined ||
		style.fillRefIdx !== undefined ||
		style.effectRefIdx !== undefined ||
		style.fontRefIdx !== undefined;

	if (!hasAnyRef) {
		return;
	}

	const existing = shape['p:style'] as XmlObject | undefined;
	const styleNode: XmlObject = existing ?? {};

	if (style.lnRefIdx !== undefined) {
		const lnRef = (styleNode['a:lnRef'] as XmlObject | undefined) ?? {};
		lnRef['@_idx'] = String(style.lnRefIdx);
		replaceRefColorChoice(lnRef, style.lnRefColorXml);
		styleNode['a:lnRef'] = lnRef;
	}
	if (style.fillRefIdx !== undefined) {
		const fillRef = (styleNode['a:fillRef'] as XmlObject | undefined) ?? {};
		fillRef['@_idx'] = String(style.fillRefIdx);
		replaceRefColorChoice(fillRef, style.fillRefColorXml);
		styleNode['a:fillRef'] = fillRef;
	}
	if (style.effectRefIdx !== undefined) {
		const effectRef = (styleNode['a:effectRef'] as XmlObject | undefined) ?? {};
		effectRef['@_idx'] = String(style.effectRefIdx);
		replaceRefColorChoice(effectRef, style.effectRefColorXml);
		styleNode['a:effectRef'] = effectRef;
	}
	if (style.fontRefIdx !== undefined) {
		const fontRef = (styleNode['a:fontRef'] as XmlObject | undefined) ?? {};
		fontRef['@_idx'] = style.fontRefIdx;
		replaceRefColorChoice(fontRef, style.fontRefColorXml);
		styleNode['a:fontRef'] = fontRef;
	}

	const reordered = reorderObjectKeys(styleNode, SHAPE_STYLE_ORDER);
	for (const key of Object.keys(styleNode)) {
		delete styleNode[key];
	}
	for (const key of Object.keys(reordered)) {
		styleNode[key] = reordered[key];
	}

	shape['p:style'] = styleNode;
}

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	preserveOrder: false,
	parseAttributeValue: false,
	allowBooleanAttributes: true,
});

const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	preserveOrder: false,
	suppressEmptyNode: true,
	suppressBooleanAttributes: false,
});

describe('<p:style> round-trip — Phase 2 Stream B / C-H2', () => {
	it('round-trips lnRef idx and schemeClr+lumMod override', () => {
		const inputXml = `
<p:sp xmlns:p="urn:p" xmlns:a="urn:a">
  <p:style>
    <a:lnRef idx="2">
      <a:schemeClr val="accent1">
        <a:lumMod val="50000"/>
      </a:schemeClr>
    </a:lnRef>
    <a:fillRef idx="0"/>
    <a:effectRef idx="0"/>
    <a:fontRef idx="minor"/>
  </p:style>
</p:sp>`;

		const parsed = parser.parse(inputXml) as XmlObject;
		const sp = parsed['p:sp'] as XmlObject;
		const styleNode = sp['p:style'] as XmlObject;

		const style: ShapeStyle = {};
		persistLnRefOnStyle(styleNode['a:lnRef'] as XmlObject, style);
		persistFillRefOnStyle(styleNode['a:fillRef'] as XmlObject, style);
		persistEffectRefOnStyle(styleNode['a:effectRef'] as XmlObject, style);
		persistFontRefOnStyle(styleNode['a:fontRef'] as XmlObject, style);

		expect(style.lnRefIdx).toBe(2);
		expect(style.lnRefColorXml).toBeDefined();
		expect(style.lnRefColorXml).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '50000' },
			},
		});
		// idx="0" is not persisted (skipped by the > 0 guard)
		expect(style.fillRefIdx).toBeUndefined();
		expect(style.effectRefIdx).toBeUndefined();
		expect(style.fontRefIdx).toBe('minor');

		// Now save: rebuild a shape and emit p:style
		const saved: XmlObject = {};
		applyShapeStyleRefs(saved, style);

		const savedStyle = saved['p:style'] as XmlObject;
		expect(savedStyle).toBeDefined();
		const savedKeys = Object.keys(savedStyle);
		// fontRef must come last per CT_ShapeStyle order
		expect(savedKeys).toStrictEqual(['a:lnRef', 'a:fontRef']);

		const savedLnRef = savedStyle['a:lnRef'] as XmlObject;
		expect(savedLnRef['@_idx']).toBe('2');
		expect(savedLnRef['a:schemeClr']).toStrictEqual({
			'@_val': 'accent1',
			'a:lumMod': { '@_val': '50000' },
		});

		const savedFontRef = savedStyle['a:fontRef'] as XmlObject;
		expect(savedFontRef['@_idx']).toBe('minor');

		// Re-parse to confirm the emitted XML survives a second parse cycle
		const out = builder.build({ 'p:sp': saved });
		const reparsed = parser.parse(out) as XmlObject;
		const reSp = reparsed['p:sp'] as XmlObject;
		const reStyleNode = reSp['p:style'] as XmlObject;

		const style2: ShapeStyle = {};
		persistLnRefOnStyle(reStyleNode['a:lnRef'] as XmlObject, style2);
		persistFontRefOnStyle(reStyleNode['a:fontRef'] as XmlObject, style2);

		expect(style2.lnRefIdx).toBe(2);
		expect(style2.lnRefColorXml).toStrictEqual(style.lnRefColorXml);
		expect(style2.fontRefIdx).toBe('minor');
	});

	it('round-trips fillRef with srgbClr override and ordering', () => {
		const inputXml = `
<p:sp xmlns:p="urn:p" xmlns:a="urn:a">
  <p:style>
    <a:fillRef idx="3"><a:srgbClr val="FF0000"/></a:fillRef>
    <a:lnRef idx="1"/>
    <a:fontRef idx="major"><a:schemeClr val="lt1"/></a:fontRef>
  </p:style>
</p:sp>`;

		const parsed = parser.parse(inputXml) as XmlObject;
		const styleNode = (parsed['p:sp'] as XmlObject)['p:style'] as XmlObject;

		const style: ShapeStyle = {};
		persistLnRefOnStyle(styleNode['a:lnRef'] as XmlObject, style);
		persistFillRefOnStyle(styleNode['a:fillRef'] as XmlObject, style);
		persistFontRefOnStyle(styleNode['a:fontRef'] as XmlObject, style);

		expect(style.fillRefIdx).toBe(3);
		expect(style.fillRefColorXml).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
		expect(style.lnRefIdx).toBe(1);
		expect(style.fontRefIdx).toBe('major');
		expect(style.fontRefColorXml).toStrictEqual({ 'a:schemeClr': { '@_val': 'lt1' } });

		// Save: even though input had fillRef before lnRef, emission must be lnRef-first.
		const saved: XmlObject = {};
		applyShapeStyleRefs(saved, style);
		const savedStyle = saved['p:style'] as XmlObject;
		expect(Object.keys(savedStyle)).toStrictEqual(['a:lnRef', 'a:fillRef', 'a:fontRef']);
	});

	it('handles bgFillStyleLst index 1001-1003', () => {
		const inputXml = `
<p:sp xmlns:p="urn:p" xmlns:a="urn:a">
  <p:style>
    <a:fillRef idx="1002"><a:schemeClr val="accent2"/></a:fillRef>
  </p:style>
</p:sp>`;

		const parsed = parser.parse(inputXml) as XmlObject;
		const styleNode = (parsed['p:sp'] as XmlObject)['p:style'] as XmlObject;

		const style: ShapeStyle = {};
		persistFillRefOnStyle(styleNode['a:fillRef'] as XmlObject, style);
		expect(style.fillRefIdx).toBe(1002);

		const saved: XmlObject = {};
		applyShapeStyleRefs(saved, style);
		const savedFillRef = (saved['p:style'] as XmlObject)['a:fillRef'] as XmlObject;
		expect(savedFillRef['@_idx']).toBe('1002');
	});

	it('does not emit <p:style> when no ref fields are populated', () => {
		const saved: XmlObject = {};
		applyShapeStyleRefs(saved, {});
		expect(saved['p:style']).toBeUndefined();
	});
});
