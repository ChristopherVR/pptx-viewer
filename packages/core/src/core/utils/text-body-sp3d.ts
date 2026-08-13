import type {
	BevelPresetType,
	MaterialPresetType,
	Text3DStyle,
	TextStyle,
	XmlObject,
} from '../types';

/** `parseInt` an attribute, or `undefined` when it is absent or not numeric. */
function intAttr(value: unknown): number | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	const parsed = parseInt(String(value), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Read one `a:bevelT` / `a:bevelB` node onto the matching Text3DStyle fields. */
function applyBevel(
	bevel: XmlObject | undefined,
	t3d: Text3DStyle,
	prefix: 'bevelTop' | 'bevelBottom',
): void {
	if (!bevel) {
		return;
	}
	t3d[`${prefix}Type` as 'bevelTopType'] = String(
		bevel['@_prst'] || 'circle',
	).trim() as BevelPresetType;
	const width = intAttr(bevel['@_w']);
	if (width !== undefined) {
		t3d[`${prefix}Width` as 'bevelTopWidth'] = width;
	}
	const height = intAttr(bevel['@_h']);
	if (height !== undefined) {
		t3d[`${prefix}Height` as 'bevelTopHeight'] = height;
	}
}

/**
 * Parse `a:bodyPr/a:sp3d` (§20.1.5.12) into {@link TextStyle.text3d}.
 *
 * Extracted from the body-properties parser so the absent-attribute handling
 * is testable in isolation. The guards used to read `attr !== null`, but
 * fast-xml-parser yields `undefined` (never `null`) for an attribute the
 * source never wrote - so `<a:sp3d><a:bevelT prst="circle"/></a:sp3d>`, which
 * is exactly how PowerPoint writes a default bevel, passed every guard and
 * stored `parseInt('undefined')` = `NaN` into `extrusionHeight`,
 * `bevelTopWidth`, `bevelTopHeight`, `bevelBottomWidth` and
 * `bevelBottomHeight`. A `NaN` reaches the renderers as a poisoned dimension
 * and serialises to `null` through JSON (the converter, the collaboration
 * codec), so it is corruption even where the save writer's truthiness check
 * happens to skip it.
 *
 * The shape-level twin (`applyShape3dStyle` in
 * `core/builders/shape-style-3d-helpers.ts`) already used the `!== undefined`
 * form; this brings the text-body path in line with it.
 *
 * @param bodyPr     - The `a:bodyPr` node to read.
 * @param style      - Text style to populate.
 * @param parseColor - Theme-aware colour resolver for `a:extrusionClr`.
 */
export function parseTextBodySp3d(
	bodyPr: XmlObject,
	style: TextStyle,
	parseColor: (colorNode: XmlObject | undefined) => string | undefined,
): void {
	const sp3d = bodyPr['a:sp3d'] as XmlObject | undefined;
	if (!sp3d) {
		return;
	}

	const t3d: Text3DStyle = {};
	const extrusionHeight = intAttr(sp3d['@_extrusionH']);
	if (extrusionHeight !== undefined) {
		t3d.extrusionHeight = extrusionHeight;
	}
	const extrusionColor = parseColor(sp3d['a:extrusionClr'] as XmlObject | undefined);
	if (extrusionColor) {
		t3d.extrusionColor = extrusionColor;
	}
	const material = String(sp3d['@_prstMaterial'] || '').trim();
	if (material) {
		t3d.presetMaterial = material as MaterialPresetType;
	}

	applyBevel(sp3d['a:bevelT'] as XmlObject | undefined, t3d, 'bevelTop');
	applyBevel(sp3d['a:bevelB'] as XmlObject | undefined, t3d, 'bevelBottom');

	if (Object.keys(t3d).length > 0) {
		style.text3d = t3d;
	}
}
