/**
 * outline-view-overlay.styles.ts: CSS for PowerPoint's Outline view.
 *
 * Lifted out of the component (as `reading-view-overlay.styles.ts` was) so that
 * file stays a template plus its wiring and keeps under this repo's 300-LOC
 * cap. A plain exported const still compiles AOT: ng-packagr statically
 * evaluates the imported string.
 *
 * @module angular-viewer/outline-view-overlay.styles
 */

/**
 * Styles for `pptx-outline-view-overlay`.
 *
 * `position: fixed; inset: 0` fills the browser WINDOW without the Fullscreen
 * API, matching the sibling reading view and slide sorter overlays.
 */
export const OUTLINE_VIEW_OVERLAY_STYLES = `
	.pptx-ng-outline-root {
		position: fixed;
		inset: 0;
		z-index: 1300;
		display: flex;
		flex-direction: column;
		background: #171717;
		color: #f5f5f5;
	}

	.pptx-ng-outline-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.1);
	}

	.pptx-ng-outline-title {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.pptx-ng-outline-hint {
		flex: 1 1 auto;
		overflow: hidden;
		font-size: 0.6875rem;
		color: rgb(255 255 255 / 0.5);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-ng-outline-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		color: rgb(255 255 255 / 0.8);
		background: transparent;
		border: 0;
		border-radius: 0.25rem;
		cursor: pointer;
	}

	.pptx-ng-outline-btn:hover {
		color: #ffffff;
		background: rgb(255 255 255 / 0.15);
	}

	.pptx-ng-outline-rows {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem 1rem;
	}

	.pptx-ng-outline-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.125rem 0;
	}

	.pptx-ng-outline-number {
		width: 1.5rem;
		flex: 0 0 auto;
		font-size: 0.625rem;
		font-variant-numeric: tabular-nums;
		color: rgb(255 255 255 / 0.4);
		text-align: right;
	}

	.pptx-ng-outline-input {
		width: 100%;
		padding: 0.125rem 0.25rem;
		font-size: 0.8125rem;
		color: rgb(255 255 255 / 0.8);
		background: transparent;
		border: 0;
		border-radius: 0.25rem;
		outline: none;
	}

	.pptx-ng-outline-input.is-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f5f5f5;
	}

	.pptx-ng-outline-input:focus {
		background: rgb(255 255 255 / 0.1);
	}
`;
