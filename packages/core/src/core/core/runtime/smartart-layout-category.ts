/**
 * Resolve a {@link SmartArtLayoutType} family from a diagram LAYOUT part
 * (`dgm:layoutDef`). The part filename (`layout1`) says nothing about the
 * algorithm, so the loader previously left `resolvedLayoutType` unset and
 * renderers fell back to a plain list for any diagram without a cached
 * drawing part. The layout definition itself carries the answer twice:
 * `dgm:catLst/dgm:cat/@type` (canonical gallery categories) and the
 * `@uniqueId` URN (e.g. `urn:microsoft.com/office/officeart/2005/8/layout/orgChart1`).
 */
import type { SmartArtLayoutType } from '../../types';

/** Canonical `dgm:cat/@type` values that map 1:1 onto layout families. */
const CATEGORY_FAMILY: Record<string, SmartArtLayoutType> = {
	list: 'list',
	process: 'process',
	cycle: 'cycle',
	hierarchy: 'hierarchy',
	relationship: 'relationship',
	matrix: 'matrix',
	pyramid: 'pyramid',
};

const UNIQUE_ID_KEYWORDS: Array<[RegExp, SmartArtLayoutType]> = [
	[/hier|org/u, 'hierarchy'],
	[/cycle|radial|circular/u, 'cycle'],
	[/process|flow|chevron|arrow|equation/u, 'process'],
	[/timeline/u, 'timeline'],
	[/matrix|grid/u, 'matrix'],
	[/pyramid/u, 'pyramid'],
	[/venn/u, 'venn'],
	[/funnel/u, 'funnel'],
	[/gear/u, 'gear'],
	[/target/u, 'target'],
	[/list/u, 'list'],
];

/**
 * Resolve the layout family from a layout definition's unique id and its
 * gallery categories. Returns `undefined` when neither signal is decisive so
 * callers can leave `resolvedLayoutType` unset rather than guess.
 */
export function resolveSmartArtLayoutCategory(
	uniqueId: string,
	categories: readonly string[],
): SmartArtLayoutType | undefined {
	for (const category of categories) {
		const family = CATEGORY_FAMILY[category.trim().toLowerCase()];
		if (family) {
			return family;
		}
	}
	const lowerId = uniqueId.toLowerCase();
	if (lowerId.length > 0) {
		for (const [pattern, family] of UNIQUE_ID_KEYWORDS) {
			if (pattern.test(lowerId)) {
				return family;
			}
		}
	}
	return undefined;
}
