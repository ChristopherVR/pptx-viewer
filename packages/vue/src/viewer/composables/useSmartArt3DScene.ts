/**
 * useSmartArt3DScene: Vue composable that drives the shared vanilla-three
 * `mountSmartArt3D` controller for `SmartArt3DRenderer.vue`'s interactive
 * WebGL view, keeping that SFC's `<script setup>` focused on layout/palette
 * derivation and inline node editing.
 *
 * `three` is an optional peer dependency, only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle
 * when the consumer does not install it. Mirrors the chart-3D scene
 * composables' fallback shape (`useBarChart3dScene` et al.), but SmartArt3D
 * has no chart-part selection to bridge and does not remount on every model
 * change: it mounts once and relies on `resize`/`setTextStyle` for updates.
 */
import type { SmartArt3DModel, TextStyleAnimationDescriptor } from 'pptx-viewer-shared';
import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Reactive inputs to {@link useSmartArt3DScene}. */
export interface UseSmartArt3DSceneOptions {
	/** The canvas the scene renders into; populated once the fallback clears. */
	canvas: Ref<HTMLCanvasElement | null>;
	/** The pure 3D model to mount, or null when the diagram has no geometry. */
	model: () => SmartArt3DModel | null;
	width: () => number;
	height: () => number;
	/** Active font-style emphasis override for every node's caption. */
	textStyle?: Ref<TextStyleAnimationDescriptor | undefined>;
}

/** Result of {@link useSmartArt3DScene}. */
export interface UseSmartArt3DSceneResult {
	/** `true` once we know the 3D scene cannot run; render the SVG fallback. */
	useFallback: Ref<boolean>;
}

/**
 * Mount and manage the shared 3D scene for a SmartArt element. See module doc.
 */
export function useSmartArt3DScene(opts: UseSmartArt3DSceneOptions): UseSmartArt3DSceneResult {
	const { canvas, model, width, height, textStyle } = opts;
	const useFallback = ref(true);
	let handle: SmartArt3DHandle | null = null;

	async function mountScene(): Promise<void> {
		const m = model();
		if (!m || m.meshes.length === 0) {
			useFallback.value = true;
			return;
		}
		try {
			const { mountSmartArt3D } = await import('pptx-viewer-shared/smartart-3d');
			useFallback.value = false;
			// Wait for the canvas (v-else branch) to render now that fallback is off.
			await nextTick();
			const canvasEl = canvas.value;
			if (!canvasEl) {
				useFallback.value = true;
				return;
			}
			handle = mountSmartArt3D(canvasEl, m, width(), height(), {
				textStyle: textStyle?.value,
			});
		} catch {
			useFallback.value = true;
		}
	}

	onMounted(mountScene);

	watch(
		() => [width(), height()] as const,
		([w, h]) => handle?.resize(w, h),
	);

	// Re-apply the text-style emphasis override whenever it changes (e.g. an
	// animation effect starting/ending mid-presentation); `setTextStyle` is a
	// no-op when the scene has not mounted yet, matching every other 3D-scene
	// text-style watcher in this binding.
	if (textStyle) {
		watch(textStyle, (nextTextStyle) => handle?.setTextStyle(nextTextStyle));
	}

	onBeforeUnmount(() => {
		handle?.dispose();
		handle = null;
	});

	return { useFallback };
}
