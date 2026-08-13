/**
 * font-catalog.ts: grouping for the Home-tab font dropdown.
 *
 * PowerPoint splits its font list into headed groups: the two theme fonts
 * first (labelled "Headings" and "Body"), then any fonts embedded in the
 * presentation, then the full alphabetical catalogue. Reproducing that in five
 * bindings means five copies of the same dedup rules, so the grouping decision
 * is made once here and each binding only renders the returned sections.
 *
 * @module render/font-catalog
 */
import { COMMON_FONT_FAMILIES } from './text-format-presets';

/** Identifies a group so bindings can label and style it. */
export type FontCatalogGroupId = 'theme' | 'embedded' | 'custom' | 'all';

/** One selectable font. */
export interface FontCatalogEntry {
	/** The family name written into the run's `fontFamily`. */
	family: string;
	/**
	 * Which theme slot this family fills, for the "(Headings)" / "(Body)" hint
	 * PowerPoint shows beside its two theme fonts. Absent for other entries.
	 */
	themeRole?: 'heading' | 'body';
}

/** A headed group of fonts. */
export interface FontCatalogGroup {
	id: FontCatalogGroupId;
	/** i18n key for the group heading. */
	labelKey: string;
	entries: FontCatalogEntry[];
}

/** Inputs describing what the current deck and session make available. */
export interface FontCatalogInput {
	/** `a:fontScheme` major/minor latin faces from the active theme. */
	themeFonts?: { heading?: string; body?: string };
	/** Families embedded in the presentation via `p:embeddedFontLst`. */
	embeddedFonts?: readonly string[];
	/** Families the user registered this session from a local font file. */
	customFonts?: readonly string[];
	/** Overrides the built-in catalogue; defaults to {@link COMMON_FONT_FAMILIES}. */
	allFonts?: readonly string[];
}

const GROUP_LABEL_KEYS: Record<FontCatalogGroupId, string> = {
	theme: 'pptx.font.group.theme',
	embedded: 'pptx.font.group.embedded',
	custom: 'pptx.font.group.custom',
	all: 'pptx.font.group.all',
};

/**
 * Build the grouped font list for the Home-tab dropdown.
 *
 * A family promoted into the theme, embedded or custom group is removed from
 * the alphabetical group, so no family is offered twice and clicking either
 * copy would not produce different results.
 *
 * @returns Only the non-empty groups, in PowerPoint's order.
 *
 * @example
 * ```ts
 * const groups = buildFontCatalog({ themeFonts: { heading: "Aptos Display" } });
 * // => groups[0].id === "theme"
 * ```
 */
export function buildFontCatalog(input: FontCatalogInput = {}): FontCatalogGroup[] {
	const themeEntries: FontCatalogEntry[] = [];
	const claimed = new Set<string>();

	const claim = (family: string | undefined): string | undefined => {
		const trimmed = family?.trim();
		if (!trimmed) {
			return undefined;
		}
		const key = trimmed.toLowerCase();
		if (claimed.has(key)) {
			return undefined;
		}
		claimed.add(key);
		return trimmed;
	};

	const heading = claim(input.themeFonts?.heading);
	if (heading) {
		themeEntries.push({ family: heading, themeRole: 'heading' });
	}
	const body = claim(input.themeFonts?.body);
	if (body) {
		themeEntries.push({ family: body, themeRole: 'body' });
	}

	const embedded = collect(input.embeddedFonts, claim);
	const custom = collect(input.customFonts, claim);
	const all = collect(input.allFonts ?? COMMON_FONT_FAMILIES, claim);

	return [
		{ id: 'theme' as const, entries: themeEntries },
		{ id: 'embedded' as const, entries: embedded },
		{ id: 'custom' as const, entries: custom },
		{ id: 'all' as const, entries: all },
	]
		.filter((group) => group.entries.length > 0)
		.map((group) => ({ ...group, labelKey: GROUP_LABEL_KEYS[group.id] }));
}

/**
 * Resolve the family the font dropdown should display when nothing overrides
 * it on the selected element.
 *
 * A title placeholder inherits the theme's major font and everything else the
 * minor font, so showing a hardcoded "Segoe UI" misreported what the deck
 * would actually render.
 *
 * @param placeholderType - `p:ph/@type` of the selected element, if any.
 * @param themeFonts - The active theme's major/minor latin faces.
 * @param fallback - Used when the theme resolves neither face.
 */
export function resolveDefaultFontFamily(
	placeholderType: string | undefined,
	themeFonts: { heading?: string; body?: string } | undefined,
	fallback = 'Segoe UI',
): string {
	const normalized = placeholderType?.trim().toLowerCase();
	const isHeading = normalized === 'title' || normalized === 'ctrtitle';
	const preferred = isHeading ? themeFonts?.heading : themeFonts?.body;
	return preferred?.trim() || themeFonts?.body?.trim() || themeFonts?.heading?.trim() || fallback;
}

function collect(
	families: readonly string[] | undefined,
	claim: (family: string | undefined) => string | undefined,
): FontCatalogEntry[] {
	const entries: FontCatalogEntry[] = [];
	for (const family of families ?? []) {
		const claimedFamily = claim(family);
		if (claimedFamily) {
			entries.push({ family: claimedFamily });
		}
	}
	return entries;
}
