import type { XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName: (parent: XmlObject | undefined, name: string) => string | undefined;
}

/** Result of extracting a classic `c:multiLvlStrRef` category hierarchy. */
export interface ChartCategoryLevelsResult {
	categories: string[];
	categoryLevels?: string[][];
}

/**
 * Extract hierarchical category levels from a classic `c:multiLvlStrRef`
 * (e.g. a PowerPoint Quarter > Month category grouping).
 *
 * Before this, the plain category extractor only matched `strRef` / `numRef`
 * (and their literal counterparts), so a multi-level category axis produced
 * ZERO categories: `c:cat/c:multiLvlStrRef` has no `strRef` or `numRef`
 * child, so the lookup fell through to an empty cache and every category
 * label vanished.
 *
 * `c:multiLvlStrCache` stores one `c:lvl` per hierarchy level, in
 * leaf-to-root order: the first `c:lvl` carries a dense value for every row
 * (the leaf labels, e.g. "Jan", "Feb", ...); each subsequent `c:lvl` is the
 * SPARSE parent grouping, only stamping a `c:pt` at the index where its
 * group starts (e.g. idx=0 "Qtr1", idx=3 "Qtr2"): the blank slots in between
 * mean "still inside the previous group", not "no label". Forward-filling
 * those blanks with the last non-blank value reproduces the merged-cell span
 * PowerPoint actually renders; leaving them blank would make the multi-level
 * axis renderer's grouping (which groups by consecutive equal text) treat
 * every blank slot as ending the group early.
 *
 * @returns The leaf-level flat `categories` plus every level (leaf first) as
 *   `categoryLevels`, or `undefined` when no `multiLvlStrRef` is present.
 */
export function extractMultiLevelCategoryValues(
	categoryContainer: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): ChartCategoryLevelsResult | undefined {
	if (!categoryContainer) {
		return undefined;
	}
	const multiLvlStrRef = xmlLookup.getChildByLocalName(categoryContainer, 'multiLvlStrRef');
	if (!multiLvlStrRef) {
		return undefined;
	}
	const cacheNode = xmlLookup.getChildByLocalName(multiLvlStrRef, 'multiLvlStrCache');
	const lvlNodes = xmlLookup.getChildrenArrayByLocalName(cacheNode, 'lvl');
	if (lvlNodes.length === 0) {
		return undefined;
	}

	const declaredCount = Number.parseInt(
		String(xmlLookup.getChildByLocalName(cacheNode, 'ptCount')?.['@_val'] ?? ''),
		10,
	);

	const levels = lvlNodes.map((lvlNode, levelIndex) =>
		expandCategoryLevel(lvlNode, levelIndex, declaredCount, xmlLookup),
	);

	return {
		categories: levels[0] ?? [],
		...(levels.length > 1 ? { categoryLevels: levels } : {}),
	};
}

/** Expand one `c:lvl`'s sparse `@idx`-keyed points into a dense array. */
function expandCategoryLevel(
	lvlNode: XmlObject,
	levelIndex: number,
	declaredCount: number,
	xmlLookup: XmlLookupLike,
): string[] {
	const points = xmlLookup.getChildrenArrayByLocalName(lvlNode, 'pt');
	const byIndex = new Map<number, string>();
	let maxIndex = -1;
	for (const point of points) {
		const index = Number.parseInt(String(point?.['@_idx'] ?? '0'), 10);
		if (!Number.isFinite(index) || index < 0) {
			continue;
		}
		const value = String(xmlLookup.getScalarChildByLocalName(point, 'v') || '').trim();
		if (value.length > 0) {
			byIndex.set(index, value);
		}
		if (index > maxIndex) {
			maxIndex = index;
		}
	}
	const length =
		Number.isFinite(declaredCount) && declaredCount > maxIndex + 1 ? declaredCount : maxIndex + 1;
	const dense: string[] = [];
	for (let index = 0; index < length; index++) {
		dense.push(byIndex.get(index) ?? '');
	}
	// Parent levels (levelIndex > 0) are sparse by design: forward-fill blanks
	// so a grouped span reads the same label across its width.
	if (levelIndex > 0) {
		let lastLabel = '';
		for (let index = 0; index < dense.length; index++) {
			if (dense[index]) {
				lastLabel = dense[index];
			} else {
				dense[index] = lastLabel;
			}
		}
	}
	return dense;
}
