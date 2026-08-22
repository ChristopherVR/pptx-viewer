/**
 * Table STYLE-level image-fill path resolution (`a:tcStyle/a:fill/a:blipFill`
 * on a `ppt/tableStyles.xml` section), mirroring
 * {@link collectTableCellImagePaths}/{@link applyTableCellImagePatches} in
 * `load-content-helpers.ts` for the per-CELL equivalent.
 *
 * `ppt/tableStyles.xml` is parsed once per presentation (not per slide), so
 * core resolves each `a:blipFill` only down to an archive-relative path
 * (`ParsedTableStyleFill.image.path`) - the same "sync parse, lazy resolve"
 * split the per-cell path uses. A load pipeline collects every such path
 * across the WHOLE `ParsedTableStyleMap` (there is only one per presentation,
 * unlike the per-slide table walk), resolves it to a displayable URL exactly
 * like any other image, and patches the map immutably via
 * {@link applyTableStyleImagePatches}.
 *
 * Split out of `load-content-helpers.ts` (already at the file-size ceiling)
 * rather than grown into it.
 *
 * @module loader/table-style-image-paths
 */
import type {
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	ParsedTableStyleMap,
} from 'pptx-viewer-core';

/** The 13 `CT_TableStyle` fill fields that may carry an image texture fill. */
const TABLE_STYLE_FILL_KEYS = [
	'wholeTblFill',
	'band1HFill',
	'band2HFill',
	'band1VFill',
	'band2VFill',
	'lastColFill',
	'firstColFill',
	'lastRowFill',
	'seCellFill',
	'swCellFill',
	'firstRowFill',
	'neCellFill',
	'nwCellFill',
] as const satisfies readonly (keyof ParsedTableStyleEntry)[];

type TableStyleFillKey = (typeof TABLE_STYLE_FILL_KEYS)[number];

/** A table-style section fill whose image path needs Blob URL resolution. */
export interface TableStyleImageRef {
	/** The style GUID key in `ParsedTableStyleMap`. */
	styleId: string;
	/** Which of the 13 section fills carries the image. */
	fillKey: TableStyleFillKey;
	path: string;
}

function isExternalUrl(path: string): boolean {
	return (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('data:') ||
		path.startsWith('blob:')
	);
}

/**
 * Collect every whole-table-STYLE image-fill path across a presentation's
 * `ParsedTableStyleMap` that needs resolving to a displayable URL.
 */
export function collectTableStyleImagePaths(tableStyleMap: ParsedTableStyleMap | undefined): {
	paths: Set<string>;
	refs: TableStyleImageRef[];
} {
	const paths = new Set<string>();
	const refs: TableStyleImageRef[] = [];
	if (!tableStyleMap) {
		return { paths, refs };
	}

	for (const [styleId, entry] of Object.entries(tableStyleMap)) {
		for (const fillKey of TABLE_STYLE_FILL_KEYS) {
			const fill = entry[fillKey] as ParsedTableStyleFill | undefined;
			const path = fill?.image?.path;
			if (path && !fill?.image?.data && !isExternalUrl(path)) {
				paths.add(path);
				refs.push({ styleId, fillKey, path });
			}
		}
	}
	return { paths, refs };
}

/**
 * Apply resolved table-style image URLs (from
 * {@link collectTableStyleImagePaths} plus a path -> URL map) back onto the
 * table style map, immutably. Returns the same `tableStyleMap` reference when
 * nothing changed, so callers can skip a state update exactly like the other
 * lazy-image patch paths do.
 */
export function applyTableStyleImagePatches(
	tableStyleMap: ParsedTableStyleMap,
	resolvedMap: Map<string, string>,
	refs: TableStyleImageRef[],
): ParsedTableStyleMap {
	const patchesByStyleId = new Map<string, Array<{ fillKey: TableStyleFillKey; url: string }>>();
	for (const ref of refs) {
		const url = resolvedMap.get(ref.path);
		if (!url) {
			continue;
		}
		const list = patchesByStyleId.get(ref.styleId) ?? [];
		list.push({ fillKey: ref.fillKey, url });
		patchesByStyleId.set(ref.styleId, list);
	}
	if (patchesByStyleId.size === 0) {
		return tableStyleMap;
	}

	const next: ParsedTableStyleMap = { ...tableStyleMap };
	for (const [styleId, patches] of patchesByStyleId) {
		const entry = next[styleId];
		if (!entry) {
			continue;
		}
		const patchedEntry: ParsedTableStyleEntry = { ...entry };
		for (const { fillKey, url } of patches) {
			const fill = patchedEntry[fillKey] as ParsedTableStyleFill | undefined;
			if (!fill?.image) {
				continue;
			}
			patchedEntry[fillKey] = { ...fill, image: { ...fill.image, data: url } };
		}
		next[styleId] = patchedEntry;
	}
	return next;
}
