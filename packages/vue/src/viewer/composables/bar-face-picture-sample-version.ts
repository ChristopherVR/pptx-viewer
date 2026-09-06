/**
 * bar-face-picture-sample-version: a Vue ref that bumps whenever any bar3D
 * face-picture colour sample resolves (`chart-bar3d-face-picture-sample.ts`).
 *
 * `ChartRenderer.vue` reads `.value` inside its `viewModel` `computed`,
 * purely to establish a reactive dependency: the shared sample cache is a
 * plain module-level cache, not a Vue ref, so Vue would otherwise never know
 * to re-derive once a sample lands (an untargeted bar3D extrusion face whose
 * fill is picture-only samples the picture's own colour ASYNCHRONOUSLY - see
 * `resolveUntargetedBarFaceFill`'s doc comment for the COM-verified ground
 * truth this reproduces). Mirrors React's inline `useSyncExternalStore`
 * wiring in `ChartElementView.tsx` and the Svelte rune-class equivalent
 * (`bar-face-picture-sample.svelte.ts`).
 */
import {
	getBarFacePicturePixelSampleVersion,
	subscribeBarFacePicturePixelSamples,
} from 'pptx-viewer-shared';
import type { Ref } from 'vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useBarFacePictureSampleVersion(): Ref<number> {
	const version = ref(getBarFacePicturePixelSampleVersion());
	let unsubscribe: (() => void) | undefined;
	onMounted(() => {
		unsubscribe = subscribeBarFacePicturePixelSamples(() => {
			version.value = getBarFacePicturePixelSampleVersion();
		});
	});
	onBeforeUnmount(() => unsubscribe?.());
	return version;
}
