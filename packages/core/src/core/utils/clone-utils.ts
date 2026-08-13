/**
 * Framework-agnostic deep-cloning utilities for PPTX data structures.
 *
 * Provides clone functions for TextStyle, ShapeStyle, PptxElement, PptxSlide,
 * and raw XmlObject trees. These are used by the undo/redo system, clipboard
 * operations, template instantiation and the MCP tools to create independent
 * copies without shared references.
 *
 * ## Why the element clone is structural rather than per-variant
 *
 * This module used to clone `PptxElement` with a `switch` on the `type`
 * discriminant that deep-copied a hand-picked field or two per branch. Every
 * field nobody remembered stayed SHARED with the source, so mutating the copy
 * wrote straight through to the original (and to the undo snapshot the clone
 * exists to isolate). The `group` case was fixed on its own once, which left
 * the identical defect in every other branch. Measured on real fixtures before
 * this rewrite: `table` shared its rows, cells and `columnWidths`; `ink` shared
 * `inkPaths`; `chart` shared its series; `text` / `shape` shared
 * `paragraphIndents`.
 *
 * Enumerating the nested structure per variant is what drifts, so the walk is
 * now generic: every plain object and array reachable from the element is
 * rebuilt. For the record, these variants own nested mutable structure and are
 * all covered by that walk:
 *
 * - every variant: `extLstXml`, `locks`, `actionClick` / `actionHover`;
 * - `text` / `shape` / `connector`: `textStyle` (incl. `tabStops`,
 *   `textFillGradientStops`, `underlineLine`), `textSegments`,
 *   `paragraphIndents`;
 * - `text` / `shape` / `connector` / `image` / `picture`: `shapeStyle` (incl.
 *   `fillGradientStops`), `shapeAdjustments`, `adjustmentHandles`, custom path
 *   data;
 * - `table`: `tableData.rows[].cells[]` (+ each cell's `style`, `textRuns`,
 *   `extraAttributes`) and `tableData.columnWidths`;
 * - `chart`: `chartData` (categories, series, per-series values);
 * - `smartArt`: `smartArtData.nodes[]`;
 * - `media`: `bookmarks`, `captionTracks`, `metadata`, `audioCdStart` / `-End`;
 * - `group`: `children` (recursively) and `groupFill`;
 * - `ink`: `inkPaths`, `inkColors`, `inkWidths`, `inkOpacities`,
 *   `inkPointPressures`;
 * - `contentPart`: `inkStrokes[]` (+ per-stroke `pressures`);
 * - `zoom`: `summaryTargets[]`;
 * - `ole` / `model3d` / `unknown`: `extensionXml[]`.
 *
 * Strings are immutable in JS, so a big base64 `imageData` / `mediaData` /
 * `modelData` payload costs one reference assignment, not a copy.
 *
 * @module clone-utils
 */
import type { PptxElement, PptxSlide, TextStyle, ShapeStyle, XmlObject } from '../types';

/**
 * Keys whose value is a verbatim parsed-XML tree kept only so the save path can
 * re-emit markup the typed model does not cover. Nothing edits them in place,
 * and they are the largest objects hanging off an element (a shape's `rawXml`
 * is its whole `<p:sp>`), so they are shared by reference rather than rebuilt.
 * Any OTHER `*Xml` field (run properties, colour choices, extensions) is small
 * and IS cloned, so an accidental edit cannot reach the source.
 */
const SHARED_RAW_XML_KEYS: ReadonlySet<string> = new Set([
	'rawXml',
	'rawTiming',
	'inkPartRawXml',
	'rawMediaReferenceXml',
]);

