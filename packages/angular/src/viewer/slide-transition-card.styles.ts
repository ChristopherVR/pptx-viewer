/**
 * `slide-transition-card.styles`: the SLIDE TRANSITION card's own CSS, split
 * out of `slide-transition-card.component.ts` to keep that file within the
 * repo's per-file LOC budget. `INSPECTOR_CARD_STYLES` (shared layout classes)
 * is applied alongside this in the component's `styles` array.
 *
 * @module viewer/slide-transition-card.styles
 */
export const SLIDE_TRANSITION_CARD_STYLES = `
	:host {
		display: block;
	}
	.orient {
		display: flex;
		gap: 4px;
	}
	.orient__btn {
		padding: 3px 8px;
		background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
		border: 1px solid var(--pptx-inspector-border, #444);
		border-radius: 3px;
		color: inherit;
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.orient__btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.orient__btn.is-active {
		background: var(--pptx-inspector-active, #0078d4);
		border-color: var(--pptx-inspector-active, #0078d4);
		color: #fff;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.sound {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
