import { AUTO_HIDE_DELAY_MS } from 'pptx-viewer-shared';
import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * useToolbarAutoHide: mouse-idle visibility for the floating presentation
 * toolbar.
 *
 * Vue port of the auto-hide half of React's `usePresentationAnnotations`
 * (`toolbarVisible` state): the toolbar starts hidden, becomes visible on any
 * `mousemove`, and hides again after `AUTO_HIDE_DELAY_MS` of no further
 * movement. Real touch interactions do not dispatch `mousemove`, so on a
 * touch-only device the toolbar simply never appears, which matters: the
 * bar sits directly over `PresentationTouchControls`' fixed prev/next
 * buttons, and without gating `pointer-events` off while hidden it silently
 * swallows taps meant for those buttons.
 *
 * The host is expected to bind both `opacity` and `pointer-events` to
 * `toolbarVisible` (not just `opacity`), exactly like React's wrapping div in
 * `ViewerCanvasArea.tsx`.
 */
export interface UseToolbarAutoHideResult {
	/** Whether the toolbar should currently be shown (and clickable). */
	toolbarVisible: Readonly<Ref<boolean>>;
	/**
	 * Show or hide the toolbar explicitly, for PowerPoint's Ctrl+H. Any later
	 * mouse movement resumes the normal auto-hide cycle.
	 */
	setToolbarVisible: (visible: boolean) => void;
}

export interface UseToolbarAutoHideOptions {
	/**
	 * File > Options > Advanced > "Show popup toolbar" (default true). When
	 * `false`, `mousemove` never auto-reveals the bar; `setToolbarVisible`
	 * (PowerPoint's Ctrl+H) still works, matching React's `popupToolbarEnabled`.
	 */
	enabled?: () => boolean;
}

export function useToolbarAutoHide(options?: UseToolbarAutoHideOptions): UseToolbarAutoHideResult {
	const toolbarVisible = ref(false);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function clearHideTimer(): void {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	function handleMouseMove(): void {
		if (options?.enabled?.() === false) {
			return;
		}
		toolbarVisible.value = true;
		clearHideTimer();
		hideTimer = setTimeout(() => {
			toolbarVisible.value = false;
		}, AUTO_HIDE_DELAY_MS);
	}

	onMounted(() => {
		window.addEventListener('mousemove', handleMouseMove);
	});

	onBeforeUnmount(() => {
		window.removeEventListener('mousemove', handleMouseMove);
		clearHideTimer();
	});

	function setToolbarVisible(visible: boolean): void {
		clearHideTimer();
		toolbarVisible.value = visible;
	}

	return { toolbarVisible: readonly(toolbarVisible), setToolbarVisible };
}
