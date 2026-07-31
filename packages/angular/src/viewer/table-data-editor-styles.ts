/**
 * table-data-editor-styles.ts: CSS string for the inspector's table data editor.
 *
 * Extracted from `table-data-editor.component.ts` for the same reason as
 * `chart-editor-styles.ts`: an inline `styles` block pushed that component well
 * past the repo's 300 LOC ceiling, and the styling is presentation-only, so it
 * reads better as its own module than as 120 lines wedged between the template
 * and the class.
 *
 * @module angular-viewer/table-data-editor-styles
 */

/** Styles for the inspector table data editor grid. */
export const TABLE_DATA_EDITOR_STYLES = `
		.pptx-tbl-editor {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			padding: 0.5rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-tbl-editor__header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.35rem;
		}

		.pptx-tbl-editor__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0;
		}

		.pptx-tbl-editor__actions {
			display: flex;
			gap: 0.2rem;
			flex-wrap: wrap;
		}

		.pptx-tbl-editor__btn {
			padding: 2px 5px;
			font-size: 10px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			white-space: nowrap;
		}

		.pptx-tbl-editor__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-tbl-editor__btn--danger {
			color: var(--pptx-inspector-danger, #f47c7c);
			border-color: var(--pptx-inspector-danger-border, #6b2a2a);
		}

		.pptx-tbl-editor__scroll {
			overflow-x: auto;
		}

		.pptx-tbl-editor__grid {
			display: flex;
			flex-direction: column;
			font-size: 11px;
			min-width: 100%;
			width: max-content;
		}

		.pptx-tbl-editor__row {
			display: flex;
		}

		.pptx-tbl-editor__corner,
		.pptx-tbl-editor__col-header,
		.pptx-tbl-editor__row-header {
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: var(--pptx-inspector-muted, #888);
			font-weight: 400;
			padding: 2px 4px;
			border: 1px solid var(--pptx-inspector-border, #333);
			margin: -0.5px;
			white-space: nowrap;
		}

		.pptx-tbl-editor__col-header {
			flex: 1 0 60px;
		}

		.pptx-tbl-editor__corner,
		.pptx-tbl-editor__row-header {
			flex: 0 0 40px;
		}

		.pptx-tbl-editor__col-label,
		.pptx-tbl-editor__row-label {
			margin-right: 2px;
		}

		.pptx-tbl-editor__remove-btn {
			padding: 0 2px;
			font-size: 11px;
			line-height: 1;
			background: none;
			border: none;
			color: var(--pptx-inspector-danger, #f47c7c);
			cursor: pointer;
		}

		.pptx-tbl-editor__cell {
			display: flex;
			flex: 1 0 60px;
			padding: 1px;
			border: 1px solid var(--pptx-inspector-border, #333);
			margin: -0.5px;
		}

		.pptx-tbl-editor__input {
			width: 100%;
			box-sizing: border-box;
			padding: 2px 4px;
			font-size: 11px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			border: none;
			outline: none;
		}

		.pptx-tbl-editor__input:focus {
			background: var(--pptx-inspector-active-bg, #1a3a5c);
		}

		.pptx-tbl-editor__input:disabled {
			opacity: 0.6;
		}
`;
