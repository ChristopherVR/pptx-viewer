/**
 * @fileoverview "Has the Slide Master view actually edited this part?" cache.
 *
 * Masters and layouts round-trip as verbatim passthrough: the parsed
 * XmlObject is flushed back unchanged, so every unmodelled attribute survives.
 * Rewriting a master's `p:spTree` from the typed element list is therefore a
 * fidelity downgrade, and every binding hands the whole `slideMasters` array
 * to `save()` on every save, edited or not.
 *
 * So the loader records a signature of each part's parsed elements, and the
 * save writer rewrites the shape tree only when the incoming elements no
 * longer match it. An untouched deck keeps its byte-stable passthrough.
 *
 * Keys that carry payload rather than structure (`rawXml`, resolved media
 * sources) are dropped: they are large, they are not what the editor mutates,
 * and `rawXml` holds the parsed node the signature is meant to describe.
 */
import type { PptxElement } from '../../types';

const signaturesByRuntime = new WeakMap<object, Map<string, string>>();

const SIGNATURE_SKIP_KEYS: ReadonlySet<string> = new Set([
	'rawXml',
	'src',
	'imageData',
	'embeddedData',
	'posterSrc',
	'thumbnailSrc',
]);

/**
 * Structural signature of one part's element list. Returns `''` when the tree
 * cannot be serialised, which makes an unedited part compare equal to itself
 * and keeps the verbatim passthrough.
 */
export function masterPartElementSignature(elements: PptxElement[] | undefined): string {
	if (elements === undefined) {
		return '';
	}
	try {
		return JSON.stringify(elements, (key, value: unknown) =>
			SIGNATURE_SKIP_KEYS.has(key) ? undefined : value,
		);
	} catch {
		return '';
	}
}

export function rememberMasterPartElementSignature(
	runtime: object,
	partPath: string,
	elements: PptxElement[] | undefined,
): void {
	let byPart = signaturesByRuntime.get(runtime);
	if (!byPart) {
		byPart = new Map();
		signaturesByRuntime.set(runtime, byPart);
	}
	byPart.set(partPath, masterPartElementSignature(elements));
}

/**
 * True when `elements` differs from what the loader parsed out of `partPath`.
 * An unknown part counts as edited: the caller supplied elements we never
 * parsed, so there is no passthrough worth protecting.
 */
export function masterPartElementsChanged(
	runtime: object,
	partPath: string,
	elements: PptxElement[] | undefined,
): boolean {
	if (elements === undefined) {
		return false;
	}
	const loaded = signaturesByRuntime.get(runtime)?.get(partPath);
	if (loaded === undefined) {
		return true;
	}
	return loaded !== masterPartElementSignature(elements);
}
