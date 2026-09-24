/**
 * useNativeImageSize: Vue composable that probes a picture's native
 * (unscaled) pixel size, for CSS math that must be relative to the image's
 * OWN size rather than the box painting it (`a:tile/@sx`/`@sy`, ECMA-376
 * §20.1.8.58).
 *
 * The synchronous cache in `pptx-viewer-shared`'s `image-native-size` is read
 * eagerly (instant on a repeat render); an async probe is kicked off on cache
 * miss and the returned ref updates once it resolves.
 */
import type { NativeImageSize } from 'pptx-viewer-shared';
import { getCachedNativeImageSize, probeNativeImageSize } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { ref, watch } from 'vue';

/**
 * @param src - The tile image source, reactive so the probe re-runs when the
 *   underlying picture's source changes.
 * @returns A ref holding the native size once resolved, `undefined` while
 *   pending or on failure.
 */
export function useNativeImageSize(
	src: Ref<string | undefined> | ComputedRef<string | undefined>,
): Ref<NativeImageSize | undefined> {
	const nativeSize = ref<NativeImageSize | undefined>(getCachedNativeImageSize(src.value));

	watch(
		src,
		(current) => {
			if (!current) {
				nativeSize.value = undefined;
				return;
			}
			const cached = getCachedNativeImageSize(current);
			if (cached) {
				nativeSize.value = cached;
				return;
			}
			nativeSize.value = undefined;
			probeNativeImageSize(current)
				.then((size) => {
					if (size && src.value === current) {
						nativeSize.value = size;
					}
					return undefined;
				})
				.catch(() => {
					// Keep the container-relative fallback already in use.
				});
		},
		{ immediate: true },
	);

	return nativeSize as Ref<NativeImageSize | undefined>;
}
