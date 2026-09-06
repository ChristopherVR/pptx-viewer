/**
 * chart-bar3d-face-picture-sample.ts: async first-pixel colour sampling for a
 * `bar3D` chart's untargeted extrusion face picture fallback (C2-G9
 * face-targeting gap, see `chart-bar3d-face-picture.ts`'s module doc for the
 * COM-verified ground truth this exists to reproduce).
 *
 * PowerPoint paints an untargeted face (a `c:pictureOptions` picture exists
 * but `c:applyToSides`/`c:applyToEnd` do not target it) with a FLAT colour
 * sampled from the picture's own top-left pixel (COM-verified: two
 * independent `Series.ApplyPictToFront/Sides/End` test decks both matched the
 * image's pixel at (0,0), not an average or the centre pixel). The shared SVG
 * view-model builder that decides this fill is synchronous and never has
 * decoded pixel data, so this module decodes the picture ASYNCHRONOUSLY,
 * caches the sampled colour by image URL (a `c:pictureOptions` data URL is
 * content-addressed: identical pictures share one decode), and exposes a
 * subscribe hook so a binding can re-render once a sample lands.
 *
 * Usage from a binding: call {@link getCachedBarFacePicturePixelColor}
 * synchronously while building the view model (used internally by
 * `resolveExtrusionFaceFill`); subscribe once per mounted chart view via
 * {@link subscribeBarFacePicturePixelSamples} and rebuild the view model
 * (or otherwise force a re-render) whenever it fires, mirroring how
 * `ColorChangedImage`/`use-color-change-image.ts` already re-render once
 * `applyColorChange` (`image-color-change.ts`) resolves.
 *
 * @module chart-bar3d-face-picture-sample
 */

/** Decodes an image URL (typically a `data:` URL) and resolves its sampled colour, or `undefined` when it cannot be decoded. */
export type BarFacePictureSampler = (imageUrl: string) => Promise<string | undefined>;

const sampleCache = new Map<string, string | undefined>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
/** Bumped every time a sample resolves; a cheap primitive snapshot for `useSyncExternalStore`-style hooks (see {@link getBarFacePicturePixelSampleVersion}). */
let sampleVersion = 0;

/**
 * Synchronously read a previously-resolved sample. `undefined` means either
 * "not sampled yet" (call {@link ensureBarFacePicturePixelSampled} to start)
 * or "sampled, but no colour could be decoded" (e.g. no DOM); the caller
 * cannot tell these apart and does not need to, since both keep using the
 * pre-existing resolved point/series colour fallback.
 */
export function getCachedBarFacePicturePixelColor(imageUrl: string): string | undefined {
	return sampleCache.get(imageUrl);
}

/**
 * Subscribe to every sample that resolves (successfully or not). Fires once
 * per {@link ensureBarFacePicturePixelSampled} call that was not already
 * cached/in-flight. A binding calls this once per mounted chart and forces a
 * view-model rebuild in the listener; it does not need to filter by image
 * URL, since a rebuild the sample did not affect is a cheap no-op diff.
 */
export function subscribeBarFacePicturePixelSamples(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function notifyBarFacePicturePixelListeners(): void {
	sampleVersion += 1;
	for (const listener of listeners) {
		listener();
	}
}

/**
 * A monotonically increasing counter, bumped once per resolved sample.
 * Framework `useSyncExternalStore`-style hooks (React) use this as the
 * snapshot value paired with {@link subscribeBarFacePicturePixelSamples}: a
 * plain number compares cheaply with `Object.is`, unlike re-deriving a
 * snapshot object on every call.
 */
export function getBarFacePicturePixelSampleVersion(): number {
	return sampleVersion;
}

/** Format one 0-255 channel as a 2-digit hex pair. */
function hexChannel(value: number): string {
	return Math.max(0, Math.min(255, Math.round(value)))
		.toString(16)
		.padStart(2, '0');
}

/**
 * Decode `imageUrl` via the browser's `Image` + `<canvas>` pipeline and read
 * the pixel at (0,0) - PowerPoint's own sample point (see this module's doc
 * comment). Resolves to `undefined` outside a DOM (SSR, headless vitest) or
 * on any decode failure; the caller's fallback (the resolved point/series
 * colour) is never worse than what shipped before this module existed.
 *
 * Drawing with an explicit 1x1 SOURCE rect (not a full-image draw scaled down
 * to a 1x1 canvas) is load-bearing: scaling the whole image down would let
 * the browser box-filter/average pixels, which is exactly the "solid
 * majority colour" reading COM ground truth already ruled out (a 16x16
 * mostly-red image with one green corner pixel painted the untargeted face
 * solid GREEN, not red).
 *
 * Resolves to a `#rrggbb` HEX string, matching every other colour this
 * renderer passes through `tint`/`shade` (`chart-palette.ts`'s `hexToRgb`
 * only parses hex, not `rgb(...)`).
 */
export function decodeFirstPixelColor(imageUrl: string): Promise<string | undefined> {
	if (typeof Image === 'undefined' || typeof document === 'undefined') {
		return Promise.resolve(undefined);
	}
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = 1;
				canvas.height = 1;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve(undefined);
					return;
				}
				ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
				const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
				resolve(a === 0 ? undefined : `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`);
			} catch {
				// A tainted canvas (cross-origin picture with no CORS headers) or any
				// other decode failure: keep the caller's existing fallback.
				resolve(undefined);
			}
		};
		img.onerror = () => resolve(undefined);
		img.src = imageUrl;
	});
}

/**
 * Kick off sampling `imageUrl` if it is not already cached or in flight.
 * Fire-and-forget: never throws, never returns the sample itself (read it
 * back via {@link getCachedBarFacePicturePixelColor} once
 * {@link subscribeBarFacePicturePixelSamples} fires). Safe to call on every
 * view-model build; a cached/in-flight URL is a single `Map` lookup.
 */
export function ensureBarFacePicturePixelSampled(
	imageUrl: string,
	sampler: BarFacePictureSampler = decodeFirstPixelColor,
): void {
	if (sampleCache.has(imageUrl) || inFlight.has(imageUrl)) {
		return;
	}
	const pending = sampler(imageUrl)
		.then((color) => {
			sampleCache.set(imageUrl, color);
			return undefined;
		})
		.catch(() => {
			sampleCache.set(imageUrl, undefined);
		})
		.finally(() => {
			inFlight.delete(imageUrl);
			notifyBarFacePicturePixelListeners();
		});
	inFlight.set(imageUrl, pending);
}

/** Test-only: reset every module-level cache/subscription between specs. */
export function resetBarFacePicturePixelCacheForTests(): void {
	sampleCache.clear();
	inFlight.clear();
	listeners.clear();
	sampleVersion = 0;
}
