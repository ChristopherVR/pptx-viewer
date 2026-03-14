/**
 * Presentation comparison (diff) operations for the headless PPTX SDK.
 *
 * Compares two {@link PptxData} structures and produces a structured
 * diff describing added, removed, and modified slides, elements,
 * theme colours/fonts, and metadata properties.
 *
 * @module sdk/diff-operations
 */

import type { PptxData, PptxSlide } from "../../types/presentation";
import type { PptxElement, GroupPptxElement } from "../../types/elements";
import type { PptxTheme } from "../../types/theme";
import type {
	PptxCoreProperties,
	PptxAppProperties,
} from "../../types/metadata";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A change to a single property value.
 */
export interface PropertyChange {
	/** Dot-separated property path (e.g. "x", "textStyle.fontSize"). */
	property: string;
	/** Value in presentation A (undefined if the property was added). */
	oldValue: unknown;
	/** Value in presentation B (undefined if the property was removed). */
	newValue: unknown;
}

/**
 * Diff result for a single element within a slide.
 */
export interface ElementDiff {
	/** Element ID (from whichever side the element exists on). */
	elementId: string;
	/** Element type discriminant (e.g. "text", "shape", "image"). */
	elementType: string;
	/** Whether the element was added, removed, or modified. */
	type: "added" | "removed" | "modified";
	/** Property-level changes (only present when type is "modified"). */
	changes?: PropertyChange[];
}

/**
 * Diff result for a single slide.
 */
export interface SlideDiff {
	/** Zero-based index of the slide in the *first* presentation (or insertion point for "added"). */
	slideIndex: number;
	/** Slide ID used for matching. */
	slideId: string;
	/** Whether the slide was added, removed, or modified. */
	type: "added" | "removed" | "modified";
	/** Element-level changes within the slide (only present when type is "modified"). */
	changes?: ElementDiff[];
}

/**
 * Top-level diff result comparing two presentations.
 */
