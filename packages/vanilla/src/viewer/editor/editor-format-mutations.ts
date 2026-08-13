import type {
	PptxElement,
	PptxElementWithShapeStyle,
	PptxElementWithText,
	ShapeStyle,
	TextSegment,
	TextStyle,
} from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import { applyCaseTransformToSegments } from 'pptx-viewer-shared';

/**
 * Pure formatting-patch builders for the vanilla editor.
 *
 * Each function returns a `Partial<PptxElement>` suitable for the immutable
 * `updateElement` mutation (which shallow-merges it over a cloned element).
 * Nothing is mutated in place.
 *
 * Scope note (documented limitation): text formatting is applied at the
 * *element* level: the boolean/size/colour is written to `textStyle` AND to
 * every `textSegments[].style`, so the change is uniformly visible whether the
 * renderer reads the container style or the per-run styles. There is no
 * character-range selection model in this binding, so per-run partial
 * formatting (e.g. bold only the middle word) is out of scope; a whole-element
 * toggle mirrors what the React/Vue/Angular inspector "Text" panel applies when
 * no sub-range is selected.
 */

/** The character toggles the ribbon Font group exposes. */
export type TextToggleKey = 'bold' | 'italic' | 'underline' | 'strikethrough';

/** On/off state of the character toggles, read from the element style. */
export interface TextFormatState {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strikethrough: boolean;
	/** True when the element carries an explicit text-shadow. */
	hasTextShadow: boolean;
	/** Effective font size in points (element style, else first run, else default). */
	fontSize: number;
	/** Effective font family, or undefined when unset. */
	fontFamily: string | undefined;
	/**
	 * `p:ph/@type` of the selected element, when it is a placeholder.
	 *
	 * Lets the font box fall back to the theme's major font inside a title and
	 * its minor font elsewhere, instead of a hardcoded family that misreported
	 * every themed deck.
	 */
	placeholderType: string | undefined;
	/** Effective text colour (hex), or undefined when unset. */
	color: string | undefined;
	/** Effective highlight colour (hex), or undefined when unset. */
	highlightColor: string | undefined;
	/** Effective character spacing (1/100 pt), defaulting to 0 (normal). */
	characterSpacing: number;
	/** Effective paragraph list type. */
	listType: TextStyle['listType'];
	/** Effective paragraph alignment. */
	align: TextStyle['align'];
	/** Effective paragraph left margin in px. */
	paragraphMarginLeft: number;
	/** Effective line-spacing multiplier. */
	lineSpacing: number | undefined;
}

/**
 * Default font size (pt) assumed when neither the element nor a run sets one.
 * Matches React's `extractFontInfo` fallback (24) so the ribbon Font group and
 * the size stepper derive the same default the reference binding shows.
 */
const DEFAULT_FONT_SIZE = 24;
/** Clamp bounds for the font-size stepper / numeric input. */
const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 400;

/** Whether the element can receive text formatting (carries text properties). */
export function canFormatText(el: PptxElement | undefined): el is PptxElementWithText {
	return el !== undefined && hasTextProperties(el);
}

/** Whether the element can receive shape (fill/stroke) formatting. */
export function canFormatShape(el: PptxElement | undefined): el is PptxElementWithShapeStyle {
	return el !== undefined && hasShapeProperties(el);
}

/** Read the effective character-format state for the format toolbar UI. */
export function readTextFormatState(el: PptxElement | undefined): TextFormatState {
	const ts: TextStyle | undefined = canFormatText(el) ? el.textStyle : undefined;
	const firstRun = canFormatText(el) ? el.textSegments?.find((s) => s.text)?.style : undefined;
	return {
		bold: Boolean(ts?.bold ?? firstRun?.bold),
		italic: Boolean(ts?.italic ?? firstRun?.italic),
		underline: Boolean(ts?.underline ?? firstRun?.underline),
		strikethrough: Boolean(ts?.strikethrough ?? firstRun?.strikethrough),
		hasTextShadow: Boolean(ts?.textShadowColor ?? firstRun?.textShadowColor),
		fontSize: ts?.fontSize ?? firstRun?.fontSize ?? DEFAULT_FONT_SIZE,
		fontFamily: ts?.fontFamily ?? firstRun?.fontFamily,
		placeholderType: (el as { placeholderType?: string } | undefined)?.placeholderType,
		color: ts?.color ?? firstRun?.color,
		highlightColor: ts?.highlightColor ?? firstRun?.highlightColor,
		characterSpacing: ts?.characterSpacing ?? firstRun?.characterSpacing ?? 0,
		listType: ts?.listType ?? firstRun?.listType,
		align: ts?.align ?? firstRun?.align,
		paragraphMarginLeft: ts?.paragraphMarginLeft ?? firstRun?.paragraphMarginLeft ?? 0,
		lineSpacing: ts?.lineSpacing ?? firstRun?.lineSpacing,
	};
}

