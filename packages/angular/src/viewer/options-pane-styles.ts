/**
 * options-pane-styles.ts: component-style string for `OptionsPaneComponent`
 * (the generic, schema-driven File > Options pane). Split out of
 * `options-pane.component.ts` to keep that file under the repo's 300 LOC
 * limit, following the same pattern as `inspector-card-styles.ts`.
 */
export const OPTIONS_PANE_STYLES = `
	.pptx-ng-options-pane {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.pptx-ng-options-headline {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
	}
	.pptx-ng-options-section h3 {
		margin: 0 0 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--pptx-border);
		color: var(--pptx-muted-foreground);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.pptx-ng-options-note {
		margin: 2px 0 6px;
		color: var(--pptx-muted-foreground);
		font-size: 11px;
	}
	.pptx-ng-options-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 5px 0;
		font-size: 13px;
	}
	.pptx-ng-options-row.is-indented {
		padding-left: 22px;
	}
	/* Toggle rows render as a <label> (see the template) so the whole
	   row, not just the checkbox glyph, is the click/touch target. */
	label.pptx-ng-options-row {
		cursor: pointer;
	}
	.pptx-ng-options-info {
		margin-left: 4px;
		color: var(--pptx-primary);
		cursor: help;
	}
	.pptx-ng-options-check {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		accent-color: var(--pptx-primary);
	}
	.pptx-ng-options-select,
	.pptx-ng-options-text,
	.pptx-ng-options-number input {
		max-width: 55%;
		padding: 3px 6px;
		border: 1px solid var(--pptx-border);
		border-radius: 4px;
		background: var(--pptx-background);
		color: var(--pptx-foreground);
		font-size: 12px;
	}
	.pptx-ng-options-number {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.pptx-ng-options-number input {
		width: 72px;
		text-align: right;
	}
	.pptx-ng-options-text {
		width: 180px;
	}
	.pptx-ng-options-btn {
		padding: 5px 12px;
		border: 1px solid var(--pptx-border);
		border-radius: 4px;
		background: transparent;
		color: var(--pptx-foreground);
		font-size: 12px;
		cursor: pointer;
	}
	.pptx-ng-options-btn:hover {
		background: var(--pptx-accent);
	}

	/*
	 * Touch target at narrow widths (as narrow as 360px), matching
	 * MIN_TOUCH_TARGET_PX (44) from pptx-viewer-shared's
	 * render/responsive module. This is the generic schema-driven
	 * control renderer for every File > Options tab (per CLAUDE.md Rule
	 * 2, fixed once here rather than per tab).
	 */
	@media (pointer: coarse), (max-width: 767px) {
		.pptx-ng-options-row {
			min-height: 44px;
			flex-wrap: wrap;
		}

		.pptx-ng-options-select,
		.pptx-ng-options-text,
		.pptx-ng-options-number input {
			min-height: 44px;
			font-size: 16px; /* prevents iOS auto-zoom on focus */
			max-width: 100%;
		}

		.pptx-ng-options-check {
			width: 22px;
			height: 22px;
		}

		.pptx-ng-options-btn {
			min-height: 44px;
			padding: 8px 14px;
		}
	}
`;
