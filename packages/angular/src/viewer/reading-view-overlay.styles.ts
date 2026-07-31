/**
 * reading-view-overlay.styles.ts: CSS for PowerPoint's Reading View.
 *
 * Lifted out of the component (as `editor-context-menu.styles.ts` was) so that
 * file stays a template plus its wiring and keeps under this repo's 300-LOC
 * cap. A plain exported const still compiles AOT: ng-packagr statically
 * evaluates the imported string.
 *
 * @module angular-viewer/reading-view-overlay.styles
 */

/**
 * Styles for `pptx-reading-view-overlay`.
 *
 * `position: fixed; inset: 0` is the whole point: Reading View fills the
 * browser WINDOW without the Fullscreen API, which is what separates it from
 * the slide show.
 */
export const READING_VIEW_OVERLAY_STYLES = `
	.pptx-ng-reading-root {
		position: fixed;
		inset: 0;
		z-index: 1300;
		display: flex;
		flex-direction: column;
		background: #171717;
	}

	.pptx-ng-reading-viewport {
		display: flex;
		flex: 1 1 0%;
		min-height: 0;
		align-items: center;
		justify-content: center;
	}

	.pptx-ng-reading-stage {
		position: relative;
		overflow: hidden;
	}

	/*
	 * SlideCanvasComponent centres its stage with a 1rem gutter, which would push
	 * the slide out of the box measured by readingViewFitScale. The sorter
	 * overlay strips the same margin for the same reason.
	 */
	.pptx-ng-reading-stage ::ng-deep .pptx-ng-canvas-wrapper {
		margin: 0 !important;
	}

	.pptx-ng-reading-nav {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.pptx-ng-reading-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.pptx-ng-reading-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.pptx-ng-reading-btn:disabled {
		cursor: default;
		opacity: 0.3;
	}

	.pptx-ng-reading-counter {
		min-width: 4rem;
		text-align: center;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: rgba(255, 255, 255, 0.7);
	}
`;
