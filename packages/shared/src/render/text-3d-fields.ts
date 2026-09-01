/**
 * text-3d-fields: unit conversion, clamping and patch building for the
 * inspector's 3D-text (WordArt "Format Text Effects") panel.
 *
 * WHY shared: `Text3DStyle` stores extrusion depth and bevel width/height in
 * EMU, exactly as OOXML does, while every binding's panel edits POINTS. Each
 * binding therefore needs the same pair of conversions, the same rounding, the
 * same field limits and the same "turning extrusion on seeds a visible depth"
 * rule. Those were retyped per binding (React, Vue and Vanilla each carried
 * their own `EMU_PER_PT` plus a local clamp), which is precisely the drift this
 * package exists to remove: a binding that rounds differently writes a slightly
 * different deck for the same user gesture.
 *
 * @module render/text-3d-fields
 */
import type { PptxElement, Text3DStyle, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/** EMU per typographic point (1pt = 12700 EMU), as OOXML defines it. */
export const TEXT_3D_EMU_PER_PT = 12700;

/** Upper bound (pt) offered for the extrusion depth field. */
export const TEXT_3D_MAX_EXTRUSION_PT = 100;

/** Upper bound (pt) offered for a bevel's width / height fields. */
export const TEXT_3D_MAX_BEVEL_PT = 50;

/**
 * Depth (pt) seeded when the user switches extrusion ON. PowerPoint renders
 * nothing at all for a zero-depth extrusion, so a freshly ticked checkbox has
 * to land on a visible value or the control looks broken.
 */
export const TEXT_3D_DEFAULT_EXTRUSION_PT = 6;

/** Convert an EMU measurement to whole points for display (0 when absent). */
export function text3dEmuToPt(emu: number | undefined): number {
	if (!emu || !Number.isFinite(emu)) {
		return 0;
	}
	return Math.round(emu / TEXT_3D_EMU_PER_PT);
}

/** Convert a point measurement back to EMU for storage. */
export function text3dPtToEmu(pt: number): number {
	return Math.round(pt * TEXT_3D_EMU_PER_PT);
}

/** Clamp an edited point value into `[0, max]` (0 for anything non-finite). */
export function clampText3dPt(value: number, max: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.min(max, value));
}

/**
 * Whether a 3D-text style is actually extruded. Every downstream control (the
 * bevels and the material) only affects rendering once there is depth, so the
 * panels hide them behind this flag.
 */
export function hasText3dExtrusion(t3d: Text3DStyle | undefined): boolean {
	return Boolean(t3d?.extrusionHeight && t3d.extrusionHeight > 0);
}

/** Merge a partial change onto an existing 3D-text style. */
export function mergeText3d(
	current: Text3DStyle | undefined,
	patch: Partial<Text3DStyle>,
): Text3DStyle {
	return { ...current, ...patch };
}

/**
 * Resolve the `text3d` value an extrusion checkbox should commit: a seeded
 * default depth when switching on, and `undefined` (drop the whole `a:sp3d`)
 * when switching off, so an unticked box never leaves an orphan bevel behind.
 *
 * This is only HALF of the change a checkbox has to commit. Writing
 * `text3d: undefined` on a placeholder does not switch the 3D off: the shape
 * inherits its `a:sp3d` from the layout/master, and the inheritance merge
 * refills the field from that ancestor on the next resolve. The other half
 * is `flatText` (`a:flatTx`), the explicit stop marker; use
 * {@link toggleText3dExtrusionPatch} (or {@link text3dStylePatch}), which
 * write both, rather than assigning this function's result to `text3d` alone.
 */
export function toggleText3dExtrusion(
	current: Text3DStyle | undefined,
	enabled: boolean,
): Text3DStyle | undefined {
	if (!enabled) {
		return undefined;
	}
	return mergeText3d(current, {
		extrusionHeight: text3dPtToEmu(TEXT_3D_DEFAULT_EXTRUSION_PT),
	});
}

/**
 * The `TextStyle` fields a 3D-text edit touches. `flatText` is always present
 * so a stale `a:flatTx` cannot survive switching 3D back on (a renderer
 * short-circuits on it regardless of `text3d`).
 */
export interface Text3DTextStylePatch {
	text3d: Text3DStyle | undefined;
	flatText: boolean | undefined;
}

/**
 * Whether a text body may inherit `a:sp3d` from a layout/master placeholder.
 *
 * Only placeholders take part in the slide -> layout -> master body-property
 * cascade, so a non-placeholder shape that drops its own `text3d` really is
 * flat afterwards, while a placeholder needs an explicit `a:flatTx` to stop
 * the ancestor's extrusion leaking back in (see `TextStyle.flatText`).
 */
export function text3dInheritsFromTemplate(el: PptxElement): boolean {
	return typeof el.placeholderType === 'string' && el.placeholderType.length > 0;
}

/**
 * Pair a `text3d` value with the `flatText` marker it needs so the patch means
 * what the checkbox says on every shape:
 *
 * - `text3d` present: `flatText` is cleared, or an earlier "off" would keep
 *   suppressing the extrusion the user just switched on.
 * - `text3d` absent on an inheriting shape: `flatText: true`, the only signal
 *   that stops the layout/master `a:sp3d` from being merged back in.
 * - `text3d` absent on a plain shape: `flatText` cleared; there is nothing to
 *   inherit, and an orphan `a:flatTx` would be noise in the saved file.
 */
export function text3dFieldsPatch(
	t3d: Text3DStyle | undefined,
	inherits: boolean,
): Text3DTextStylePatch {
	return { text3d: t3d, flatText: t3d === undefined && inherits ? true : undefined };
}

/**
 * The `TextStyle` patch an extrusion checkbox should commit. Combines
 * {@link toggleText3dExtrusion} with {@link text3dFieldsPatch}.
 *
 * @param current - The text body's current 3D style.
 * @param enabled - The checkbox's new position.
 * @param inherits - Whether the shape inherits body properties from a
 *   layout/master placeholder; pass {@link text3dInheritsFromTemplate}(element).
 */
export function toggleText3dExtrusionPatch(
	current: Text3DStyle | undefined,
	enabled: boolean,
	inherits: boolean,
): Text3DTextStylePatch {
	return text3dFieldsPatch(toggleText3dExtrusion(current, enabled), inherits);
}

/**
 * Build a `Partial<PptxElement>` patch that writes `text3d` (and the matching
 * `flatText` marker, see {@link text3dFieldsPatch}) onto the element's
 * existing `textStyle` without dropping the other text fields. Mirrors
 * `textStylePatch` in `inspector-helpers`, which cannot carry `text3d` because
 * its change set is the flat font-formatting subset.
 */
export function text3dStylePatch(
	el: PptxElement,
	t3d: Text3DStyle | undefined,
): Partial<PptxElement> {
	const base: TextStyle = hasTextProperties(el) ? (el.textStyle ?? {}) : {};
	return {
		textStyle: { ...base, ...text3dFieldsPatch(t3d, text3dInheritsFromTemplate(el)) },
	} as Partial<PptxElement>;
}
