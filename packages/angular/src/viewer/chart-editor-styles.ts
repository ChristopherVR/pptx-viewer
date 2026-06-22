/**
 * chart-editor-styles.ts: Shared CSS string for the advanced chart-editor
 * inspector control components. Each control component reuses the same
 * `pptx-chart-card` look (heading, rows, inputs, swatches) so the panel reads
 * as one cohesive section. Kept as a single exported template-literal so the
 * styling lives in one place rather than being copy-pasted per component.
 *
 * @module angular-viewer/chart-editor-styles
 */

/** Shared styles for all chart-editor control components. */
export const CHART_EDITOR_STYLES = `
	.pptx-chart-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--pptx-inspector-border, #333);
	}

	.pptx-chart-card__heading {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pptx-inspector-muted, #888);
		margin: 0;
	}

	.pptx-chart-card__group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.pptx-chart-card__group--indent {
		margin-left: 0.5rem;
	}

	.pptx-chart-card__subhead {
		font-size: 11px;
		font-weight: 600;
	}

	.pptx-chart-card__row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 11px;
	}

	.pptx-chart-card__label {
		flex: 0 0 auto;
		width: 5rem;
		color: var(--pptx-inspector-muted, #888);
	}

	.pptx-chart-card__label--wide {
		width: 6.5rem;
	}

	.pptx-chart-card__name {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-chart-card__check {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 11px;
		cursor: pointer;
	}

	.pptx-chart-card__input {
		flex: 1 1 auto;
		min-width: 0;
		box-sizing: border-box;
		padding: 2px 4px;
		font-size: 11px;
		background: var(--pptx-inspector-input-bg, #2d2d2d);
		border: 1px solid var(--pptx-inspector-border, #444);
		border-radius: 3px;
		color: inherit;
		outline: none;
	}

	.pptx-chart-card__input--num {
		flex: 0 0 auto;
		width: 4rem;
		text-align: right;
	}

	.pptx-chart-card__input:focus {
		border-color: var(--pptx-inspector-active, #0078d4);
	}

	.pptx-chart-card__input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.pptx-chart-card__color {
		flex: 0 0 auto;
		width: 26px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--pptx-inspector-border, #444);
		border-radius: 3px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-chart-card__color:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.pptx-chart-card__clear {
		flex: 0 0 auto;
		padding: 0 2px;
		font-size: 12px;
		line-height: 1;
		background: none;
		border: none;
		color: var(--pptx-inspector-muted, #888);
		cursor: pointer;
	}

	.pptx-chart-card__clear:hover {
		color: var(--pptx-inspector-danger, #f47c7c);
	}

	.pptx-chart-card__input--num::-webkit-outer-spin-button,
	.pptx-chart-card__input--num::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
`;
