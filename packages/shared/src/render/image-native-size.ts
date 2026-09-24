/**
 * A picture's native (unscaled) pixel dimensions, probed once per source and
 * cached, for CSS math that must be relative to the image's OWN size rather
 * than the box that paints it.
 *
 * `a:tile/@sx`/`@sy` (ECMA-376 §20.1.8.58) is one such consumer: it is a
 * percentage of the picture's native pixel size, not of the container CSS
 * `background-size: <percent>` resolves against (see `image-tiling.ts`).
 * There is no CSS-only way to express "N% of this image's own intrinsic
 * size" for a `background-image` layer (an `<img>` gets free intrinsic
 * sizing via `width/height: auto`, but a repeating background layer does
 * not), so the number has to come from a real decode.
 *
 * Framework-agnostic (`Image`/browser-only): each binding wraps
 * {@link probeNativeImageSize} in its own reactive primitive (a hook, a
 * `ref` + effect, a signal) to re-render once the async probe resolves,
 * using {@link getCachedNativeImageSize} for the synchronous fast path on
 * every render after the first.
 *
 * @module render/image-native-size
 */

/** A picture's native, unscaled pixel dimensions. */
export interface NativeImageSize {
	width: number;
	height: number;
}

const sizeCache = new Map<string, NativeImageSize>();
const pendingProbes = new Map<string, Promise<NativeImageSize | undefined>>();

/**
 * The cached native size for `src`, if it has already been probed. Always
 * safe to call during render: it never triggers a decode.
 */
export function getCachedNativeImageSize(src: string | undefined): NativeImageSize | undefined {
	return src ? sizeCache.get(src) : undefined;
}

/**
 * Decode `src` far enough to read its intrinsic pixel size, caching the
 * result (and de-duping concurrent callers for the same `src`). Resolves to
 * `undefined` when running outside a browser (`Image` unavailable), the
 * source fails to load, or reports a zero size.
 */
export function probeNativeImageSize(src: string): Promise<NativeImageSize | undefined> {
	const cached = sizeCache.get(src);
	if (cached) {
		return Promise.resolve(cached);
	}
	const inflight = pendingProbes.get(src);
	if (inflight) {
		return inflight;
	}

	const probe = new Promise<NativeImageSize | undefined>((resolve) => {
		if (typeof Image === 'undefined') {
			resolve(undefined);
			return;
		}
		const img = new Image();
		img.onload = () => {
			const size: NativeImageSize = { width: img.naturalWidth, height: img.naturalHeight };
			resolve(size.width > 0 && size.height > 0 ? size : undefined);
		};
		img.onerror = () => resolve(undefined);
		img.src = src;
	}).then((size) => {
		pendingProbes.delete(src);
		if (size) {
			sizeCache.set(src, size);
		}
		return size;
	});

	pendingProbes.set(src, probe);
	return probe;
}

/** Test-only: clear the memoised probe cache between test cases. */
export function _resetNativeImageSizeCacheForTests(): void {
	sizeCache.clear();
	pendingProbes.clear();
}
