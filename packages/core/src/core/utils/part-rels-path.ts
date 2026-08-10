/**
 * Derive the OPC relationship part path for a package part.
 *
 * A part's relationships live in a `_rels` folder beside it, in a file named
 * after the part plus `.rels` (ECMA-376 part 2, 9.3). Deriving that by
 * search-and-replacing the containing folder name works only for the folders
 * someone remembered to spell out, so express the rule itself instead.
 *
 * @module part-rels-path
 */

/**
 * Build the relationship part path for `partPath`.
 *
 * @param partPath - Package-relative part path, e.g. `ppt/slideLayouts/slideLayout3.xml`.
 * @returns The `.rels` path, e.g. `ppt/slideLayouts/_rels/slideLayout3.xml.rels`.
 */
export function partRelsPath(partPath: string): string {
	const lastSlash = partPath.lastIndexOf('/');
	if (lastSlash < 0) {
		return `_rels/${partPath}.rels`;
	}
	const directory = partPath.slice(0, lastSlash);
	const fileName = partPath.slice(lastSlash + 1);
	return `${directory}/_rels/${fileName}.rels`;
}