/**
 * Whether `value` is a plain data object this walk should rebuild. Class
 * instances, `Date`, typed arrays and the like are shared by reference: the
 * PPTX data model holds none of them, and copying one blindly would corrupt it.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function cloneValue<T>(value: T, seen: WeakMap<object, unknown>): T {
	if (Array.isArray(value)) {
		const cached = seen.get(value);
		if (cached !== undefined) {
			return cached as T;
		}
		const copy: unknown[] = new Array(value.length);
		seen.set(value, copy);
		for (let index = 0; index < value.length; index++) {
			copy[index] = cloneValue(value[index], seen);
		}
		return copy as T;
	}
	if (!isPlainRecord(value)) {
		return value;
	}
	const cached = seen.get(value);
	if (cached !== undefined) {
		return cached as T;
	}
	const copy: Record<string, unknown> = {};
	seen.set(value, copy);
	for (const key of Object.keys(value)) {
		const child = value[key];
		copy[key] = SHARED_RAW_XML_KEYS.has(key) ? child : cloneValue(child, seen);
	}
	return copy as T;
}

/**
 * Deep-copy a plain PPTX data value: every nested object and array is rebuilt,
 * primitives (including large base64 strings) are carried over by reference,
 * and the verbatim XML trees listed in {@link SHARED_RAW_XML_KEYS} stay shared.
 *
 * Repeated references to the same object are preserved as repeated references
 * to the same copy, so a self-referencing tree cannot recurse forever.
 */
export function deepCloneData<T>(value: T): T {
	return cloneValue(value, new WeakMap<object, unknown>());
}

/**
 * Deep-clone a {@link TextStyle}.
 *
 * @param style - The text style to clone.
 * @returns A new TextStyle copy, or `undefined` if the input is falsy.
 */
export function cloneTextStyle(style?: TextStyle): TextStyle | undefined {
	if (!style) {
		return undefined;
	}
	return deepCloneData(style);
}

/**
 * Deep-clone a {@link ShapeStyle}, including nested structure such as the
 * gradient stops array (each stop is its own object).
 *
 * @param style - The shape style to clone.
 * @returns A new ShapeStyle copy, or `undefined` if the input is falsy.
 */
export function cloneShapeStyle(style?: ShapeStyle): ShapeStyle | undefined {
	if (!style) {
		return undefined;
	}
	return deepCloneData(style);
}

/**
 * Deep-clone a {@link PptxElement} of ANY variant in the union: nothing nested
 * inside the copy is shared with the original (see the module doc for the
 * per-variant accounting and the two deliberate exceptions, immutable strings
 * and preserved raw XML).
 *
 * @param element - The element to clone.
 * @returns A fully independent copy of the element.
 */
export function cloneElement(element: PptxElement): PptxElement {
	return deepCloneData(element);
}

/**
 * Deep-clone a {@link PptxSlide}: its elements, comments, warnings, transition,
 * animations, notes shapes and every other nested field.
 *
 * @param slide - The slide to clone.
 * @returns A fully independent copy of the slide.
 */
export function cloneSlide(slide: PptxSlide): PptxSlide {
	return deepCloneData(slide);
}

/**
 * Deep-clone a mapping of slide IDs to template element arrays.
 *
 * Used when duplicating or resetting template element state so that
 * each slide gets its own independent element copies.
 *
 * @param templateElementsBySlideId - The mapping to clone.
 * @returns A new record with independently cloned element arrays.
 */
export function cloneTemplateElementsBySlideId(
	templateElementsBySlideId: Record<string, PptxElement[]>,
): Record<string, PptxElement[]> {
	const cloned: Record<string, PptxElement[]> = {};
	Object.entries(templateElementsBySlideId).forEach(([slideId, elements]) => {
		cloned[slideId] = elements.map(cloneElement);
	});
	return cloned;
}

/**
 * Deep-clone an {@link XmlObject} tree.
 *
 * Prefers the structured clone algorithm (faster, preserves more types)
 * with a JSON round-trip fallback for legacy runtimes that lack
 * {@link structuredClone}. Returns `undefined` if cloning fails
 * (e.g. circular references on the JSON path).
 *
 * @param value - The XML object tree to clone.
 * @returns A deep copy, or `undefined` on failure.
 */
export function cloneXmlObject(value: XmlObject | undefined): XmlObject | undefined {
	if (!value) {
		return undefined;
	}
	try {
		if (typeof structuredClone === 'function') {
			return structuredClone(value) as XmlObject;
		}
		return JSON.parse(JSON.stringify(value)) as XmlObject;
	} catch (error) {
		console.warn('Failed to clone XML object, returning undefined.', value, error);
		return undefined;
	}
}
