/**
 * useColorChangeImage: Vue composable that applies the PowerPoint
 * `<a:clrChange>` colour-replacement (chroma-key) effect to an image.
 *
 * Processing is asynchronous and runs on an offscreen canvas via the shared,
 * framework-agnostic `applyColorChange`. The original `src` is returned while
 * the canvas work completes (or if it fails / the DOM is unavailable), then the
 * processed data-URL replaces it. Results go through the shared cache so a
 * repeated image + effect combo resolves instantly.
 *
 * The view-layer logic in ElementImageBox.vue stays thin: it consumes the
 * `displaySrc` ref and renders a plain `<img>`.
 */
import type { PptxImageEffects } from 'pptx-viewer-core';
import {
	applyColorChange,
	buildCacheKey,
	DEFAULT_COLOR_CHANGE_TOLERANCE,
	getCachedResult,
	setCachedResult,
} from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref, watch } from 'vue';

/** Parsed `clrChange` effect, as carried on `PptxImageEffects`. */
export type ClrChangeEffect = NonNullable<PptxImageEffects['clrChange']>;

/** Reactive inputs accepted by {@link useColorChangeImage}. */
export interface UseColorChangeImageOptions {
	/** Original image source (data-URL or blob URL); may be `undefined`. */
	src: Ref<string | undefined> | ComputedRef<string | undefined>;
	/** The parsed clrChange effect, or `undefined` when the effect is absent. */
	clrChange: Ref<ClrChangeEffect | undefined> | ComputedRef<ClrChangeEffect | undefined>;
	/** Optional tolerance override (0-100); falls back to the shared default. */
	tolerancePct?: Ref<number | undefined> | ComputedRef<number | undefined>;
}

/** Whether a canvas-backed colour change can run in this environment (SSR-safe). */
function canProcess(): boolean {
	return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';
}

/**
 * Compute the recoloured image source for a clrChange effect.
 *
 * @returns `displaySrc` - the processed data-URL once ready, otherwise the
 *   original `src` (so the image is always visible during/after processing).
 */
export function useColorChangeImage(options: UseColorChangeImageOptions): {
	displaySrc: ComputedRef<string | undefined>;
} {
	const { src, clrChange, tolerancePct } = options;

	// The processed data-URL, or null while we fall back to the original src.
	const processed = ref<string | null>(null);
	// Cancels the most recent in-flight processing; re-set on every watch run.
	let cancelInFlight: (() => void) | null = null;

	const cacheKey = computed<string | null>(() => {
		const source = src.value;
		const effect = clrChange.value;
		if (!source || !effect || !effect.clrFrom) {
			return null;
		}
		const tolerance = tolerancePct?.value ?? DEFAULT_COLOR_CHANGE_TOLERANCE;
		return buildCacheKey(
			source,
			effect.clrFrom,
			effect.clrTo,
			tolerance,
			Boolean(effect.clrToTransparent),
		);
	});

	watch(
		cacheKey,
		(key) => {
			// Cancel any still-pending work from the previous key before starting.
			cancelInFlight?.();
			cancelInFlight = null;
			processed.value = null;
			if (!key) {
				return;
			}

			// Cache hit: swap in immediately, no canvas work.
			const cached = getCachedResult(key);
			if (cached) {
				processed.value = cached;
				return;
			}

			// No DOM/canvas (SSR or test without a real canvas): keep the original.
			if (!canProcess()) {
				return;
			}

			const source = src.value;
			const effect = clrChange.value;
			if (!source || !effect) {
				return;
			}
			const tolerance = tolerancePct?.value ?? DEFAULT_COLOR_CHANGE_TOLERANCE;

			let cancelled = false;
			cancelInFlight = () => {
				cancelled = true;
			};

			applyColorChange(
				source,
				effect.clrFrom,
				effect.clrTo,
				tolerance,
				Boolean(effect.clrToTransparent),
			)
				.then((result) => {
					if (!cancelled) {
						setCachedResult(key, result.dataUrl);
						processed.value = result.dataUrl;
					}
					return undefined;
				})
				.catch(() => {
					// On failure, fall back to the original image (processed stays null).
				});
		},
		{ immediate: true },
	);

	const displaySrc = computed<string | undefined>(() => processed.value ?? src.value);

	return { displaySrc };
}
