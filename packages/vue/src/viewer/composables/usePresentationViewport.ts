/**
 * usePresentationViewport: the slideshow overlay's relationship to the window
 * (fit-to-viewport scale, the centring frame box, and real fullscreen).
 *
 * These belong together because they are the same concern seen twice: the
 * Fullscreen API changes the window size, which changes the scale. Absence of
 * the Fullscreen API degrades gracefully to the fixed `inset: 0` overlay, so
 * every call here is defensive rather than feature-detected once.
 */
import type { ComputedRef, CSSProperties, Ref } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import type { CanvasSize } from '../types';

export interface UsePresentationViewportOptions {
	/** The slide's authored pixel size, as a getter so a deck swap re-scales. */
	canvasSize: () => CanvasSize;
	/** The overlay root; the element fullscreen is requested on. */
	overlayRef: Ref<HTMLElement | null>;
	/**
	 * True for an audience display. Browsers reject a fullscreen request that is
	 * not user-initiated, and an audience tab is opened programmatically, so it
	 * retries once on the viewer's first interaction instead of giving up.
	 */
	isAudience: boolean;
}

export interface UsePresentationViewportResult {
	/** Fit-to-viewport scale, preserving aspect ratio. */
	scale: ComputedRef<number>;
	/**
	 * Box sized to the SCALED footprint. The stage itself uses
	 * `transform: scale()` with a `top left` origin, so its laid-out box still
	 * occupies the unscaled dimensions and flexbox cannot centre it without
	 * this wrapper.
	 */
	frameStyle: ComputedRef<CSSProperties>;
}

export function usePresentationViewport(
	options: UsePresentationViewportOptions,
): UsePresentationViewportResult {
	const viewportWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth);
	const viewportHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight);

	const scale = computed(() => {
		const { width, height } = options.canvasSize();
		if (width <= 0 || height <= 0 || viewportWidth.value <= 0 || viewportHeight.value <= 0) {
			return 1;
		}
		return Math.min(viewportWidth.value / width, viewportHeight.value / height);
	});

	const frameStyle = computed<CSSProperties>(() => ({
		width: `${options.canvasSize().width * scale.value}px`,
		height: `${options.canvasSize().height * scale.value}px`,
	}));

	function handleResize(): void {
		viewportWidth.value = window.innerWidth;
		viewportHeight.value = window.innerHeight;
	}

	function requestFullscreen(): void {
		const el = options.overlayRef.value;
		if (!el || typeof el.requestFullscreen !== 'function') {
			return;
		}
		try {
			void el.requestFullscreen().catch(() => {
				/* ignore fullscreen errors */
			});
		} catch {
			/* fullscreen not supported */
		}
	}

	function exitFullscreen(): void {
		if (typeof document === 'undefined') {
			return;
		}
		try {
			if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
				void document.exitFullscreen().catch(() => {
					/* ignore */
				});
			}
		} catch {
			/* fullscreen not supported */
		}
	}

	onMounted(() => {
		window.addEventListener('resize', handleResize);
		handleResize();
		requestFullscreen();
		if (options.isAudience) {
			const requestOnInteraction = (): void => requestFullscreen();
			document.addEventListener('pointerdown', requestOnInteraction, { once: true });
			document.addEventListener('keydown', requestOnInteraction, { once: true });
		}
	});

	onBeforeUnmount(() => {
		window.removeEventListener('resize', handleResize);
		exitFullscreen();
	});

	return { scale, frameStyle };
}
