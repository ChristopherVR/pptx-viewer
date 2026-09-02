/**
 * Naming helpers for master/layout CRUD operations.
 *
 * PowerPoint uses two different conventions depending on what is being
 * duplicated: a layout gets a trailing counter ("Title Slide" ->
 * "Title Slide 2"), a slide master gets a leading counter ("Office Theme"
 * -> "1_Office Theme"). Both are pure so they can be unit tested without a
 * handler.
 *
 * @module sdk/master-layout-crud-names
 */
import type { PptxData } from '../../types/presentation';

/** Every layout name currently in use, across every slide master. */
export function collectLayoutNames(data: PptxData): string[] {
	const names: string[] = [];
	for (const master of data.slideMasters ?? []) {
		for (const layout of master.layouts ?? []) {
			if (layout.name) {
				names.push(layout.name);
			}
		}
	}
	return names;
}

/** Every slide master name currently in use. */
export function collectMasterNames(data: PptxData): string[] {
	return (data.slideMasters ?? [])
		.map((master) => master.name)
		.filter((name): name is string => Boolean(name));
}

/**
 * A name distinct from `existingNames`, following PowerPoint's "duplicate a
 * layout" convention: an unused base name is kept as-is, a taken one grows a
 * trailing counter ("Title Slide" -> "Title Slide 2" -> "Title Slide 3").
 *
 * @example
 * ```ts
 * uniqueDisplayName(["Title Slide"], "Title Slide"); // => "Title Slide 2"
 * uniqueDisplayName(["Title Slide", "Title Slide 2"], "Title Slide"); // => "Title Slide 3"
 * uniqueDisplayName(["Title Slide"], "Blank"); // => "Blank"
 * ```
 */
export function uniqueDisplayName(existingNames: readonly string[], base: string): string {
	const names = new Set(existingNames);
	if (!names.has(base)) {
		return base;
	}
	const match = base.match(/^(.*) (\d+)$/);
	const root = match ? match[1] : base;
	let n = match ? parseInt(match[2], 10) + 1 : 2;
	while (names.has(`${root} ${n}`)) {
		n += 1;
	}
	return `${root} ${n}`;
}

/**
 * A name distinct from `existingNames`, following PowerPoint's "duplicate a
 * slide master" convention: a leading counter ("Office Theme" ->
 * "1_Office Theme" -> "2_Office Theme").
 *
 * @example
 * ```ts
 * uniquePrefixedName(["Office Theme"], "Office Theme"); // => "1_Office Theme"
 * ```
 */
export function uniquePrefixedName(existingNames: readonly string[], base: string): string {
	const names = new Set(existingNames);
	const match = base.match(/^(\d+)_(.*)$/);
	const root = match ? match[2] : base;
	let n = match ? parseInt(match[1], 10) + 1 : 1;
	let candidate = `${n}_${root}`;
	while (names.has(candidate)) {
		n += 1;
		candidate = `${n}_${root}`;
	}
	return candidate;
}
