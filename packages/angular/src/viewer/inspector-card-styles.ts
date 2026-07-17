/**
 * inspector-card-styles.ts: shared component-style string for the default
 * (no-selection) inspector cards, mirroring the React inspector's CARD /
 * HEADING / INPUT / BTN class tokens (inspector-pane-constants.ts) on top of
 * the same `--pptx-inspector-*` CSS variables the element inspector uses.
 *
 * Angular component styles are view-encapsulated, so each card component
 * includes this string via `styles: [INSPECTOR_CARD_STYLES]` instead of
 * relying on another component's scoped classes.
 */
export const INSPECTOR_CARD_STYLES = `
	.icard {
		border: 1px solid var(--pptx-inspector-border, #333);
		border-radius: 4px;
		background: var(--pptx-inspector-card-bg, rgba(0, 0, 0, 0.04));
		padding: 8px;
		display: grid;
		gap: 6px;
		font-size: 11px;
	}
	.icard__heading {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pptx-inspector-muted, #888);
		margin: 0;
	}
	.icard__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.icard__col {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 3px;
	}
	.icard__label {
		color: var(--pptx-inspector-muted, #888);
		flex-shrink: 0;
	}
	.icard__value {
		color: var(--pptx-inspector-muted, #888);
		text-align: right;
	}
	.icard__input,
	.icard__select {
		box-sizing: border-box;
		min-width: 0;
		background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
		border: 1px solid var(--pptx-inspector-border, #444);
		color: inherit;
		border-radius: 3px;
		padding: 3px 5px;
		font-size: 11px;
		font-family: inherit;
	}
	.icard__input--number {
		width: 62px;
		text-align: right;
	}
	.icard__btn {
		flex: 1;
		padding: 3px 6px;
		background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
		border: 1px solid var(--pptx-inspector-border, #444);
		color: inherit;
		border-radius: 3px;
		cursor: pointer;
		font-size: 11px;
		white-space: nowrap;
	}
	.icard__btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.icard__btn--danger {
		flex: 0 0 auto;
		color: var(--pptx-inspector-danger, #d24d4d);
	}
	.icard__grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
`;
