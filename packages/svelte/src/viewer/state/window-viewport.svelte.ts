/**
 * useWindowViewport: reactive BROWSER viewport width/height for the
 * dense-panel responsive decision functions in `pptx-viewer-shared`
 * (`render/responsive/*`), consumed by the chart/table data grids, the
 * animation panel, and ShareDialog.
 *
 * Mirrors React's `useIsMobile().viewportWidth/viewportHeight`: always the
 * window's own size, never a container/canvas box, so a viewer embedded in a
 * narrow sidebar still gets its normal desktop layout. Call this once at the
 * top of a component's `<script>`; the returned object tracks `resize` for
 * the lifetime of that component via `$effect`.
 */
export interface WindowViewport {
	readonly width: number;
	readonly height: number;
}

export function useWindowViewport(): WindowViewport {
	let width = $state(typeof window === 'undefined' ? 1024 : window.innerWidth);
	let height = $state(typeof window === 'undefined' ? 768 : window.innerHeight);

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const onResize = (): void => {
			width = window.innerWidth;
			height = window.innerHeight;
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	return {
		get width() {
			return width;
		},
		get height() {
			return height;
		},
	};
}
