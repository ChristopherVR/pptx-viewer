/**
 * google-fonts-lookup.ts: canonical-spelling lookup against the bundled
 * Google Fonts catalogue.
 *
 * Split out of `google-webfonts.ts` (which was growing past this repo's
 * ~300-line-per-file convention) so both it and
 * `google-webfonts-metric-clones.ts` can depend on the lookup without a
 * circular import between the two.
 *
 * @module render/google-fonts-lookup
 */
import { GOOGLE_FONTS_FAMILIES } from './google-fonts-catalogue';

/** Lower-cased catalogue name -> canonical Google Fonts spelling (lazy). */
let catalogueIndex: Map<string, string> | undefined;

/**
 * Canonical Google Fonts spelling for `family`, or `null` when the CSS2 API
 * does not serve it. Matching is case-insensitive and whitespace-normalised
 * because PowerPoint stores the name as the author typed it.
 */
export function findGoogleFontsFamily(family: string): string | null {
	if (!catalogueIndex) {
		catalogueIndex = new Map(GOOGLE_FONTS_FAMILIES.map((name) => [normaliseFamily(name), name]));
	}
	return catalogueIndex.get(normaliseFamily(family)) ?? null;
}

function normaliseFamily(family: string): string {
	return family.trim().replace(/\s+/gu, ' ').toLowerCase();
}