export interface PresentationDiff {
	/** Per-slide diff entries. */
	slideChanges: SlideDiff[];
	/** Whether the theme changed between presentations. */
	themeChanged: boolean;
	/** Property-level theme changes (colors, fonts, name). */
	themeChanges?: PropertyChange[];
	/** Property-level metadata changes (core + app properties). */
	metadataChanges: PropertyChange[];
	/** Summary counts. */
	summary: {
		added: number;
		removed: number;
		modified: number;
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Keys considered "structural" or "transient" that should be excluded
 * from element property comparison.
 */
const ELEMENT_SKIP_KEYS = new Set([
	"rawXml",
	"locks",
	"actionClick",
	"actionHover",
	"adjustmentHandles",
]);

/**
 * Keys on PptxSlide that are compared at the slide level (not element level).
 */
const SLIDE_COMPARE_KEYS: ReadonlyArray<keyof PptxSlide> = [
	"backgroundColor",
	"backgroundImage",
	"backgroundGradient",
	"hidden",
	"layoutPath",
	"layoutName",
	"notes",
	"sectionName",
	"sectionId",
];

/**
 * Shallow-compare two values. For objects / arrays, uses JSON serialization
 * to keep the comparison simple and avoid deep-recursion edge cases.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null && b == null) return true;
	if (a == null || b == null) return false;
	if (typeof a !== typeof b) return false;
	if (typeof a === "object") {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return false;
}

/**
 * Compare two plain objects and return property-level changes.
 * Only inspects own enumerable keys. Skips keys in the skip set.
 */
function diffObject(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
	prefix: string,
	skipKeys: Set<string>,
): PropertyChange[] {
	const changes: PropertyChange[] = [];
	const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

	for (const key of allKeys) {
		if (skipKeys.has(key)) continue;
		const fullKey = prefix ? `${prefix}.${key}` : key;
		const va = a[key];
		const vb = b[key];
		if (!valuesEqual(va, vb)) {
			changes.push({ property: fullKey, oldValue: va, newValue: vb });
		}
	}

	return changes;
}

/**
 * Build a lookup map of elements by ID, including nested group children.
 */
function buildElementMap(elements: PptxElement[]): Map<string, PptxElement> {
	const map = new Map<string, PptxElement>();
	for (const el of elements) {
		map.set(el.id, el);
		if (el.type === "group" && (el as GroupPptxElement).children) {
			for (const [id, child] of buildElementMap(
				(el as GroupPptxElement).children,
			)) {
				map.set(id, child);
			}
		}
	}
	return map;
}

/**
 * Compare two elements and return property-level changes.
 */
function diffElements(a: PptxElement, b: PptxElement): PropertyChange[] {
	const aObj = a as unknown as Record<string, unknown>;
	const bObj = b as unknown as Record<string, unknown>;

	// Skip keys that are not meaningful for comparison
	const skip = new Set(ELEMENT_SKIP_KEYS);
	skip.add("type"); // type is already captured in ElementDiff.elementType

	// For groups, handle children separately
	if (a.type === "group" && b.type === "group") {
		skip.add("children");
	}

	return diffObject(aObj, bObj, "", skip);
}

/**
 * Collect all top-level element IDs from a slide (preserving order).
 */
function getElementIds(elements: PptxElement[]): string[] {
	return elements.map((el) => el.id);
}

// ---------------------------------------------------------------------------
// Core comparison: slides
// ---------------------------------------------------------------------------

/**
 * Compare two slides and return a {@link SlideDiff} describing the changes.
 *
 * Elements are matched by ID. Elements present only in slide A are "removed";
 * elements present only in slide B are "added"; elements in both are compared
 * property-by-property.
 *
 * @param a - The slide from the first (original) presentation.
 * @param b - The slide from the second (modified) presentation.
 * @returns A SlideDiff with type "modified" and element-level changes.
 *          If the slides are identical, the changes array will be empty.
 */
export function diffSlides(
	a: PptxSlide,
	b: PptxSlide,
	slideIndex = 0,
): SlideDiff {
	const elementChanges: ElementDiff[] = [];

	// Compare slide-level properties
	const slidePropertyChanges: PropertyChange[] = [];
	for (const key of SLIDE_COMPARE_KEYS) {
		const va = a[key];
		const vb = b[key];
		if (!valuesEqual(va, vb)) {
			slidePropertyChanges.push({
				property: `slide.${key}`,
				oldValue: va,
				newValue: vb,
			});
		}
	}

	// Build element maps
	const mapA = buildElementMap(a.elements);
	const mapB = buildElementMap(b.elements);

	// Also track top-level element order for detecting reordering
	const idsA = new Set(getElementIds(a.elements));
	const idsB = new Set(getElementIds(b.elements));

	// Include nested IDs
	for (const id of mapA.keys()) idsA.add(id);
	for (const id of mapB.keys()) idsB.add(id);

	// Elements removed (in A but not in B)
	for (const [id, el] of mapA) {
		if (!mapB.has(id)) {
			elementChanges.push({
				elementId: id,
				elementType: el.type,
				type: "removed",
			});
		}
	}

	// Elements added (in B but not in A)
	for (const [id, el] of mapB) {
		if (!mapA.has(id)) {
			elementChanges.push({
				elementId: id,
				elementType: el.type,
				type: "added",
			});
		}
	}

	// Elements modified (in both A and B)
	for (const [id, elA] of mapA) {
		const elB = mapB.get(id);
		if (!elB) continue;

		const propChanges = diffElements(elA, elB);
		if (propChanges.length > 0) {
			elementChanges.push({
				elementId: id,
				elementType: elA.type,
				type: "modified",
				changes: propChanges,
			});
		}
	}

	// If there are slide-level property changes, add them as a synthetic element diff
	// with a special elementId to distinguish from real element changes.
	if (slidePropertyChanges.length > 0) {
		elementChanges.push({
			elementId: "__slide__",
			elementType: "slide",
			type: "modified",
			changes: slidePropertyChanges,
		});
	}

	return {
		slideIndex,
		slideId: a.id,
		type: "modified",
		changes: elementChanges,
	};
}

// ---------------------------------------------------------------------------
// Theme comparison
// ---------------------------------------------------------------------------

/**
 * Compare two theme objects and return property-level changes.
 */
function diffThemes(
	a: PptxTheme | undefined,
	b: PptxTheme | undefined,
): { changed: boolean; changes: PropertyChange[] } {
	if (!a && !b) return { changed: false, changes: [] };
	if (!a && b) {
		return {
			changed: true,
			changes: [{ property: "theme", oldValue: undefined, newValue: b.name ?? "(unnamed)" }],
		};
	}
	if (a && !b) {
		return {
			changed: true,
			changes: [{ property: "theme", oldValue: a.name ?? "(unnamed)", newValue: undefined }],
		};
	}

	// Both exist — compare name, colorScheme, fontScheme
	const changes: PropertyChange[] = [];

	if (a!.name !== b!.name) {
		changes.push({ property: "theme.name", oldValue: a!.name, newValue: b!.name });
	}

	// Color scheme
	if (a!.colorScheme && b!.colorScheme) {
		const colorKeys = Object.keys({
			...a!.colorScheme,
			...b!.colorScheme,
		});
		for (const key of colorKeys) {
			const va = (a!.colorScheme as unknown as Record<string, unknown>)[key];
			const vb = (b!.colorScheme as unknown as Record<string, unknown>)[key];
			if (va !== vb) {
				changes.push({
					property: `theme.colorScheme.${key}`,
					oldValue: va,
					newValue: vb,
				});
			}
		}
	} else if (a!.colorScheme !== b!.colorScheme) {
		changes.push({
			property: "theme.colorScheme",
			oldValue: a!.colorScheme,
			newValue: b!.colorScheme,
		});
	}

	// Font scheme
	if (a!.fontScheme && b!.fontScheme) {
		const fsA = a!.fontScheme;
		const fsB = b!.fontScheme;

		// Major font
		if (!valuesEqual(fsA.majorFont, fsB.majorFont)) {
			changes.push({
				property: "theme.fontScheme.majorFont",
				oldValue: fsA.majorFont,
				newValue: fsB.majorFont,
			});
		}
		// Minor font
		if (!valuesEqual(fsA.minorFont, fsB.minorFont)) {
			changes.push({
				property: "theme.fontScheme.minorFont",
				oldValue: fsA.minorFont,
				newValue: fsB.minorFont,
			});
		}
	} else if (!valuesEqual(a!.fontScheme, b!.fontScheme)) {
		changes.push({
			property: "theme.fontScheme",
			oldValue: a!.fontScheme,
			newValue: b!.fontScheme,
		});
	}

	// Format scheme (compared as a whole — it's deeply nested)
	if (!valuesEqual(a!.formatScheme, b!.formatScheme)) {
		changes.push({
			property: "theme.formatScheme",
			oldValue: a!.formatScheme ? "(present)" : undefined,
			newValue: b!.formatScheme ? "(present)" : undefined,
		});
	}

	return { changed: changes.length > 0, changes };
}

// ---------------------------------------------------------------------------
// Metadata comparison
// ---------------------------------------------------------------------------

/**
 * Compare core + app properties and return changes.
 */
function diffMetadata(a: PptxData, b: PptxData): PropertyChange[] {
	const changes: PropertyChange[] = [];

	// Core properties
	const coreA = (a.coreProperties ?? {}) as Record<string, unknown>;
	const coreB = (b.coreProperties ?? {}) as Record<string, unknown>;
	const coreKeys: ReadonlyArray<keyof PptxCoreProperties> = [
		"title",
		"subject",
		"creator",
		"keywords",
		"description",
		"lastModifiedBy",
		"revision",
		"created",
		"modified",
		"category",
		"contentStatus",
	];

	for (const key of coreKeys) {
		const va = coreA[key];
		const vb = coreB[key];
		if (!valuesEqual(va, vb)) {
			changes.push({
				property: `coreProperties.${key}`,
				oldValue: va,
				newValue: vb,
			});
		}
	}

	// App properties
	const appA = (a.appProperties ?? {}) as Record<string, unknown>;
	const appB = (b.appProperties ?? {}) as Record<string, unknown>;
	const appKeys: ReadonlyArray<keyof PptxAppProperties> = [
		"application",
		"appVersion",
		"presentationFormat",
		"slides",
		"hiddenSlides",
		"notes",
		"totalTime",
		"words",
		"paragraphs",
		"company",
		"manager",
		"template",
	];

	for (const key of appKeys) {
		const va = appA[key];
		const vb = appB[key];
		if (!valuesEqual(va, vb)) {
			changes.push({
				property: `appProperties.${key}`,
				oldValue: va,
				newValue: vb,
			});
		}
	}

	// Slide dimensions
	if (a.width !== b.width) {
		changes.push({ property: "width", oldValue: a.width, newValue: b.width });
	}
	if (a.height !== b.height) {
		changes.push({ property: "height", oldValue: a.height, newValue: b.height });
	}

	return changes;
}

// ---------------------------------------------------------------------------
// Main diff function
// ---------------------------------------------------------------------------

/**
 * Compare two presentations and produce a structured diff.
 *
 * Slides are matched by their `id` property. Unmatched slides are reported
 * as "added" or "removed". Matched slides are compared element-by-element
 * (also matched by ID). Theme and metadata changes are reported separately.
 *
 * @param a - The first (original) presentation.
 * @param b - The second (modified) presentation.
 * @returns A {@link PresentationDiff} describing all differences.
 *
 * @example
 * ```ts
 * const original = await handler.load(bufferA);
 * const modified = await handler.load(bufferB);
 * const diff = diffPresentations(original, modified);
 *
 * console.log(`${diff.summary.added} added, ${diff.summary.removed} removed, ${diff.summary.modified} modified`);
 * for (const sc of diff.slideChanges) {
 *   console.log(`Slide ${sc.slideIndex}: ${sc.type}`);
 * }
 * ```
 */
export function diffPresentations(a: PptxData, b: PptxData): PresentationDiff {
	const slideChanges: SlideDiff[] = [];

	// Build slide ID -> index maps
	const slideMapA = new Map<string, number>();
	for (let i = 0; i < a.slides.length; i++) {
		slideMapA.set(a.slides[i].id, i);
	}
	const slideMapB = new Map<string, number>();
	for (let i = 0; i < b.slides.length; i++) {
		slideMapB.set(b.slides[i].id, i);
	}

	// Slides removed (in A but not in B)
	for (let i = 0; i < a.slides.length; i++) {
		const slide = a.slides[i];
		if (!slideMapB.has(slide.id)) {
			slideChanges.push({
				slideIndex: i,
				slideId: slide.id,
				type: "removed",
			});
		}
	}

	// Slides added (in B but not in A)
	for (let i = 0; i < b.slides.length; i++) {
		const slide = b.slides[i];
		if (!slideMapA.has(slide.id)) {
			slideChanges.push({
				slideIndex: i,
				slideId: slide.id,
				type: "added",
			});
		}
	}

	// Slides modified (in both A and B)
	for (let i = 0; i < a.slides.length; i++) {
		const slideA = a.slides[i];
		const idxB = slideMapB.get(slideA.id);
		if (idxB === undefined) continue;

		const slideB = b.slides[idxB];
		const slideDiff = diffSlides(slideA, slideB, i);

		// Only include if there are actual changes
		if (slideDiff.changes && slideDiff.changes.length > 0) {
			slideChanges.push(slideDiff);
		}
	}

	// Theme comparison
	const themeDiff = diffThemes(a.theme, b.theme);

	// Metadata comparison
	const metadataChanges = diffMetadata(a, b);

	// Summary counts
	let added = 0;
	let removed = 0;
	let modified = 0;
	for (const sc of slideChanges) {
		switch (sc.type) {
			case "added":
				added++;
				break;
			case "removed":
				removed++;
				break;
			case "modified":
				modified++;
				break;
		}
	}

	return {
		slideChanges,
		themeChanged: themeDiff.changed,
		themeChanges: themeDiff.changes.length > 0 ? themeDiff.changes : undefined,
		metadataChanges,
		summary: { added, removed, modified },
	};
}