/** Apply `patch` to the element `textStyle` and to every run style. */
function patchTextStyle(el: PptxElement, patch: Partial<TextStyle>): Partial<PptxElement> {
	if (!canFormatText(el)) {
		return {};
	}
	const textStyle: TextStyle = { ...el.textStyle, ...patch };
	const segments: TextSegment[] | undefined = el.textSegments?.map((seg) => ({
		...seg,
		style: { ...seg.style, ...patch },
	}));
	return segments ? { textStyle, textSegments: segments } : { textStyle };
}

/** Toggle a boolean character property (bold/italic/underline) element-wide. */
export function toggleTextProp(el: PptxElement, key: TextToggleKey): Partial<PptxElement> {
	const state = readTextFormatState(el);
	return patchTextStyle(el, { [key]: !state[key] });
}

/** Set the font size (pt) element-wide, clamped to sane bounds. */
export function setFontSize(el: PptxElement, size: number): Partial<PptxElement> {
	const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
	return patchTextStyle(el, { fontSize: clamped });
}

/** Step the font size by `delta` points from the current effective size. */
export function adjustFontSize(el: PptxElement, delta: number): Partial<PptxElement> {
	return setFontSize(el, readTextFormatState(el).fontSize + delta);
}

/** Set the text colour (hex) element-wide. */
export function setTextColor(el: PptxElement, color: string): Partial<PptxElement> {
	return patchTextStyle(el, { color });
}

/** Set the text highlight colour (hex) element-wide. */
export function setHighlightColor(el: PptxElement, color: string): Partial<PptxElement> {
	return patchTextStyle(el, { highlightColor: color });
}

/** Merge a shape-style patch (fill/stroke/width) onto the element. */
export function patchShapeStyle(el: PptxElement, patch: Partial<ShapeStyle>): Partial<PptxElement> {
	if (!canFormatShape(el)) {
		return {};
	}
	const shapeStyle: ShapeStyle = { ...el.shapeStyle, ...patch };
	return { shapeStyle } as Partial<PptxElement>;
}

/** Set the font family element-wide. */
export function setFontFamily(el: PptxElement, fontFamily: string): Partial<PptxElement> {
	return patchTextStyle(el, { fontFamily });
}

/** Set the character spacing (1/100 pt) element-wide. */
export function setCharacterSpacing(el: PptxElement, spacing: number): Partial<PptxElement> {
	return patchTextStyle(el, { characterSpacing: spacing });
}

/** Default outer-shadow parameters applied when the text-shadow toggle is turned on. */
const DEFAULT_TEXT_SHADOW: Partial<TextStyle> = {
	textShadowColor: '#000000',
	textShadowBlur: 2,
	textShadowOffsetX: 1,
	textShadowOffsetY: 1,
	textShadowOpacity: 0.5,
};

/** Toggle a default text-drop-shadow element-wide (on when absent, cleared when present). */
export function toggleTextShadow(el: PptxElement): Partial<PptxElement> {
	const hasShadow = readTextFormatState(el).hasTextShadow;
	return patchTextStyle(
		el,
		hasShadow
			? {
					textShadowColor: undefined,
					textShadowBlur: undefined,
					textShadowOffsetX: undefined,
					textShadowOffsetY: undefined,
					textShadowOpacity: undefined,
				}
			: DEFAULT_TEXT_SHADOW,
	);
}

/**
 * Rewrite every run's characters per a PowerPoint "Change Case" mode (see
 * shared `transformTextCase`), across the whole element (no sub-range
 * selection model in this binding, see module docs).
 */
export function changeTextCase(el: PptxElement, mode: ChangeCaseMode): Partial<PptxElement> {
	if (!canFormatText(el) || !el.textSegments) {
		return {};
	}
	const textSegments = applyCaseTransformToSegments(el.textSegments, null, mode);
	return { textSegments, text: textSegments.map((s) => s.text).join('') } as Partial<PptxElement>;
}

/** Reset every character toggle/colour to the default (unformatted) state. */
export function clearFormatting(el: PptxElement): Partial<PptxElement> {
	return patchTextStyle(el, {
		bold: false,
		italic: false,
		underline: false,
		strikethrough: false,
		highlightColor: undefined,
		textShadowColor: undefined,
		textShadowBlur: undefined,
		textShadowOffsetX: undefined,
		textShadowOffsetY: undefined,
		textShadowOpacity: undefined,
		characterSpacing: undefined,
	});
}
