/**
 * @fileoverview "Did the user actually pick a new background?" cache.
 *
 * `PptxSlideMaster.backgroundColor` and friends are *resolved render values*,
 * not authored ones. A default PowerPoint master carries
 * `<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>`: a
 * pointer into the theme's `a:bgFillStyleLst`, which the loader flattens to a
 * hex so something can be painted. Every binding then hands the whole
 * `slideMasters` array back to `save()` on every save, edited or not, so a
 * writer that treats "colour is defined" as "colour was chosen" rewrites that
 * `p:bgRef` into a literal `p:bgPr` solid fill on the first save of any deck,
 * and the master stops following its theme forever after.
 *
 * So the loader records the colour it produced per part, and the writer only
 * touches `p:bg` when the incoming colour differs from it. This mirrors
 * {@link module:master-part-element-signature}, which protects the shape tree
 * the same way and for the same reason.
 */

const backgroundsByRuntime = new WeakMap<object, Map<string, string>>();

/** Case- and `#`-insensitive comparison key for a background colour. */
function backgroundKey(color: string | undefined): string {
	return color === undefined ? '' : color.trim().replace(/^#/, '').toUpperCase();
}

/** Record the background colour the loader resolved for one template part. */
export function rememberMasterPartBackground(
	runtime: object,
	partPath: string,
	backgroundColor: string | undefined,
): void {
	let byPart = backgroundsByRuntime.get(runtime);
	if (!byPart) {
		byPart = new Map();
		backgroundsByRuntime.set(runtime, byPart);
	}
	byPart.set(partPath, backgroundKey(backgroundColor));
}

/**
 * The background colour the loader resolved for `partPath`, normalised, or
 * `undefined` when the part was never recorded. `''` means the part carried no
 * `<p:bg>` (or none we could resolve), which is distinct from "no record":
 * an unrecorded part has no authored `p:bg` worth protecting, so the writer
 * takes the caller's colour at face value.
 */
export function masterPartLoadedBackground(runtime: object, partPath: string): string | undefined {
	return backgroundsByRuntime.get(runtime)?.get(partPath);
}

/**
 * True when this part's model carries a background colour that differs from
 * the loaded one, i.e. when rewriting the part is worth doing at all. Lets a
 * writer skip re-serializing a part nobody edited.
 */
export function masterPartBackgroundEdited(
	runtime: object,
	part: { path: string; backgroundColor?: string | undefined },
): boolean {
	if (part.backgroundColor === undefined) {
		return false;
	}
	const loaded = masterPartLoadedBackground(runtime, part.path);
	return loaded === undefined || loaded !== backgroundKey(part.backgroundColor);
}
